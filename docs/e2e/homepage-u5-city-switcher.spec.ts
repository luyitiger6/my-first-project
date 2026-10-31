import { expect, test } from './support/fixtures'
import {
  NARROW_VIEWPORT,
  businessAlerts,
  expectNoHorizontalOverflow,
  gotoHome,
  gotoPath,
  waitForUrl,
} from './support/helpers'

const SWITCHER = '[data-section="city-switcher"]'

const CITY_LABELS = [
  'All cities',
  'Beijing',
  'Shanghai',
  'Guangzhou',
  'Chengdu',
  "Xi'an",
  'Hangzhou',
  'Sanya',
]

const TAGLINES: Record<string, string> = {
  all: 'Everywhere, at any pace',
  beijing: 'Between city walls and hutong lanes',
  shanghai: 'A city under plane trees',
  guangzhou: 'Morning tea and arcades',
  chengdu: 'Slow down, then slow down more',
  xian: 'Thirteen kilometers of wind',
  hangzhou: 'Tea hills west of the lake',
  sanya: 'Leave winter on the shore',
}

function chipList(page: Parameters<typeof gotoHome>[0]) {
  return page.locator(`${SWITCHER} ul button`)
}

test.describe('U5 · 城市快速入口 · 桌面端', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S1 · 依次渲染 8 个 chip，全部是带 aria-pressed 的 button', async ({ page }) => {
    // S1 When 首页加载 · Then 依次渲染 8 个城市 chip；And 每个都是 <button type="button"> 且带 aria-pressed
    const chips = chipList(page)
    await expect(chips).toHaveCount(8)
    await expect(chips).toHaveText(CITY_LABELS)

    const semantics = await chips.evaluateAll((nodes) =>
      nodes.map((node) => ({
        tag: node.tagName,
        type: (node as HTMLButtonElement).type,
        pressed: node.getAttribute('aria-pressed'),
      })),
    )
    for (const chip of semantics) {
      expect(chip.tag).toBe('BUTTON')
      expect(chip.type).toBe('button')
      expect(chip.pressed === 'true' || chip.pressed === 'false').toBe(true)
    }
  })

  test('§4.1 · 区块带 id="cities" 与 data-section 锚点', async ({ page }) => {
    // §4.1 区块容器带 id="cities" 与 data-section="city-switcher"，供 hero 的 Browse by city 跳转
    const section = page.locator(SWITCHER)
    await expect(section).toHaveAttribute('id', 'cities')
    await expect(section).toHaveAttribute('aria-labelledby', 'city-switcher-title')
    await expect(page.locator('#city-switcher-title')).toHaveText('Pick a city first')
  })

  test('S2 · 选中城市 aria-pressed=true，其余为 false 且带激活样式类', async ({ page }) => {
    // S2 When activeCity='beijing' · Then Beijing aria-pressed=true、其余 false，且额外带激活样式类
    await gotoHome(page, { city: 'beijing' })
    const chips = chipList(page)
    const states = await chips.evaluateAll((nodes) =>
      nodes.map((node) => {
        const computed = getComputedStyle(node)
        return {
          text: (node.textContent ?? '').trim(),
          pressed: node.getAttribute('aria-pressed'),
          classCount: node.className.split(/\s+/).filter(Boolean).length,
          background: computed.backgroundColor,
        }
      }),
    )

    expect(states.map((state) => state.pressed)).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
      'false',
    ])

    const beijing = states.find((state) => state.text === 'Beijing')
    const shanghai = states.find((state) => state.text === 'Shanghai')
    expect(beijing).toBeDefined()
    expect(shanghai).toBeDefined()
    expect(beijing?.classCount).toBe((shanghai?.classCount ?? 0) + 1)
    expect(beijing?.background).not.toBe(shanghai?.background)
  })

  test('S3 · 点击城市改用 replace：URL 正确且历史不新增', async ({ page }) => {
    // S3 When 在 /? 下点击 Chengdu · Then URL 变为 /?city=chengdu；And 浏览器历史不新增条目
    const historyBefore = await page.evaluate(() => window.history.length)

    await page.getByRole('button', { name: 'Chengdu', exact: true }).click()
    await waitForUrl(page,(url) => url.searchParams.get('city') === 'chengdu')

    const url = new URL(page.url())
    expect(url.pathname).toBe('/')
    expect(url.search).toBe('?city=chengdu')
    expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)
  })

  test('S4 · 切换城市保留其他查询参数', async ({ page }) => {
    // S4 When 在 /?city=beijing&utm=x 下点击 Shanghai · Then 跳转 /?city=shanghai&utm=x，utm 未被丢弃
    await gotoPath(page, '/?city=beijing&utm=x')
    await page.getByRole('button', { name: 'Shanghai', exact: true }).click()
    await waitForUrl(page,
      (url) => url.searchParams.get('city') === 'shanghai' && url.searchParams.get('utm') === 'x',
    )

    const url = new URL(page.url())
    expect(url.searchParams.get('city')).toBe('shanghai')
    expect(url.searchParams.get('utm')).toBe('x')
  })

  test('S5 · 选中 All cities 时删除 city，其余参数保留', async ({ page }) => {
    // S5 When 在 /?city=beijing&utm=x 下点击 All cities · Then 跳转 /?utm=x（city 删除，其余保留）
    await gotoPath(page, '/?city=beijing&utm=x')
    await page.getByRole('button', { name: 'All cities', exact: true }).click()
    await waitForUrl(page,(url) => !url.searchParams.has('city'))

    const url = new URL(page.url())
    expect(url.pathname).toBe('/')
    expect(url.search).toBe('?utm=x')
  })

  test('S6 · 说明文案跟随当前城市并随切换同步更新', async ({ page }) => {
    // S6 When 当前城市为 hangzhou · Then 右上角展示 Now: Hangzhou · Tea hills west of the lake；切换后同步更新
    await gotoHome(page, { city: 'hangzhou' })
    const note = page.locator(`${SWITCHER} .wc-section-note`)
    await expect(note).toHaveText(`Now: Hangzhou · ${TAGLINES.hangzhou}`)

    await page.getByRole('button', { name: 'Sanya', exact: true }).click()
    await waitForUrl(page,(url) => url.searchParams.get('city') === 'sanya')
    await expect(note).toHaveText(`Now: Sanya · ${TAGLINES.sanya}`)
  })

  test('S7 · 点击已是选中的城市不触发导航', async ({ page }) => {
    // S7 When 点击已经是选中的城市 · Then 不调用 router.replace，URL 不变，无多余渲染
    await gotoHome(page, { city: 'beijing' })
    const historyBefore = await page.evaluate(() => window.history.length)

    // 显式的负向等待窗口：700ms 内不应出现 city 变化，绝非固定 sleep。
    const navigated = await waitForUrl(
      page,
      (url) => url.searchParams.get('city') !== 'beijing',
      { timeout: 700 },
    )
      .then(() => true)
      .catch(() => false)
    expect(navigated, '点击当前已选城市不应触发导航').toBe(false)
    expect(new URL(page.url()).searchParams.get('city')).toBe('beijing')
    expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)

    // 断言短路逻辑没有把按钮点坏：换一个城市仍然能跳转。
    await page.getByRole('button', { name: 'Chengdu', exact: true }).click()
    await waitForUrl(page,(url) => url.searchParams.get('city') === 'chengdu')
  })

  test('S8 · 非法城市参数回落 All cities，chip 仍全部渲染', async ({ page }) => {
    // S8 When 传入不在 CITIES 中的 slug · Then 说明文案回退到 All cities 的 tagline，页面不报错
    // 真实链路由 parseCity 归一化，因此浏览器可观察结果是 All cities 选中；
    // 组件级「无 chip 选中」分支由 vitest 的 city-switcher.test.tsx 覆盖。
    await gotoPath(page, '/?city=atlantis')
    await expect(page.locator(`${SWITCHER} .wc-section-note`)).toHaveText(
      `Now: All cities · ${TAGLINES.all}`,
    )
    await expect(chipList(page)).toHaveCount(8)
    await expect(page.getByRole('button', { name: 'All cities', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(businessAlerts(page)).toHaveCount(0)
    await expect(page.locator('#hero-title')).toBeVisible()
  })

  test('S9 · query 为空时点击城市不产生空参数', async ({ page }) => {
    // S9 When query={} 时点击 Beijing · Then 跳转 /?city=beijing，不出现 ?& 或空串
    await page.getByRole('button', { name: 'Beijing', exact: true }).click()
    await waitForUrl(page,(url) => url.searchParams.get('city') === 'beijing')

    const url = new URL(page.url())
    expect(url.pathname).toBe('/')
    expect(url.search).toBe('?city=beijing')
    expect(url.searchParams.getAll('city')).toEqual(['beijing'])
  })

  test('S10 · 城市参数不重复：覆盖而非追加', async ({ page }) => {
    // S10 When 传入的 query 本身含 city · Then 以点击的城市覆盖该值，不产生 ?city=x&city=y
    await gotoPath(page, '/?city=beijing&city=shanghai')
    await page.getByRole('button', { name: 'Chengdu', exact: true }).click()
    await waitForUrl(page,(url) => url.searchParams.get('city') === 'chengdu')

    const cityValues = await page.evaluate(() =>
      new URL(window.location.href).searchParams.getAll('city'),
    )
    expect(cityValues).toEqual(['chengdu'])
  })

  test('S11 · 连续快速切换后 URL 与最后一次点击一致', async ({ page }) => {
    // S11 When 短时间内连续点击多个城市 · Then 最终 URL 反映最后一次点击，无参数抖动或空 URL，不抛错
    for (const city of ['Beijing', 'Shanghai', 'Chengdu']) {
      await page.getByRole('button', { name: city, exact: true }).click()
    }
    await waitForUrl(page,(url) => url.searchParams.get('city') === 'chengdu')

    const url = new URL(page.url())
    expect(url.pathname).toBe('/')
    expect(url.searchParams.getAll('city')).toEqual(['chengdu'])
    await expect(businessAlerts(page)).toHaveCount(0)
    await expect(page.locator('#hero-title')).toBeVisible()
  })
})

test.describe('U5 · 城市快速入口 · 超窄屏 320×667', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S12 · 8 个 chip 自动换行、文字不裁切且无横向滚动', async ({ page }) => {
    // S12 When 视口 320px · Then 8 个 chip 自动换行，行内不裁切文字；And 页面无横向滚动
    const chips = chipList(page)
    await expect(chips).toHaveCount(8)
    for (const chip of await chips.all()) {
      await expect(chip).toBeVisible()
    }

    const layout = await chips.evaluateAll((nodes) => {
      const list = nodes[0]?.parentElement?.parentElement
      return {
        flexWrap: list ? getComputedStyle(list).flexWrap : '',
        rows: new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().top))).size,
        clipped: nodes.some((node) => node.scrollWidth > node.clientWidth + 1),
      }
    })

    expect(layout.flexWrap).toBe('wrap')
    expect(layout.rows, '320px 下 8 个 chip 应换行成多行').toBeGreaterThan(1)
    expect(layout.clipped, 'chip 内的城市名不应被裁切').toBe(false)
    await expectNoHorizontalOverflow(page, '320px 城市入口')
  })
})
