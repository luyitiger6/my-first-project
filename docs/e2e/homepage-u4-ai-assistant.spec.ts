import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import {
  NARROW_VIEWPORT,
  expectNoHorizontalOverflow,
  gotoHome,
  recordDataRequests,
} from './support/helpers'

const FLOATING = '[data-testid="ai-floating"]'
const HEADER_TRIGGER = '[data-testid="ai-header"]'
const CLOSE_LABEL = 'Close the AI assistant'

const CAPABILITIES = [
  'Build a three-day itinerary for any city',
  'Compare attractions by season and crowds',
  'Fit stays and transport to your budget',
]

async function openFromFloating(page: Page) {
  await page.getByTestId('ai-floating').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

async function bodyOverflow(page: Page): Promise<string> {
  return page.evaluate(() => document.body.style.overflow)
}

test.describe('U4 · AI 助手入口 · 桌面端', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S1 · 初始关闭：无对话框，两个触发器 aria-expanded 均为 false', async ({ page }) => {
    // S1 When 页面加载完成 · Then DOM 中不存在 [role="dialog"]，两个触发器 aria-expanded 均为 false
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('ai-floating')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('ai-header')).toHaveAttribute('aria-expanded', 'false')
  })

  test('S2 · 悬浮按钮打开面板，属性正确且 URL 不变', async ({ page }) => {
    // S2 When 点击右下角悬浮按钮 · Then dialog/aria-modal/aria-labelledby 正确，两个触发器 aria-expanded=true，URL 不变不新增历史
    const urlBefore = page.url()
    const historyBefore = await page.evaluate(() => window.history.length)

    const dialog = await openFromFloating(page)
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await expect(dialog).toHaveAttribute('aria-labelledby', 'ai-assistant-title')
    await expect(page.locator('#ai-assistant-title')).toHaveText('AI travel assistant')

    await expect(page.getByTestId('ai-floating')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('ai-header')).toHaveAttribute('aria-expanded', 'true')

    expect(page.url()).toBe(urlBefore)
    expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)
  })

  test('S2 · And 打开面板不发起业务 API 请求', async ({ page }) => {
    // S2 补充：面板为纯前端占位，打开与关闭过程不得调用任何业务接口
    // spec 的 Scenario 限定的是「打开并关闭面板期间」：根布局挂载时的会话探测（GET /api/auth/me）
    // 发生在打开面板之前，不属于面板行为。先等探测落地（加载占位消失）再开始记录，
    // 否则会把全局会话探测算到 AI 面板头上。
    await expect(page.getByTestId('account-loading')).toHaveCount(0)

    const requests = recordDataRequests(page)
    await openFromFloating(page)
    await expect(page.getByText('This is a front-end placeholder. It sends no requests.')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const apiCalls = requests.filter((url) => /\/api\//.test(url))
    expect(apiCalls, '打开与关闭 AI 面板不应发起业务 API 请求').toEqual([])
  })

  test('S3 · 顶栏按钮打开同一个面板，不产生第二份实例', async ({ page }) => {
    // S3 When 点击顶栏 AI assistant · Then 打开同一个面板（共享状态），只存在一个 dialog
    await page.getByTestId('ai-header').click()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(page.getByTestId('ai-floating')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('ai-header')).toHaveAttribute('aria-expanded', 'true')
  })

  test('S4 · Esc 关闭面板并从 DOM 移除，焦点回到触发元素', async ({ page }) => {
    // S4 When 面板打开且焦点在面板内，按 Esc · Then 面板关闭并移除，焦点回到打开前的悬浮按钮
    await openFromFloating(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('ai-floating')).toBeFocused()
  })

  test('S5 · 点击遮罩关闭面板，焦点回到触发元素', async ({ page }) => {
    // S5 When 点击面板外的半透明遮罩 · Then 面板关闭，焦点归还触发元素
    await openFromFloating(page)
    await page.getByTestId('ai-overlay').click({ position: { x: 8, y: 8 } })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('ai-floating')).toBeFocused()
  })

  test('S6 · 点击面板内部不关闭面板', async ({ page }) => {
    // S6 When 点击面板内部（标题、说明、能力清单） · Then 事件被 stopPropagation，面板保持打开
    const dialog = await openFromFloating(page)
    const urlBefore = page.url()

    await dialog.getByRole('heading', { name: 'AI travel assistant' }).click()
    await expect(dialog).toBeVisible()

    await dialog.getByText('Compare attractions by season and crowds').click()
    await expect(dialog).toBeVisible()
    expect(page.url()).toBe(urlBefore)
  })

  test('S7 · 点击右上角 × 关闭，焦点归还', async ({ page }) => {
    // S7 When 点击右上角 × · Then 面板关闭，焦点归还触发元素
    await openFromFloating(page)
    await page.getByRole('button', { name: CLOSE_LABEL }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('ai-floating')).toBeFocused()
  })

  test('S7 · 点击 Got it 关闭，焦点归还', async ({ page }) => {
    // S7 When 点击底部 Got it · Then 面板关闭，焦点归还触发元素
    await openFromFloating(page)
    await page.getByRole('button', { name: 'Got it', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('ai-floating')).toBeFocused()
  })

  test('S8 · 打开后自动聚焦关闭按钮，对话框以标题命名', async ({ page }) => {
    // S8 When 面板打开 · Then 焦点落在 aria-label="Close the AI assistant" 的按钮，读屏可读出标题 AI travel assistant
    const dialog = await openFromFloating(page)
    await expect(dialog).toHaveAccessibleName('AI travel assistant')
    await expect(page.getByRole('button', { name: CLOSE_LABEL })).toBeFocused()
    await expect(dialog.locator('h1')).toHaveCount(0)
  })

  test('S15 · Tab 在最后一个可聚焦元素上落回第一个', async ({ page }) => {
    // S15 When 焦点在最后一个可聚焦元素（Got it） · Then 按 Tab 回到第一个（关闭按钮），焦点不跑到遮罩后的页面
    const dialog = await openFromFloating(page)
    const gotIt = dialog.getByRole('button', { name: 'Got it', exact: true })
    await gotIt.focus()
    await expect(gotIt).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: CLOSE_LABEL })).toBeFocused()
    await expect(dialog).toBeVisible()
  })

  test('S16 · Shift+Tab 在第一个可聚焦元素上落回最后一个', async ({ page }) => {
    // S16 When 焦点在第一个可聚焦元素（关闭按钮） · Then 按 Shift+Tab 落到最后一个（Got it）
    const dialog = await openFromFloating(page)
    const closeButton = page.getByRole('button', { name: CLOSE_LABEL })
    await expect(closeButton).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Got it', exact: true })).toBeFocused()
  })

  test('S17 · 打开期间锁定 body 滚动，关闭后恢复原值', async ({ page }) => {
    // S17 When 面板打开 · Then body.style.overflow=hidden；And 面板自身可滚动；And 关闭后恢复打开前的原值
    const dialog = await openFromFloating(page)
    expect(await bodyOverflow(page)).toBe('hidden')

    const panelScroll = await dialog.evaluate((element) => {
      const computed = getComputedStyle(element)
      return { overflowY: computed.overflowY, maxHeight: computed.maxHeight }
    })
    expect(panelScroll.overflowY).toBe('auto')
    expect(panelScroll.maxHeight).not.toBe('none')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await bodyOverflow(page)).toBe('')

    // 原值非空时也必须原样恢复，不能被写成 'auto'。
    await page.evaluate(() => {
      document.body.style.overflow = 'scroll'
    })
    await openFromFloating(page)
    expect(await bodyOverflow(page)).toBe('hidden')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await bodyOverflow(page)).toBe('scroll')
  })

  test('S11 · 关闭后再打开，焦点归还指向最新一次触发元素', async ({ page }) => {
    // S11 When 关闭后再次打开 · Then restoreFocusRef 指向最新触发元素，不残留旧引用
    await openFromFloating(page)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('ai-floating')).toBeFocused()

    await page.getByTestId('ai-header').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('ai-header')).toBeFocused()
    await expect(page.getByTestId('ai-floating')).not.toBeFocused()
  })

  test('§3.4 · 面板文案与结构符合契约', async ({ page }) => {
    // §3.4 面板契约：Coming soon 徽标、标题、说明、三条能力、免责声明、Got it
    const dialog = await openFromFloating(page)
    await expect(dialog.getByText('Coming soon', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'AI travel assistant' })).toBeVisible()
    await expect(dialog).toContainText('Real conversation is being wired up.')
    await expect(dialog.locator('li')).toHaveText(CAPABILITIES)
    await expect(dialog).toContainText('This is a front-end placeholder. It sends no requests.')
    await expect(dialog.getByRole('button', { name: 'Got it', exact: true })).toBeVisible()
  })

  test('S13 · SSR 首屏无遮罩，只在客户端交互后出现面板', async ({ page }) => {
    // S13 When 服务端渲染 · Then 首屏 HTML 无 dialog/遮罩，只保留关闭状态的悬浮触发器
    const response = await page.request.get('/')
    expect(response.ok()).toBe(true)
    const html = await response.text()

    expect(html).toContain('data-testid="ai-floating"')
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain('data-testid="ai-overlay"')
  })
})

test.describe('U4 · AI 助手入口 · 超窄屏 320×667', () => {
  test.use({ viewport: NARROW_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S14 · 窄屏隐藏文字后悬浮按钮仍有可访问名称且可打开面板', async ({ page }) => {
    // S14 When 视口 320px · Then 悬浮按钮可点击、aria-label 仍存在，隐藏文字也不变成无名按钮
    const floating = page.getByTestId('ai-floating')
    await expect(floating).toBeVisible()
    await expect(floating).toHaveAccessibleName('Open the AI assistant')
    await expect(floating).toHaveAttribute('aria-haspopup', 'dialog')

    const text = floating.locator('span')
    await expect(text).toHaveCSS('display', 'none')

    await floating.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoHorizontalOverflow(page, '320px 打开 AI 面板')
  })
})
