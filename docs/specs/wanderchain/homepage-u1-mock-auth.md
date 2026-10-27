# U1 · Mock 认证（登录标识为邮箱）

| 项 | 值 |
|---|---|
| 单元编号 | U1 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: Mock 认证（登录标识为邮箱）` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | 纯前端本地会话，**零网络请求**。真实认证需另立项 |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；表单、账户区与错误文案一律以英文为准。

### 1.1 包含

| # | 能力 | 落点 |
|---|---|---|
| 1 | 用户 / 会话 / 注册入参类型，`AuthError` 错误类 | `lib/auth/mock-auth.ts` |
| 2 | 两个种子账号（管理员 + 普通用户） | 同文件 `SEED_ACCOUNTS` |
| 3 | 注册：邮箱归一化、字段校验、重复检测、写入本地账号表 | `registerAccount` |
| 4 | 登录：按归一化邮箱查找、明文比对、签发假令牌 | `loginWithPassword` |
| 5 | 会话读写：8 小时 TTL、过期清理、脏数据清理 | `readSession` / `logoutSession` |
| 6 | 全局认证上下文：`loading / guest / user` 三态 | `AuthProvider` / `useAuth` |
| 7 | 登录 / 注册表单（同一组件双模式） | `AuthForm` |
| 8 | 顶栏账户区：加载占位 / 登录入口 / 用户名 + 编辑标 + 退出 | `AccountMenu` |
| 9 | 两个路由页 `/login`、`/register` | `app/login/page.tsx`、`app/register/page.tsx` |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 真实 JWT 签发、签名校验、刷新令牌 | 未立项 |
| 服务端会话、Cookie、HttpOnly | 未立项 |
| 第三方登录（微信 / GitHub / OAuth） | 未立项 |
| 找回密码、邮箱验证、验证码 | 未立项 |
| 权限校验与路由守卫（`admin` 仅用于展示 `Editor` 标） | 未立项 |
| 收藏 / 发帖等依赖登录的业务能力 | 未立项 |
| AI 助手面板 | U4 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 种子账号 | **静态**（编译期常量） | 2 个，含明文密码，仅用于演示 |
| 注册账号 | 浏览器 `localStorage` | key `wanderchain.accounts` |
| 会话 | 浏览器 `localStorage` | key `wanderchain.session`，TTL 8 小时 |
| 真实认证接口 | **需要 API（本期未接）** | 本单元零 fetch |

### 1.4 与其他单元的关系

- **依赖**：无
- **被依赖**：U2 骨架（`AuthProvider` 挂在根布局，`AccountMenu` 挂在顶栏）
- **结论**：可与 U4 并行，是最早能开工的两个单元之一

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 首帧会话恢复（已登录）**
- When 页面加载且本地存在未过期会话
- Then 状态由 `loading` 变为 `user`，`user` 为会话中的用户对象
- And 顶栏展示用户名（`admin` 角色额外展示 `Editor` 标）

**S2 · 首帧会话恢复（未登录）**
- When 本地无会话
- Then 状态变为 `guest`，顶栏展示 `Log in / Sign up` 链接指向 `/login`

**S3 · 注册成功**
- When 提交合法邮箱、≥6 位密码、≥2 字用户名，且两次密码一致
- Then 账号写入 `wanderchain.accounts`，会话写入 `wanderchain.session`
- And 状态变为 `user`，路由 `replace('/')`

**S4 · 登录成功**
- When 提交种子账号或已注册账号的正确凭据
- Then 签发三段式假令牌（`header.payload.mock-signature`），会话持久化
- And 状态变为 `user`，路由 `replace('/')`

**S5 · 邮箱大小写与空格不敏感**
- When 输入 ` Admin@WanderChain.dev ` 与 `admin123`
- Then 登录成功（归一化为 `admin@wanderchain.dev` 后命中种子账号）
- And 注册时同一邮箱的不同大小写写法被判为重复

**S6 · 退出登录**
- When 点击 `Log out`
- Then `wanderchain.session` 被移除，状态变为 `guest`
- And 账号表 `wanderchain.accounts` **不受影响**（已注册账号仍可再次登录）

### 2.2 异常路径

**S7 · 邮箱格式非法**
- When 提交不含 `@` 或不含点号的邮箱
- Then 抛出 `AuthError('Enter a valid email address')`，表单以 `role="alert"` 展示
- And 不写入任何存储

**S8 · 密码过短**
- When 提交长度 < 6 的密码
- Then 抛出 `AuthError('Password must be at least 6 characters')`，状态保持 `guest`

**S9 · 用户名过短**
- When 注册时用户名 trim 后长度 < 2
- Then 抛出 `AuthError('Username must be at least 2 characters')`

**S10 · 邮箱重复**
- When 注册一个已存在于种子表或已注册表中的邮箱
- Then 抛出 `AuthError('This email is already registered')`，账号表不被写入

**S11 · 凭据不匹配**
- When 邮箱不存在或密码错误
- Then 抛出 `AuthError('Incorrect email or password')`
- And 错误文案不区分「账号不存在」与「密码错误」，文案完全一致（避免枚举账号）

**S12 · 两次密码不一致**
- When 注册模式下两次输入不同且点击提交
- Then 直接展示 `The two passwords do not match`
- And **不调用** `register`，不产生任何存储写入

**S13 · 会话过期**
- When 本地会话的 `expiresAt <= Date.now()`
- Then 删除该会话并返回 `null`，状态回到 `guest`

**S14 · 本地会话被破坏**
- When `wanderchain.session` 不是合法 JSON，或缺少 `user` 字段
- Then 删除该会话并返回 `null`，不抛异常、不白屏

**S15 · 提交中重复点击**
- When 请求进行中再次点击提交
- Then 按钮 `disabled` 且文案为 `Working…`，不产生第二次调用

**S16 · 服务端渲染阶段**
- When 在无 `window` 的环境执行本模块
- Then 存储访问返回 `null`，不抛 `ReferenceError`
- And 会话恢复只在 `useEffect` 中发生，不在渲染期访问浏览器 API

---

## 3. 数据结构

### 3.1 类型定义

```ts
export type UserRole = 'user' | 'admin'

export interface AuthUser { id: string; email: string; name: string; role: UserRole }

export interface Session { token: string; user: AuthUser; expiresAt: number }

export interface RegisterInput { email: string; password: string; name: string }

export class AuthError extends Error {}

export type AuthStatus = 'loading' | 'guest' | 'user'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
}
```

### 3.2 组件 Props

| 组件 | Props | 约束 |
|---|---|---|
| `AuthProvider` | `{ children: ReactNode }` | 必须包裹整个 `body` 内容；页面内**只能出现一个** |
| `AuthForm` | `{ mode: 'login' \| 'register' }` | 闭集 2 值；决定是否渲染 `Username` / `Confirm password` 两个字段与文案 |
| `AccountMenu` | 无 | 必须位于 `AuthProvider` 内，否则抛错 |
| `useAuth()` | 无 | 在 Provider 外调用抛 `useAuth must be used inside AuthProvider` |

### 3.3 字段与规则约束

| 项 | 约束 | 违反后果 |
|---|---|---|
| `email` | 正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`，归一化 = `trim().toLowerCase()` | 抛 `AuthError`，不落库 |
| `password` | 长度 ≥ 6，**明文存 `localStorage`** | 抛 `AuthError`；明文存储为演示特性，见 5.5 |
| `name` | `trim()` 后长度 ≥ 2 | 抛 `AuthError` |
| `role` | 注册用户固定 `'user'`；种子账号可 `'admin'` | 权限提升绕过 |
| `token` | 三段式 `base64url(payload)` + `.mock-signature`，**不校验签名** | 伪造令牌不报错 |
| `expiresAt` | `Date.now() + 8h`，毫秒时间戳 | 过期判定失效 |
| `id` | `u-<36 进制时间><6 位随机>` | 碰撞导致账号串号 |

### 3.4 存储契约

| key | 形态 | 读失败处理 |
|---|---|---|
| `wanderchain.accounts` | `StoredAccount[]`（含明文 password） | `JSON.parse` 失败 → 视为空数组 |
| `wanderchain.session` | `Session` | 解析失败 / 无 `user` / 已过期 → 删除并返回 `null` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 认证逻辑

- [ ] 种子账号 `admin@wanderchain.dev / admin123` 可登录且 `role === 'admin'`
- [ ] 种子账号 `traveler@wanderchain.dev / traveler123` 可登录且 `role === 'user'`
- [ ] 邮箱大小写与首尾空格不影响登录结果
- [ ] 注册成功后账号入 `wanderchain.accounts`、会话入 `wanderchain.session`
- [ ] 重复邮箱（含大小写差异）注册被拒绝，文案为 `This email is already registered`
- [ ] 邮箱非法 / 密码 < 6 / 用户名 < 2 分别给出对应文案
- [ ] 登录失败统一文案 `Incorrect email or password`
- [ ] 两次密码不一致时不调用 `register`，无存储写入
- [ ] 退出后会话被清除，账号表保留，原账号可再次登录

### 4.2 会话与异常

- [ ] 过期会话被删除并回到 `guest`
- [ ] 会话 JSON 损坏时被删除且不白屏
- [ ] 无 `window` 环境下不抛错（`readSession()` 返回 `null`）
- [ ] 提交中按钮 `disabled` 且文案 `Working…`

### 4.3 界面

- [ ] 顶栏三态：加载时占位（无文字）、访客时 `Log in / Sign up`、登录后「用户名 + `Log out`」
- [ ] `admin` 用户额外显示 `Editor` 标
- [ ] 表单错误以 `role="alert"` 呈现
- [ ] 登录页展示演示账号提示，注册页不展示
- [ ] 登录页与注册页互有跳转链接

### 4.4 工程

- [ ] 全链路零网络请求（`grep -r "fetch(" lib/auth components/auth` 无结果）
- [ ] `AccountMenu` 在 `AuthProvider` 外使用时抛出明确错误而非静默失败
- [ ] `lib/auth/mock-auth.test.ts` + `components/auth/account-menu.test.tsx` 覆盖 S1–S16
- [ ] `npx vitest run lib/auth components/auth` 全绿
- [ ] `npm run build` 通过
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- `AuthProvider`、`AuthForm`、`AccountMenu` 均为 **Client Component**，文件首行必须是 `'use client'`
- 根布局为 Server Component，只负责把 `AuthProvider` 包在 `{children}` 外层
- 浏览器 API（`localStorage`）**只允许**在 `useEffect` 或事件回调中访问，禁止在渲染期读取
- 路由跳转用 `useRouter().replace('/')`，不用 `window.location`
- 认证状态用 `useState` + `useMemo` 暴露，不引入 `useSyncExternalStore` 或第三方状态库

### 5.2 Tailwind CSS + shadcn/ui

**⚠ 现状：仓库无 Tailwind、无 shadcn/ui**，表单与按钮为 CSS Modules + `wc-button` 工具类。

若引入后，本单元应改用的 shadcn 组件：

| 现状元素 | 目标组件 |
|---|---|
| `<label><span>Email</span><input/></label>` | `Label` + `Input` |
| 提交按钮 | `Button`（`disabled` 由 `pending` 驱动） |
| 错误提示 `<p role="alert">` | `Alert` variant=`destructive`，或保留原生 `role="alert"` |
| 顶栏用户名 + 退出 | `DropdownMenu`（`DropdownMenuTrigger` + `DropdownMenuItem`） |

约束：错误文案必须仍能被 `getByRole('alert')` 命中；不得用 `Toast` 替代内联错误（Toast 在测试中不稳定）。

### 5.3 响应式（mobile-first）

| 断点 | 表单 |
|---|---|
| 默认（320–767px） | 单列全宽，输入框高度 ≥ 44px，字号 ≥ 16px（防 iOS 自动缩放） |
| `≥768px` | 卡片最大宽 420px 居中 |

- 顶栏在窄屏下不得因用户名过长而撑破布局：用户名 `max-width` 截断 + `title` 兜底
- 320px 下表单无横向滚动

### 5.4 图片（next/image）

**本单元无图片**。约束：登录 / 注册页不得引入装饰性大图；若后续加品牌图，走 U2 的统一约束（`next/image` + `priority`）。

### 5.5 与现状的差异（安全边界）

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | 生产认证 | **密码明文存 `localStorage`**，令牌不签名 | 仅演示；上线前必须换服务端签发方案 |
| 2 | Tailwind + shadcn | 未安装，用 CSS Modules | 表单样式与目标组件库不一致 |
| 3 | 路由级守卫 | **无**：未登录也能访问 `/community` | 本期刻意不做，见 1.2 |
| 4 | 会话恢复时机 | `useEffect` 内一次读取 | 首帧必然经历 `loading`，勿在 SSR 断言登录态 |

> 上述第 1 条必须在代码注释与本文件中同时标注，禁止以「反正是 mock」为由省略警告。

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 认证逻辑 | `frontend/lib/auth/mock-auth.ts` |
| 上下文 | `frontend/components/auth/auth-provider.tsx` |
| 表单 | `frontend/components/auth/auth-form.tsx` |
| 账户区 | `frontend/components/auth/account-menu.tsx` |
| 路由页 | `frontend/app/login/page.tsx`、`frontend/app/register/page.tsx` |
| 挂载 | `frontend/app/layout.tsx`（Provider）、`components/site/site-header.tsx`（AccountMenu） |
| 测试 | `lib/auth/mock-auth.test.ts`、`components/auth/account-menu.test.tsx` |

```powershell
cd frontend
npx vitest run lib/auth components/auth
npm run build
cd ..
powershell -File harness\run-all.ps1
```
