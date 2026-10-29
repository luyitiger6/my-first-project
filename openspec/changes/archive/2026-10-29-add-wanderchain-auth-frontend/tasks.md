# Tasks

## 1. 后端断言补口（G4）

- [x] 1.1 在 `backend/src/test/java/com/luyi/myfirst/service/auth/AuthCookieTest.java` 增一条断言：下发与清除两种 `Set-Cookie` 都不含 `Domain` 属性；验证 `02-test` 全绿，且把 `AuthCookie` 改成 `.domain("wanderchain.dev")` 后该用例必红（变异实验，验证后还原）

## 2. 代理头透传（G2）

- [x] 2.1 `frontend/app/api/[...path]/route.ts` 按白名单转发 `cookie`、`origin`、`referer`，其余请求头不转发，`host` 明确不转发；验证 `route.test.ts` 新增用例断言三个头出现在转发请求上、`host` 不出现
- [x] 2.2 上游 `set-cookie` 用 `getSetCookie()` 取出全部条目并逐条 `append` 回传；验证用例构造两条 `Set-Cookie` 后，响应里 `getSetCookie()` 仍是两条且各自属性完整（含 `HttpOnly`、`Path=/`、`Max-Age`）
- [x] 2.3 确认既有 5 条代理用例（地址拼接、运行期切换、POST 语义、非 2xx 透传、429 透传、502 兜底）在改动后仍全绿；验证 `npm run test` 退出码 0

## 3. 契约单一真源与闸门（G3）

- [x] 3.1 新增 `frontend/lib/contracts/auth.ts`：镜像后端 10 个 record（`CaptchaResponse`、`RegisterCodeRequest`、`RegisterRequest`、`RegisterResponse`、`LoginRequest`、`LoginResponse`、`MeResponse`、`PasswordResetCodeRequest`、`PasswordResetRequest`、`ErrorResponse`）的字段名，`AccountStatus` 用小写字面量联合，`Instant` 映射为 `string`，错误码常量集合为 spec 的七个值，端点路径集中为常量；验证 `lib/contracts/auth.test.ts` 断言字段集合与错误码个数
- [x] 3.2 新增 `harness/checks/10-contract-check.ps1`：解析后端 `web/auth/dto/*.java` 与 `common/web/ErrorResponse.java` 的 record 组件名，解析前端契约文件的接口字段名，按同名接口做集合比对；两侧字段名必须匹配 `^[a-z][A-Za-z0-9]*$`；后端 dto 目录内出现 `@JsonProperty` 即失败；前端出现后端没有的接口即失败；验证四种破坏（删一个后端字段、加一个前端字段、改成蛇形、加 `@JsonProperty`）都能让闸门 `exit 1`，正常状态 `exit 0`
- [x] 3.3 同步 `AGENTS.md`：§6 目录地图补 `10-contract-check.ps1` 一行、§7 命令速查补「只查契约」、`<!-- harness-checks: ... -->` 标记追加 `10-contract-check`；验证 `07-doc-consistency.ps1` 退出码 0
- [x] 3.4 修正 `harness/run-all.ps1` 的 `.SYNOPSIS`：闸门链描述仍写着 `06-flyway` 且只列到 06，改为实际的十一道；验证 `07-doc-consistency` 仍通过（该脚本只比对标记与文件名，注释改动不影响）

## 4. 认证客户端与 UI（G1）

- [x] 4.1 新增 `frontend/lib/auth/auth-api.ts`：`fetchCaptcha` / `requestRegisterCode` / `registerAccount` / `login` / `fetchCurrentAccount` / `logout`，统一 `credentials: 'same-origin'`；错误体 `{ code, message }` 解析为带 `code`、`status`、`retryAfter` 的 `AuthApiError`；`GET /me` 的 `401` 归一化为 `null`；错误码到英文文案的映射表集中在此，未知码回落到后端 `message` 原文；验证 `lib/auth/auth-api.test.ts` 覆盖成功、401 归一化、429 带 `retryAfter`、两个 403 文案不同、请求体字段名逐字等于契约
- [x] 4.2 `components/auth/auth-provider.tsx` 改为挂载时调 `fetchCurrentAccount()`，状态机 `loading → guest | user`，`logout` 调后端端点后回到 `guest`；不再读写 localStorage；验证 provider 用例断言三态流转与「网络失败归 guest 且不抛未捕获异常」
- [x] 4.3 `components/auth/account-menu.tsx` 改用 `displayName`，删除 `role` 分支与 `Editor` 徽章；验证用例断言展示显示名、且不出现角色徽章
- [x] 4.4 `components/auth/auth-form.tsx` 登录分支：默认不取图形码，收到 `CAPTCHA_INVALID` 才取码并允许带码重试；`RATE_LIMITED` 展示 `Retry-After` 秒数；两个 403 展示不同文案；密码提示改为 8–72；验证用例覆盖四条分支，并断言「凭证正确时从未请求过图形码端点」
- [x] 4.5 `components/auth/auth-form.tsx` 注册分支：改为两步（图形码换邮箱码 → 提交邮箱码注册），第一步失败不进入第二步，`429` 展示等待秒数；验证用例断言两步各发一次请求、请求体字段名取自契约、图形码错误时不提交注册
- [x] 4.6 适配既有页面测试：`app/page.test.tsx`、`app/placeholders.test.tsx`、`app/layout.test.tsx` 用 `AuthProvider` 包裹，挂载期会发请求，必须桩掉 `fetch`；验证三个文件在 `npm run test` 下全绿且无未处理 rejection
- [x] 4.7 `app/login/page.tsx`、`app/register/page.tsx` 与 `components/auth/auth-form.module.css` 补齐图形码图片、验证码输入、等待提示的样式与可访问性标签；验证 `npm run build` 退出码 0

## 5. mock 退役与文档同步

- [x] 5.1 删除 `frontend/lib/auth/mock-auth.ts` 与 `frontend/lib/auth/mock-auth.test.ts`；验证全仓检索 `mock-auth` 零命中，`03-static-guard` 与 `04-frontend` 均通过
- [x] 5.2 把 `docs/e2e/homepage-u1-mock-auth.spec.ts` 改写为 `docs/e2e/homepage-u1-auth.spec.ts`，用 `page.route` 桩掉 `/api/auth/*`，断言对象换成对外契约（请求体字段名、错误码分流、图形码按需出现、注册两步各一次请求）；验证 `npm run test:e2e` 实跑通过——**若本轮无法实跑，必须在下方如实记为未验证，不得记为通过**
- [x] 5.3 同步改写 `docs/specs/wanderchain/homepage-u1-mock-auth.md` 为 `homepage-u1-auth.md`，Scenario 与改写后的 E2E 一一对应；验证 `08-spec-doc-breakpoints.ps1` 退出码 0（该文档不在配对表内，改名不影响闸门）
- [x] 5.4 修正 `playwright.config.ts` 中「Mock 认证在 production 下会主动拒绝注册与登录」的注释，改为真实原因；验证全仓检索该句零命中

## 6. 验收

- [x] 6.1 `powershell -File harness\checks\02-test.ps1` 退出码 0（后端，含 1.1 新增断言）
- [x] 6.2 `powershell -File harness\checks\04-frontend.ps1` 退出码 0（`npm ci → build → test`）
- [x] 6.3 `powershell -File harness\checks\10-contract-check.ps1` 退出码 0，并按 3.2 完成四次破坏性验证
- [x] 6.4 `powershell -File harness\run-all.ps1` 退出码 0，十一道闸门全 PASS
- [x] 6.5 手动打通一次真实链路（后端 `mvn spring-boot:run` + 前端 `npm run dev`）：取图形码 → 换注册码 → 注册（浏览器落 `wc_session` cookie）→ 刷新页面顶栏显示 displayName → 登出后回到访客态；把观察到的结果记入本条备注
  - **已实跑通过（2026-10-29，经前端代理 `http://localhost:3000`）**：后端 8989 + 前端 dev 3000 同时在线，MySQL 8806/`wanderchain`、Redis 6606 db3 为真实实例。
  - `GET /api/auth/captcha` → 200（`captchaId` + `data:image/png;base64,…`）；`POST /api/auth/register-code` → 202；`POST /api/auth/register` → 200，响应体 `{publicId,email,displayName}` 全驼峰、不含令牌。
  - `Set-Cookie: wc_session=…; Path=/; Max-Age=604800; Expires=…; HttpOnly; SameSite=Lax` —— **不含 `Domain`**（G4 在真实链路上复现）。
  - `GET /api/auth/me` → 200，`{publicId,email,displayName,status:"active",createdAt:"2026-10-29T…Z"}` 五字段全驼峰（G3 端到端对齐）；`POST /api/auth/logout` → 204 且回传清除态 `wc_session=; Max-Age=0`；登出后 `GET /api/auth/me` → 401（回到访客态）。
  - 验证码取值方式：图形码/邮箱码在 Redis 内均以 `HMAC-SHA256(jwt-secret)` 摘要存储、明文码只在进程内 outbox（spec 禁止端点读出），故用已知密钥本地复算摘要、以已知答案预写对应 Redis 键完成链路；候选密钥正确性由「注册 200 + /me 200」自证。此步为一次性人工联调，未新增任何生产端点或改动源码。

## Workflow follow-up

- 归档时把 `frontend-nextjs` 的 MODIFIED 条款合入主 spec，并新增 `wanderchain-auth-frontend` 能力目录。
- `frontend-nextjs` 主 spec 的 Purpose 仍写着「Mock 认证」，归档时一并改为真实认证接入。
- `docs/spec-coverage-audit.md` 是 2026-10-27 的审计快照，u1 的 16 条计数会过期；按快照不回改处理，在归档说明里注明。
