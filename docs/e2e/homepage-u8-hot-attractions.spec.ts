import { expect, test } from './support/fixtures'
import {
  NARROW_VIEWPORT,
  expectNoHorizontalOverflow,
  gotoHome,
  gridColumnCount,
} from './support/helpers'

const SECTION = '#hot-attractions'

/** 已发布景点按浏览数降 → 发布时间降 → id 升，上限 5 条。 */
const ALL_ATTRACTIONS = [
  { name: 'The Palace Museum', meta: 'Beijing · Rating 4.8', views: '32,000 views' },
  { name: 'The Bund', meta: 'Shanghai · Rating 4.6', views: '28,000 views' },
  { name: 'West Lake', meta: 'Hangzhou · Rating 4.7', views: '26,000 views' },
  { name: 'Terracotta Army', meta: "Xi'an · Rating 4.5", views: '21,000 views' },
  { name: 'Yalong Bay', meta: 'Sanya · Rating 4.4', views: '19,000 views' },
]

test.describe('U8 · 热门景点区块 · 桌面端', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S1 · 渲染景点卡片，每张含封面、名称、城市与评分、浏览量', async ({ page }) => {
    // S1 When 数据 ready 且非空 · Then 数量 = items.length ≤ 5；And 每张卡四要素齐全
    const cards = page.locator(`${SECTION} ul > li`)
    await expect(cards).toHaveCount(5)

    for (const [index, attraction] of ALL_ATTRACTIONS.entries()) {
      const card = cards.nth(index)
      const cover = card.locator('img')
      await expect(cover).toHaveCount(1)
      await expect(cover).toHaveAttribute('alt', `${attraction.name} cover`)
      await expect(card.locator('h3')).toHaveText(attraction.name)
      await expect(card.locator('p').nth(0)).toHaveText(attraction.meta)
      await expect(card.locator('p').nth(1)).toHaveText(attraction.views)
    }
  })

  test('S2 · 顺序为浏览量降 → 发布时间降 → id 升', async ({ page }) => {
    // S2 When 数据乱序返回 · Then 展示顺序按浏览量降序（组件自身不排序）
    await expect(page.locator(`${SECTION} ul > li h3`)).toHaveText(
      ALL_ATTRACTIONS.map((attraction) => attraction.name),
    )
  })

  test('S3 · 草稿与已删除景点不出现，也不占前五', async ({ page }) => {
    // S3 When Mock 中含 draft / removed 景点 · Then 它们不出现（draft 的 99,999 浏览也不得成为第一）
    const section = page.locator(SECTION)
    await expect(section).not.toContainText('A viewing deck not yet open')
    await expect(section).not.toContainText('A retired old attraction')
    await expect(section.locator('ul > li h3').first()).toHaveText('The Palace Museum')
    await expect(section.locator('ul > li')).toHaveCount(5)
  })

  test('S4 · 城市过滤只保留 Xi\'an 与全城通用景点', async ({ page }) => {
    // S4 When city='xian' · Then 只展示 Xi'an 与 all 的已发布景点
    await gotoHome(page, { city: 'xian' })
    const section = page.locator(SECTION)
    await expect(section.locator('ul > li')).toHaveCount(1)
    await expect(section.locator('ul > li h3')).toHaveText(['Terracotta Army'])
    await expect(section.locator('ul > li p')).toHaveText([
      "Xi'an · Rating 4.5",
      '21,000 views',
    ])
  })

  test('S5 · 评分固定一位小数且只读不可点击', async ({ page }) => {
    // S5 When rating 为 0–5 的数字 · Then 显示 Rating 4.8 形式（toFixed(1)），且评分不可交互
    // 数据集没有两位小数评分，用「所有卡片均为一位小数」验证同一格式化契约。
    const metas = page.locator(`${SECTION} ul > li p:first-of-type`)
    // allTextContents 不会自动等待数据就绪，先等卡片渲染完再取值。
    await expect(metas).toHaveCount(5)
    const texts = await metas.allTextContents()
    expect(texts).toHaveLength(5)
    for (const text of texts) {
      expect(text).toMatch(/^.+ · Rating \d\.\d$/)
    }

    const interactive = await page
      .locator(`${SECTION} ul > li`)
      .evaluateAll((nodes) => nodes.filter((node) => node.querySelector('a, button')).length)
    expect(interactive, '景点卡片当前不可点击，不应出现链接或按钮').toBe(0)
  })

  test('S6 · 浏览数按 en-US 千分位格式化', async ({ page }) => {
    // S6 When viewCount=38000 / 860 · Then 分别显示 38,000 views / 860 views（本数据集为 32,000 / 28,000）
    const cards = page.locator(`${SECTION} ul > li`)
    await expect(cards.nth(0).locator('p').nth(1)).toHaveText('32,000 views')
    await expect(cards.nth(1).locator('p').nth(1)).toHaveText('28,000 views')
    await expect(cards.nth(0)).not.toContainText('32000 views')
  })

  test('S7 · 元信息按 city · Rating 拼接（4.6 显示为 4.6）', async ({ page }) => {
    // S7 When 景点在 hangzhou、评分 4.6 / 4.7 · Then 元信息为 Hangzhou · Rating 4.7
    const cards = page.locator(`${SECTION} ul > li`)
    await expect(cards.nth(2).locator('p').first()).toHaveText('Hangzhou · Rating 4.7')
  })

  test('S8 · 切换城市后重新取数', async ({ page }) => {
    // S8 When city 变化 · Then 区块重新取数并展示新城市景点
    await page.getByRole('button', { name: 'Beijing', exact: true }).click()
    await page.waitForURL((url) => url.searchParams.get('city') === 'beijing')

    const section = page.locator(SECTION)
    await expect(section.locator('ul > li')).toHaveCount(1)
    await expect(section.locator('ul > li h3')).toHaveText(['The Palace Museum'])
    await expect(section.locator('ul > li p')).toHaveText([
      'Beijing · Rating 4.8',
      '32,000 views',
    ])
  })

  test('S11 · 封面加载失败时保留 1:1 占位且布局不塌陷', async ({ page }) => {
    // S11 When 封面 URL 失效 · Then 保留 1:1 占位、alt 可读、布局不塌陷
    await page.route('https://images.unsplash.com/**', (route) => route.abort())
    await gotoHome(page)

    const covers = page.locator(`${SECTION} ul > li img`)
    await expect(covers).toHaveCount(5)
    for (const [index, attraction] of ALL_ATTRACTIONS.entries()) {
      const cover = covers.nth(index)
      await expect(cover).toHaveAttribute('alt', `${attraction.name} cover`)
      const box = await cover.boundingBox()
      expect(box, `第 ${index + 1} 张封面应保留占位尺寸`).not.toBeNull()
      const ratio = (box?.width ?? 0) / (box?.height ?? 1)
      expect(ratio).toBeGreaterThan(0.95)
      expect(ratio).toBeLessThan(1.05)
    }

    await expect(page.locator('#editor-picks ul li')).toHaveCount(6)
  })

  test('S14 · 快速连续切换城市只渲染最后一次结果', async ({ page }) => {
    // S14 When 短时间内多次切换 · Then 只渲染最后一次（Chengdu）结果，不出现新旧城市混排
    for (const city of ['Beijing', 'Shanghai', 'Chengdu']) {
      await page.getByRole('button', { name: city, exact: true }).click()
    }
    await page.waitForURL((url) => url.searchParams.get('city') === 'chengdu')

    const section = page.locator(SECTION)
    await expect(section.locator('ul > li h3')).toHaveText(['Kuanzhai Alley'])
    await expect(section).not.toContainText('The Palace Museum')
    await expect(section).not.toContainText('The Bund')
  })
})

test.describe('U8 · 热门景点区块 · 超窄屏 320×667', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S13 · 单列、封面保持 1:1 且无横向滚动', async ({ page }) => {
    // S13 When 视口 320px · Then 单列，封面保持 1:1，无横向滚动
    const grid = page.locator(`${SECTION} ul`)
    expect(await gridColumnCount(grid)).toBe(1)

    const covers = page.locator(`${SECTION} ul > li img`)
    await expect(covers).toHaveCount(5)
    for (const cover of await covers.all()) {
      const box = await cover.boundingBox()
      const ratio = (box?.width ?? 0) / (box?.height ?? 1)
      expect(ratio).toBeGreaterThan(0.95)
      expect(ratio).toBeLessThan(1.05)
    }

    await expectNoHorizontalOverflow(page, '320px 热门景点')
  })
})
