import { expect, test } from './support/fixtures'
import {
  businessAlerts,
  gotoHome,
  gotoPath,
  observedText,
  waitForUrl,
  watchText,
} from './support/helpers'

const SECTION_ORDER = [
  'feature-nav',
  'city-switcher',
  'editor-picks',
  'hot-posts',
  'hot-attractions',
]

const SECTION_TITLES = [
  'Where to start',
  'Pick a city first',
  "Editor's picks",
  'Trending posts',
  'Popular attractions',
]

test.describe('U2 · 首页骨架与区块编排', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S1 · 五个 [data-section] 的出现顺序固定', async ({ page }) => {
    // S1 When 访问 / · Then [data-section] 顺序恒为 feature-nav → city-switcher → editor-picks → hot-posts → hot-attractions
    const order = await page
      .locator('[data-section]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-section')))
    expect(order).toEqual(SECTION_ORDER)
  })

  test('S1 · And 每个区块的可见标题与规格一致', async ({ page }) => {
    // S1 And 每个区块可见标题依次为 Where to start / Pick a city first / Editor's picks / Trending posts / Popular attractions
    await expect(page.locator('[data-section] h2')).toHaveText(SECTION_TITLES)
  })

  test('S4 · 首页框架完整：顶栏、页脚、浮动 AI 按钮、跳过链接', async ({ page }) => {
    // S4 When 访问首页 · Then 顶栏、页脚、浮动 AI 按钮、跳过导航链接均存在
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
    await expect(page.getByTestId('ai-floating')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeVisible()
    await expect(page.locator('#main-content')).toHaveCount(1)
  })

  test('S4 · And 跳过链接可直达主内容锚点', async ({ page }) => {
    // S4 And 主内容区带 id="main-content"，跳过链接可直达
    // 跳过链接在未聚焦时位于视口外，只能通过键盘激活，这也正是它的真实用法。
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await skip.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeInViewport()
    expect(new URL(page.url()).hash).toBe('#main-content')
  })

  test('S5 · 三个内容区块从 loading 进入 ready 并渲染列表', async ({ page }) => {
    // S5 When 区块数据 resolve · Then 状态由 loading 变为 ready，列表渲染，加载提示消失
    await expect(page.getByRole('status')).toHaveCount(0)
    await expect(page.locator('#editor-picks ul li')).toHaveCount(6)
    await expect(page.locator('#hot-posts ol li')).toHaveCount(10)
    await expect(page.locator('#hot-attractions ul li')).toHaveCount(5)
  })

  test('S13 · 缺少 searchParams 时城市为 all 且页面正常渲染', async ({ page }) => {
    // S13 When searchParams 为 {} · Then 城市为 all、query 为空对象、页面正常渲染
    await expect(page.getByRole('button', { name: 'All cities', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator('[data-section]')).toHaveCount(5)
    expect(new URL(page.url()).search).toBe('')
  })

  test('S10 · 城市变化触发三个内容区块重新取数', async ({ page }) => {
    // S10 When city 发生变化 · Then 三个内容区块重新进入 loading 并各自重新取数
    await watchText(page, '[role="status"]', [
      "Our editors are picking this week's routes…",
      "Measuring this week's buzz…",
      'Gathering attraction data…',
    ])

    await page.getByRole('button', { name: 'Shanghai', exact: true }).click()
    await waitForUrl(page,(url) => url.searchParams.get('city') === 'shanghai')

    await expect(page.locator('#editor-picks')).toContainText(
      'Plane trees and coffee on Wukang Road',
    )
    await expect(page.locator('#editor-picks')).not.toContainText("A gaiwan of tea in People's Park")

    const seen = await observedText(page)
    expect(
      seen,
      '城市切换后应至少有一个内容区块出现加载态',
    ).toContain("Our editors are picking this week's routes…")
  })

  test('S11 · 连续切换城市不产生卸载后 setState 警告', async ({ page }) => {
    // S11 When 取数未 resolve 时 city 再次变化 · Then 旧结果被丢弃，控制台无卸载警告
    // 浏览器端无法直接观察「在途请求被丢弃」，用连续切换 + 控制台警告代理。
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    for (const city of ['Beijing', 'Shanghai', 'Chengdu']) {
      await page.getByRole('button', { name: city, exact: true }).click()
      await waitForUrl(page,(url) => url.searchParams.get('city') === city.toLowerCase())
    }

    await expect(page.locator('#editor-picks')).toContainText("A gaiwan of tea in People's Park")
    const unmountedWarnings = consoleErrors.filter((text) =>
      /unmounted|state update on an unmounted/i.test(text),
    )
    expect(unmountedWarnings).toEqual([])
  })
})

test.describe('U2 · 城市参数', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S2 · 城市参数下发到城市入口与三个内容区块', async ({ page }) => {
    // S2 When 访问 /?city=beijing · Then Beijing 选中，三个内容区块以 beijing 请求数据
    await gotoHome(page, { city: 'beijing' })
    await expect(page.getByRole('button', { name: 'Beijing', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await expect(page.locator('#editor-picks')).toContainText(
      'A walk through the Forbidden City at dusk',
    )
    await expect(page.locator('#editor-picks')).not.toContainText(
      'Plane trees and coffee on Wukang Road',
    )
    await expect(page.locator('#hot-posts ol li')).toHaveCount(1)
    await expect(page.locator('#hot-posts')).toContainText(
      'Independent bookshops in Beijing hutongs',
    )
    await expect(page.locator('#hot-attractions ul li')).toHaveCount(1)
    await expect(page.locator('#hot-attractions')).toContainText('The Palace Museum')
  })

  test('S3 · 其余单值参数在城市切换后被保留', async ({ page }) => {
    // S3 When 访问 /?city=chengdu&utm=x · Then 其余单值参数保留在 query 对象中供切换时沿用
    await gotoPath(page, '/?city=chengdu&utm=x')
    await expect(page.getByRole('button', { name: 'Chengdu', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await page.getByRole('button', { name: 'Shanghai', exact: true }).click()
    await waitForUrl(page,
      (url) => url.searchParams.get('city') === 'shanghai' && url.searchParams.get('utm') === 'x',
    )
  })

  test('S6 · 非法城市回落 all 且页面不报错', async ({ page }) => {
    // S6 When 访问 /?city=atlantis · Then 归一化为 all，All cities 选中，页面不报错、不空白
    await gotoPath(page, '/?city=atlantis')
    await expect(page.getByRole('button', { name: 'All cities', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator('#hero-title')).toBeVisible()
    await expect(businessAlerts(page)).toHaveCount(0)
  })

  test('S12 · 重复查询参数取首值且不导致渲染异常', async ({ page }) => {
    // S12 When URL 含重复参数 ?city=beijing&city=shanghai · Then toQuery 与 parseCity 都取首值 beijing
    await gotoPath(page, '/?city=beijing&city=shanghai')
    await expect(page.getByRole('button', { name: 'Beijing', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Shanghai', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(page.locator('#hero-title')).toBeVisible()
  })
})

test.describe('U2 · 空数据', () => {
  test.beforeEach(async ({ page }) => {
    // 广州没有编辑精选，但仍有帖子与景点：这是真实数据可触发的空态。
    await gotoHome(page, { city: 'guangzhou' })
  })

  test('S9 · 空数据只展示空态，不与错误态并存', async ({ page }) => {
    // S9 When 区块返回 { items: [], total: 0 } · Then 展示空态文案，不展示错误提示
    // 真实数据每个城市都至少有一条 city=all 的精选，浏览器端构造不出 items: []。
    // 可观察代理：广州只回退到全城通用精选、不进入错误态；空态渲染由 vitest 覆盖。
    const section = page.locator('#editor-picks')
    await expect(section.locator('ul li')).toHaveCount(1)
    await expect(section).toContainText('Seven days, one backpack')
    await expect(section).not.toContainText("No editor's picks in Guangzhou yet.")
    await expect(section.getByRole('alert')).toHaveCount(0)
  })
})

test.describe('U2 · 多路由页面框架', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S4 · /search 同样具备完整站点头尾与浮动按钮', async ({ page }) => {
    // S4 When 访问 /search · Then 顶栏、页脚、浮动 AI 按钮、跳过链接均存在
    await gotoPath(page, '/search')
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
    await expect(page.getByTestId('ai-floating')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeVisible()
    await expect(page.locator('#main-content')).toHaveCount(1)
  })

  test('S4 · 两个占位页同样具备完整站点头尾与浮动按钮', async ({ page }) => {
    // S4 When 访问 /community 或 /attractions · Then 顶栏、页脚、浮动 AI 按钮、跳过链接均存在
    for (const path of ['/community', '/attractions']) {
      await gotoPath(page, path)
      await expect(page.locator('header')).toBeVisible()
      await expect(page.locator('footer')).toBeVisible()
      await expect(page.getByTestId('ai-floating')).toBeVisible()
      await expect(page.locator('#main-content')).toHaveCount(1)
    }
  })

  test('S4 · 登录与注册页是独立品牌页，不套站点头尾', async ({ page }) => {
    // S4 And 登录、注册是独立品牌页，只保留跳过链接与主内容锚点，不套站点头尾
    for (const path of ['/login', '/register']) {
      await gotoPath(page, path)
      await expect(page.locator('header')).toHaveCount(0)
      await expect(page.locator('footer')).toHaveCount(0)
      await expect(page.locator('#main-content')).toHaveCount(1)
      await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeVisible()
    }
  })
})
