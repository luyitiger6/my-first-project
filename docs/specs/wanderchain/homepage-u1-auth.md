# U1 · 认证前端接入（真实后端，会话只在 HttpOnly cookie）

| 项 | 值 |
|---|---|
| 单元编号 | U1 |
| 归属能力 | `wanderchain-homepage` / `wanderchain-auth-frontend` |
| 对应主 spec | `### Requirement: 认证前端接入` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 后端契约真源 | [openspec/specs/wanderchain-auth/spec.md](../../../openspec/specs/wanderchain-auth/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | 前端接入真实 `/api/auth/*`；令牌只存在于后端下发的 HttpOnly cookie，前端不可读 |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；表单、账户区与错误文案一律以英文为准。

### 1.1 包含

| # | 能力 | 落点 |
|---|---|---|
| 1 | 认证契约单一真源：10 个请求/响应形状、账户状态、七个错误码、九个端点、密码界限、cookie 名 | `lib/contracts/auth.ts` |
| 2 | 契约联锁测试：字段名集合被钉死，改任一侧即红 | `lib/contracts/auth.test.ts` |
| 3 | 认证 HTTP 客户端：取图形码、换注册码、注册、登录、读当前账户、登出 | `lib/auth/auth-api.ts` |
| 4 | 错误归一化：`{ code, message }` → `AuthApiError`，网络失败 → `AuthNetworkError`，错误码 → 英文文案 | 同文件 `describeAuthError` |
| 5 | 全局认证上下文：`loading / guest / user` 三态，会话唯一真源是 `GET /api/auth/me` | `AuthProvider` / `useAuth` |
| 6 | 登录 / 注册表单（同一组件双模式，注册为两步） | `AuthForm` |
| 7 | 顶栏账户区：加载占位 / 登录入口 / 显示名 + 退出 | `AccountMenu` |
| 8 | 两个路由页 `/login`、`/register` | `app/login/page.tsx`、`app/register/page.tsx` |
| 9 | 同源代理转发认证所需的请求头与 `Set-Cookie` | `app/api/[...path]/route.ts` |
| 10 | 安全详情 next、登录注册互转及认证写后只读会话重试 | `lib/auth/return-to.ts`、`AuthForm` |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 令牌签发、签名校验、会话存储、限流计数、bcrypt 时序等价 | 后端 `wanderchain-auth` 能力 |
| 找回密码的两步流程 UI（`password-reset-code` / `password-reset`） | 未立项；契约里已留字段形状 |
| 第三方登录（微信 / GitHub / OAuth） | 未立项 |
| 邮箱验证邮件的实际投递 | 后端；前端只消费 `EMAIL_UNVERIFIED` 错误码 |
| 权限校验与路由守卫 | 未立项：后端无角色模型，前端不得凭空造 |
| 收藏 / 评论 / 投票与详情业务 UI | 帖子互动能力；本单元只提供认证及安全回跳，不自动重放写入 |
| AI 助手面板 | U4 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 账户与会话 | 后端 API（`/api/auth/*`，经同源代理到 `BACKEND_URL`） | 无本地兜底，接口不可达即访客态 |
| 会话令牌 | HttpOnly cookie `wc_session` | 前端 JS 读不到，也不写 `localStorage` / `sessionStorage` |
| 图形码图片 | 后端返回的 `data:image/png;base64,...` | 用原生 `<img>`，不走 `next/image`（data URI 过不了自定义 loader） |
| 用户资料 | `GET /api/auth/me` 的响应体 | 界面显示名只取这里，不取登录响应 |

### 1.4 与其他单元的关系

- **依赖**：后端 `wanderchain-auth` 能力（14 条 Requirement 已实现并全绿）；同源代理（本单元 1.1 第 9 项）
- **被依赖**：U2 骨架（`AuthProvider` 挂在根布局，`AccountMenu` 挂在顶栏）
- **连带影响**：`AuthProvider` 挂载即发 `GET /api/auth/me`，因此所有渲染根布局的页面测试都必须桩掉 `fetch`；页面自身的「零 fetch」约束改为「页面数据零 fetch」，认证探测不计入

---

## 2. 核心场景

Scenario 编号与 `docs/e2e/homepage-u1-auth.spec.ts` 的 A1–A23 对应（A21 为八种恶意目标的参数化用例）；单元层证据在
`lib/auth/auth-api.test.ts`、`lib/auth/return-to.test.ts`、`lib/contracts/auth.test.ts`、`components/auth/*.test.tsx`。
新增回跳行为对应在飞 CHANGE `add-wanderchain-post-interactions-frontend` 的认证 delta；归档前不视为已同步主 spec。

### 2.1 会话状态

**A1 · 无会话**
- When `GET /api/auth/me` 返回 `401 UNAUTHENTICATED`
- Then 状态为 `guest`，顶栏展示 `Log in / Sign up` 链接指向 `/login`
- And 顶栏没有 `Log out` 按钮

**A2 · 有会话**
- When `GET /api/auth/me` 返回 `200` 与账户体
- Then 状态为 `user`，顶栏展示 `displayName` 与 `Log out`
- And **不展示任何角色徽章**（后端无角色模型）

**A3 · 会话探测失败不白屏**
- When `GET /api/auth/me` 返回 5xx 或网络不可达
- Then 状态归 `guest`，页面主体照常渲染
- And 不向用户弹任何业务错误（认证探测失败不是用户操作的结果）

**A4 · 服务端首帧**
- When 服务端渲染首帧
- Then HTML 含加载占位 `data-testid="account-loading"`
- And HTML **不含**显示名与 `Log out`：会话只在客户端 effect 中探测，不在渲染期读取

**A5 · 浏览器可读存储空白**
- When 处于已登录状态
- Then `localStorage`、`sessionStorage` 长度为 0，`document.cookie` 为空串
- And 令牌与用户资料都没有落到 JS 可读的地方

### 2.2 登录 `/login`

**A6 · 凭证正确**
- When 提交合法邮箱与密码
- Then 请求序列为 `GET /me` → `POST /login` → `GET /me`
- And `POST /login` 的请求体字段名逐字为 `{ email, password }`
- And 跳转到 `/`，顶栏显示名取自第二次 `/me` 的响应，不取登录响应

**A7 · 凭证错误**
- When `POST /login` 返回 `401 UNAUTHENTICATED`
- Then 以 `role="alert"` 展示统一文案 `The email or password is incorrect.`
- And 文案不区分「邮箱不存在」与「密码错误」
- And 停留在 `/login`，可读存储仍为空白

**A8 · 图形码按需出现**
- Given 登录页初始状态不请求 `/api/auth/captcha`，也不渲染 `Image code` 字段
- When `POST /login` 返回 `400 CAPTCHA_INVALID`
- Then 请求一张图形码并渲染 `Image code` 输入框与图片（`alt="Image verification challenge"`）
- And 重试的请求体为 `{ email, password, captchaId, captchaAnswer }`

**A9 · 限流**
- When `POST /login` 返回 `429 RATE_LIMITED` 且带 `Retry-After: 45`
- Then 文案包含 `45 seconds`
- And **不自动重试**：`/api/auth/login` 只被调用一次

**A10 · 两个 403 文案不同**
- When 返回 `403 EMAIL_UNVERIFIED`
- Then 文案含 `not been verified`
- When 返回 `403 CROSS_SITE_REJECTED`
- Then 文案含 `origin is not trusted`，且与前一条不相同

**A11 · 密码提示**
- When 渲染登录页
- Then 密码框 `placeholder` 为 `8-72 bytes (about 3-24 Chinese characters)`（取自契约常量，不是硬编码；字节口径 + 汉字换算示例，见 `openspec/specs/wanderchain-auth-frontend`）
- And 页面上不存在任何演示账号提示

### 2.3 注册 `/register`

**A12 · 第一步形态**
- When 进入注册页
- Then 请求序列为 `GET /me` → `GET /captcha`，图形码与 `Image code` 字段可见
- And 主按钮文案为 `Send email code`，步骤指示为 `Step 1 of 2`

**A13 · 两步成功**
- When 第一步提交图形码答案、第二步提交邮箱码
- Then 请求序列为 `GET /me` → `GET /captcha` → `POST /register-code` → `POST /register` → `GET /me`
- And `POST /register-code` 体为 `{ email, captchaId, captchaAnswer }`
- And `POST /register` 体为 `{ email, code, password, displayName }`
- And 跳转到 `/`，顶栏显示新账户的 `displayName`，可读存储空白

**A14 · 图形码答错**
- When `POST /register-code` 返回 `400 CAPTCHA_INVALID`
- Then 展示对应文案，**停在第一步**（`Email code` 字段不出现）
- And 从未调用 `POST /register`
- And 自动换一张新图形码：`/api/auth/captcha` 共被调用两次（图形码一次性）

**A15 · 换码被限流**
- When `POST /register-code` 返回 `429` 且带 `Retry-After: 60`
- Then 文案包含 `60 seconds`，停在第一步
- And `/api/auth/register-code` 只被调用一次

**A16 · 两次密码不一致**
- When 两次密码输入不同并点击提交
- Then 展示 `The two passwords do not match`
- And **不发任何请求**（客户端守卫早于网络调用）

**A17 · 密码界限与后端一致**
- When 渲染注册页
- Then 密码框 `placeholder` 为 `8-72 bytes (about 3-24 Chinese characters)`，下限 8 字节 / 上限 72 字节来自后端 `PasswordRules`

### 2.4 退出登录

**A18 · 登出**
- When 点击 `Log out`
- Then 调用 `POST /api/auth/logout`，随后顶栏回到 `Log in / Sign up`
- And 显示名消失，可读存储仍为空白
- And 即使登出请求失败，界面也回到访客态（`finally` 中复位，不留下「已登录但令牌已失效」的假象）

### 2.5 详情安全回跳与会话确认

**A19 · 登录返回详情**
- When next 为规范 `/posts/<26 位大写有效 ULID>`，登录写入成功且 `/me` 确认账户
- Then replace 原详情，不携带身份或未提交输入，不发评论、投票、收藏写请求

**A20 · 注册互转保留详情**
- When 带合法 next 从登录切到注册、再切回登录，或完成两步注册
- Then 两个互转链接保留相同目标，注册成功后以 `/me` 确认结果返回详情；默认无 next 仍由 A6/A13 验证回首页

**A21 · 拒绝未知目标**
- When next 为外链、协议相对、反斜杠、重复编码、非法标识、其它路径、额外查询或片段
- Then 不保留到互转链接，认证成功仅回 `/`，不执行参数内容
- And URLSearchParams 已解码一次的值不再二次解码；路径内百分号、额外段、非法 ULID 等细分边界由 return-to.test.ts 覆盖

**A22 / A23 · 登录 / 注册写成功但会话未确认**
- When 写接口成功，随后 `/me` 401、5xx 或网络失败
- Then Provider 返回 null 且全局为 guest，表单仍留在当前路由，提示 `Authentication succeeded, but your session could not be confirmed. Retry session check.`
- And `Retry session check` 只发 GET /me；重复未确认仍停留，确认账户后才导航，不重发登录、注册或邮箱码，不自动重放互动
- And 同一次写入/会话重试中的连续 submit 被同步锁挡住，按钮展示禁用的 `Working…`

本组浏览器桩只验证认证导航目标与请求，不将目标页面出现 URL 称为详情内容验收；详情读取、本人状态及跨页面互动由帖子用例另验。A22/A23 显式截图附在各自报告中，截图名为 `login-session-unconfirmed.png` / `register-session-unconfirmed.png`。

---

## 3. 数据结构

### 3.1 契约（`lib/contracts/auth.ts`，镜像后端 record）

```ts
export type AccountStatus = 'active' | 'email_unverified' | 'deleted'

export interface CaptchaResponse { captchaId: string; image: string }
export interface RegisterCodeRequest { email: string; captchaId: string; captchaAnswer: string }
export interface RegisterRequest { email: string; code: string; password: string; displayName: string }
export interface RegisterResponse { publicId: string; email: string; displayName: string }
export interface LoginRequest { email: string; password: string; captchaId?: string; captchaAnswer?: string }
export interface LoginResponse { publicId: string; email: string; displayName: string; expiresAt: string }
export interface MeResponse { publicId: string; email: string; displayName: string; status: AccountStatus; createdAt: string }
export interface PasswordResetCodeRequest { email: string; captchaId: string; captchaAnswer: string }
export interface PasswordResetRequest { email: string; code: string; newPassword: string }
export interface ErrorResponse { code: string; message: string }

export const AUTH_ERROR_CODES = [
  'UNAUTHENTICATED', 'EMAIL_UNVERIFIED', 'CROSS_SITE_REJECTED',
  'INVALID_CODE', 'CAPTCHA_INVALID', 'RATE_LIMITED', 'VALIDATION_FAILED',
] as const
```

约定：

- 字段名**逐字**等于后端 record 的组件名，一律 camelCase；两侧都禁止蛇形
- 后端 `Instant` 映射为 `string`（ISO-8601），前端不做时间戳换算
- 响应体**永不含**令牌：`token` / `accessToken` 这类字段名一旦出现在契约里就是违约
- 新增字段先改后端 DTO，再改契约文件，`10-contract-check.ps1` 会拦住只改一侧的行为

### 3.2 组件 Props

| 组件 | Props | 约束 |
|---|---|---|
| `AuthProvider` | `{ children: ReactNode }` | 必须包裹整个 `body` 内容；页面内**只能出现一个** |
| `AuthForm` | `{ mode: 'login' \| 'register' }` | 闭集 2 值；决定是渲染一步登录还是两步注册 |
| `AccountMenu` | 无 | 必须位于 `AuthProvider` 内，否则抛错 |
| `useAuth()` | 无 | 在 Provider 外调用抛 `useAuth must be used inside AuthProvider` |

`AuthContextValue`：

```ts
export type AuthStatus = 'loading' | 'guest' | 'user'

export interface AuthContextValue {
  status: AuthStatus
  user: MeResponse | null
  login: (input: LoginRequest) => Promise<MeResponse | null>
  register: (input: RegisterRequest) => Promise<MeResponse | null>
  logout: () => Promise<void>
  refresh: () => Promise<MeResponse | null>
}
```

`login` / `register` 成功后内部会再调一次 `refresh()`：界面显示的账户永远来自 `/me`，
避免「登录响应里的近似值」与「服务端真实状态」出现两套真相。返回值是 `/me` 的确认结果，不是写响应；null 只允许表单重试读取，不重新认证写入。refresh 的 loading 态禁止互动写操作，递增请求代次确保旧读取不覆盖新会话或登出状态。

### 3.3 字段与规则约束

| 项 | 约束 | 违反后果 |
|---|---|---|
| `email` | 由后端校验并归一化；前端不做大小写折叠 | 前端自作主张归一化会与后端判定不一致 |
| `password` | 8–72 字节（`PASSWORD_MIN_BYTES` / `PASSWORD_MAX_BYTES`） | `400 VALIDATION_FAILED` |
| `displayName` | 后端校验；前端只透传 | `400 VALIDATION_FAILED` |
| `captchaId` / `captchaAnswer` | 一次性；答错后必须重新取码 | `400 CAPTCHA_INVALID` |
| `code` | 邮箱验证码，只在注册第二步出现 | `400 INVALID_CODE` |
| 令牌 | 只在 `Set-Cookie` 中传递，`HttpOnly` / `SameSite=Lax` / `Path=/`，**无 `Domain`** | 前端任何读取令牌的写法都是违约 |

### 3.4 错误码到文案的映射（`lib/auth/auth-api.ts`）

| HTTP | `code` | 界面文案 |
|---|---|---|
| 401 | `UNAUTHENTICATED` | `The email or password is incorrect.` |
| 403 | `EMAIL_UNVERIFIED` | `This email has not been verified yet, so it cannot log in.` |
| 403 | `CROSS_SITE_REJECTED` | `The request was rejected because its origin is not trusted.` |
| 400 | `INVALID_CODE` | `That code is incorrect or has expired. Request a new one.` |
| 400 | `CAPTCHA_INVALID` | `The image verification answer is incorrect or has expired.` |
| 429 | `RATE_LIMITED` | `Too many attempts.` + `Try again in N seconds.`（N 取自 `Retry-After`） |
| 400 | `VALIDATION_FAILED` | `Some fields are not valid. Check them and try again.` |
| 其它 | 非契约错误体 | 回落到错误原文（例如代理兜底的 `Request failed with status 502`），不伪装成业务文案 |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 会话与契约

- [ ] `GET /api/auth/me` 的 `401` 被归一化为 `null`，不抛到界面
- [ ] 界面显示名只来自 `/me`，登录响应里的显示名不出现在顶栏
- [ ] `localStorage` / `sessionStorage` / `document.cookie` 在已登录态下全部为空
- [ ] 服务端首帧只有加载占位，不含账户信息
- [ ] 契约文件字段名与后端 record 组件名逐字相同，全部 camelCase
- [ ] 契约错误码为七个固定值，端点为九个固定路径
- [ ] `lib/contracts/auth.test.ts` 改任一字段名即红

### 4.2 登录与注册

- [ ] 登录默认不请求图形码端点；`CAPTCHA_INVALID` 后才取码并带码重试
- [ ] 注册两步各发一次请求，请求体字段名逐字取自契约
- [ ] 注册第一步失败停在第一步，从不调用 `/register`
- [ ] 图形码答错后自动换一张新码（`/captcha` 两次）
- [ ] `429` 展示 `Retry-After` 秒数，且不自动重试
- [ ] 两个 `403` 文案互不相同
- [ ] 两次密码不一致时不发任何请求
- [ ] 密码提示为 `8-72 bytes (about 3-24 Chinese characters)`，取自契约常量

### 4.3 界面与可访问性

- [ ] 顶栏三态：加载占位（无文字）、访客 `Log in / Sign up`、登录后「显示名 + `Log out`」
- [ ] 没有基于角色的徽章
- [ ] 表单错误以 `role="alert"` 呈现，位于 `#main-content` 内
- [ ] 图形码图片有可读 `alt`，刷新按钮有可见文案
- [ ] 每个输入框都能被 `getByLabel` 精确命中
- [ ] 登录页与注册页互有跳转链接，只传安全允许列表中的 next
- [ ] 无合法 next 仍回首页；合法详情仅在 /me 确认后回跳
- [ ] 写成功但会话未确认时只提供读取重试，不重复写入
- [ ] useSearchParams 所在表单由路由页 Suspense 包裹，fallback 为 role=status

### 4.4 工程

- [ ] 全仓检索 `mock-auth` 零命中
- [ ] `lib/auth/auth-api.test.ts` + `lib/auth/return-to.test.ts` + `components/auth/*.test.tsx` 覆盖 A1–A23 的单元层等价断言
- [ ] `docs/e2e/homepage-u1-auth.spec.ts` 用 `page.route` 桩掉 `/api/auth/*`，不依赖 MySQL / Redis
- [ ] `npx vitest run` 全绿，`npm run build` 退出码 0
- [ ] `harness/checks/10-contract-check.ps1` 退出码 0
- [ ] 无占位注释与跳过写法，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- `AuthProvider`、`AuthForm`、`AccountMenu` 均为 **Client Component**，文件首行必须是 `'use client'`
- 根布局为 Server Component，只负责把 `AuthProvider` 包在 `{children}` 外层
- 会话探测**只允许**在 `useEffect` 中发生，禁止在渲染期发请求（否则 SSR 与 CSR 首帧不一致）
- 路由跳转用 `useRouter().replace(合法 next ?? '/')`，不用 `window.location`；严格允许列表校验后才使用 next
- 登录/注册页以 Suspense 包裹消费 useSearchParams 的 AuthForm，fallback 提供英文加载状态；生产 build 验证 prerender 边界
- 认证状态用 `useState` + `useMemo` 暴露，不引入 `useSyncExternalStore` 或第三方状态库
- 所有请求带 `credentials: 'same-origin'`：cookie 是令牌的唯一载体，漏掉就等于没登录

### 5.2 同源代理

- `app/api/[...path]/route.ts` 按白名单转发 `cookie`、`origin`、`referer`，其余请求头一律不转发
- `host` **不得**转发：后端看到的请求主机名必须来自转发目标
- `x-forwarded-for` **不得**伪造：后端来源解析是 fail-closed 的，客户端可操纵的值会把安全判定变成摆设
- 上游 `Set-Cookie` 用 `getSetCookie()` 取出全部条目后**逐条 `append`**；用 `get()` 会把多条按逗号合并，属性随之错位

### 5.3 样式

**仓库无 Tailwind、无 shadcn/ui**，表单与按钮为 CSS Modules + `wc-button` 工具类。
若日后引入组件库，错误文案必须仍能被 `getByRole('alert')` 命中，且不得用 Toast 替代内联错误。

### 5.4 响应式（mobile-first）

| 断点 | 表单 |
|---|---|
| 默认（320–767px） | 单列全宽，输入框高度 ≥ 44px，字号 ≥ 16px（防 iOS 自动缩放） |
| `≥768px` | 卡片最大宽 420px 居中 |

- 顶栏在窄屏下不得因显示名过长而撑破布局：`max-width` 截断 + `title` 兜底
- 320px 下表单无横向滚动

### 5.5 与 mock 时代的差异（已消除的债）

| # | mock 时代 | 现状 |
|---|---|---|
| 1 | 密码明文存 `localStorage`，令牌不签名 | 令牌只在 HttpOnly cookie，前端不接触明文存储 |
| 2 | 前端造了后端不存在的 `role` 与 `Editor` 徽章 | 界面只渲染契约里真实存在的字段 |
| 3 | 前端字段名 `id` / `name` 与后端 `publicId` / `displayName` 漂移 | 契约单一真源 + `10-contract-check` 闸门双向比对 |
| 4 | 代理丢 `Cookie` / `Origin` / `Set-Cookie`，后端全绿而前端不可用 | 白名单转发 + 逐条回传，代理测试钉住 |
| 5 | 路由级守卫缺失 | 仍刻意不做，见 1.2；后端拦截器负责鉴权 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 契约真源 | `frontend/lib/contracts/auth.ts` |
| 认证客户端 | `frontend/lib/auth/auth-api.ts` |
| 安全回跳 | `frontend/lib/auth/return-to.ts` / `return-to.test.ts` |
| 上下文 | `frontend/components/auth/auth-provider.tsx` |
| 表单 | `frontend/components/auth/auth-form.tsx` |
| 账户区 | `frontend/components/auth/account-menu.tsx` |
| 路由页 | `frontend/app/login/page.tsx`、`frontend/app/register/page.tsx` |
| 代理 | `frontend/app/api/[...path]/route.ts` |
| 挂载 | `frontend/app/layout.tsx`（Provider）、`components/site/site-header.tsx`（AccountMenu） |
| 单元测试 | `lib/contracts/auth.test.ts`、`lib/auth/auth-api.test.ts`、`components/auth/{auth-provider,auth-form,account-menu}.test.tsx` |
| 端到端 | `docs/e2e/homepage-u1-auth.spec.ts`（A1–A23，共 30 用例） |
| 契约闸门 | `harness/checks/10-contract-check.ps1` |

任务组 3 本轮验证记录（不代称整个 CHANGE 完成）：
- `npm --prefix D:\my-first-project\frontend run test`：34 个文件、414 项通过，退出码 0；使用规范盘符避免 Windows ESM 模块身份差异，排障及对照记录见 CHANGE design。
- `npm --prefix d:\my-first-project\frontend run build`：编译、TypeScript、静态页面生成成功，退出码 0。
- `npm --prefix d:\my-first-project run test:e2e -- docs/e2e/homepage-u1-auth.spec.ts`：30 项通过，退出码 0；报告 `docs/e2e/playwright-report/index.html`，A22/A23 的只读重试截图附在报告中。
- 未覆盖：详情内容与本人状态、评论/投票/收藏 UI、真实认证联调及本 CHANGE 最终总 Harness。本轮回跳目标详情尚为 404，认证桩只验地址与请求，不代表真实详情可读。

```powershell
cd frontend
npx vitest run lib/contracts lib/auth components/auth
npm run build
cd ..
npm run test:e2e -- docs/e2e/homepage-u1-auth.spec.ts
powershell -File harness\checks\10-contract-check.ps1
powershell -File harness\run-all.ps1
```
