import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import {
  ADMIN_ACCOUNT,
  SESSION_KEY,
  businessAlerts,
  gotoHome,
  gotoPath,
  loginViaForm,
  observedSubmitPending,
  readStoredAccounts,
  readStoredSession,
  seedAccounts,
  seedSession,
  watchSubmitPending,
} from './support/helpers'

const header = (page: Page) => page.locator('header')

/** 直接读原始值：损坏的 JSON 交给页面的 readSession 清理后再断言为 null。 */
async function rawSession(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), SESSION_KEY)
}

test.describe('U1 · 访客与会话恢复', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('S2 · 无会话时状态变为 guest，顶栏展示登录入口', async ({ page }) => {
    // S2 When 本地无会话 · Then 状态变为 guest，顶栏展示 Log in / Sign up 指向 /login
    const link = page.getByRole('link', { name: 'Log in / Sign up' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/login')
  })

  test('S16 · 渲染期不读浏览器存储：首帧 HTML 只有加载占位', async ({ page }) => {
    // S16 When 服务端渲染阶段 · Then 不在渲染期访问浏览器 API；浏览器端用首帧 HTML 代理
    const response = await page.request.get('/')
    expect(response.ok()).toBe(true)
    const html = await response.text()

    expect(html).toContain('data-testid="account-loading"')
    expect(html).not.toContain('Editor Lan')
    expect(html).not.toContain('Log out')
  })
})

test.describe('U1 · 已登录会话恢复', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, ADMIN_ACCOUNT.user)
    await gotoHome(page)
  })

  test('S1 · 页面加载后由 loading 变为 user 并展示用户名', async ({ page }) => {
    // S1 When 本地存在未过期会话 · Then 状态变为 user，顶栏展示用户名
    await expect(header(page).getByText('Editor Lan', { exact: true })).toBeVisible()
    await expect(header(page).getByRole('button', { name: 'Log out' })).toBeVisible()
  })

  test('S1 · And admin 角色额外展示 Editor 标', async ({ page }) => {
    // S1 And admin 角色额外展示 Editor 标
    await expect(header(page).getByText('Editor', { exact: true })).toBeVisible()
  })
})

test.describe('U1 · 会话过期与损坏', () => {
  test('S13 · 过期会话被删除并回到 guest', async ({ page }) => {
    // S13 When 本地会话的 expiresAt <= Date.now() · Then 删除会话并回到 guest
    await seedSession(page, ADMIN_ACCOUNT.user, -1_000)
    await gotoHome(page)

    await expect(page.getByRole('link', { name: 'Log in / Sign up' })).toBeVisible()
    expect(await rawSession(page)).toBeNull()
  })

  test('S14 · 非法 JSON 的会话被删除且不白屏', async ({ page }) => {
    // S14 When wanderchain.session 不是合法 JSON · Then 删除并返回 null，不抛异常、不白屏
    await page.addInitScript(
      (key) => {
        try {
          window.localStorage.setItem(key, '{broken json')
        } catch {
          // 不透明来源跳过。
        }
      },
      SESSION_KEY,
    )
    await gotoHome(page)

    await expect(page.getByRole('link', { name: 'Log in / Sign up' })).toBeVisible()
    await expect(page.locator('#hero-title')).toBeVisible()
    expect(await rawSession(page)).toBeNull()
  })

  test('S14 · 缺少 user 字段的会话被删除', async ({ page }) => {
    // S14 When 会话缺少 user 字段 · Then 删除并返回 null
    await page.addInitScript(
      ({ key, value }) => {
        try {
          window.localStorage.setItem(key, value)
        } catch {
          // 不透明来源跳过。
        }
      },
      {
        key: SESSION_KEY,
        value: JSON.stringify({ token: 'a.b.mock-signature', expiresAt: Date.now() + 60_000 }),
      },
    )
    await gotoHome(page)

    await expect(page.getByRole('link', { name: 'Log in / Sign up' })).toBeVisible()
    expect(await rawSession(page)).toBeNull()
  })
})

test.describe('U1 · 登录页 /login', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPath(page, '/login')
  })

  test('S4 · 种子账号登录成功并签发三段式会话', async ({ page }) => {
    // S4 When 提交种子账号正确凭据 · Then 签发三段式假令牌、会话持久化、路由 replace('/')
    await page.getByLabel('Email', { exact: true }).fill(ADMIN_ACCOUNT.user.email)
    await page.getByLabel('Password', { exact: true }).fill(ADMIN_ACCOUNT.password)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()

    await page.waitForURL((url) => url.pathname === '/')
    await expect(header(page).getByText('Editor Lan', { exact: true })).toBeVisible()

    const session = (await readStoredSession(page)) as {
      token: string
      user: { role: string }
      expiresAt: number
    }
    expect(session.token.split('.')).toHaveLength(3)
    expect(session.token.endsWith('.mock-signature')).toBe(true)
    expect(session.user.role).toBe('admin')
    expect(session.expiresAt).toBeGreaterThan(Date.now())
  })

  test('S5 · 邮箱大小写与首尾空格不影响登录', async ({ page }) => {
    // S5 When 输入 ' Admin@WanderChain.dev ' 与 admin123 · Then 归一化后命中种子账号
    await page.getByLabel('Email', { exact: true }).fill(' Admin@WanderChain.dev ')
    await page.getByLabel('Password', { exact: true }).fill(ADMIN_ACCOUNT.password)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()

    await page.waitForURL((url) => url.pathname === '/')
    await expect(header(page).getByText('Editor Lan', { exact: true })).toBeVisible()
  })

  test('S11 · 账号不存在与密码错误使用完全一致的文案', async ({ page }) => {
    // S11 When 邮箱不存在或密码错误 · Then 统一抛出 'Incorrect email or password'
    const email = page.getByLabel('Email', { exact: true })
    const password = page.getByLabel('Password', { exact: true })
    const submit = page.getByRole('button', { name: 'Log in', exact: true })
    const alert = businessAlerts(page)

    await email.fill('nobody@wanderchain.dev')
    await password.fill('whatever1')
    await submit.click()
    await expect(alert).toHaveText('Incorrect email or password')

    await email.fill(ADMIN_ACCOUNT.user.email)
    await password.fill('wrong-password')
    await submit.click()
    await expect(alert).toHaveText('Incorrect email or password')

    expect(new URL(page.url()).pathname).toBe('/login')
    expect(await readStoredSession(page)).toBeNull()
  })

  test('S15 · 提交中按钮 disabled 且文案为 Working…', async ({ page }) => {
    // S15 When 请求进行中 · Then 按钮 disabled 且文案为 Working…，不产生第二次调用
    await page.getByLabel('Email', { exact: true }).fill(ADMIN_ACCOUNT.user.email)
    await page.getByLabel('Password', { exact: true }).fill(ADMIN_ACCOUNT.password)

    await watchSubmitPending(page)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/')

    const pending = await observedSubmitPending(page)
    expect(pending.sawWorking, '提交中应出现 Working… 文案').toBe(true)
    expect(pending.sawDisabled, '提交中按钮应为 disabled').toBe(true)
  })

  test('S4 · And 登录页展示演示账号提示且可跳转注册', async ({ page }) => {
    // S4 And 登录页展示演示账号提示；登录页与注册页互有跳转链接
    await expect(page.getByText('Demo account: admin@wanderchain.dev / admin123')).toBeVisible()
    const switchLink = page.getByRole('link', { name: 'Create one' })
    await expect(switchLink).toHaveAttribute('href', '/register')
    await switchLink.click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create an account')
    await expect(page.getByRole('link', { name: 'Log in', exact: true })).toHaveAttribute(
      'href',
      '/login',
    )
  })
})

test.describe('U1 · 注册页 /register', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPath(page, '/register')
  })

  test('S3 · 合法输入注册成功并写入账号表与会话', async ({ page }) => {
    // S3 When 提交合法邮箱、≥6 位密码、≥2 字用户名且两次一致 · Then 写入两个 key、状态变 user、跳转 /
    await page.getByLabel('Username', { exact: true }).fill('New Walker')
    await page.getByLabel('Email', { exact: true }).fill('new.walker@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('walker123')
    await page.getByLabel('Confirm password', { exact: true }).fill('walker123')
    await page.getByRole('button', { name: 'Sign up and log in' }).click()

    await page.waitForURL((url) => url.pathname === '/')
    await expect(header(page).getByText('New Walker', { exact: true })).toBeVisible()

    const accounts = await readStoredAccounts(page)
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toMatchObject({
      email: 'new.walker@wanderchain.dev',
      name: 'New Walker',
      role: 'user',
    })

    const session = (await readStoredSession(page)) as { user: { name: string } }
    expect(session.user.name).toBe('New Walker')
  })

  test('S5 · And 种子邮箱的不同大小写写法被判为重复', async ({ page }) => {
    // S5 And 注册时同一邮箱的不同大小写写法被判为重复
    await page.getByLabel('Username', { exact: true }).fill('Copy Cat')
    await page.getByLabel('Email', { exact: true }).fill('Admin@WanderChain.dev')
    await page.getByLabel('Password', { exact: true }).fill('copycat123')
    await page.getByLabel('Confirm password', { exact: true }).fill('copycat123')
    await page.getByRole('button', { name: 'Sign up and log in' }).click()

    await expect(businessAlerts(page)).toHaveText('This email is already registered')
    expect(await readStoredAccounts(page)).toEqual([])
    expect(await readStoredSession(page)).toBeNull()
  })

  test('S7 · 邮箱格式非法时给出明确文案且不落库', async ({ page }) => {
    // S7 When 提交不含 @ 或不含点号的邮箱 · Then 'Enter a valid email address'，不写入任何存储
    await page.getByLabel('Username', { exact: true }).fill('Bad Email')
    await page.getByLabel('Email', { exact: true }).fill('not-an-email')
    await page.getByLabel('Password', { exact: true }).fill('whatever1')
    await page.getByLabel('Confirm password', { exact: true }).fill('whatever1')
    await page.getByRole('button', { name: 'Sign up and log in' }).click()

    await expect(businessAlerts(page)).toHaveText('Enter a valid email address')
    expect(await rawSession(page)).toBeNull()
    expect(await readStoredAccounts(page)).toEqual([])
  })

  test('S8 · 密码短于 6 位时提示最小长度', async ({ page }) => {
    // S8 When 提交长度 < 6 的密码 · Then 'Password must be at least 6 characters'，状态保持 guest
    await page.getByLabel('Username', { exact: true }).fill('Short Pass')
    await page.getByLabel('Email', { exact: true }).fill('short.pass@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('12345')
    await page.getByLabel('Confirm password', { exact: true }).fill('12345')
    await page.getByRole('button', { name: 'Sign up and log in' }).click()

    await expect(businessAlerts(page)).toHaveText('Password must be at least 6 characters')
    expect(await rawSession(page)).toBeNull()
  })

  test('S9 · 用户名 trim 后不足 2 字时被拒绝', async ({ page }) => {
    // S9 When 用户名 trim 后长度 < 2 · Then 'Username must be at least 2 characters'
    await page.getByLabel('Username', { exact: true }).fill(' A ')
    await page.getByLabel('Email', { exact: true }).fill('short.name@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('whatever1')
    await page.getByLabel('Confirm password', { exact: true }).fill('whatever1')
    await page.getByRole('button', { name: 'Sign up and log in' }).click()

    await expect(businessAlerts(page)).toHaveText('Username must be at least 2 characters')
    expect(await readStoredAccounts(page)).toEqual([])
  })

  test('S10 · 已注册邮箱再次注册被拒绝且账号表不被写入', async ({ page }) => {
    // S10 When 注册一个已存在于已注册表中的邮箱 · Then 'This email is already registered'
    await page.getByLabel('Username', { exact: true }).fill('First Owner')
    await page.getByLabel('Email', { exact: true }).fill('owner@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('owner123')
    await page.getByLabel('Confirm password', { exact: true }).fill('owner123')
    await page.getByRole('button', { name: 'Sign up and log in' }).click()
    await page.waitForURL((url) => url.pathname === '/')

    await gotoPath(page, '/register')
    await page.getByLabel('Username', { exact: true }).fill('Second Owner')
    await page.getByLabel('Email', { exact: true }).fill('owner@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('owner456')
    await page.getByLabel('Confirm password', { exact: true }).fill('owner456')
    await page.getByRole('button', { name: 'Sign up and log in' }).click()

    await expect(businessAlerts(page)).toHaveText('This email is already registered')
    const accounts = await readStoredAccounts(page)
    expect(accounts).toHaveLength(1)
    expect(accounts[0].name).toBe('First Owner')
  })

  test('S12 · 两次密码不一致时直接报错且不调用 register', async ({ page }) => {
    // S12 When 注册模式下两次输入不同并提交 · Then 'The two passwords do not match'，不产生存储写入
    await page.getByLabel('Username', { exact: true }).fill('Mismatch Person')
    await page.getByLabel('Email', { exact: true }).fill('mismatch@wanderchain.dev')
    await page.getByLabel('Password', { exact: true }).fill('first123')
    await page.getByLabel('Confirm password', { exact: true }).fill('second123')
    await page.getByRole('button', { name: 'Sign up and log in' }).click()

    await expect(businessAlerts(page)).toHaveText('The two passwords do not match')
    expect(await readStoredAccounts(page)).toEqual([])
    expect(await rawSession(page)).toBeNull()
  })

  test('S3 · And 注册页不展示演示账号提示', async ({ page }) => {
    // S3 And 登录页展示演示账号提示，注册页不展示
    await expect(page.getByText('Demo account: admin@wanderchain.dev / admin123')).toHaveCount(0)
  })
})

test.describe('U1 · 退出登录', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, ADMIN_ACCOUNT.user)
    await seedAccounts(page, [
      { email: 'returning@wanderchain.dev', password: 'returning1', name: 'Returning Guest' },
    ])
    await gotoHome(page)
  })

  test('S6 · 退出后会话被清除但账号表保留，原账号可再次登录', async ({ page }) => {
    // S6 When 点击 Log out · Then session 被移除、状态变 guest，accounts 不受影响
    await header(page).getByRole('button', { name: 'Log out' }).click()
    await expect(page.getByRole('link', { name: 'Log in / Sign up' })).toBeVisible()
    expect(await rawSession(page)).toBeNull()

    const accountsBefore = await readStoredAccounts(page)
    expect(accountsBefore.map((account) => account.email)).toContain('returning@wanderchain.dev')

    await loginViaForm(page, {
      user: {
        id: 'u-returning',
        email: 'returning@wanderchain.dev',
        name: 'Returning Guest',
        role: 'user',
      },
      password: 'returning1',
    })

    await expect(header(page).getByText('Returning Guest', { exact: true })).toBeVisible()
    await expect(header(page).getByText('Editor', { exact: true })).toHaveCount(0)
    expect((await readStoredAccounts(page)).map((account) => account.email)).toContain(
      'returning@wanderchain.dev',
    )
  })
})
