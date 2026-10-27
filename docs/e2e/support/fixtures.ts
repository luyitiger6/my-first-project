import fs from 'node:fs/promises'
import path from 'node:path'

import { test as base, expect } from '@playwright/test'

function slugify(value: string): string {
  const slug = value
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'test'
}

/**
 * 失败即截图：Playwright 自带的 only-on-failure 写进 test-results 的临时目录，
 * 这里再落一份可读文件名的 fullPage 截图（docs/e2e/screenshots/<spec>/<test>.png），
 * 并把文件挂到 HTML 报告上，便于直接定位失败时的页面状态。
 */
export const test = base.extend<{ failureScreenshot: void }>({
  failureScreenshot: [
    async ({ page }, use, testInfo) => {
      await use()

      if (testInfo.status === testInfo.expectedStatus || testInfo.status === 'skipped') {
        return
      }

      const screenshotsRoot = path.join(path.dirname(testInfo.file), 'screenshots')
      const specName = path.basename(testInfo.file, '.spec.ts')
      const targetDir = path.join(screenshotsRoot, specName)
      const targetFile = path.join(targetDir, `${slugify(testInfo.title)}.png`)

      try {
        await fs.mkdir(targetDir, { recursive: true })
        const body = await page.screenshot({ fullPage: true })
        await fs.writeFile(targetFile, body)
        await testInfo.attach('failure screenshot', {
          path: targetFile,
          contentType: 'image/png',
        })
      } catch (cause) {
        // 页面可能已随用例收尾关闭：截图失败不能掩盖原始失败原因。
        console.warn(`[e2e] failed to capture screenshot for "${testInfo.title}": ${String(cause)}`)
      }
    },
    { auto: true },
  ],
})

export { expect }
