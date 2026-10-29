# Proposal

## Why

后端能力 `wanderchain-auth` 已归档（`openspec/specs/wanderchain-auth/spec.md`，14 条 Requirement，`02-test` 224 例全绿），但前端一行都没接：`frontend/lib/auth/mock-auth.ts` 把账号与**明文密码**写进 localStorage、签发不参与校验的三段式假令牌，并在 `NODE_ENV=production` 下由 `assertDemoEnvironment()` 直接抛错。三个后果：

1. **站点在生产不可用**——注册与登录第一步就抛异常。
2. **后端 cookie 认证链路端到端一次都没走过**——`Set-Cookie` 下发、`OriginGuard` 来源校验、令牌三步校验在真实浏览器路径上全部未被验证。
3. **前端字段名已与后端契约漂移，且没有任何机制会报警**——`AuthUser { id, name, role }` 对 `MeResponse { publicId, displayName, status }`；`role: 'user' | 'admin'` 在后端根本不存在；密码最小长度前端写 6、后端是 8–72 字节。

漂移能长期存在，是因为同源代理 `frontend/app/api/[...path]/route.ts` 只透传 `content-type` 与 `accept`：`Cookie`、`Origin`、`Referer` 被丢掉，上游 `Set-Cookie` 也不回传。这条链路上任一环缺失，表现都是「后端测试全绿、前端不能用」——登录拿不到 cookie、写请求被 `OriginGuard` 判 403、受保护接口 401。归档的 `add-wanderchain-auth` tasks 3.5 已把这笔账记在案（「前端 `route.ts` 当前不转发 `Origin`/`Referer`/`Cookie`，接入时需一并补」），本变更就是还这笔账。

因此本次不是「把 mock 换成 fetch」，而是把**代理透传、契约镜像、认证客户端**三件事一起补上，并把「契约一致性」从口头约定变成一道有否决权的闸门。

## What Changes

- **代理层（G2）**：`app/api/[...path]/route.ts` 按白名单转发 `cookie`、`origin`、`referer` 三个请求头，并把上游 `set-cookie` 逐条回传（多条不得压成一条）。其余请求头维持不透传，`host` 明确不转发。
- **契约层（G3）**：新增 `frontend/lib/contracts/auth.ts` 作为前端认证字段的**唯一书写点**，逐字镜像后端 `web/auth/dto/*.java` 与 `common/web/ErrorResponse.java` 的 record 组件名；`AccountStatus` 用后端小写字面量联合（`active` / `email_unverified` / `deleted`）；`Instant` 一律映射为 ISO-8601 `string`；错误码常量集合与 spec「统一错误结构」的七个值一致。
- **认证客户端（G1）**：新增 `frontend/lib/auth/auth-api.ts`，以 `credentials: 'same-origin'` 调 `/api/auth/*`；错误体 `{ code, message }` 解析为带 `code` 与 `retryAfter` 的 `AuthApiError`；`GET /me` 的 `401` 归一化为 `null` 而不是抛错。
- **UI 接入**：`auth-provider.tsx` 的会话状态只从 `GET /me` 读（首帧 `loading`，随后 `guest` / `user`），localStorage 不再存任何令牌或用户信息；`account-menu.tsx` 改用 `displayName`，删除后端不存在的 `role` 徽章；登录表单在收到 `CAPTCHA_INVALID` 时才取图形码并允许重试；注册表单改为「图形码换邮箱码 → 提交注册」两步，密码提示改为 8–72。
- **mock 退役**：删除 `lib/auth/mock-auth.ts` 与 `lib/auth/mock-auth.test.ts`。生产护栏 `assertDemoEnvironment` 随之消失——它的职责由真实认证本身承担，不再需要一个「误部署即抛错」的替身。
- **后端补一条断言（G4）**：`AuthCookieTest` 增加「`Set-Cookie` 不含 `Domain` 属性」的断言。spec 第 193 行要求 cookie `MUST NOT 允许 Domain 跨越到子域`，当前实现从不下发 `Domain`，靠「没写它」成立而没有断言钉住。
- **新增闸门 `10-contract-check.ps1`**：解析后端 `record` 组件名与前端 `lib/contracts/auth.ts` 的接口字段名，按同名接口做集合比对；同时校验双侧字段名均为 camelCase、且后端 dto 目录内不出现 `@JsonProperty` 改名注解。任一项不符即 `exit 1`。
- **文档同步**：`AGENTS.md` §6 目录地图与 §7 命令速查补第 10 道闸门、`<!-- harness-checks: ... -->` 标记追加 `10-contract-check`；`harness/run-all.ps1` 的 `.SYNOPSIS` 顺带修掉仍写着 `06-flyway` 的过期描述。

## Capabilities

### New Capabilities

- `wanderchain-auth-frontend`：前端认证接入的可观察契约——会话状态只来自 `GET /me`、令牌只存在于 HttpOnly cookie、注册走两步码链路、登录按错误码分流、界面不出现后端不存在的字段。

### Modified Capabilities

- `frontend-nextjs`：
  - MODIFIED「API 同源代理（运行期可切换）」——原条款只要求透传方法、请求体、状态码与响应体，不足以支撑 cookie 认证；补入认证相关请求头透传与 `Set-Cookie` 逐条回传。原条款的 5 个 Scenario 全部保留，只新增不删减。
  - ADDED「认证契约与后端字段一致并纳入闸门」——把「前后端字段名同步」写成可验证要求，而不是靠人记得改。

## Impact

- 前端代码：`app/api/[...path]/route.ts`、`components/auth/{auth-provider,auth-form,account-menu}.tsx` 及两个 `.module.css`（新增图形码与验证码字段样式）、`app/login/page.tsx`、`app/register/page.tsx`；新增 `lib/contracts/auth.ts`、`lib/auth/auth-api.ts`；删除 `lib/auth/mock-auth.ts`。
- 前端测试：`app/api/[...path]/route.test.ts` 增头透传与 `Set-Cookie` 回传用例；新增 `lib/contracts/auth.test.ts`、`lib/auth/auth-api.test.ts`；改写 `components/auth/{auth-form,account-menu}.test.tsx`；删除 `lib/auth/mock-auth.test.ts`。`app/page.test.tsx`、`app/placeholders.test.tsx`、`app/layout.test.tsx` 里的 `AuthProvider` 包裹需要一并适配（它们依赖挂载期读 localStorage 的旧行为）。
- 后端代码：仅 `src/test/.../service/auth/AuthCookieTest.java` 增一条断言，`main` 不动。
- 闸门与文档：新增 `harness/checks/10-contract-check.ps1`；`AGENTS.md` §6/§7 与闸门标记同步；`harness/run-all.ps1` 注释修正。
- 运行期：不新增 npm 依赖、不新增 Maven 依赖；`application.yml` 的 `allowed-origins` 已登记 `http://localhost:3000` 与 `http://127.0.0.1:3000`，无需改动。
- **明确不做**：
  - `trusted-proxies` 登记与代理追加 `X-Forwarded-For`——涉及部署拓扑与信任边界，另立变更（理由见 design D4）。
  - 密码找回与账户注销的前端页面——后端端点已就绪，UI 另立变更。
  - Playwright E2E 打通真实认证链路——需要真实 MySQL/Redis 与后端进程常驻，另立变更。
  - 后端任何行为改动——本变更不改 `wanderchain-auth` 的任何 Requirement。
