import { expect, type Locator, type Page } from '@playwright/test'

/**
 * 项目标准视口：桌面取 1440×900（与既有手测截图一致），
 * 移动端取 375×667；规格里明确写 320px 的断点另用 NARROW_VIEWPORT 复验。
 */
export const DESKTOP_VIEWPORT = { width: 1440, height: 900 }
export const MOBILE_VIEWPORT = { width: 375, height: 667 }
export const NARROW_VIEWPORT = { width: 320, height: 667 }

/** 首页带锚点的四个区块 id，与 app/page.tsx 的 SectionBoundary 一一对应。 */
export const HOME_SECTION_IDS = [
  'cities',
  'editor-picks',
  'hot-posts',
  'hot-attractions',
] as const

export async function gotoPath(page: Page, pathname: string): Promise<void> {
  // 首屏图片直连 Unsplash：弱网或断网时 load 事件会被拖住，domcontentloaded 已足够判断文档到达。
  await page.goto(pathname, { waitUntil: 'domcontentloaded' })
  await page.locator('#main-content').waitFor({ state: 'visible' })
}

export function withQuery(pathname: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString()
  return search ? `${pathname}?${search}` : pathname
}

export async function gotoHome(page: Page, params: Record<string, string> = {}): Promise<void> {
  await gotoPath(page, withQuery('/', params))
}

export async function gotoSearch(page: Page, q?: string): Promise<void> {
  await gotoPath(page, q === undefined ? '/search' : withQuery('/search', { q }))
}

/**
 * 锚点落位偏差：目标区块顶部与吸顶头部下沿的距离，按视口高度归一化。
 * 区块对齐后该值应接近 0；只读取视口相对位置，与当前滚动量无关。
 */
export async function anchorOffsetRatio(section: Locator): Promise<number> {
  return section.evaluate((element) => {
    const header = document.querySelector('header')
    const headerHeight = header === null ? 0 : header.getBoundingClientRect().height
    const offset = element.getBoundingClientRect().top - headerHeight
    return Math.abs(offset) / window.innerHeight
  })
}

/**
 * 断言锚点落位：目标区块顶部对齐吸顶头部下沿（偏差 < 10% 视口高）。
 * 页尾区块可能已滚到文档尽头、无法再对齐，此时「停在 maxScroll」视为合格落位。
 */
export async function expectAnchorLanded(page: Page, hash: string): Promise<void> {
  const section = page.locator(hash)
  await expect
    .poll(
      async () => {
        const ratio = await anchorOffsetRatio(section)
        if (ratio < 0.1) return 'aligned'
        const atDocumentEnd = await page.evaluate(() => {
          const max = document.documentElement.scrollHeight - window.innerHeight
          return Math.abs(window.scrollY - max) <= 1
        })
        return atDocumentEnd ? 'aligned' : `offset ${(ratio * 100).toFixed(1)}% of viewport`
      },
      { message: `${hash} 应停在吸顶头部下沿（或已滚到文档尽头）` },
    )
    .toBe('aligned')
}

/** 横向滚动是响应式最常见的破绽：允许 1px 的取整误差。 */
export async function expectNoHorizontalOverflow(page: Page, label = '页面'): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement
    return root.scrollWidth - root.clientWidth
  })
  expect(overflow, `${label}不应出现横向滚动`).toBeLessThanOrEqual(1)
}

/** 读取 grid 容器的实际列数：computed style 会把 repeat() 展开成像素轨道。 */
export async function gridColumnCount(locator: Locator): Promise<number> {
  const info = await locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return { display: style.display, columns: style.gridTemplateColumns }
  })
  expect(info.display, '断言列数的容器必须是 grid 布局').toBe('grid')
  return info.columns
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

/**
 * 业务错误提示统一收敛到主内容区。
 * Next.js Dev Tools 的 RouteAnnouncer 也带 role="alert"，全局 getByRole('alert')
 * 会把它的路由播报误判成业务报错，strict mode 下还会与表单错误撞名。
 */
export function businessAlerts(page: Page): Locator {
  return page.locator('#main-content [role="alert"]')
}

/** 浏览器里挂一个 MutationObserver，记录动作期间「曾经出现过」的文本。 */
export async function watchText(page: Page, selector: string, expected: string[]): Promise<void> {
  await page.evaluate(
    ({ selector, expected }) => {
      interface Handle {
        hits: string[]
        observer: MutationObserver
      }
      const scope = window as unknown as { __e2eWatch?: Handle }
      scope.__e2eWatch?.observer.disconnect()

      const hits: string[] = []
      const collect = () => {
        for (const node of Array.from(document.querySelectorAll(selector))) {
          const text = (node.textContent ?? '').trim()
          if (expected.includes(text) && !hits.includes(text)) {
            hits.push(text)
          }
        }
      }

      collect()
      const observer = new MutationObserver(collect)
      // 属性也要看：disabled / aria-busy 这类瞬态不一定改文本。
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      })
      scope.__e2eWatch = { hits, observer }
    },
    { selector, expected },
  )
}

export async function observedText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    interface Handle {
      hits: string[]
      observer: MutationObserver
    }
    const scope = window as unknown as { __e2eWatch?: Handle }
    const handle = scope.__e2eWatch
    if (!handle) {
      return []
    }
    handle.observer.disconnect()
    scope.__e2eWatch = undefined
    return handle.hits
  })
}

export interface MockUser {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
}

export interface MockAccount {
  user: MockUser
  password: string
}

/** 与 lib/auth/mock-auth.ts 的 SEED_ACCOUNTS 保持一致。 */
export const ADMIN_ACCOUNT: MockAccount = {
  user: { id: 'u-admin', email: 'admin@wanderchain.dev', name: 'Editor Lan', role: 'admin' },
  password: 'admin123',
}

export const TRAVELER_ACCOUNT: MockAccount = {
  user: {
    id: 'u-traveler',
    email: 'traveler@wanderchain.dev',
    name: 'Traveler Zhou',
    role: 'user',
  },
  password: 'traveler123',
}

export const SESSION_KEY = 'wanderchain.session'
export const ACCOUNTS_KEY = 'wanderchain.accounts'
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000

/**
 * 在文档脚本执行前写入会话，等价于「这个浏览器上次已经登录过」。
 * 用 addInitScript 而不是登录表单，是为了让刷新/新标签页仍保持登录态。
 */
export async function seedSession(
  page: Page,
  user: MockUser = ADMIN_ACCOUNT.user,
  ttlMs = SESSION_TTL_MS,
): Promise<void> {
  const session = {
    // 与 createToken 同形：三段式、签名不参与校验。
    token: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJzZWVkIn0.mock-signature',
    user,
    expiresAt: Date.now() + ttlMs,
  }

  await page.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // about:blank 等不透明来源没有 localStorage；导航到目标源后脚本会再次执行。
      }
    },
    { key: SESSION_KEY, value: JSON.stringify(session) },
  )
}

export async function loginViaForm(page: Page, account: MockAccount = ADMIN_ACCOUNT): Promise<void> {
  await gotoPath(page, '/login')
  await page.getByLabel('Email', { exact: true }).fill(account.user.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/')
}

/** 只记录 XHR / fetch：HMR websocket 与静态资源不属于业务请求。 */
export function recordDataRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => {
    const type = request.resourceType()
    if (type === 'xhr' || type === 'fetch') {
      urls.push(request.url())
    }
  })
  return urls
}

export async function readStoredSession(page: Page): Promise<unknown> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  }, SESSION_KEY)
}

export interface StoredAccountInput {
  id?: string
  email: string
  password: string
  name: string
  role?: 'user' | 'admin'
}

/** 预置「本机已注册过的账号」，用于验证退出后账号表不受影响。 */
export async function seedAccounts(page: Page, accounts: StoredAccountInput[]): Promise<void> {
  const normalized = accounts.map((account, index) => ({
    id: account.id ?? `u-seed-${index}`,
    email: account.email,
    name: account.name,
    role: account.role ?? 'user',
    password: account.password,
  }))

  await page.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // 同 seedSession：不透明来源跳过。
      }
    },
    { key: ACCOUNTS_KEY, value: JSON.stringify(normalized) },
  )
}

export async function readStoredAccounts(page: Page): Promise<StoredAccountInput[]> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw === null ? [] : (JSON.parse(raw) as StoredAccountInput[])
  }, ACCOUNTS_KEY)
}

/** 观察提交中的瞬态：按钮文案 Working… 与 disabled 可能只渲染一两帧。 */
export async function watchSubmitPending(page: Page): Promise<void> {
  await page.evaluate(() => {
    interface Handle {
      sawWorking: boolean
      sawDisabled: boolean
      observer: MutationObserver
    }
    const scope = window as unknown as { __e2ePending?: Handle }
    scope.__e2ePending?.observer.disconnect()

    const state = { sawWorking: false, sawDisabled: false } as Handle
    const collect = () => {
      const button = document.querySelector('form button[type="submit"]')
      if (!button) {
        return
      }
      if ((button.textContent ?? '').trim() === 'Working…') {
        state.sawWorking = true
      }
      if (button.hasAttribute('disabled')) {
        state.sawDisabled = true
      }
    }

    collect()
    state.observer = new MutationObserver(collect)
    state.observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    })
    scope.__e2ePending = state
  })
}

export async function observedSubmitPending(
  page: Page,
): Promise<{ sawWorking: boolean; sawDisabled: boolean }> {
  return page.evaluate(() => {
    interface Handle {
      sawWorking: boolean
      sawDisabled: boolean
      observer: MutationObserver
    }
    const scope = window as unknown as { __e2ePending?: Handle }
    const handle = scope.__e2ePending
    if (!handle) {
      return { sawWorking: false, sawDisabled: false }
    }
    handle.observer.disconnect()
    scope.__e2ePending = undefined
    return { sawWorking: handle.sawWorking, sawDisabled: handle.sawDisabled }
  })
}
