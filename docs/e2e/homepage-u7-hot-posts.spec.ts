import { expect, test } from './support/fixtures'
import {
  NARROW_VIEWPORT,
  expectNoHorizontalOverflow,
  gotoHome,
  waitForUrl,
} from './support/helpers'

const SECTION = '#hot-posts'

/** 已发布帖子按评论数 → 浏览数 → 发布时间降序、id 升序兜底，上限 10 条。 */
const ALL_POSTS = [
  {
    rank: '01',
    title: 'Chengdu rain, falling into a cup of tea',
    meta: 'Xiaozhou · Chengdu · Oct 11',
    upvotes: '245',
    comments: '42',
    bookmarks: '81',
  },
  {
    rank: '02',
    title: 'The Bund: wind from dusk into the night',
    meta: 'Aran · Shanghai · Oct 12',
    upvotes: '198',
    comments: '42',
    bookmarks: '73',
  },
  {
    rank: '03',
    title: "Riding the whole Xi'an city wall",
    meta: "Chenmo · Xi'an · Oct 10",
    upvotes: '156',
    comments: '31',
    bookmarks: '44',
  },
  {
    rank: '04',
    title: 'Guangzhou morning tea map: seven days, no repeats',
    meta: 'Aran · Guangzhou · Oct 9',
    upvotes: '134',
    comments: '28',
    bookmarks: '62',
  },
  {
    rank: '05',
    title: 'Hiking the Hangzhou tea hills: the wrong turn is the surprise',
    meta: 'Linshen · Hangzhou · Oct 8',
    upvotes: '128',
    comments: '27',
    bookmarks: '51',
  },
  {
    rank: '06',
    title: 'Winter in Sanya starts with a glass of coconut water',
    meta: 'Xiaozhou · Sanya · Oct 7',
    upvotes: '142',
    comments: '25',
    bookmarks: '58',
  },
  {
    rank: '07',
    title: 'Independent bookshops in Beijing hutongs',
    meta: 'Chenmo · Beijing · Oct 6',
    upvotes: '115',
    comments: '22',
    bookmarks: '49',
  },
  {
    rank: '08',
    title: "A walking route through Shanghai's plane-tree district",
    meta: 'Linshen · Shanghai · Oct 5',
    upvotes: '98',
    comments: '19',
    bookmarks: '37',
  },
  {
    rank: '09',
    title: 'Two days around Chengdu: old towns and bamboo groves',
    meta: 'Aran · Chengdu · Oct 4',
    upvotes: '87',
    comments: '18',
    bookmarks: '33',
  },
  {
    rank: '10',
    title: 'Sweet soup shops under Guangzhou arcades',
    meta: 'Xiaozhou · Guangzhou · Oct 3',
    upvotes: '76',
    comments: '16',
    bookmarks: '29',
  },
]

test.describe('U7 · 热门帖子区块 · 桌面端', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S1 · 渲染有序列表，每条含排名、标题、作者、城市、日期、评论与浏览数', async ({ page }) => {
    // S1 When 数据 ready 且非空 · Then 条目数 = items.length ≤ 10；And 每条含排名、标题、元信息、计数
    const cards = page.locator(`${SECTION} ol > li`)
    await expect(cards).toHaveCount(10)

    for (const card of await cards.all()) {
      await expect(card.locator('span[aria-hidden="true"]')).toHaveCount(1)
      await expect(card.locator('h3')).toHaveCount(1)
      await expect(card.locator('p')).toHaveCount(1)
      // 互动统计是图标化三列（赞 / 评 / 藏），不再是「N comments · N views」一行文本。
      await expect(card.locator('[aria-label="Post interactions"] > span')).toHaveCount(3)
    }

    const first = cards.first()
    await expect(first.locator('h3')).toHaveText(ALL_POSTS[0].title)
    await expect(first.locator('p')).toHaveText(ALL_POSTS[0].meta)
  })

  test('S2 · 排名从 01 起两位补零且 aria-hidden，顺序由 ol 承担', async ({ page }) => {
    // S2 When 渲染第 1、2、10 条 · Then 排名依次显示 01、02、10；And 排名元素 aria-hidden，读屏靠 <ol> 语义
    const list = page.locator(`${SECTION} ol`)
    expect(await list.evaluate((element) => element.tagName)).toBe('OL')

    const ranks = page.locator(`${SECTION} ol > li > span`)
    await expect(ranks).toHaveText(ALL_POSTS.map((post) => post.rank))
    for (const rank of await ranks.all()) {
      await expect(rank).toHaveAttribute('aria-hidden', 'true')
      await expect(rank).toBeVisible()
    }
  })

  test('S3 · 顺序为评论数降 → 浏览数降 → 发布时间降，id 升序兜底', async ({ page }) => {
    // S3 When 数据乱序返回 · Then 展示顺序符合排序规则（组件自身不排序）
    // 前两条同为 42 条评论，Chengdu rain 浏览数更高排在前面，可直接验证第二条排序键生效。
    await expect(page.locator(`${SECTION} ol > li h3`)).toHaveText(
      ALL_POSTS.map((post) => post.title),
    )
  })

  test('S4 · 草稿与已删除帖子不出现且不占排名位', async ({ page }) => {
    // S4 When Mock 中含 draft / removed 帖子 · Then 它们不出现、不占排名（removed 帖 99 评论也不得成为 01）
    const section = page.locator(SECTION)
    await expect(section).not.toContainText('The last half hour before the Forbidden City closes')
    await expect(section).not.toContainText('A removed old post')
    await expect(section.locator('ol > li h3').first()).toHaveText(ALL_POSTS[0].title)
    await expect(section.locator('ol > li > span').first()).toHaveText('01')
  })

  test('S5 · 城市过滤只保留 Chengdu 与全城通用帖子', async ({ page }) => {
    // S5 When city='chengdu' · Then 只展示 Chengdu 与 all 的已发布帖子
    await gotoHome(page, { city: 'chengdu' })
    const section = page.locator(SECTION)
    await expect(section.locator('ol > li')).toHaveCount(2)
    await expect(section.locator('ol > li h3')).toHaveText([
      'Chengdu rain, falling into a cup of tea',
      'Two days around Chengdu: old towns and bamboo groves',
    ])
    await expect(section.locator('ol > li p')).toHaveText([
      'Xiaozhou · Chengdu · Oct 11',
      'Aran · Chengdu · Oct 4',
    ])
  })

  test('S6 · 元信息按 author · city · MMM D 拼接', async ({ page }) => {
    // S6 When 作者 Xiaozhou、城市 Chengdu、日期 2026-10-11 · Then 元信息为 Xiaozhou · Chengdu · Oct 11
    const cards = page.locator(`${SECTION} ol > li`)
    await expect(cards.nth(0).locator('p').first()).toHaveText('Xiaozhou · Chengdu · Oct 11')
    await expect(cards.nth(4).locator('p').first()).toHaveText('Linshen · Hangzhou · Oct 8')
  })

  test('S7 · 互动计数三列顺序为赞 / 评 / 藏，数值保持原值', async ({ page }) => {
    // S7 When 首条帖子赞 245 · 评 42 · 藏 81 · Then 三列按该顺序渲染且各自带可读 aria-label
    const cards = page.locator(`${SECTION} ol > li`)
    const first = cards.nth(0)
    await expect(first.locator('[aria-label="Post interactions"] > span')).toHaveText([
      ALL_POSTS[0].upvotes,
      ALL_POSTS[0].comments,
      ALL_POSTS[0].bookmarks,
    ])
    await expect(first.locator(`[aria-label="${ALL_POSTS[0].upvotes} upvotes"]`)).toBeVisible()
    await expect(first.locator(`[aria-label="${ALL_POSTS[0].comments} comments"]`)).toBeVisible()
    await expect(first.locator(`[aria-label="${ALL_POSTS[0].bookmarks} bookmarks"]`)).toBeVisible()
    await expect(cards.nth(1).locator('[aria-label="Post interactions"] > span')).toHaveText([
      ALL_POSTS[1].upvotes,
      ALL_POSTS[1].comments,
      ALL_POSTS[1].bookmarks,
    ])
  })

  test('S8 · 切换城市后重新取数，排名从 01 重新开始', async ({ page }) => {
    // S8 When city 变化 · Then 回到 loading 后重新取数，新城市列表排名从 01 起
    await page.getByRole('button', { name: 'Beijing', exact: true }).click()
    await waitForUrl(page,(url) => url.searchParams.get('city') === 'beijing')

    const section = page.locator(SECTION)
    await expect(section.locator('ol > li')).toHaveCount(1)
    await expect(section.locator('ol > li > span')).toHaveText(['01'])
    await expect(section.locator('ol > li h3')).toHaveText([
      'Independent bookshops in Beijing hutongs',
    ])
    await expect(section.locator('ol > li p')).toHaveText(['Chenmo · Beijing · Oct 6'])
    await expect(section.locator('ol > li [aria-label="Post interactions"] > span')).toHaveText([
      ALL_POSTS[6].upvotes,
      ALL_POSTS[6].comments,
      ALL_POSTS[6].bookmarks,
    ])
  })

  test('S11 · 长标题换行不截断，排名与计数不被挤压', async ({ page }) => {
    // S11 When 英文标题超过 2 行 · Then 标题换行、排名与计数不被挤压、不截断语义
    // 静态数据不含超长标题，改为验证「无 line-clamp + 排名定宽 + 计数不换行」的可观察代理。
    const first = page.locator(`${SECTION} ol > li`).first()
    const metrics = await first.evaluate((element) => {
      const rank = element.querySelector('span')
      const title = element.querySelector('h3')
      const stats = element.querySelector('[aria-label="Post interactions"]')
      const titleStyle = title ? getComputedStyle(title) : null
      // 图标化统计的三列必须落在同一行，才不会被挤压成三行。
      const itemTops = stats
        ? Array.from(stats.children).map((child) => Math.round(child.getBoundingClientRect().top))
        : []
      return {
        rankWidth: rank ? rank.getBoundingClientRect().width : 0,
        titleWhiteSpace: titleStyle?.whiteSpace ?? '',
        titleLineClamp: titleStyle?.getPropertyValue('-webkit-line-clamp') ?? '',
        statsOnOneLine: itemTops.length === 3 && new Set(itemTops).size === 1,
      }
    })

    expect(metrics.rankWidth).toBe(28)
    expect(metrics.titleWhiteSpace).not.toBe('nowrap')
    expect(metrics.titleLineClamp === '' || metrics.titleLineClamp === 'none').toBe(true)
    expect(metrics.statsOnOneLine).toBe(true)
    await expectNoHorizontalOverflow(page, '桌面端热门帖子')
  })

  test('S14 · 快速连续切换城市不出现新旧城市混排', async ({ page }) => {
    // S14 When 短时间内多次切换 · Then 只渲染最后一次（Chengdu）结果，不混入其他城市帖子
    for (const city of ['Beijing', 'Shanghai', 'Chengdu']) {
      await page.getByRole('button', { name: city, exact: true }).click()
    }
    await waitForUrl(page,(url) => url.searchParams.get('city') === 'chengdu')

    const section = page.locator(SECTION)
    await expect(section.locator('ol > li h3')).toHaveText([
      'Chengdu rain, falling into a cup of tea',
      'Two days around Chengdu: old towns and bamboo groves',
    ])
    await expect(section).not.toContainText('Independent bookshops in Beijing hutongs')
    await expect(section).not.toContainText("Riding the whole Xi'an city wall")
  })
})

test.describe('U7 · 热门帖子区块 · 超窄屏 320×667', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S13 · 排名、标题与计数纵向堆叠且无横向滚动', async ({ page }) => {
    // S13 When 视口 320px · Then 计数列另起一行并左缩进对齐标题，无横向滚动
    const first = page.locator(`${SECTION} ol > li`).first()
    const layout = await first.evaluate((element) => {
      const title = element.querySelector('h3')
      const stats = element.querySelector('[aria-label="Post interactions"]')
      const titleBox = title?.getBoundingClientRect()
      const statsBox = stats?.getBoundingClientRect()
      return {
        flexWrap: getComputedStyle(element).flexWrap,
        titleTop: titleBox?.top ?? 0,
        statsTop: statsBox?.top ?? 0,
        statsPaddingLeft: stats ? getComputedStyle(stats).paddingLeft : '',
        statsWidth: statsBox?.width ?? 0,
        itemWidth: element.getBoundingClientRect().width,
      }
    })

    expect(layout.flexWrap).toBe('wrap')
    expect(layout.statsTop).toBeGreaterThan(layout.titleTop)
    // ≤640px 的计数列 width:100% + padding-left:42px，文本与标题左缘对齐。
    expect(layout.statsPaddingLeft).toBe('42px')
    expect(layout.statsWidth).toBeGreaterThan(layout.itemWidth * 0.8)
    await expectNoHorizontalOverflow(page, '320px 热门帖子')
  })
})
