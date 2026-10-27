import { expect, test } from './support/fixtures'
import {
  NARROW_VIEWPORT,
  expectNoHorizontalOverflow,
  gotoHome,
  gridColumnCount,
} from './support/helpers'

const NAV = '[data-section="feature-nav"]'

const CARDS = [
  {
    title: 'Travel community',
    description: 'See how others got around, then write your own route down.',
    action: 'Enter community →',
  },
  {
    title: 'Attraction guides',
    description: 'Pick a place by city and season that will not disappoint.',
    action: 'Browse guides →',
  },
  {
    title: 'AI assistant',
    description: 'Hand it your itinerary, budget and questions.',
    action: 'Open the placeholder panel →',
  },
]

test.describe('U3 · 功能导航栏 · 桌面端', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S1 · 恰有 3 张卡，顺序固定且每张卡四要素齐全', async ({ page }) => {
    // S1 When 首页加载 · Then 区块内恰有 3 个可交互单元，顺序 Travel community → Attraction guides → AI assistant
    const section = page.locator(NAV)
    const cards = section.locator('[data-layout="grid"] > li')
    await expect(cards).toHaveCount(3)

    const names = await section
      .locator('[data-layout="grid"] > li > a, [data-layout="grid"] > li > button')
      .evaluateAll((nodes) =>
        nodes.map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim()),
      )
    expect(names).toHaveLength(3)
    expect(names[0]).toContain('Travel community')
    expect(names[1]).toContain('Attraction guides')
    expect(names[2]).toContain('AI assistant')

    // S1 And 每张卡都含图标、标题、描述、动作文案四要素
    for (const [index, card] of CARDS.entries()) {
      const scope = cards.nth(index)
      await expect(scope.locator('svg')).toHaveCount(1)
      await expect(scope).toContainText(card.title)
      await expect(scope).toContainText(card.description)
      await expect(scope).toContainText(card.action)
    }
  })

  test('S2 · 两个路由入口分别跳转 /community 与 /attractions', async ({ page }) => {
    // S2 When 点击 Travel community / Attraction guides · Then 分别导航到对应路由，且为 <a href>
    const section = page.locator(NAV)

    const community = section.getByRole('link', { name: /Travel community/ })
    await expect(community).toHaveAttribute('href', '/community')
    await community.click()
    await page.waitForURL((url) => url.pathname === '/community')

    await gotoHome(page)
    const attractions = page.locator(NAV).getByRole('link', { name: /Attraction guides/ })
    await expect(attractions).toHaveAttribute('href', '/attractions')
    await attractions.click()
    await page.waitForURL((url) => url.pathname === '/attractions')
  })

  test('S3 · 点击 AI assistant 卡打开面板且 URL 不变', async ({ page }) => {
    // S3 When 点击 AI assistant 卡 · Then 面板出现（role=dialog）· And 当前 URL 不变、不产生历史记录
    const before = page.url()
    await page
      .locator(NAV)
      .getByRole('button', { name: /AI assistant/ })
      .click()

    await expect(page.getByRole('dialog')).toBeVisible()
    expect(page.url()).toBe(before)
  })

  test('S4 · 区块以 h2 命名，三个装饰图标被读屏跳过', async ({ page }) => {
    // S4 When 屏幕阅读器读取 · Then 区块由 feature-nav-title 命名、标题为 h2；图标 aria-hidden 且不可聚焦
    const section = page.locator(NAV)
    await expect(section).toHaveAttribute('aria-labelledby', 'feature-nav-title')
    await expect(page.locator('#feature-nav-title')).toHaveText('Where to start')
    await expect(page.locator('#feature-nav-title')).toHaveRole('heading')

    const icons = section.locator('svg')
    await expect(icons).toHaveCount(3)
    for (const icon of await icons.all()) {
      await expect(icon).toHaveAttribute('aria-hidden', 'true')
      await expect(icon).toHaveAttribute('focusable', 'false')
    }
  })

  test('S5 · Tab 顺序与视觉顺序一致', async ({ page }) => {
    // S5 When 用 Tab 遍历 · Then 焦点依次落在 Travel community → Attraction guides → AI assistant
    const section = page.locator(NAV)
    const community = section.getByRole('link', { name: /Travel community/ })
    await community.focus()
    await expect(community).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(section.getByRole('link', { name: /Attraction guides/ })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(section.getByRole('button', { name: /AI assistant/ })).toBeFocused()
  })

  test('S5 · And 键盘 Enter 可激活 AI 卡并打开面板', async ({ page }) => {
    // S5 And 每张卡 Enter / Space 均可触发
    const button = page.locator(NAV).getByRole('button', { name: /AI assistant/ })
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('S9 · 卡片高度由内容撑开，图标保持 22×22 不变形', async ({ page }) => {
    // S9 When 描述超过两行 · Then 卡片自然增高、图标与标题不被挤压变形
    // 静态文案无法真的注入超长描述，改为验证「无固定高度 + 图标尺寸不受列宽影响」这一可观察代理。
    const cards = page.locator(`${NAV} [data-layout="grid"] > li`)
    for (const card of await cards.all()) {
      const metrics = await card.evaluate((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }))
      expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1)
    }

    const icons = page.locator(`${NAV} svg`)
    const boxes = await icons.evaluateAll((nodes) =>
      nodes.map((node) => ({
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
      })),
    )
    for (const box of boxes) {
      expect(box.width).toBe(22)
      expect(box.height).toBe(22)
    }
  })
})

test.describe('U3 · 功能导航栏 · 超窄屏 320×667', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S8 · 三张卡单列堆叠、宽度充满容器且无横向滚动', async ({ page }) => {
    // S8 When 视口 320px · Then 三张卡单列堆叠，卡片宽度 = 容器宽度，无横向滚动
    const grid = page.locator(`${NAV} [data-layout="grid"]`)
    expect(await gridColumnCount(grid)).toBe(1)

    const gridBox = await grid.boundingBox()
    expect(gridBox).not.toBeNull()
    const cards = grid.locator('> li')
    for (const card of await cards.all()) {
      const box = await card.boundingBox()
      expect(box?.width ?? 0).toBeGreaterThan((gridBox?.width ?? 0) - 2)
    }

    await expectNoHorizontalOverflow(page, '320px 功能导航')
  })

  test('S8 · And 描述文案完整换行，不使用 line-clamp 截断', async ({ page }) => {
    // S8 And 描述文案换行不截断（不使用 line-clamp）
    for (const card of CARDS) {
      const description = page
        .locator(NAV)
        .getByText(card.description, { exact: true })
      await expect(description).toBeVisible()

      const style = await description.evaluate((element) => {
        const computed = getComputedStyle(element)
        return {
          whiteSpace: computed.whiteSpace,
          lineClamp: computed.getPropertyValue('-webkit-line-clamp'),
          overflow: computed.overflow,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }
      })

      expect(style.whiteSpace).not.toBe('nowrap')
      expect(style.lineClamp === '' || style.lineClamp === 'none').toBe(true)
      expect(style.scrollHeight).toBeLessThanOrEqual(style.clientHeight + 1)
    }
  })
})
