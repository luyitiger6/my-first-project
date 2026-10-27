import { expect, test } from './support/fixtures'
import {
  MOBILE_VIEWPORT,
  NARROW_VIEWPORT,
  expectNoHorizontalOverflow,
  gotoHome,
} from './support/helpers'

const HERO = 'section[aria-labelledby="hero-title"]'
const TITLE = 'Turn a place you want to see into a route you can start today.'

test.describe('首页首屏 · 桌面端 1440×900', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S1 · 首屏渲染：全页唯一 h1 使用改造后的主标题', async ({ page }) => {
    // S1 When 访问 / · Then 页面出现且仅出现 1 个 h1，文案与规格一致
    const headings = page.getByRole('heading', { level: 1 })
    await expect(headings).toHaveCount(1)
    await expect(headings).toHaveText(TITLE)
    await expect(page.locator('#hero-title')).toHaveCount(1)
  })

  test('S1 · And 眉标、导语与城市规模提示与规格逐字一致', async ({ page }) => {
    // S1 And 眉标、导语、城市规模提示文本与 §1.1 一致
    const hero = page.locator(HERO)
    await expect(hero).toContainText('wanderchain · City travel guide')
    await expect(hero).toContainText(
      '7 cities, routes walked by our editors, posts being discussed right now, and places worth the detour — all behind one search box.',
    )
    await expect(hero).toContainText('Currently covering 7 cities, re-walked by our editors every week.')
  })

  test('S2 · 背景图为 alt 为空的装饰图且 sizes 为 100vw', async ({ page }) => {
    // S2 When 首屏渲染 · Then 背景图为 <img>，alt 为空、sizes="100vw"，带 priority 提示
    const image = page.locator(HERO).locator('img')
    await expect(image).toHaveCount(1)
    await expect(image).toHaveAttribute('alt', '')
    await expect(image).toHaveAttribute('sizes', '100vw')
    // Next 16 的 priority 提示体现在 head 的 <link rel="preload" as="image">，
    // 图片元素本身不再保证带 fetchpriority 属性。
    const preload = page.locator('head link[rel="preload"][as="image"]')
    await expect(preload).toHaveCount(1)
    const preloadSrcSet = await preload.getAttribute('imagesrcset')
    expect(preloadSrcSet).toContain('images.unsplash.com')
    // priority 图片不得退化为懒加载；Next 16 不再强制写 loading="eager"。
    expect(await image.getAttribute('loading')).not.toBe('lazy')
  })

  test('S2 · And 背景图由自定义 loader 直达 CDN，不经过 /_next/image', async ({ page }) => {
    // S2 And 由自定义 loader 按宽度档位直接向 CDN 取图，不经过 Next 的图片优化端点
    const image = page.locator(HERO).locator('img')
    const src = await image.getAttribute('src')
    expect(src).toBeTruthy()
    expect(src).toContain('images.unsplash.com')
    expect(src).toContain('w=')
    expect(src).not.toContain('/_next/image')

    const srcset = await image.getAttribute('srcset')
    expect(srcset).toBeTruthy()
    expect((srcset ?? '').split(',').filter(Boolean).length).toBeGreaterThan(1)

    const optimizedRequests = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.includes('/_next/image')),
    )
    expect(optimizedRequests).toEqual([])
  })

  test('S3 · 输入关键词回车后以 GET 跳到 /search?q=', async ({ page }) => {
    // S3 When 输入关键词并提交 · Then 浏览器以 GET 跳到 /search?q=<关键词>
    const form = page.getByRole('search')
    await expect(form).toHaveAttribute('action', '/search')
    await expect(form).toHaveAttribute('method', 'get')

    const input = page.locator('#hero-search')
    await expect(input).toHaveAttribute('name', 'q')
    await input.fill('chengdu')
    await input.press('Enter')

    await page.waitForURL((url) => url.pathname === '/search' && url.searchParams.get('q') === 'chengdu')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search the site')
  })

  test('S3 · And 空输入被 required 拦在浏览器端，不产生空查询', async ({ page }) => {
    // S3 And 输入为空时被 required 拦在浏览器端，不产生空查询请求
    const input = page.locator('#hero-search')
    await expect(input).toHaveAttribute('required', '')

    const validationMessage = await input.evaluate(
      (element) => (element as HTMLInputElement).validationMessage,
    )
    expect(validationMessage.length).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Search', exact: true }).click()
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('S4 · 文字入口 “Enter the travel community” 跳转 /community', async ({ page }) => {
    // S4 When 点击文字入口 · Then 跳转 /community
    const link = page.locator(HERO).getByRole('link', { name: 'Enter the travel community' })
    await expect(link).toHaveAttribute('href', '/community')
    await link.click()
    await page.waitForURL((url) => url.pathname === '/community')
  })

  test('S4 · 文字入口 “Browse attraction guides” 跳转 /attractions', async ({ page }) => {
    // S4 When 点击文字入口 · Then 跳转 /attractions
    const link = page.locator(HERO).getByRole('link', { name: 'Browse attraction guides' })
    await expect(link).toHaveAttribute('href', '/attractions')
    await link.click()
    await page.waitForURL((url) => url.pathname === '/attractions')
  })

  test('S4 · 文字入口 “Browse by city” 滚动到 #cities 且不改变路径', async ({ page }) => {
    // S4 When 点击文字入口 · Then 滚动到 id="cities" · And 不改变 URL 路径、不整页刷新
    const link = page.locator(HERO).getByRole('link', { name: 'Browse by city →' })
    await expect(link).toHaveAttribute('href', '#cities')
    await link.click()

    await expect(page.locator('#cities')).toBeInViewport()
    expect(new URL(page.url()).pathname).toBe('/')
    expect(new URL(page.url()).hash).toBe('#cities')
  })

  test('S5 · 城市规模提示的数字等于白名单非 all 城市数', async ({ page }) => {
    // S5 When 城市白名单增减一座城市 · Then 提示数字随之变化 · And 不含 all
    const meta = page
      .locator(HERO)
      .locator('p')
      .filter({ hasText: 'Currently covering' })
    await expect(meta).toHaveText(
      'Currently covering 7 cities, re-walked by our editors every week.',
    )

    const chips = page.locator('#cities button')
    const chipCount = await chips.count()
    const stated = Number(/(\d+) cities/.exec(await meta.innerText())?.[1])
    expect(stated).toBe(chipCount - 1)
  })

  test('S6 · 带 city 参数时首屏内容与无参数完全一致', async ({ page }) => {
    // S6 When 访问 /?city=beijing · Then 首屏与无参数时完全一致 · And 城市语义只由下方区块体现
    const hero = page.locator(HERO)
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
    const baseline = normalize(await hero.innerText())

    await gotoHome(page, { city: 'beijing' })
    await expect(page.getByRole('button', { name: 'Beijing', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(normalize(await hero.innerText())).toBe(baseline)
    await expect(hero).not.toContainText('Beijing')
  })

  test('S9 · 客户端 JS 未执行时原始 HTML 已包含全部首屏内容', async ({ page }) => {
    // S9 When 首屏 HTML 已到达但 JS 尚未执行 · Then 眉标、标题、导语、搜索框、入口、规模提示全部可见
    // 浏览器端无法真的“禁用 JS 后再断言可见”，改用未执行客户端脚本的原始 HTML 代理。
    const response = await page.request.get('/')
    expect(response.ok()).toBe(true)
    const html = await response.text()
    // React 会在数字与文字之间插入 <!-- --> 分隔符，剥掉注释后再断言可见文本。
    const visibleHtml = html.replace(/<!--[\s\S]*?-->/g, '')

    expect(visibleHtml).toContain('wanderchain · City travel guide')
    expect(visibleHtml).toContain(TITLE)
    expect(visibleHtml).toContain('7 cities, routes walked by our editors')
    expect(visibleHtml).toContain('Currently covering 7 cities')
    expect(visibleHtml).toContain('Enter the travel community')
    expect(visibleHtml).toContain('Browse attraction guides')
    expect(visibleHtml).toContain('href="#cities"')

    // S9 And 表单可直接提交，不依赖 useEffect 才出现
    expect(html).toContain('id="hero-search"')
    expect(html).toContain('name="q"')
    expect(html).toContain('action="/search"')
    expect(html).toContain('method="get"')
  })

  test('S10 · prefers-reduced-motion 下无位移、缩放或自动播放', async ({ page }) => {
    // S10 When prefers-reduced-motion: reduce · Then 无位移 / 缩放 / 自动播放类过渡
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.locator('#hero-title')).toBeVisible()

    const movements = await page.locator(`${HERO} *`).evaluateAll((elements) =>
      elements.flatMap((element) => {
        const style = getComputedStyle(element)
        const issues: string[] = []
        const duration = Number.parseFloat(style.transitionDuration) || 0
        // globals.css 在 reduce 下把时长压到 0.01ms（1e-05s）；低于 1ms 视为瞬时。
        if (/transform|translate|scale|rotate/.test(style.transitionProperty) && duration >= 0.001) {
          issues.push(`transition:${style.transitionProperty}:${style.transitionDuration}`)
        }
        if (
          style.animationName !== 'none' &&
          (Number.parseFloat(style.animationDuration) || 0) >= 0.001
        ) {
          issues.push(`animation:${style.animationName}`)
        }
        return issues
      }),
    )
    expect(movements).toEqual([])
  })
})

test.describe('首页首屏 · 移动端 375×667', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S8 · 600px 以下搜索框已改为纵向且页面无横向滚动', async ({ page }) => {
    // S8 When 视口宽度 ≤ 600px · Then 搜索框改为纵向 · And 无横向滚动条
    const form = page.getByRole('search')
    await expect(form).toHaveCSS('flex-direction', 'column')

    const formBox = await form.boundingBox()
    const buttonBox = await form.getByRole('button', { name: 'Search' }).boundingBox()
    expect(formBox).not.toBeNull()
    expect(buttonBox).not.toBeNull()
    expect(buttonBox?.width ?? 0).toBeGreaterThan((formBox?.width ?? 0) * 0.9)

    await expectNoHorizontalOverflow(page, '375px 首屏')
  })
})

test.describe('首页首屏 · 超窄屏 320×667', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S8 · 搜索框纵向排列且按钮满宽', async ({ page }) => {
    // S8 When 视口宽度 320px · Then 输入在上、按钮在下，按钮满宽
    const form = page.getByRole('search')
    await expect(form).toHaveCSS('flex-direction', 'column')

    const formBox = await form.boundingBox()
    const inputBox = await page.locator('#hero-search').boundingBox()
    const buttonBox = await form.getByRole('button', { name: 'Search' }).boundingBox()
    expect(formBox).not.toBeNull()
    expect(inputBox).not.toBeNull()
    expect(buttonBox).not.toBeNull()

    expect(buttonBox?.y ?? 0).toBeGreaterThan(inputBox?.y ?? 0)
    expect(buttonBox?.width ?? 0).toBeGreaterThan((formBox?.width ?? 0) * 0.9)
  })

  test('S8 · And 标题缩到 clamp 下限 36px 且自然换行不截断', async ({ page }) => {
    // S8 And 标题按 clamp(36px, 5.6vw, 64px) 缩到下限并自然换行，不截断、不省略
    const title = page.locator('#hero-title')
    await expect(title).toHaveCSS('font-size', '36px')

    const metrics = await title.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        height: element.getBoundingClientRect().height,
        fontSize: Number.parseFloat(style.fontSize),
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
        overflow: style.overflow,
        lineClamp: style.getPropertyValue('-webkit-line-clamp'),
      }
    })

    expect(metrics.height).toBeGreaterThan(metrics.fontSize * 1.5)
    expect(metrics.whiteSpace).not.toBe('nowrap')
    expect(metrics.textOverflow).not.toBe('ellipsis')
    expect(metrics.overflow).toBe('visible')
    expect(metrics.lineClamp === '' || metrics.lineClamp === 'none').toBe(true)
  })

  test('S8 · And 页面无横向滚动条', async ({ page }) => {
    // S8 And 页面无横向滚动条（scrollWidth <= clientWidth）
    await expectNoHorizontalOverflow(page, '320px 首屏')
  })
})
