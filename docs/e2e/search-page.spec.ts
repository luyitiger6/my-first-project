import { expect, test } from './support/fixtures'
import {
  NARROW_VIEWPORT,
  expectAnchorLanded,
  expectNoHorizontalOverflow,
  gotoHome,
  gotoSearch,
} from './support/helpers'

const GROUPS = 'section[aria-labelledby^="search-group-"]'

test.describe('Search · 搜索结果页 · 桌面端', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSearch(page)
  })

  test('S1 · 无 q 时渲染引导态与回首页链接，不渲染结果分组', async ({ page }) => {
    // S1 When 访问 /search · Then 渲染引导文案与回首页链接；And 不渲染任何结果分组
    await expect(page.locator('h1')).toHaveText('Search the site')
    await expect(page.locator('#main-content')).toContainText(
      'Type the name of a city, a post or an attraction to search across everything.',
    )
    const back = page.getByRole('link', { name: 'Back to the homepage' })
    await expect(back).toHaveAttribute('href', '/')
    await expect(page.locator(GROUPS)).toHaveCount(0)
  })

  test('S1 · And q 只含空白时同样进入引导态', async ({ page }) => {
    // S1 And q 只含空白 → 视为未提问，渲染引导态，无分组
    await gotoSearch(page, '   ')
    await expect(page.locator('#main-content')).toContainText(
      'Type the name of a city, a post or an attraction to search across everything.',
    )
    await expect(page.locator(GROUPS)).toHaveCount(0)
  })

  test('S2 · 三类同时命中，分组顺序固定且每组显示组名与条数', async ({ page }) => {
    // S2 When 访问 /search?q=成都 · Then 分组顺序 Editor's picks → Posts → Attractions，每组显示组名与条数
    await gotoSearch(page, '成都')
    const groups = page.locator(GROUPS)
    await expect(groups).toHaveCount(3)
    await expect(groups.locator('h2')).toHaveText(["Editor's picks", 'Posts', 'Attractions'])
    await expect(groups.locator('h2 + p')).toHaveText(['1', '2', '1'])

    await expect(groups.nth(0).locator('li')).toHaveCount(1)
    await expect(groups.nth(0)).toContainText("A gaiwan of tea in People's Park")
    await expect(groups.nth(0).locator('li')).toContainText('Chengdu · Editor Xiaozhou')

    await expect(groups.nth(1).locator('li')).toHaveCount(2)
    await expect(groups.nth(1)).toContainText('Chengdu rain, falling into a cup of tea')
    await expect(groups.nth(1)).toContainText('Two days around Chengdu: old towns and bamboo groves')
    await expect(groups.nth(1)).toContainText('Chengdu · Xiaozhou · 42 comments')

    await expect(groups.nth(2).locator('li')).toHaveCount(1)
    await expect(groups.nth(2)).toContainText('Kuanzhai Alley')
    await expect(groups.nth(2)).toContainText('Chengdu · Rating 4.3 · 17,000 views')
  })

  test('S2 · And 顶部回显总条数与去空白后的关键词', async ({ page }) => {
    // S2 And 顶部回显 {N} results for “成都”.，N = 各组 items 之和 = 4
    await gotoSearch(page, '成都')
    await expect(page.locator('#main-content')).toContainText('4 results for “成都”.')
    const counts = await page.locator(`${GROUPS} h2 + p`).allTextContents()
    expect(counts.reduce((sum, value) => sum + Number(value), 0)).toBe(4)
  })

  test('S4 · 关键词去首尾空白，结果与无空白时一致', async ({ page }) => {
    // S4 When q=%20%20chengdu%20%20 · Then 回显 chengdu，结果与 q=chengdu 完全一致
    await gotoSearch(page, '  chengdu  ')
    await expect(page.locator('#main-content')).toContainText('4 results for “chengdu”.')
    await expect(page.locator(`${GROUPS} h2`)).toHaveText(["Editor's picks", 'Posts', 'Attractions'])
    await expect(page.locator(`${GROUPS} h2 + p`)).toHaveText(['1', '2', '1'])
  })

  test('S4 · And 大小写不敏感，slug 不参与匹配（xian 零命中）', async ({ page }) => {
    // S4 And Chengdu 同样命中；英文名 Xi'an 与 slug xian 不同形，因此 xian 零命中
    await gotoSearch(page, 'Chengdu')
    await expect(page.locator('#main-content')).toContainText('4 results for “Chengdu”.')

    await gotoSearch(page, 'xian')
    await expect(page.locator('#main-content')).toContainText('Nothing found for “xian”.')
    await expect(page.locator(GROUPS)).toHaveCount(0)
  })

  test('S5 · 每组末尾回链指向首页对应锚点并可落地', async ({ page }) => {
    // S5 When 点击 See ... on the homepage · Then 跳到 /#editor-picks / /#hot-posts / /#hot-attractions
    const anchors = [
      { label: 'See editor picks on the homepage', hash: '#editor-picks' },
      { label: 'See trending posts on the homepage', hash: '#hot-posts' },
      { label: 'See popular attractions on the homepage', hash: '#hot-attractions' },
    ]

    for (const anchor of anchors) {
      await gotoSearch(page, '成都')
      const link = page.getByRole('link', { name: anchor.label })
      await expect(link).toHaveAttribute('href', `/${anchor.hash}`)
      await link.click()
      await page.waitForURL((url) => url.hash === anchor.hash)

      const section = page.locator(anchor.hash)
      await expect(section).toHaveCount(1)
      // 初次滚动发生在区块数据就绪前，落位由首页的锚点补偿组件在布局稳定后完成。
      await expect(section).toBeInViewport()
      await expect(page.locator(`${anchor.hash}-title`)).toBeInViewport()
      await expectAnchorLanded(page, anchor.hash)
    }
  })

  test('S6 · 零命中渲染空态与回首页入口，不渲染空分组', async ({ page }) => {
    // S6 When 访问 /search?q=zzz · Then 渲染 Nothing found for “zzz”. 与回首页入口；And 无空分组
    await gotoSearch(page, 'zzz')
    await expect(page.locator('#main-content')).toContainText('Nothing found for “zzz”.')
    await expect(page.getByRole('link', { name: 'Back to the homepage' })).toHaveAttribute(
      'href',
      '/',
    )
    await expect(page.locator(GROUPS)).toHaveCount(0)
  })

  test('S7 · 草稿与已删除内容不可搜', async ({ page }) => {
    // S7 When 搜索只存在于 draft / removed 内容中的文字 · Then 结果为 0 条
    // 这些条目真实存在于 Mock 数据，只是不可发布态；零命中证明发布态过滤生效。
    const draftOnlyQueries = [
      'removed old post',
      'viewing deck',
      'retired old attraction',
      'last half hour',
    ]

    for (const query of draftOnlyQueries) {
      await gotoSearch(page, query)
      await expect(page.locator('#main-content')).toContainText(`Nothing found for “${query}”.`)
      await expect(page.locator(GROUPS)).toHaveCount(0)
    }
  })

  test('S8 · 关键词含特殊字符时按纯文本回显，不解析为 HTML', async ({ page }) => {
    // S8 When q 含引号、尖括号 · Then 页面按纯文本回显，不解析 HTML、不抛异常、不 500
    const payload = '<script>alert("x")</script>'
    const dialogs: string[] = []
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message())
      await dialog.dismiss()
    })

    await gotoSearch(page, payload)
    await expect(page.locator('#main-content')).toContainText(
      `Nothing found for “${payload}”.`,
    )
    expect(await page.locator('#main-content script').count()).toBe(0)
    expect(dialogs, 'payload 不应被当作脚本执行').toEqual([])

    const response = await page.request.get(`/search?q=${encodeURIComponent(payload)}`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('&lt;script&gt;alert')
    expect(html).not.toContain('<script>alert')
  })

  test('§4.1 · 结构契约：唯一 h1、分组 section 语义、条目非链接', async ({ page }) => {
    // §4.1 全页唯一 h1；每个分组是带 aria-labelledby 的 section；条目为 li 且内部无 <a>
    await gotoSearch(page, '成都')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveText('Search the site')
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()

    const groups = page.locator(GROUPS)
    await expect(groups).toHaveCount(3)
    for (const group of await groups.all()) {
      await expect(group).toHaveAttribute('aria-labelledby', /^search-group-/)
      await expect(group.locator('h2')).toHaveCount(1)
    }
    expect(await page.locator(`${GROUPS} li a`).count()).toBe(0)
    await expect(page.locator(`${GROUPS} li`)).toHaveCount(4)
  })
})

test.describe('Search · 首页截断内容仍可被检索', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S3 · 首页列表之外的内容在搜索结果中可见', async ({ page }) => {
    // S3 When 搜索只出现在首页上限之外的内容（沙面岛 / 回民街 / 后海村） · Then 结果中包含该条目
    const cases = [
      { query: '沙面岛', section: '#hot-attractions', title: 'Shamian Island' },
      { query: '回民街', section: '#hot-posts', title: "Six in the morning on Xi'an's Muslim Quarter" },
      { query: '后海村', section: '#hot-posts', title: 'First surf lesson at Houhai Village, Sanya' },
    ]

    for (const item of cases) {
      // 先确认它确实被首页上限截断，否则这条场景就失去意义。
      // 上一轮已跳到搜索页，每轮都要先回首页再断言。
      await gotoHome(page)
      await expect(page.locator(item.section)).not.toContainText(item.title)

      await gotoSearch(page, item.query)
      await expect(page.locator('#main-content')).toContainText(item.title)
    }
  })
})

test.describe('Search · 搜索页 · 超窄屏 320×667', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await gotoSearch(page, '成都')
  })

  test('S9 · 组头改为上下两行、内边距收窄且无横向滚动', async ({ page }) => {
    // S9 When 视口 320px · Then 卡片内边距收窄，组头由横排改为上下两行；And 无横向滚动
    const firstGroup = page.locator(GROUPS).first()
    await expect(firstGroup).toBeVisible()

    const layout = await firstGroup.evaluate((element) => {
      const head = element.firstElementChild
      const heading = element.querySelector('h2')
      const count = element.querySelector('h2 + p')
      return {
        flexDirection: head ? getComputedStyle(head).flexDirection : '',
        paddingLeft: getComputedStyle(element).paddingLeft,
        paddingTop: getComputedStyle(element).paddingTop,
        headingTop: heading?.getBoundingClientRect().top ?? 0,
        countTop: count?.getBoundingClientRect().top ?? 0,
      }
    })

    expect(layout.flexDirection).toBe('column')
    expect(layout.paddingLeft).toBe('18px')
    expect(layout.paddingTop).toBe('20px')
    expect(layout.countTop).toBeGreaterThan(layout.headingTop)
    await expectNoHorizontalOverflow(page, '320px 搜索结果')
  })
})
