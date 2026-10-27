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
        // next dev 不能换成 next start：Mock 认证在 production 下会主动拒绝注册与登录。
        reuseExistingServer: true,
        timeout: 240_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
