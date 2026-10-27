/**
 * E2E 运行器：从 3000 起探测端口，直到找到一个可用位置。
 *
 * 三种情况：
 *  - 端口空闲：在该端口启动 frontend 的 next dev（由 playwright.config.ts 的 webServer 负责）。
 *  - 端口已是本项目实例（HTML 含 wanderchain）：直接复用，避免重复启动 dev server。
 *  - 端口被其他进程占用：继续 3001、3002……直到 3010。
 *
 * 结果通过 E2E_PORT / E2E_BASE_URL / E2E_USE_EXISTING 注入 Playwright 配置，
 * 然后把命令行参数原样转交给 @playwright/test。
 */
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const START_PORT = 3000
const END_PORT = 3010
const HOSTS = ['127.0.0.1', '::1']

function canConnect(host, port, timeoutMs = 1_500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    let settled = false

    const finish = (listening) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(listening)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function isListening(port) {
  for (const host of HOSTS) {
    if (await canConnect(host, port)) {
      return true
    }
  }
  return false
}

async function identifyOwner(port) {
  for (const host of ['localhost', '127.0.0.1']) {
    try {
      const response = await fetch(`http://${host}:${port}/`, {
        signal: AbortSignal.timeout(60_000),
      })
      if (!response.ok) {
        continue
      }
      const html = await response.text()
      return html.includes('wanderchain') ? 'ours' : 'foreign'
    } catch {
      // 端口在监听但 HTTP 探测失败：按异己占用处理，继续后移更安全。
    }
  }
  return 'foreign'
}

async function choosePort() {
  for (let port = START_PORT; port <= END_PORT; port += 1) {
    if (!(await isListening(port))) {
      return { port, existing: false }
    }
    const owner = await identifyOwner(port)
    if (owner === 'ours') {
      return { port, existing: true }
    }
    console.warn(`[e2e] port ${port} is used by another process, trying ${port + 1}`)
  }
  throw new Error(`[e2e] no free port between ${START_PORT} and ${END_PORT}`)
}

const { port, existing } = await choosePort()
const baseURL = `http://localhost:${port}`
console.log(`[e2e] using ${baseURL} (${existing ? 'reusing running dev server' : 'starting next dev'})`)

const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js')
const child = spawn(process.execPath, [cli, 'test', ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    E2E_PORT: String(port),
    E2E_BASE_URL: baseURL,
    E2E_USE_EXISTING: existing ? '1' : '0',
  },
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal)
  })
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
