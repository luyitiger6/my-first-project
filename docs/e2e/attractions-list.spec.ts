import type { Locator } from '@playwright/test'
import { expect, test } from './support/fixtures'
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  NARROW_VIEWPORT,
  expectNoHorizontalOverflow,
  gotoPath,
  gridColumnCount,
  waitForUrl,
} from './support/helpers'

const SHORTLIST = 'section[data-collection]'
const FULL_LIST = 'section[data-section="attraction-list"]'

/** 卡片内部还有一层徽标 `ul`，计数与列数一律用直系子选择器。 */
const FIRST_TRIP_GRID = `${SHORTLIST}[data-collection="first-trip"] > ul`

/**
 * 浏览数只承诺「en-US 千分位」这一形状（单元文档 S5 的口径），
 * 具体数值属于业务数据，不在断言里锁死。
 */
const VIEWS_SHAPE = /^\d{1,3}(,\d{3})* views$/

/** 把每张卡的浏览数读成数字，用来断言相对顺序而不是写死名次。 */
async function readViewCounts(cards: Locator): Promise<number[]> {
  const counts: number[] = []
  for (const card of await cards.all()) {
    const text = await card.locator('p').nth(1).innerText()
    counts.push(Number(text.replace(/\D/g, '')))
  }
  return counts
}

/** 三个榜单的顺序、固定英文名与策展成员（`schema.sql` 的 `curated_rank_*` 列）。 */
const SHORTLISTS = [
  {
    key: 'first-trip',
    title: 'First time in China',
    members: ['Forbidden City', 'The Bund', 'Chengdu Panda Base', 'Terracotta Army'],
  },
  {
    key: 'no-booking',
    title: 'No booking needed',
    members: ['The Bund', 'Shamian Island', "Xi'an City Wall", 'West Lake'],
  },
  {
    key: 'open-monday',
    title: 'Open on Mondays',
    members: ['The Bund', 'Shamian Island', 'West Lake', 'Yalong Bay'],
  },
]

test.describe('景点列表页 · 桌面端', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPath(page, '/attractions')
  })

  test('S1 · 三个榜单按固定顺序渲染，榜名与成员都来自后端策展', async ({ page }) => {
    // S1 When 打开 /attractions · Then 先榜单后完整列表；榜单顺序固定，榜名是固定英文串
    await expect(page.locator('h1')).toHaveText('Places worth the trip')

    const blocks = page.locator(SHORTLIST)
    await expect(blocks).toHaveCount(3)
    await expect(blocks.locator('h2')).toHaveText(SHORTLISTS.map((item) => item.title))

    for (const [index, shortlist] of SHORTLISTS.entries()) {
      const block = blocks.nth(index)
      await expect(block).toHaveAttribute('data-collection', shortlist.key)
      await expect(block.locator('ul > li h3')).toHaveText(shortlist.members)
    }
  })

  test('S2 · 卡片整卡链接到详情，city · Rating 与千分位浏览数同形', async ({ page }) => {
    // S2 When 渲染榜单成员 · Then 每张卡是链接且四要素齐全
    const firstPick = page
      .locator(`${SHORTLIST}[data-collection="first-trip"] ul > li`)
      .first()
    await expect(firstPick.locator('a')).toHaveAttribute(
      'href',
      '/attractions/01JQATTR000000000000000001',
    )
    await expect(firstPick.locator('h3')).toHaveText('Forbidden City')
    await expect(firstPick.locator('p').nth(0)).toHaveText('Beijing · Rating 4.8')
    // 千分位是格式规则；具体浏览量随业务数据变化，锁死数值会让数据调整误伤本用例。
    await expect(firstPick.locator('p').nth(1)).toHaveText(VIEWS_SHAPE)
    // 约束徽标由后端布尔事实推导：故宫需预约、周一闭馆。
    await expect(firstPick.locator('ul li')).toHaveText([
      'Paid entry',
      'Booking needed',
      'Closed on Mondays',
    ])
  })

  test('S3 · 完整列表按浏览量取满并如实说明总数', async ({ page }) => {
    // S3 When 已发布 12 条 · Then 完整列表 12 条，status line 说明 12 of 12
    const list = page.locator(FULL_LIST)
    await expect(list.locator('h2')).toHaveText('Every published attraction')
    // 第一个 p 是区块说明，status line 在数据就绪后才出现，所以按整段文本断。
    await expect(list).toContainText('Showing 12 of 12 published attractions.')
    await expect(page.locator(`${FULL_LIST} > ul > li`)).toHaveCount(12)

    // 完整列表走默认 hot：断言「浏览量非递增」这一排序规则本身，
    // 而不是锁死某个景点刚好排在第一。
    const counts = await readViewCounts(page.locator(`${FULL_LIST} > ul > li`))
    expect(counts).toHaveLength(12)
    expect(counts).toEqual([...counts].sort((left, right) => right - left))

    // 草稿（draft）不得出现在任何位置。
    await expect(list).not.toContainText('Yu Garden')
  })

  test('S4 · city 参数下发到三个榜单与完整列表', async ({ page }) => {
    // S4 When 访问 ?city=chengdu · Then 榜单与列表都按成都取数，榜名本身不随城市变化
    await gotoPath(page, '/attractions?city=chengdu')

    const blocks = page.locator(SHORTLIST)
    await expect(blocks.locator('h2')).toHaveText(SHORTLISTS.map((item) => item.title))

    await expect(blocks.nth(0).locator('ul > li h3')).toHaveText(['Chengdu Panda Base'])
    // 成都的另外两个榜单没有策展成员：显示含城市的空态，而不是空列表。
    for (const index of [1, 2]) {
      await expect(blocks.nth(index).locator('ul > li')).toHaveCount(0)
      await expect(blocks.nth(index)).toContainText('No picks on this shortlist in Chengdu yet.')
    }

    await expect(page.locator(`${FULL_LIST} ul > li h3`)).toHaveText([
      'Chengdu Panda Base',
      'Wuhou Shrine',
    ])
    await expect(page.locator(FULL_LIST)).toContainText('Showing 2 of 2 published attractions.')
  })

  test('S5 · 榜单成员点进去就是详情页', async ({ page }) => {
    // 7.2 链路二：/attractions 榜单 → 详情
    await page.locator(`${SHORTLIST}[data-collection="first-trip"] ul > li a`).first().click()

    await waitForUrl(page, (url) => url.pathname === '/attractions/01JQATTR000000000000000001')
    await expect(page.locator('h1')).toHaveText('Forbidden City')
    await expect(page.getByText(/^Checked/)).toHaveText(/^Checked [A-Z][a-z]{2} \d{4}$/)
  })
})

test.describe('景点列表页 · 平板 375×667', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('S6 · 窄屏榜单仍按固定顺序渲染且无横向滚动', async ({ page }) => {
    await gotoPath(page, '/attractions')

    const blocks = page.locator(SHORTLIST)
    await expect(blocks.locator('h2')).toHaveText(SHORTLISTS.map((item) => item.title))
    await expectNoHorizontalOverflow(page, '375px 景点列表')
  })
})

test.describe('景点列表页 · 超窄屏 320×667', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test('S7 · 榜单降为单列且无横向滚动', async ({ page }) => {
    // S7 When 视口 320px · Then ≤480px 断点把四列网格收成单列
    await gotoPath(page, '/attractions')

    const grid = page.locator(FIRST_TRIP_GRID)
    await expect(page.locator(`${FIRST_TRIP_GRID} > li`)).toHaveCount(4)
    expect(await gridColumnCount(grid)).toBe(1)
    await expectNoHorizontalOverflow(page, '320px 景点列表')
  })
})

test.describe('景点列表页 · 桌面四列', () => {
  test.use({ viewport: DESKTOP_VIEWPORT })

  test('S8 · 1440px 下榜单为四列网格', async ({ page }) => {
    await gotoPath(page, '/attractions')

    const grid = page.locator(FIRST_TRIP_GRID)
    await expect(page.locator(`${FIRST_TRIP_GRID} > li`)).toHaveCount(4)
    expect(await gridColumnCount(grid)).toBe(4)
  })
})
