import type { APIRequestContext, Page } from '@playwright/test'

import { expect, test } from './support/fixtures'
import { gotoPath, saveEvidenceScreenshot, waitForUrl } from './support/helpers'

/**
 * 私信链路的浏览器验收（任务 7.1 / 8.4）。
 *
 * 与其它 spec 不同，这里**不打桩**：私信的价值就在「A 发出、B 收到、未读翻转、
 * SSE 实时到达」这套真实状态机，桩掉之后剩下的只是本文件自己写的假象。
 * 因此本文件依赖本机 8989 后端、8806 MySQL、6606 Redis 与 3000 前端 dev server，
 * 账号取 User 环境变量 `E2E_POSTS_ACCOUNT_{A,B}_{EMAIL,PASSWORD}`
 * （由 `scripts/seed-posts-accounts.ps1` 维护）。
 *
 * 用例按文件顺序串行执行（workers=1）：未读用例依赖上一条用例刚发出的消息，
 * 单独用 `-g` 跑某一条会失去前置状态。
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const EMAIL_A = process.env.E2E_POSTS_ACCOUNT_A_EMAIL ?? ''
const PASSWORD_A = process.env.E2E_POSTS_ACCOUNT_A_PASSWORD ?? ''
const EMAIL_B = process.env.E2E_POSTS_ACCOUNT_B_EMAIL ?? ''
const PASSWORD_B = process.env.E2E_POSTS_ACCOUNT_B_PASSWORD ?? ''

interface Account {
  publicId: string
  displayName: string
  email: string
}

function requireAccounts(): void {
  const missing = [
    ['E2E_POSTS_ACCOUNT_A_EMAIL', EMAIL_A],
    ['E2E_POSTS_ACCOUNT_A_PASSWORD', PASSWORD_A],
    ['E2E_POSTS_ACCOUNT_B_EMAIL', EMAIL_B],
    ['E2E_POSTS_ACCOUNT_B_PASSWORD', PASSWORD_B],
  ]
    .filter(([, value]) => value === '')
    .map(([name]) => name)
  if (missing.length > 0) {
    throw new Error(`缺少账号环境变量：${missing.join(', ')}；先运行 scripts/seed-posts-accounts.ps1`)
  }
}

function originHeaders(): Record<string, string> {
  return { Origin: BASE_URL }
}

async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<void> {
  const response = await request.post('/api/auth/login', {
    headers: originHeaders(),
    data: { email, password },
  })
  expect(response.status(), '登录端点应返回 200').toBe(200)
}

async function fetchMe(request: APIRequestContext): Promise<Account> {
  const response = await request.get('/api/auth/me')
  expect(response.status(), '/api/auth/me 应返回 200').toBe(200)
  return (await response.json()) as Account
}

/** 走真实登录表单：认证链路的 cookie 与跳转都由浏览器完成。 */
async function loginThroughForm(page: Page, email: string, password: string): Promise<void> {
  await gotoPath(page, '/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 })
}

let self: Account
let peer: Account

test.beforeAll(async ({ playwright }) => {
  requireAccounts()
  const requestA = await playwright.request.newContext({ baseURL: BASE_URL })
  const requestB = await playwright.request.newContext({ baseURL: BASE_URL })
  try {
    await apiLogin(requestA, EMAIL_A, PASSWORD_A)
    self = await fetchMe(requestA)
    await apiLogin(requestB, EMAIL_B, PASSWORD_B)
    peer = await fetchMe(requestB)
  } finally {
    await requestA.dispose()
    await requestB.dispose()
  }
})

test.describe('私信 · 真实后端链路', () => {
  test('S1/S2：列表页粘贴用户页地址新建会话并进入', async ({ page }, testInfo) => {
    await loginThroughForm(page, EMAIL_A, PASSWORD_A)
    await gotoPath(page, '/messages')
    await expect(page.getByRole('heading', { level: 1, name: 'Direct messages' })).toBeVisible()

    await page.getByLabel('Start a conversation').fill(`/users/${peer.publicId}`)
    await page.getByRole('button', { name: 'Open chat' }).click()

    await waitForUrl(page, (url) => url.pathname.startsWith('/messages/'))
    await expect(page.getByRole('heading', { level: 1, name: peer.displayName })).toBeVisible()
    await saveEvidenceScreenshot(page, testInfo, '01-new-conversation')
  })

  test('S3/S5：发送消息后气泡出现、返回列表摘要更新', async ({ page }, testInfo) => {
    const content = `DM e2e ${Date.now()}`

    await loginThroughForm(page, EMAIL_A, PASSWORD_A)
    await gotoPath(page, '/messages')
    await page.getByRole('link', { name: new RegExp(peer.displayName) }).click()
    await waitForUrl(page, (url) => url.pathname.startsWith('/messages/'))

    await page.getByRole('textbox', { name: 'Message' }).fill(content)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText(content, { exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Back to messages' }).click()
    await waitForUrl(page, (url) => url.pathname === '/messages')
    await expect(page.getByRole('link', { name: new RegExp(content) })).toBeVisible()
    await saveEvidenceScreenshot(page, testInfo, '02-sent-and-preview')
  })

  test('S4/S9：顶栏与会话未读可见，进入会话后清零', async ({ page }, testInfo) => {
    await loginThroughForm(page, EMAIL_B, PASSWORD_B)
    await gotoPath(page, '/messages')

    const badge = page.locator('header').getByRole('link', { name: /Messages/ })
    await expect(badge).toHaveText(/Messages\s*\d+\s*unread/)
    const item = page.getByRole('link', { name: new RegExp(self.displayName) })
    await expect(item).toContainText('unread')
    await saveEvidenceScreenshot(page, testInfo, '03-unread-badge')

    await item.click()
    await waitForUrl(page, (url) => url.pathname.startsWith('/messages/'))
    await expect(page.getByRole('heading', { level: 1, name: self.displayName })).toBeVisible()

    await gotoPath(page, '/messages')
    await expect(badge).toHaveText(/^Messages$/)
    await expect(page.getByRole('link', { name: new RegExp(self.displayName) })).not.toContainText('unread')
    await saveEvidenceScreenshot(page, testInfo, '04-read-cleared')
  })

  test('S6/S7：双上下文实时推送，双向都无需刷新', async ({ browser }, testInfo) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    try {
      await apiLogin(contextA.request, EMAIL_A, PASSWORD_A)
      await apiLogin(contextB.request, EMAIL_B, PASSWORD_B)

      const created = await contextA.request.post('/api/dm/conversations', {
        headers: originHeaders(),
        data: { peerPublicId: peer.publicId },
      })
      expect([200, 201], '重复发起会话应复用既有会话').toContain(created.status())
      const conversation = (await created.json()) as { publicId: string }

      const pageA = await contextA.newPage()
      const pageB = await contextB.newPage()
      await gotoPath(pageA, `/messages/${conversation.publicId}`)
      await gotoPath(pageB, `/messages/${conversation.publicId}`)
      await expect(pageA.getByRole('heading', { level: 1, name: peer.displayName })).toBeVisible()
      await expect(pageB.getByRole('heading', { level: 1, name: self.displayName })).toBeVisible()

      const outbound = `DM push A→B ${Date.now()}`
      await pageA.getByRole('textbox', { name: 'Message' }).fill(outbound)
      const outboundSentAt = Date.now()
      await pageA.getByRole('button', { name: 'Send' }).click()
      await expect(pageB.getByText(outbound, { exact: true })).toBeVisible({ timeout: 15_000 })
      const outboundLatency = Date.now() - outboundSentAt
      testInfo.annotations.push({ type: 'SSE A→B', description: `${outboundLatency}ms` })
      expect(outboundLatency, '任务 7.1：2 秒内到达').toBeLessThanOrEqual(2_000)

      const reply = `DM push B→A ${Date.now()}`
      await pageB.getByRole('textbox', { name: 'Message' }).fill(reply)
      const replySentAt = Date.now()
      await pageB.getByRole('button', { name: 'Send' }).click()
      await expect(pageA.getByText(reply, { exact: true })).toBeVisible({ timeout: 15_000 })
      const replyLatency = Date.now() - replySentAt
      testInfo.annotations.push({ type: 'SSE B→A', description: `${replyLatency}ms` })
      expect(replyLatency, '任务 7.1：2 秒内到达').toBeLessThanOrEqual(2_000)

      await saveEvidenceScreenshot(pageA, testInfo, '05-realtime-two-way')
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })

  test('S10：游客访问列表页被送回登录页', async ({ page }) => {
    await page.context().clearCookies()
    await gotoPath(page, '/messages')
    await waitForUrl(page, (url) => url.pathname === '/login')
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible()
  })
})
