import { expect, test } from './support/fixtures'
import { businessAlerts, gotoHome, gotoPath } from './support/helpers'

/**
 * U0 是纯 TypeScript 数据层，没有自己的 UI。
 * 浏览器端只能通过首页三个内容区块与城市入口做「可观察代理」：
 * 每条 test 的 When/Then 注释里标注对应的 U0 场景编号。
 */

const EDITOR_TITLES = [
  'A walk through the Forbidden City at dusk',
  'Plane trees and coffee on Wukang Road',
  "A gaiwan of tea in People's Park",
  'Seven days, one backpack',
  'West of West Lake, among the tea hills',
  "Riding the city wall: thirteen kilometers of wind",
]

const POST_TITLES = [
  'Chengdu rain, falling into a cup of tea',
  'The Bund: wind from dusk into the night',
  "Riding the whole Xi'an city wall",
  'Guangzhou morning tea map: seven days, no repeats',
  'Hiking the Hangzhou tea hills: the wrong turn is the surprise',
  'Winter in Sanya starts with a glass of coconut water',
  'Independent bookshops in Beijing hutongs',
  "A walking route through Shanghai's plane-tree district",
  'Two days around Chengdu: old towns and bamboo groves',
  'Sweet soup shops under Guangzhou arcades',
]

const ATTRACTION_TITLES = [
  'The Palace Museum',
  'The Bund',
  'West Lake',
  'Terracotta Army',
  'Yalong Bay',
]

test.describe('U0 · 默认首页（/）', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S3 · And 查询城市为 all 时返回全部城市内容', async ({ page }) => {
    // S3 And 查询城市为 all 时返回全部城市内容
    const picks = page.locator('#editor-picks')
    await expect(picks.locator('ul li')).toHaveCount(6)
    for (const city of ['Beijing', 'Shanghai', 'Chengdu', 'All cities', 'Hangzhou', "Xi'an"]) {
      await expect(picks).toContainText(city)
    }
  })

  test('S4 · 精选按 sortOrder 升序、并列按 id 升序', async ({ page }) => {
    // S4 When 调用 listEditorPicks · Then 按 sortOrder 升序，并列按 id 升序
    await expect(page.locator('#editor-picks ul li h3')).toHaveText(EDITOR_TITLES)
  })

  test('S4 · 帖子按评论、浏览、时间降序，id 升序兜底', async ({ page }) => {
    // S4 When 调用 listHotPosts · Then 按 commentCount → viewCount → publishedAt → id 排序
    await expect(page.locator('#hot-posts ol li h3')).toHaveText(POST_TITLES)
  })

  test('S4 · 景点按浏览、时间降序，id 升序兜底', async ({ page }) => {
    // S4 When 调用 listHotAttractions · Then 按 viewCount → publishedAt → id 排序
    await expect(page.locator('#hot-attractions ul li h3')).toHaveText(ATTRACTION_TITLES)
  })

  test('S5 · 帖子只展示前 10 条，第 11 名以后被截断', async ({ page }) => {
    // S5 When 匹配结果超过上限 · Then items 只含前 limit 条（HOT_POSTS_LIMIT=10）
    const items = page.locator('#hot-posts ol li')
    await expect(items).toHaveCount(10)
    await expect(page.locator('#hot-posts')).not.toContainText(
      "Six in the morning on Xi'an's Muslim Quarter",
    )
    await expect(page.locator('#hot-posts')).not.toContainText(
      'First surf lesson at Houhai Village, Sanya',
    )
  })

  test('S5 · 景点只展示前 5 条，第 6 名以后被截断', async ({ page }) => {
    // S5 When 匹配结果超过上限 · Then items 只含前 limit 条（HOT_ATTRACTIONS_LIMIT=5）
    const items = page.locator('#hot-attractions ul li')
    await expect(items).toHaveCount(5)
    await expect(page.locator('#hot-attractions')).not.toContainText('Kuanzhai Alley')
    await expect(page.locator('#hot-attractions')).not.toContainText('Shamian Island')
  })

  test('S5 · 精选上限为 6 条', async ({ page }) => {
    // S5 And 三个上限分别为 6 / 10 / 5；精选数据集恰为 6 条
    await expect(page.locator('#editor-picks ul li')).toHaveCount(6)
  })

  test('S6 · formatCount 输出 en-US 千分位（以真实数据代理）', async ({ page }) => {
    // S6 When formatCount(20000) → '20,000'；页面可观察代理为 32,000 与 9,100
    const topPost = page.locator('#hot-posts ol li').first()
    await expect(topPost).toContainText('42 comments · 9,100 views')

    const palace = page
      .locator('#hot-attractions ul li')
      .filter({ hasText: 'The Palace Museum' })
    await expect(palace).toContainText('32,000 views')
  })

  test('S6 · formatDate 输出 MMM D、锁定 Asia/Shanghai 且不含年份', async ({ page }) => {
    // S6 When formatDate('2026-10-11T16:30:00+08:00') · Then 输出 'Oct 11'（不含年份）
    const topPost = page.locator('#hot-posts ol li').first()
    await expect(topPost).toContainText('Xiaozhou · Chengdu · Oct 11')
    await expect(topPost).not.toContainText('2026')
  })

  test('S10 · draft / removed 的帖子与景点不出现在页面上', async ({ page }) => {
    // S10 When Mock 中存在 draft / removed · Then 两个列表不含它们，也不计入结果
    for (const hidden of [
      'The last half hour before the Forbidden City closes',
      'A removed old post',
      'A viewing deck not yet open',
      'A retired old attraction',
    ]) {
      await expect(page.getByText(hidden, { exact: true })).toHaveCount(0)
    }
  })
})

test.describe('U0 · 城市参数归一化', () => {
  test.beforeEach(async ({ page }) => {
    // 统一先到达首页；需要带参数的用例再导航到目标 URL。
    await gotoHome(page)
  })

  test('S1 · 合法 city 参数被原样保留', async ({ page }) => {
    // S1 When 传入 'beijing' · Then 返回 'beijing'
    await gotoHome(page, { city: 'beijing' })
    await expect(page.getByRole('button', { name: 'Beijing', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator('#cities')).toContainText(
      'Now: Beijing · Between city walls and hutong lanes',
    )
  })

  test('S1 · And 缺失、空串与非法 slug 一律回落 all', async ({ page }) => {
    // S1 And 传入 undefined、''、'atlantis' 时一律返回 'all'
    for (const url of ['/', '/?city=', '/?city=atlantis']) {
      await gotoPath(page, url)
      await expect(page.getByRole('button', { name: 'All cities', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    }
  })

  test('S2 · 数组入参取第一个元素', async ({ page }) => {
    // S2 When 传入 ['shanghai', 'beijing'] · Then 取第一个元素判定，返回 'shanghai'
    await gotoPath(page, '/?city=shanghai&city=beijing')
    await expect(page.getByRole('button', { name: 'Shanghai', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Beijing', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('S3 · 城市过滤同时返回本城与 all 通用内容', async ({ page }) => {
    // S3 When 查询城市为 beijing · Then 返回 city === 'beijing' 与 city === 'all' 两类内容
    await gotoHome(page, { city: 'beijing' })
    const picks = page.locator('#editor-picks')
    await expect(picks).toContainText('A walk through the Forbidden City at dusk')
    await expect(picks).toContainText('Seven days, one backpack')
    await expect(picks).not.toContainText('Plane trees and coffee on Wukang Road')
  })

  test('S7 · 非法城市静默回落，不抛错也不进入错误态', async ({ page }) => {
    // S7 When 传入 'atlantis' / '' / undefined · Then 静默回落 'all'，不抛异常
    await gotoPath(page, '/?city=atlantis')
    await expect(businessAlerts(page)).toHaveCount(0)
    await expect(page.locator('#hot-posts ol li')).toHaveCount(10)
  })

  test('S8 · cityNameEn 对未收录 slug 兜底为 All cities', async ({ page }) => {
    // S8 When cityNameEn 遇到未收录项 · Then 兜底 'All cities'；界面只用英文名
    await gotoPath(page, '/?city=unknown')
    await expect(page.locator('#cities')).toContainText(
      'Now: All cities · Everywhere, at any pace',
    )
  })
})
