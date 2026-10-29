import path from 'node:path'

import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3000)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`
const REUSE_EXISTING_SERVER = process.env.E2E_USE_EXISTING === '1'
const BROWSER_CHANNEL = process.env.E2E_CHANNEL ?? 'chrome'

/**
 * E2E 工程放在工作区根：测试文件位于 docs/e2e，依赖因此必须落在根的 node_modules，
 * 不能装进 frontend/ 子模块。
 */
export default defineConfig({
  testDir: path.join(__dirname, 'docs', 'e2e'),
  testMatch: '**/*.spec.ts',
  outputDir: path.join(__dirname, 'docs', 'e2e', 'test-results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // 用户要求：单个测试 30s。
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, 'docs', 'e2e', 'playwright-report'), open: 'never' }],
  ],
  globalSetup: path.join(__dirname, 'docs', 'e2e', 'support', 'global-setup.ts'),
  use: {
    baseURL: BASE_URL,
    // 使用本机 Chrome，避免在 GitHub 不可达时下载 Playwright 浏览器二进制。
    channel: BROWSER_CHANNEL,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  webServer: REUSE_EXISTING_SERVER
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        cwd: path.join(__dirname, 'frontend'),
        url: BASE_URL,
        // 用 next dev 而不是 next start：E2E 不在 harness 的十一道闸门内，dev 配上 reuseExistingServer
        // 能直接复用已经跑着的开发服务，省掉每轮一次生产构建；构建能不能过由 04-frontend 闸门负责。
        reuseExistingServer: true,
        timeout: 240_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
