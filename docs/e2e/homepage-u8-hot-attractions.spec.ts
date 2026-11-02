import type { Locator, Page } from '@playwright/test'
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
 * 6.1 起本区块读后端 `GET /api/attractions?sortBy=hot&limit=5`，不再是前端 Mock。
 * 顺序为浏览量降 → 发布时间降 → id 升。
 *
 * 断言口径：景点名单、城市与浏览量都是 `schema.sql` 的种子数据。
 * E2E 只守护「排序规则」与「展示形状」，不写死具体景点与数值——
 * 锁死数值会让种子调整误仿成实现故障（本轮回归暴露的正是这个问题）。
 */
const VIEWS_SHAPE = /^\d{1,3}(,\d{3})* views$/
const META_SHAPE = /^[A-Za-z' ]+ · Rating \d\.\d$/

interface RenderedCard {
  card: Locator
  name: string
  meta: string
  views: string
  count: number
}

/**
 * 逐卡读出四要素与浏览量数值，供「顺序」「形状」「对应关系」三类断言共用。
 * 区块数据是异步取的：先等到预期张数再批量读，否则会在加载态读到空列表。
 */
async function readCards(page: Page, expectedCount?: number): Promise<RenderedCard[]> {
  const cards = page.locator(`${SECTION} ul > li`)
  if (expectedCount === undefined) {
    await expect(cards.first()).toBeVisible()
  } else {
    await expect(cards).toHaveCount(expectedCount)
  }

  const rendered: RenderedCard[] = []
  for (let index = 0; index < (await cards.count()); index += 1) {
    const card = cards.nth(index)
    const views = (await card.locator('p').nth(1).innerText()).trim()
    rendered.push({
      card,
      name: (await card.locator('h3').innerText()).trim(),
      meta: (await card.locator('p').nth(0).innerText()).trim(),
      views,
      count: Number(views.replace(/\D/g, '')),
    })
  }
  return rendered
}

/** hot 排序在页面上的可观察不变量：浏览量非递增。 */
function expectNonIncreasingViews(cards: RenderedCard[]): void {
  const counts = cards.map((item) => item.count)
  expect(counts.length).toBeGreaterThan(1)
  expect(counts).toEqual([...counts].sort((left, right) => right - left))
}

test.describe('U8 · 热门景点区块 · 桌面端', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S1 · 渲染景点卡片，每张含封面、名称、城市与评分、浏览量', async ({ page }) => {
    // S1 When 数据 ready 且非空 · Then 数量 = items.length ≤ 5；And 每张卡四要素齐全
    await expect(page.locator(`${SECTION} ul > li`)).toHaveCount(5)

    for (const item of await readCards(page, 5)) {
      const cover = item.card.locator('img')
      await expect(cover).toHaveCount(1)
      await expect(cover).toHaveAttribute('alt', `${item.name} cover`)
      expect(item.name).not.toBe('')
      expect(item.meta).toMatch(META_SHAPE)
      expect(item.views).toMatch(VIEWS_SHAPE)
    }
  })

  test('S2 · 顺序为浏览量降 → 发布时间降 → id 升', async ({ page }) => {
    // S2 When 后端按 hot 返回 · Then 展示顺序与响应一致（组件自身不排序）
    const cards = await readCards(page, 5)
    expect(cards).toHaveLength(5)
    expectNonIncreasingViews(cards)
  })

  test('S3 · 草稿与低浏览量的景点不出现，也不占前五', async ({ page }) => {
    // S3 When 库中含 1 条 draft（Yu Garden）与 7 条 published 之外的名次 · Then draft 不出现，第 6 名起被截断
    const section = page.locator(SECTION)
    await expect(section).not.toContainText('Yu Garden')
    await expect(section).not.toContainText('Yalong Bay')
    await expect(section).not.toContainText('Shamian Island')
    await expect(section.locator('ul > li')).toHaveCount(5)
  })

  test("S4 · 城市过滤只保留 Xi'an 的已发布景点", async ({ page }) => {
    // S4 When city='xian' · Then 只展示 Xi'an 的已发布景点（种子 2 条）
    await gotoHome(page, { city: 'xian' })
    const section = page.locator(SECTION)
    await expect(section.locator('ul > li')).toHaveCount(2)

    const cards = await readCards(page, 2)
    for (const item of cards) {
      expect(item.meta.startsWith("Xi'an · Rating ")).toBe(true)
      expect(item.views).toMatch(VIEWS_SHAPE)
    }
    expectNonIncreasingViews(cards)
  })

  test('S5 · 评分固定一位小数，整卡链接到详情页', async ({ page }) => {
    // S5 When rating 为 0–5 的数字 · Then 显示 Rating 4.9 形式（toFixed(1)）
    const cards = await readCards(page, 5)
    expect(cards).toHaveLength(5)
    for (const item of cards) {
      expect(item.meta).toMatch(META_SHAPE)
    }

    // 6.1 起卡片整卡是链接：点击进得去详情页，href 里的 publicId 来自后端。
    // 只校验 publicId 的 ULID 形状，不锁死到某个具体景点。
    const links = page.locator(`${SECTION} ul > li > a`)
    await expect(links).toHaveCount(5)
    const hrefs = await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''))
    for (const href of hrefs) {
      expect(href).toMatch(/^\/attractions\/[0-9A-HJKMNP-TV-Z]{26}$/)
    }
  })

  test('S6 · 浏览数按 en-US 千分位格式化', async ({ page }) => {
    // S6 When viewCount 为四位数以上 · Then 显示 16,700 views 形式，不出现裸数字
    const cards = await readCards(page, 5)
    expect(cards).toHaveLength(5)
    for (const item of cards) {
      expect(item.views).toMatch(VIEWS_SHAPE)
      // 裸数字（无千分位分隔符）不得出现。
      expect(item.views).not.toMatch(/^\d{4,} views$/)
    }
  })

  test('S7 · 元信息按 city · Rating 拼接', async ({ page }) => {
    // S7 When 景点在某城市、评分 x.y · Then 元信息行为 `{City} · Rating {x.y}`
    const cards = await readCards(page, 5)
    expect(cards).toHaveLength(5)
    for (const item of cards) {
      expect(item.meta).toMatch(META_SHAPE)
    }
  })

  test('S8 · 切换城市后重新取数', async ({ page }) => {
    // S8 When city 变化 · Then 区块重新取数并展示新城市景点
    await page.getByRole('button', { name: 'Beijing', exact: true }).click()
    await waitForUrl(page, (url) => url.searchParams.get('city') === 'beijing')

    const section = page.locator(SECTION)
    await expect(section.locator('ul > li')).toHaveCount(2)

    const cards = await readCards(page, 2)
    for (const item of cards) {
      expect(item.meta.startsWith('Beijing · Rating ')).toBe(true)
      expect(item.views).toMatch(VIEWS_SHAPE)
    }
    expectNonIncreasingViews(cards)
  })

  test('S11 · 封面加载失败时保留 1:1 占位且布局不塌陷', async ({ page }) => {
    // S11 When 封面 URL 失效 · Then 保留 1:1 占位、alt 可读、布局不塌陷
    await page.route('https://images.unsplash.com/**', (route) => route.abort())
    await gotoHome(page)

    const cards = await readCards(page, 5)
    expect(cards).toHaveLength(5)
    for (const [index, item] of cards.entries()) {
      const cover = item.card.locator('img')
      await expect(cover).toHaveCount(1)
      // alt 与同一张卡的名称保持对应，不依赖外部常量。
      await expect(cover).toHaveAttribute('alt', `${item.name} cover`)
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
    await expect(section.locator('ul > li')).toHaveCount(2)
    // 只渲染最后一次切换（chengdu）的结果，不出现新旧城市混排。
    for (const item of await readCards(page, 2)) {
      expect(item.meta.startsWith('Chengdu · Rating ')).toBe(true)
    }
    await expect(section).not.toContainText('West Lake')
    await expect(section).not.toContainText('The Bund')
  })
})

test.describe('U8 · 首页景点卡片 → 详情页', () => {
  test('点第一张卡进入详情，标题与核实时间都在', async ({ page }) => {
    // 7.2 链路一：首页热门景点 → 详情
    await gotoHome(page)
    const [first] = await readCards(page)
    const href = await first.card.locator('a').getAttribute('href')
    const publicId = (href ?? '').split('/').pop() ?? ''
    expect(publicId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)

    await first.card.locator('a').click()
    await waitForUrl(page, (url) => url.pathname === `/attractions/${publicId}`)
    // 点哪张卡就该看到哪个景点：标题与卡片名称一致，不对照外部常量。
    await expect(page.locator('h1')).toHaveText(first.name)
    // 核实时间只校验存在与形状（与景点列表页 S5 同一口径），具体月份属于数据。
    await expect(page.getByText(/^Checked/)).toHaveText(/^Checked [A-Z][a-z]{2} \d{4}$/)
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
