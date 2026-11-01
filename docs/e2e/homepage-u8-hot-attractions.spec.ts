import { expect, test } from './support/fixtures'
import {
  NARROW_VIEWPORT,
  expectNoHorizontalOverflow,
  gotoHome,
  gridColumnCount,
  waitForUrl,
} from './support/helpers'

const SECTION = '#hot-attractions'

/**
 * 6.1 起本区块读后端 `GET /api/attractions?sortBy=hot&limit=5`，
 * 不再是前端 Mock：名称、城市、评分、浏览量全部以 `schema.sql` 的种子为准。
 * 顺序为浏览量降 → 发布时间降 → id 升。
 */
const ALL_ATTRACTIONS = [
  {
    publicId: '01JQATTR000000000000000011',
    name: 'West Lake',
    meta: 'Hangzhou · Rating 4.9',
    views: '16,700 views',
  },
  { publicId: '01JQATTR000000000000000003', name: 'The Bund', meta: 'Shanghai · Rating 4.7', views: '15,400 views' },
  {
    publicId: '01JQATTR000000000000000007',
    name: 'Chengdu Panda Base',
    meta: 'Chengdu · Rating 4.9',
    views: '14,200 views',
  },
  {
    publicId: '01JQATTR000000000000000001',
    name: 'Forbidden City',
    meta: 'Beijing · Rating 4.8',
    views: '12,800 views',
  },
  {
    publicId: '01JQATTR000000000000000009',
    name: 'Terracotta Army',
    meta: "Xi'an · Rating 4.8",
    views: '11,300 views',
  },
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
    // S2 When 后端按 hot 返回 · Then 展示顺序与响应一致（组件自身不排序）
    await expect(page.locator(`${SECTION} ul > li h3`)).toHaveText(
      ALL_ATTRACTIONS.map((attraction) => attraction.name),
    )
  })

  test('S3 · 草稿与低浏览量的景点不出现，也不占前五', async ({ page }) => {
    // S3 When 库中含 1 条 draft（Yu Garden）与 7 条 published 之外的名次 · Then draft 不出现，第 6 名起被截断
    const section = page.locator(SECTION)
    await expect(section).not.toContainText('Yu Garden')
    await expect(section).not.toContainText('Yalong Bay')
    await expect(section).not.toContainText('Shamian Island')
    await expect(section.locator('ul > li h3').first()).toHaveText('West Lake')
    await expect(section.locator('ul > li')).toHaveCount(5)
  })

  test("S4 · 城市过滤只保留 Xi'an 的已发布景点", async ({ page }) => {
    // S4 When city='xian' · Then 只展示 Xi'an 的已发布景点（种子 2 条）
    await gotoHome(page, { city: 'xian' })
    const section = page.locator(SECTION)
    await expect(section.locator('ul > li')).toHaveCount(2)
    await expect(section.locator('ul > li h3')).toHaveText(['Terracotta Army', "Xi'an City Wall"])
    await expect(section.locator('ul > li').first().locator('p')).toHaveText([
      "Xi'an · Rating 4.8",
      '11,300 views',
    ])
  })

  test('S5 · 评分固定一位小数，整卡链接到详情页', async ({ page }) => {
    // S5 When rating 为 0–5 的数字 · Then 显示 Rating 4.9 形式（toFixed(1)）
    const metas = page.locator(`${SECTION} ul > li p:first-of-type`)
    await expect(metas).toHaveCount(5)
    const texts = await metas.allTextContents()
    expect(texts).toHaveLength(5)
    for (const text of texts) {
      expect(text).toMatch(/^.+ · Rating \d\.\d$/)
    }

    // 6.1 起卡片整卡是链接：点击进得去详情页，href 里的 publicId 来自后端。
    const links = page.locator(`${SECTION} ul > li > a`)
    await expect(links).toHaveCount(5)
    await expect(links.first()).toHaveAttribute('href', `/attractions/${ALL_ATTRACTIONS[0].publicId}`)
  })

  test('S6 · 浏览数按 en-US 千分位格式化', async ({ page }) => {
    // S6 When viewCount=16700 / 15400 · Then 分别显示 16,700 views / 15,400 views
    const cards = page.locator(`${SECTION} ul > li`)
    await expect(cards.nth(0).locator('p').nth(1)).toHaveText('16,700 views')
    await expect(cards.nth(1).locator('p').nth(1)).toHaveText('15,400 views')
    await expect(cards.nth(0)).not.toContainText('16700 views')
  })

  test('S7 · 元信息按 city · Rating 拼接', async ({ page }) => {
    // S7 When 景点在 hangzhou、评分 4.9 · Then 元信息为 Hangzhou · Rating 4.9
    const cards = page.locator(`${SECTION} ul > li`)
    await expect(cards.nth(0).locator('p').first()).toHaveText('Hangzhou · Rating 4.9')
  })

  test('S8 · 切换城市后重新取数', async ({ page }) => {
    // S8 When city 变化 · Then 区块重新取数并展示新城市景点
    await page.getByRole('button', { name: 'Beijing', exact: true }).click()
    await waitForUrl(page, (url) => url.searchParams.get('city') === 'beijing')

    const section = page.locator(SECTION)
    await expect(section.locator('ul > li')).toHaveCount(2)
    await expect(section.locator('ul > li h3')).toHaveText(['Forbidden City', 'Temple of Heaven'])
    await expect(section.locator('ul > li').first().locator('p')).toHaveText([
      'Beijing · Rating 4.8',
      '12,800 views',
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
    await waitForUrl(page, (url) => url.searchParams.get('city') === 'chengdu')

    const section = page.locator(SECTION)
    await expect(section.locator('ul > li h3')).toHaveText(['Chengdu Panda Base', 'Wuhou Shrine'])
    await expect(section).not.toContainText('West Lake')
    await expect(section).not.toContainText('The Bund')
  })
})

test.describe('U8 · 首页景点卡片 → 详情页', () => {
  test('点第一张卡进入详情，标题与核实时间都在', async ({ page }) => {
    // 7.2 链路一：首页热门景点 → 详情
    await gotoHome(page)
    await page.locator(`${SECTION} ul > li > a`).first().click()

    await waitForUrl(page, (url) => url.pathname === `/attractions/${ALL_ATTRACTIONS[0].publicId}`)
    await expect(page.locator('h1')).toHaveText('West Lake')
    await expect(page.getByText(/Checked/)).toContainText('Checked Sep 2026')
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
