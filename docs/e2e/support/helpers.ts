import { expect, type Locator, type Page, type Route } from '@playwright/test'

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

/** ------------------------------------------------------------------ *
 * 认证端点的桩与请求录制
 * ------------------------------------------------------------------ */

export interface AuthStubResponse {
  status?: number
  body?: unknown
  headers?: Record<string, string>
}

/** 键是端点路径（如 `/api/auth/login`），值可以随调用次数变化。 */
export type AuthStubMap = Record<string, AuthStubResponse | (() => AuthStubResponse)>

export interface RecordedAuthRequest {
  path: string
  method: string
  body: unknown
}

/**
 * 把 `/api/auth/*` 全部桩掉。
 *
 * E2E 断言的是前端对外的契约——请求打到哪个端点、请求体字段名逐字是什么、
 * 收到某个错误码后界面怎么走；后端自身的行为由 backend 的单元测试与容器装配测试负责。
 * 桩掉之后这条链路不依赖 MySQL / Redis / 后端进程，也不会踩到「登录失败次数」的共享限流桶
 * （本地所有请求同属一个未知来源，失败 20 次就锁 10 分钟，跑几轮 E2E 就会把开发机锁住）。
 */
export async function stubAuthApi(page: Page, stubs: AuthStubMap): Promise<void> {
  await page.route('**/api/auth/**', async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    const stub = stubs[pathname]
    if (!stub) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UNAUTHENTICATED', message: `no stub for ${pathname}` }),
      })
      return
    }

    const resolved = typeof stub === 'function' ? stub() : stub
    const status = resolved.status ?? 200
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: resolved.headers,
      // 204 不允许带响应体，否则浏览器会直接判为协议错误。
      body: status === 204 ? '' : JSON.stringify(resolved.body ?? {}),
    })
  })
}

/** 录制真正发到 `/api/auth/*` 的请求，用于断言端点顺序与请求体字段名。 */
export function recordAuthRequests(page: Page): RecordedAuthRequest[] {
  const recorded: RecordedAuthRequest[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/auth/')) {
      return
    }
    let body: unknown = null
    const raw = request.postData()
    if (raw) {
      try {
        body = JSON.parse(raw) as unknown
      } catch {
        body = raw
      }
    }
    recorded.push({ path: url.pathname, method: request.method(), body })
  })
  return recorded
}

/** 已登录账户的 `/me` 响应体，字段与 `lib/contracts/auth.ts` 的 MeResponse 一致。 */
export const ME_BODY = {
  publicId: '01JACCOUNT0000000000000',
  email: 'editor@wanderchain.dev',
  displayName: 'Editor Lan',
  status: 'active',
  createdAt: '2026-10-29T03:00:00Z',
}

/** 未认证的 `/me` 响应，与后端拦截器写出的错误体同形。 */
export const UNAUTHENTICATED_BODY = { code: 'UNAUTHENTICATED', message: '未认证' }

/** 图形码响应体：图片是 data URI，桩里不必真的是有效 PNG。 */
export const CAPTCHA_BODY = {
  captchaId: '01JCAPTCHA000000000000',
  image: 'data:image/png;base64,iVBORw0KGgo=',
}

/** 浏览器可读存储里必须一片空白：认证信息只存在于 HttpOnly cookie。 */
export async function expectNoBrowserReadableAuthState(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    local: window.localStorage.length,
    session: window.sessionStorage.length,
    cookie: document.cookie,
  }))
  expect(sizes.local, 'localStorage 不应留下任何认证信息').toBe(0)
  expect(sizes.session, 'sessionStorage 不应留下任何认证信息').toBe(0)
  expect(sizes.cookie, '令牌 cookie 必须是 HttpOnly，脚本读不到').toBe('')
}
