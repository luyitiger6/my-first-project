import { expect, test } from './support/fixtures'
import { NARROW_VIEWPORT, expectNoHorizontalOverflow, gotoPath } from './support/helpers'

/** 种子里的杭州西湖：8 项事实全齐、核实时间 2026-09-12。 */
const WEST_LAKE = '/attractions/01JQATTR000000000000000011'

const FACT_TERMS = [
  'Tickets',
  'Opening hours',
  'Booking',
  'Payment',
  'Address',
  'Address in Chinese',
  'Getting there',
  'Suggested visit',
]

test.describe('景点详情页 · 桌面端', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPath(page, WEST_LAKE)
  })

  test('S1 · 标题、元信息与核实时间都渲染出来', async ({ page }) => {
    // S1 When 打开已发布景点详情 · Then 唯一 h1 是英文名，元信息为 city · Rating · views
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveText('West Lake')
    await expect(page.getByText('Hangzhou · Rating 4.9 · 16,700 views')).toBeVisible()

    // 核实时间只到月，同时给出机器可读的完整日期。
    const time = page.locator('time')
    await expect(time).toHaveText('Sep 2026')
    await expect(time).toHaveAttribute('datetime', '2026-09-12')
    await expect(page.getByText(/^Checked/)).toContainText('Checked Sep 2026')
  })

  test('S2 · 八项事实按固定顺序渲染，种子每条都有值', async ({ page }) => {
    // S2 When 数据 ready · Then 事实卡按「先能不能去，再怎么去，最后待多久」排八项
    await expect(page.getByRole('heading', { level: 2, name: 'What to know before you go' })).toBeVisible()
    await expect(page.locator('dl dt')).toHaveText(FACT_TERMS)

    const values = page.locator('dl dd')
    await expect(values).toHaveCount(8)
    // 种子数据字段齐备：这一页不该出现占位文案（占位分支由组件单测覆盖）。
    await expect(page.locator('dl')).not.toContainText('Not confirmed yet.')
    await expect(values.nth(0)).toHaveText('Free; boat trips CNY 55.')
    await expect(values.nth(4)).toHaveText('West Lake Scenic Area, Xihu District, Hangzhou')
  })

  test('S3 · 中文地址带英文用途标注', async ({ page }) => {
    // S3 When 展示 addressCn · Then 同一 dd 内附 Show this to a taxi driver.
    const chinese = page.locator('dl dd').nth(5)
    await expect(chinese).toContainText('Show this to a taxi driver.')
    expect(await chinese.innerText()).toMatch(/[\u4e00-\u9fa5]/)
  })

  test('S4 · 主图带 srcset 与 sizes，摘要与正文按内容出现', async ({ page }) => {
    // S4 When coverUrl 存在 · Then 主图是 next/image 产物，两张档位齐全；摘要与 guide 区块紧随其后
    const cover = page.locator('main img').first()
    await expect(cover).toHaveAttribute('alt', 'West Lake cover')
    await expect(cover).toHaveAttribute('srcset', /w=/)
    await expect(cover).toHaveAttribute('sizes', /vw|px/)

    await expect(page.getByText(/The lake, causeways and tea hills/)).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'The guide' })).toBeVisible()
    await expect(page.getByText(/Start at Broken Bridge before 08:00/)).toBeVisible()
  })

  test('S5 · 顶部与底部都有回列表入口，页头页脚在位', async ({ page }) => {
    // S5 When 进入详情 · Then 返回链接指向 /attractions，站点框架不缺失
    await expect(page.getByRole('link', { name: '← Back to all attractions' })).toHaveAttribute(
      'href',
      '/attractions',
    )
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
  })
})

test.describe('景点详情页 · 不可发布与不存在的 publicId', () => {
  test('S6 · 未知 publicId 渲染英文空态并给出回列表入口', async ({ page }) => {
    // S6 When publicId 不在库里 · Then 空态而非错误态、不是白屏
    await gotoPath(page, '/attractions/01JQATTR000000000000000999')

    await expect(page.locator('h1')).toHaveText('Attraction not found')
    await expect(page.locator('#main-content')).toContainText(
      'This attraction is not published, or it has been taken down.',
    )
    await expect(page.getByRole('link', { name: 'Browse all attractions' })).toHaveAttribute(
      'href',
      '/attractions',
    )
    // 404 是可预期结果：不出现错误提示与重试按钮。
    await expect(page.locator('#main-content [role="alert"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Retry/ })).toHaveCount(0)
  })

  test('S7 · 草稿景点（Yu Garden）对外等同不存在', async ({ page }) => {
    // S7 When publicId 指向 draft 种子 · Then 与未发布同权：空态，不泄露字段
    await gotoPath(page, '/attractions/01JQATTR000000000000000013')

    await expect(page.locator('h1')).toHaveText('Attraction not found')
    await expect(page.locator('#main-content')).not.toContainText('A Ming-dynasty garden')
  })
})

test.describe('景点详情页 · 超窄屏 320×667', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test('S8 · 事实卡与空态都不产生横向滚动', async ({ page }) => {
    await gotoPath(page, WEST_LAKE)
    await expect(page.locator('h1')).toHaveText('West Lake')
    await expectNoHorizontalOverflow(page, '320px 景点详情')

    await gotoPath(page, '/attractions/01JQATTR000000000000000999')
    await expect(page.locator('h1')).toHaveText('Attraction not found')
    await expectNoHorizontalOverflow(page, '320px 景点空态')
  })
})
