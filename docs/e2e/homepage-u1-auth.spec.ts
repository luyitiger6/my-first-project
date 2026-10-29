import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import {
  CAPTCHA_BODY,
  ME_BODY,
  UNAUTHENTICATED_BODY,
  businessAlerts,
  expectNoBrowserReadableAuthState,
  gotoHome,
  gotoPath,
  recordAuthRequests,
  stubAuthApi,
  type RecordedAuthRequest,
} from './support/helpers'

/**
 * U1 · 认证前端接入。
 *
 * 断言对象是前端对外的契约：请求打到哪个端点、请求体字段名逐字是什么、
 * 收到某个错误码之后界面怎么走、令牌与用户资料有没有落进浏览器可读存储。
 * 后端自身的行为（bcrypt 时序、限流计数、cookie 属性）由 backend 的测试负责，
 * 这里一律用 `page.route` 桩掉 `/api/auth/*`——既让这条链路不依赖 MySQL / Redis，
 * 也避免反复失败登录把本地那个共享的限流桶踩满。
 */

const header = (page: Page) => page.locator('header')

const REGISTER_RESPONSE = {
  publicId: '01JACCOUNT0000000000000',
  email: 'new.walker@wanderchain.dev',
  displayName: 'New Walker',
}

/** 首次探测无会话，其后有会话：登录/注册成功后的刷新应当看到已登录状态。 */
function sessionProbeAfterLogin(account = ME_BODY) {
  let calls = 0
  return () => {
    calls += 1
    return calls === 1
      ? { status: 401, body: UNAUTHENTICATED_BODY }
      : { status: 200, body: account }
  }
}

/**
 * 开发模式下 React StrictMode 会双调用挂载 effect，所以「进页面探测一次会话」在 dev server 上
 * 实际发两条 `GET /me`，注册页也会取两张图形码。这是 React 故意用来暴露副作用不幂等的行为，
 * 生产构建下不会发生（`AuthProvider` 的 effect 带 `cancelled` 标志，双调用不会写脏状态）。
 *
 * 因此下面的断言钉住的是**计数关系与先后顺序**，而不是绝对序列：
 * 该发的一次不能少（登录成功后必须再探测一次），不该发的一次不能多（第一步失败时 `/register` 必须是 0）。
 */
function countPath(requests: RecordedAuthRequest[], path: string) {
  return requests.filter((request) => request.path === path).length
}

function bodiesOf(requests: RecordedAuthRequest[], path: string) {
  return requests.filter((request) => request.path === path).map((request) => request.body)
}

function firstIndexOf(requests: RecordedAuthRequest[], path: string) {
  return requests.findIndex((request) => request.path === path)
}

test.describe('U1 · 会话状态只来自服务端', () => {
  test('A1 · /me 返回 401 时顶栏展示登录入口，不展示任何用户信息', async ({ page }) => {
    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
    })

    await gotoHome(page)

    const link = page.getByRole('link', { name: 'Log in / Sign up' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/login')
    await expect(header(page).getByRole('button', { name: 'Log out' })).toHaveCount(0)
  })

  test('A2 · /me 返回账户时顶栏展示 displayName，且没有角色徽章', async ({ page }) => {
    await stubAuthApi(page, { '/api/auth/me': { body: ME_BODY } })

    await gotoHome(page)

    await expect(header(page).getByText('Editor Lan', { exact: true })).toBeVisible()
    await expect(header(page).getByRole('button', { name: 'Log out' })).toBeVisible()
    // 后端没有角色模型，界面也就不该有基于角色的徽章。
    await expect(header(page).getByText('Editor', { exact: true })).toHaveCount(0)
  })

  test('A3 · /me 返回 5xx 时页面照常渲染为访客态，不白屏', async ({ page }) => {
    await stubAuthApi(page, {
      '/api/auth/me': { status: 503, body: { code: 'VALIDATION_FAILED', message: '上游不可用' } },
    })

    await gotoHome(page)

    await expect(page.locator('#hero-title')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Log in / Sign up' })).toBeVisible()
    await expect(businessAlerts(page)).toHaveCount(0)
  })

  test('A4 · 服务端首帧只有加载占位，不泄露任何账户信息', async ({ page }) => {
    await stubAuthApi(page, { '/api/auth/me': { body: ME_BODY } })

    const response = await page.request.get('/')
    expect(response.ok()).toBe(true)
    const html = await response.text()

    expect(html).toContain('data-testid="account-loading"')
    expect(html).not.toContain('Editor Lan')
    expect(html).not.toContain('Log out')
  })

  test('A5 · 已登录状态下浏览器可读存储一片空白', async ({ page }) => {
    await stubAuthApi(page, { '/api/auth/me': { body: ME_BODY } })

    await gotoHome(page)
    await expect(header(page).getByText('Editor Lan', { exact: true })).toBeVisible()

    await expectNoBrowserReadableAuthState(page)
  })
})

test.describe('U1 · 登录页 /login', () => {
  test('A6 · 凭证正确直接登录，全程不请求图形码端点', async ({ page }) => {
    const requests = recordAuthRequests(page)
    await stubAuthApi(page, {
      '/api/auth/me': sessionProbeAfterLogin(),
      '/api/auth/login': {
        body: { ...ME_BODY, displayName: 'Login Response Name', expiresAt: '2026-11-05T03:00:00Z' },
      },
    })

    await gotoPath(page, '/login')
    await page.getByLabel('Email', { exact: true }).fill('editor@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('password1')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()

    await page.waitForURL((url) => url.pathname === '/')
    // 顶栏显示的是 /me 的返回值，而不是登录响应里的近似值：会话只有一个真源。
    await expect(header(page).getByText('Editor Lan', { exact: true })).toBeVisible()
    await expect(header(page).getByText('Login Response Name')).toHaveCount(0)

    expect(countPath(requests, '/api/auth/login')).toBe(1)
    expect(bodiesOf(requests, '/api/auth/login')).toEqual([
      { email: 'editor@wanderchain.dev', password: 'password1' },
    ])
    // 挂载探测是第一个请求，登录之后必须再探测一次：会话的唯一真源是 /me。
    expect(requests[0].path).toBe('/api/auth/me')
    expect(countPath(requests, '/api/auth/me')).toBeGreaterThanOrEqual(2)
    expect(requests[requests.length - 1].path).toBe('/api/auth/me')
    expect(firstIndexOf(requests, '/api/auth/login')).toBeLessThan(
      requests.map((request) => request.path).lastIndexOf('/api/auth/me'),
    )
    // 登录全程不碰图形码端点：不预取，也就少一个可被探测的入口。
    expect(countPath(requests, '/api/auth/captcha')).toBe(0)
  })

  test('A7 · 401 只给一句统一凭证文案，不区分邮箱是否存在', async ({ page }) => {
    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
      '/api/auth/login': { status: 401, body: UNAUTHENTICATED_BODY },
    })

    await gotoPath(page, '/login')
    await page.getByLabel('Email', { exact: true }).fill('nobody@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('password1')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()

    await expect(businessAlerts(page)).toHaveText('The email or password is incorrect.')
    expect(new URL(page.url()).pathname).toBe('/login')
    await expectNoBrowserReadableAuthState(page)
  })

  test('A8 · 收到 CAPTCHA_INVALID 才出现图形码，带码重试的请求体含图形码字段', async ({ page }) => {
    const requests = recordAuthRequests(page)
    let loginCalls = 0
    await stubAuthApi(page, {
      '/api/auth/me': sessionProbeAfterLogin(),
      '/api/auth/captcha': { body: CAPTCHA_BODY },
      '/api/auth/login': () => {
        loginCalls += 1
        return loginCalls === 1
          ? { status: 400, body: { code: 'CAPTCHA_INVALID', message: '图形验证码错误或已过期' } }
          : { body: ME_BODY }
      },
    })

    await gotoPath(page, '/login')
    // 登录页初始状态不预取图形码。
    await expect(page.getByLabel('Image code')).toHaveCount(0)

    await page.getByLabel('Email', { exact: true }).fill('editor@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('wrong-password')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()

    await expect(page.getByLabel('Image code')).toBeVisible()
    await expect(page.getByAltText('Image verification challenge')).toBeVisible()

    await page.getByLabel('Image code').fill('a1b2')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()

    await page.waitForURL((url) => url.pathname === '/')
    const loginRequests = requests.filter((request) => request.path === '/api/auth/login')
    expect(loginRequests).toHaveLength(2)
    expect(loginRequests[0].body).toEqual({
      email: 'editor@wanderchain.dev',
      password: 'wrong-password',
    })
    expect(loginRequests[1].body).toEqual({
      email: 'editor@wanderchain.dev',
      password: 'wrong-password',
      captchaId: CAPTCHA_BODY.captchaId,
      captchaAnswer: 'a1b2',
    })
    expect(requests.some((request) => request.path === '/api/auth/captcha')).toBe(true)
  })

  test('A9 · 限流时展示 Retry-After 的秒数，且不自动重试', async ({ page }) => {
    const requests = recordAuthRequests(page)
    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
      '/api/auth/login': {
        status: 429,
        body: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' },
        headers: { 'retry-after': '45' },
      },
    })

    await gotoPath(page, '/login')
    await page.getByLabel('Email', { exact: true }).fill('editor@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('password1')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()

    await expect(businessAlerts(page)).toContainText('45 seconds')
    expect(requests.filter((request) => request.path === '/api/auth/login')).toHaveLength(1)
  })

  test('A10 · 两个 403 文案不同：邮箱未验证与来源不可信', async ({ page }) => {
    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
      '/api/auth/login': { status: 403, body: { code: 'EMAIL_UNVERIFIED', message: '邮箱尚未验证' } },
    })
    await gotoPath(page, '/login')
    await page.getByLabel('Email', { exact: true }).fill('editor@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('password1')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(businessAlerts(page)).toContainText('not been verified')
    const unverifiedText = await businessAlerts(page).textContent()

    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
      '/api/auth/login': {
        status: 403,
        body: { code: 'CROSS_SITE_REJECTED', message: '请求来源不可信' },
      },
    })
    await gotoPath(page, '/login')
    await page.getByLabel('Email', { exact: true }).fill('editor@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('password1')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(businessAlerts(page)).toContainText('origin is not trusted')

    expect(unverifiedText).not.toBe(await businessAlerts(page).textContent())
  })

  test('A11 · 密码提示的下限是 8 而不是 6', async ({ page }) => {
    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
    })

    await gotoPath(page, '/login')

    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
      'placeholder',
      'At least 8 characters (up to 72)',
    )
    await expect(page.getByText('Demo account: admin@wanderchain.dev / admin123')).toHaveCount(0)
  })
})

test.describe('U1 · 注册页 /register', () => {
  test('A12 · 进入注册页即取一张图形码，第一步按钮是换发邮箱码', async ({ page }) => {
    const requests = recordAuthRequests(page)
    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
      '/api/auth/captcha': { body: CAPTCHA_BODY },
    })

    await gotoPath(page, '/register')

    await expect(page.getByLabel('Image code')).toBeVisible()
    await expect(page.getByAltText('Image verification challenge')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send email code' })).toBeVisible()
    await expect(page.getByText(/Step 1 of 2/)).toBeVisible()
    expect(countPath(requests, '/api/auth/me')).toBeGreaterThanOrEqual(1)
    expect(countPath(requests, '/api/auth/captcha')).toBeGreaterThanOrEqual(1)
    // 第一步只换邮箱码，既不该登录也不该注册。
    expect(countPath(requests, '/api/auth/login')).toBe(0)
    expect(countPath(requests, '/api/auth/register')).toBe(0)
    expect(countPath(requests, '/api/auth/register-code')).toBe(0)
  })

  test('A13 · 两步各发一次请求，字段名取自契约，成功后离开注册页', async ({ page }) => {
    const requests = recordAuthRequests(page)
    await stubAuthApi(page, {
      '/api/auth/me': sessionProbeAfterLogin({
        ...ME_BODY,
        email: REGISTER_RESPONSE.email,
        displayName: REGISTER_RESPONSE.displayName,
      }),
      '/api/auth/captcha': { body: CAPTCHA_BODY },
      '/api/auth/register-code': { status: 202, body: {} },
      '/api/auth/register': { body: REGISTER_RESPONSE },
    })

    await gotoPath(page, '/register')
    await page.getByLabel('Username', { exact: true }).fill('New Walker')
    await page.getByLabel('Email', { exact: true }).fill('new.walker@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('walker12345')
    await page.getByLabel('Confirm password', { exact: true }).fill('walker12345')
    await page.getByLabel('Image code').fill('a1b2')
    await page.getByRole('button', { name: 'Send email code' }).click()

    await expect(page.getByLabel('Email code')).toBeVisible()
    await expect(page.getByText(/Step 2 of 2/)).toBeVisible()

    await page.getByLabel('Email code').fill('654321')
    await page.getByRole('button', { name: 'Sign up and log in' }).click()

    await page.waitForURL((url) => url.pathname === '/')
    await expect(header(page).getByText('New Walker', { exact: true })).toBeVisible()

    expect(countPath(requests, '/api/auth/register-code')).toBe(1)
    expect(bodiesOf(requests, '/api/auth/register-code')).toEqual([
      {
        email: 'new.walker@wanderchain.dev',
        captchaId: CAPTCHA_BODY.captchaId,
        captchaAnswer: 'a1b2',
      },
    ])
    expect(countPath(requests, '/api/auth/register')).toBe(1)
    expect(bodiesOf(requests, '/api/auth/register')).toEqual([
      {
        email: 'new.walker@wanderchain.dev',
        code: '654321',
        password: 'walker12345',
        displayName: 'New Walker',
      },
    ])
    // 两步不得颠倒，且注册成功后必须再探测一次会话（最后一个请求是 /me）。
    expect(firstIndexOf(requests, '/api/auth/register-code')).toBeLessThan(
      firstIndexOf(requests, '/api/auth/register'),
    )
    expect(requests[requests.length - 1].path).toBe('/api/auth/me')
    expect(countPath(requests, '/api/auth/login')).toBe(0)
    await expectNoBrowserReadableAuthState(page)
  })

  test('A14 · 图形码答错时停在第一步，不提交注册，并换一张新码', async ({ page }) => {
    const requests = recordAuthRequests(page)
    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
      '/api/auth/captcha': { body: CAPTCHA_BODY },
      '/api/auth/register-code': {
        status: 400,
        body: { code: 'CAPTCHA_INVALID', message: '图形验证码错误或已过期' },
      },
    })

    await gotoPath(page, '/register')
    await page.getByLabel('Username', { exact: true }).fill('New Walker')
    await page.getByLabel('Email', { exact: true }).fill('new.walker@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('walker12345')
    await page.getByLabel('Confirm password', { exact: true }).fill('walker12345')
    await page.getByLabel('Image code').fill('zzzz')
    const captchaBeforeSubmit = countPath(requests, '/api/auth/captcha')
    await page.getByRole('button', { name: 'Send email code' }).click()

    await expect(businessAlerts(page)).toHaveText(
      'The image verification answer is incorrect or has expired.',
    )
    await expect(page.getByLabel('Email code')).toHaveCount(0)
    expect(countPath(requests, '/api/auth/register')).toBe(0)
    // 答错后必须换一张新码：图形码是一次性的，旧的那张已经作废。
    expect(countPath(requests, '/api/auth/captcha')).toBeGreaterThan(captchaBeforeSubmit)
    expect(new URL(page.url()).pathname).toBe('/register')
  })

  test('A15 · 换发注册码被限流时展示等待秒数，且不重复发请求', async ({ page }) => {
    const requests = recordAuthRequests(page)
    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
      '/api/auth/captcha': { body: CAPTCHA_BODY },
      '/api/auth/register-code': {
        status: 429,
        body: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' },
        headers: { 'retry-after': '60' },
      },
    })

    await gotoPath(page, '/register')
    await page.getByLabel('Username', { exact: true }).fill('New Walker')
    await page.getByLabel('Email', { exact: true }).fill('new.walker@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('walker12345')
    await page.getByLabel('Confirm password', { exact: true }).fill('walker12345')
    await page.getByLabel('Image code').fill('a1b2')
    await page.getByRole('button', { name: 'Send email code' }).click()

    await expect(businessAlerts(page)).toContainText('60 seconds')
    await expect(page.getByLabel('Email code')).toHaveCount(0)
    expect(requests.filter((request) => request.path === '/api/auth/register-code')).toHaveLength(1)
  })

  test('A16 · 两次密码不一致时不发任何请求', async ({ page }) => {
    const requests = recordAuthRequests(page)
    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
      '/api/auth/captcha': { body: CAPTCHA_BODY },
      '/api/auth/register-code': { status: 202, body: {} },
    })

    await gotoPath(page, '/register')
    await page.getByLabel('Username', { exact: true }).fill('Mismatch Person')
    await page.getByLabel('Email', { exact: true }).fill('mismatch@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('first12345')
    await page.getByLabel('Confirm password', { exact: true }).fill('second12345')
    await page.getByLabel('Image code').fill('a1b2')
    await page.getByRole('button', { name: 'Send email code' }).click()

    await expect(businessAlerts(page)).toHaveText('The two passwords do not match')
    expect(requests.some((request) => request.path === '/api/auth/register-code')).toBe(false)
  })

  test('A17 · 密码提示与后端约束一致：下限 8', async ({ page }) => {
    await stubAuthApi(page, {
      '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY },
      '/api/auth/captcha': { body: CAPTCHA_BODY },
    })

    await gotoPath(page, '/register')

    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
      'placeholder',
      'At least 8 characters (up to 72)',
    )
  })
})

test.describe('U1 · 退出登录', () => {
  test('A18 · 点击 Log out 调用后端登出端点并回到访客态', async ({ page }) => {
    const requests = recordAuthRequests(page)
    let logoutCalls = 0
    await stubAuthApi(page, {
      '/api/auth/me': () => (logoutCalls === 0 ? { body: ME_BODY } : { status: 401, body: UNAUTHENTICATED_BODY }),
      '/api/auth/logout': () => {
        logoutCalls += 1
        return { status: 204 }
      },
    })

    await gotoHome(page)
    await expect(header(page).getByText('Editor Lan', { exact: true })).toBeVisible()

    await header(page).getByRole('button', { name: 'Log out' }).click()

    await expect(page.getByRole('link', { name: 'Log in / Sign up' })).toBeVisible()
    await expect(header(page).getByText('Editor Lan', { exact: true })).toHaveCount(0)
    expect(requests.some((request) => request.path === '/api/auth/logout')).toBe(true)
    await expectNoBrowserReadableAuthState(page)
  })
})
