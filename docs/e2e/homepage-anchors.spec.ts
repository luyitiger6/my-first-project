import { expect, test } from './support/fixtures'
import { expectAnchorLanded, gotoHome, gotoPath } from './support/helpers'

/**
 * 对应 openspec 能力「锚点落位稳定性」（fix-homepage-anchor-landing）的首页侧场景。
 * 回链场景（从搜索页点 See ... on the homepage）由 search-page.spec.ts 的 S5 覆盖；
 * 这里覆盖直接带锚点访问、用户主动滚动让位、无锚点时不自动滚动。
 */
const ANCHORS = ['#editor-picks', '#hot-posts', '#hot-attractions'] as const

test.describe('首页 · 锚点落位 · 桌面端', () => {
  for (const hash of ANCHORS) {
    test(`直接访问 /${hash} 落在吸顶头部下沿`, async ({ page }) => {
      // WHEN 打开 /#... · THEN 目标区块进入视口、标题可见，顶部偏差 < 10% 视口高
      await gotoPath(page, `/${hash}`)

      const section = page.locator(hash)
      await expect(section).toHaveCount(1)
      await expect(section).toBeInViewport()
      await expect(page.locator(`${hash}-title`)).toBeInViewport()
      await expectAnchorLanded(page, hash)
    })
  }

  test('用户主动滚动后不再把页面拉回锚点', async ({ page }) => {
    // WHEN 落位完成后用户滚走 · THEN 页面不回弹
    await gotoPath(page, '/#hot-posts')
    await expectAnchorLanded(page, '#hot-posts')

    await page.mouse.move(700, 400)
    await page.mouse.wheel(0, -4000)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(4)

    // 负向场景验证「不会发生」，取第二份样本确认滚动位置未被校正回来。
    await page.waitForTimeout(600)
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(4)
  })

  test('无锚点进入首页时不自动滚动', async ({ page }) => {
    // WHEN 不带 hash 打开首页 · THEN scrollY 保持 0，即使区块数据随后撑高页面
    await gotoHome(page)
    await expect(page.locator('#hot-attractions ul > li')).toHaveCount(5)

    await page.waitForTimeout(600)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})
