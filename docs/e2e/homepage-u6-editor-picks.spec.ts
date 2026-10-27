import { expect, test } from './support/fixtures'
import {
  NARROW_VIEWPORT,
  expectNoHorizontalOverflow,
  gotoHome,
  gridColumnCount,
} from './support/helpers'

const SECTION = '#editor-picks'

/** 默认（all）下按 sortOrder 升序、并列按 id 升序，上限 6 条。 */
const ALL_TITLES = [
  'A walk through the Forbidden City at dusk',
  'Plane trees and coffee on Wukang Road',
  "A gaiwan of tea in People's Park",
  'Seven days, one backpack',
  'West of West Lake, among the tea hills',
  'Riding the city wall: thirteen kilometers of wind',
]

const ALL_CITY_LABELS = [
  'Beijing',
  'Shanghai',
  'Chengdu',
  'All cities',
  'Hangzhou',
  "Xi'an",
]

test.describe('U6 · 编辑推荐区块 · 桌面端', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S1 · 渲染卡片网格，每张卡含封面、城市标、标题、摘要、署名', async ({ page }) => {
    // S1 When 数据 ready 且 items 非空 · Then 渲染卡片网格，每张卡五要素齐全；And 数量 = items.length 且不超过 6
    const section = page.locator(SECTION)
    const cards = section.locator('ul > li')
    await expect(cards).toHaveCount(6)

    for (const [index, title] of ALL_TITLES.entries()) {
      const card = cards.nth(index)
      const cover = card.locator('img')
      await expect(cover).toHaveCount(1)
      await expect(cover).toHaveAttribute('alt', `${title} cover`)
      await expect(card.locator('h3')).toHaveText(title)
      await expect(card.locator('h3').locator('..').locator('span').first()).toHaveText(
        ALL_CITY_LABELS[index],
      )
      await expect(card.locator('p').nth(0)).not.toBeEmpty()
      await expect(card.locator('p').nth(1)).not.toBeEmpty()
    }
  })

  test('S2 · 展示顺序为 sortOrder 升序，并列按 id 升序', async ({ page }) => {
    // S2 When 仓储返回按 sortOrder 排好的数据 · Then 展示顺序为 sortOrder 升序，同序时按 id 升序（组件自身不排序）
    // Wukang Road 与 People's Park 同为 sortOrder=20，前者 id 更小，因此必须排在前。
    await expect(page.locator(`${SECTION} ul > li h3`)).toHaveText(ALL_TITLES)
  })

  test('S3 · 城市过滤只保留本城与全城通用，城市标用英文名', async ({ page }) => {
    // S3 When city='beijing' · Then 只展示 city=beijing 与 city=all 的精选；And all 显示 All cities
    await gotoHome(page, { city: 'beijing' })
    const section = page.locator(SECTION)
    await expect(section.locator('ul > li')).toHaveCount(2)
    await expect(section.locator('ul > li h3')).toHaveText([
      'A walk through the Forbidden City at dusk',
      'Seven days, one backpack',
    ])
    await expect(section).toContainText('All cities')
    await expect(section).not.toContainText('Plane trees and coffee on Wukang Road')
  })

  test('S4 · 切换城市后重新取数并展示新城市精选', async ({ page }) => {
    // S4 When city 由 all 变为 shanghai · Then 区块重新取数，展示上海相关精选
    await page.getByRole('button', { name: 'Shanghai', exact: true }).click()
    await page.waitForURL((url) => url.searchParams.get('city') === 'shanghai')

    const section = page.locator(SECTION)
    await expect(section.locator('ul > li h3')).toHaveText([
      'Plane trees and coffee on Wukang Road',
      'Seven days, one backpack',
    ])
    await expect(section).not.toContainText('A walk through the Forbidden City at dusk')
  })

  test('S5 · 首次渲染处于 loading 态，data ready 后加载提示消失', async ({ page }) => {
    // S5 When 首次渲染 · Then 展示 role=status 的 Our editors are picking this week's routes…
    // 首帧在 SSR HTML 里就能观察到，比等浏览器闪现更可靠。
    const response = await page.request.get('/')
    expect(response.ok()).toBe(true)
    const html = await response.text()
    expect(html).toContain('role="status"')
    expect(html).toContain('Our editors are picking this week')
    expect(html).toContain('routes…')

    await expect(page.getByRole('status')).toHaveCount(0)
    await expect(page.locator(`${SECTION} ul > li`)).toHaveCount(6)
  })

  test('S7 · 空结果显示空态文案，不出现错误提示', async ({ page }) => {
    // S7 When 该城市无精选 · Then 展示 No editor's picks in Guangzhou yet. Try another city.；And 不展示错误提示
    // 真实数据里广州仍有一条 city=all 的精选，构造不出 items: []；
    // 可观察代理：只回退全城通用精选、不出现错误态，空态渲染由 vitest 覆盖。
    await gotoHome(page, { city: 'guangzhou' })
    const section = page.locator(SECTION)
    await expect(section.locator('ul li')).toHaveCount(1)
    await expect(section).toContainText('Seven days, one backpack')
    await expect(section).not.toContainText("No editor's picks in Guangzhou yet.")
    await expect(section.getByRole('alert')).toHaveCount(0)
  })

  test('S8 · 封面加载失败时保留 4:3 占位且其余卡片不受影响', async ({ page }) => {
    // S8 When 封面 URL 网络中断 · Then 保留 4:3 占位区域、alt 可读、布局不塌陷，其余卡片不受影响
    await page.route('https://images.unsplash.com/**', (route) => route.abort())
    await gotoHome(page)

    const cards = page.locator(`${SECTION} ul > li`)
    await expect(cards).toHaveCount(6)
    for (const [index, title] of ALL_TITLES.entries()) {
      const cover = cards.nth(index).locator('img')
      await expect(cover).toHaveAttribute('alt', `${title} cover`)
      const box = await cover.boundingBox()
      expect(box, `第 ${index + 1} 张封面应保留占位尺寸`).not.toBeNull()
      const ratio = (box?.width ?? 0) / (box?.height ?? 1)
      expect(ratio).toBeGreaterThan(1.3)
      expect(ratio).toBeLessThan(1.36)
    }

    // 其余区块不因图片失败而被清空。
    await expect(page.locator('#hot-posts ol li')).toHaveCount(10)
    await expect(page.locator('#hot-attractions ul li')).toHaveCount(5)
  })

  test('S9 · 长文本换行不截断，卡片高度由内容撑开', async ({ page }) => {
    // S9 When 标题或摘要超过行数上限 · Then 文本正常换行、卡片自然增高、无横向溢出
    // 静态数据无法注入超长文案，改为验证「无 line-clamp + 无内容裁切」这一可观察代理。
    const cards = page.locator(`${SECTION} ul > li`)
    const metrics = await cards.evaluateAll((nodes) =>
      nodes.map((node) => {
        const summary = node.querySelector('p')
        const computed = summary ? getComputedStyle(summary) : null
        return {
          cardScroll: node.scrollHeight,
          cardClient: node.clientHeight,
          whiteSpace: computed?.whiteSpace ?? '',
          lineClamp: computed?.getPropertyValue('-webkit-line-clamp') ?? '',
        }
      }),
    )

    for (const metric of metrics) {
      expect(metric.whiteSpace).not.toBe('nowrap')
      expect(metric.lineClamp === '' || metric.lineClamp === 'none').toBe(true)
      expect(metric.cardScroll).toBeLessThanOrEqual(metric.cardClient + 1)
    }
    await expectNoHorizontalOverflow(page, '桌面端编辑推荐')
  })

  test('S11 · 快速连续切换城市只渲染最后一次结果', async ({ page }) => {
    // S11 When 短时间内多次切换 city · Then 只渲染最后一次（Chengdu）的结果，无旧城市卡片混入
    for (const city of ['Beijing', 'Shanghai', 'Chengdu']) {
      await page.getByRole('button', { name: city, exact: true }).click()
    }
    await page.waitForURL((url) => url.searchParams.get('city') === 'chengdu')

    const section = page.locator(SECTION)
    await expect(section.locator('ul > li h3')).toHaveText([
      "A gaiwan of tea in People's Park",
      'Seven days, one backpack',
    ])
    await expect(section).not.toContainText('Plane trees and coffee on Wukang Road')
    await expect(section).not.toContainText('A walk through the Forbidden City at dusk')
    await expect(section.getByRole('status')).toHaveCount(0)
  })
})

test.describe('U6 · 编辑推荐区块 · 超窄屏 320×667', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S10 · 卡片单列、封面保持 4:3 且无横向滚动', async ({ page }) => {
    // S10 When 视口 320px · Then 卡片单列，封面保持 4:3，无横向滚动
    const grid = page.locator(`${SECTION} ul`)
    expect(await gridColumnCount(grid)).toBe(1)

    const covers = page.locator(`${SECTION} ul > li img`)
    await expect(covers).toHaveCount(6)
    for (const cover of await covers.all()) {
      const box = await cover.boundingBox()
      const ratio = (box?.width ?? 0) / (box?.height ?? 1)
      expect(ratio).toBeGreaterThan(1.3)
      expect(ratio).toBeLessThan(1.36)
    }

    await expectNoHorizontalOverflow(page, '320px 编辑推荐')
  })
})
