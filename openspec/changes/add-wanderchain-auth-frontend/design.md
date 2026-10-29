# Design

本变更的难点不在「调后端接口」，而在三处容易被做成「看起来通了、其实没通」的地方：代理头透传、契约同步机制、以及来源限流在本地开发的共享桶。逐条记录取舍。

## D1 契约真源在后端 DTO，前端镜像 + 闸门比对，而不是代码生成

**结论**：`frontend/lib/contracts/auth.ts` 手写镜像后端 record 组件名，由 `10-contract-check.ps1` 做集合比对。

**为什么不选 OpenAPI 生成**（`springdoc-openapi` + `openapi-typescript`）：

- 生成方案要在后端加依赖、在构建期跑生成器，而本仓库的 `04-frontend` 闸门是 `npm ci → build → test`，生成步骤会插进构建链，失败时的归因面变大；
- 更关键的是**生成物本身也会漂移**：生成出来的 `.d.ts` 提交进仓库后，谁都能手改它，于是仍然需要一道闸门来发现「生成物与真源不一致」。既然闸门不可省，手写镜像 + 闸门比对的总成本更低，还顺带能钉住命名风格；
- 生成器还会把后端内部类型（非出站 DTO）一并带出，反而扩大契约面。

**代价**：镜像需要人工维护，改后端 DTO 时必须同改前端。这个代价由闸门承担——忘了改就是 `exit 1`，而不是靠人记得。

## D2 命名规则：双侧 camelCase，且由闸门而非约定保证

- Java record 的组件名**就是** JSON key（Jackson 默认不改名），因此后端天然 camelCase；闸门扫描 `web/auth/dto/*.java` 与 `common/web/ErrorResponse.java`，出现 `@JsonProperty` 即失败——改名注解是唯一能让「Java 侧驼峰、线上蛇形」的口子，堵住它就堵住了整类漂移。
- 前端字段名必须匹配 `^[a-z][A-Za-z0-9]*$`；`status` 用后端的小写字面量联合 `'active' | 'email_unverified' | 'deleted'`，**不用**枚举名大写形式（契约里写的是 `active`，不是 `ACTIVE`）。
- `Instant` 一律映射为 ISO-8601 `string`。旧 mock 的 `expiresAt: number`（毫秒）是漂移的一个实例：类型对不上时 TS 不会报错，因为 `number` 与 `string` 在 `JSON.parse` 之后都是 `unknown`。
- 前端 `role: 'user' | 'admin'` 概念删除。后端没有角色模型，留着它等于让界面显示一个永远为假的事实（`account-menu` 的 `Editor` 徽章）。

## D3 代理只加三个请求头，`set-cookie` 逐条回传

**转发白名单**：`cookie`、`origin`、`referer`。

- `cookie`：后端 `AuthInterceptor` 只从 cookie 读令牌，不转发等于所有受保护接口 401。
- `origin` / `referer`：后端 `OriginGuard` 对写请求要求二者至少其一命中 `allowed-origins`，不转发等于所有 POST/DELETE 403 `CROSS_SITE_REJECTED`。
- **不透传 `host`**：转发 `host: localhost:3000` 会让后端日志与来源判断看到前端主机名；后端只需要 `Origin`，不需要 `Host`。
- **不追加 `X-Forwarded-For`**：见 D4。

**回传**：`set-cookie` 用 `Headers.getSetCookie()` 取出全部条目后逐条 `append`。用 `get('set-cookie')` 只会拿到被逗号拼接的一条，浏览器解析 `Max-Age` 之后的部分会失败——这是「登录成功但没落 cookie」最隐蔽的一种写法。`content-type` 与 `retry-after` 维持既有行为。

## D4 `trusted-proxies` 保持空列表，本地开发的限流是共享桶

**结论**：本变更不登记可信代理，也不让前端追加转发头。所有经代理的请求在后端都落入「未知来源」单桶（`source-max: 20` / `source-window: 10m`）。

**为什么不顺手把 `127.0.0.1` 登记为可信代理**：登记之后，任何直连 `8989` 的本机进程都能靠伪造 `X-Forwarded-For` 无限刷新来源额度，`TrustedProxySourceKeyResolver` 的第一条规则（「对端不在登记清单里就不看转发头」）在本地就形同虚设——把 fail-closed 变成 fail-open，只为让开发期少撞一次 429。

**代价（必须写明，不能假装没有）**：同一台开发机上任何人累计 20 次登录失败，会把这台机器上所有人在 10 分钟内锁在 429。前端测试因此 MUST NOT 依赖真实后端做失败登录的重复调用；本变更的前端测试全部 mock `fetch`。真实拓扑下的代理登记（nginx / ALB 出口地址进 `trusted-proxies`）属部署形态问题，另立变更。

## D5 图形码的获取时机：注册必取，登录按需

后端不会预先告知「这次要不要图形码」——`LoginRequest` 的 `captchaId` / `captchaAnswer` 是可选字段，只在账户连续失败达阈值后才被要求。因此：

- **注册**：图形码是换发邮箱码的前置条件，进页面即取一张。
- **登录**：默认不取码；收到 `400` + `CAPTCHA_INVALID` 才取一张并允许带码重试。主动轮询会把一次性码烧掉（`GETDEL` 语义，取出来就作废），也会让「刷新页面」变成消耗配额的动作。

## D6 会话状态只从 `GET /me` 读，localStorage 不再存任何认证信息

HttpOnly cookie 是唯一凭据，前端 JS 读不到它，因此「我是否已登录」只能问后端。首帧 `loading`，`/me` 返回 200 → `user`，返回 401 → `guest`，网络失败 → `guest` 且不吞掉错误（错误只在调试时可见，界面不展示）。

**推论**：`AuthProvider` 挂载期会发一次请求。`app/page.test.tsx`、`app/placeholders.test.tsx`、`app/layout.test.tsx` 这些用 `AuthProvider` 包裹的测试必须 mock `fetch`，否则 jsdom 下会出现未处理的 rejection。这不是测试写法退步，而是「会话来自服务端」的必然结果。

## D7 错误码到文案的映射集中在客户端层

`lib/auth/auth-api.ts` 持有一张 `AuthErrorCode → 英文文案` 的映射，组件不各自拼提示。理由：spec 的「统一错误结构」要求客户端**以错误码而非状态码**区分两个 403（`EMAIL_UNVERIFIED` 与 `CROSS_SITE_REJECTED`），把判断散落到组件里就会出现只看 `status` 的实现。`RATE_LIMITED` 额外读 `Retry-After` 秒数并写进错误对象，界面据此显示等待时间，不再发第二次探测请求。

映射缺项的处理：未知错误码回落到 `message` 字段原文，不静默变成「未知错误」——后端新增错误码属于契约变更，此时前端显示后端原文比显示一句假的兜底文案更诚实。

## D8 mock 认证整体删除，不保留「演示模式」开关

`assertDemoEnvironment()` 存在的理由是「防止演示代码被当成真认证部署」。接入真实认证后这个理由消失，而保留一个 `USE_MOCK_AUTH` 开关等于在生产构建里留一条把明文密码写进 localStorage 的路径。删除 `lib/auth/mock-auth.ts` 与其测试，`03-static-guard` 的前端文件计数随之变化属正常。

**连带影响（已核实，不是假设）**：`docs/e2e/homepage-u1-mock-auth.spec.ts` 直接读写 `wanderchain.session` 并用种子账号 `admin@wanderchain.dev / admin123` 登录（该文件第 22、82、101、145、190 行），`docs/specs/wanderchain/homepage-u1-mock-auth.md` 记录其 16 个 Scenario。删掉 mock 必然让这套 E2E 与单元文档同时失效，因此本变更必须一并处理，不能只删实现：

- E2E 改写为 `docs/e2e/homepage-u1-auth.spec.ts`，用 Playwright 的 `page.route` 在网络层桩掉 `/api/auth/*`。断言对象从「mock 的内部状态」换成「对外契约」：请求体字段名逐字等于契约、按错误码而非状态码分流、图形码只在 `CAPTCHA_INVALID` 后出现、注册两步各自发一次请求。这样登录/注册页的可观察行为覆盖不缩水。
- `playwright.config.ts` 第 48 行注释「next dev 不能换成 next start：Mock 认证在 production 下会主动拒绝注册与登录」随 mock 退役而失效，改写为真实原因（E2E 走 dev server 以便 `page.route` 拦截与热更）。
- `08-spec-doc-breakpoints.ps1` 的配对表不含 u1 文档，改名不影响该闸门。
- `docs/spec-coverage-audit.md` 是带日期（2026-10-27）的审计快照，其中 u1 的 16 条计数会过期。按「快照不回改」处理，在归档说明里注明，不修改历史报告。
- **u4「S2 · 打开面板不发起业务 API 请求」被连带修改（实跑 E2E 时暴露，非预期）**：`AuthProvider` 挂载即发 `GET /api/auth/me` 探测会话，而所有渲染根布局的页面都挂 `AuthProvider`，因此这条探测会在 u4 挂钩 `recordDataRequests` 之后、打开面板之前落地，被 `/\/api\//` 过滤误算成「面板发起的请求」。spec 原文（`openspec/specs/wanderchain-homepage/spec.md`）限定的是「打开并**关闭面板期间**不发生 fetch/XHR」，全局会话探测不属于面板行为；据此把记录起点移到探测落地之后（等 `data-testid="account-loading"` 消失）再挂钩，并按 spec 补上 Esc 关闭动作。契约未弱化：面板本身仍断言零业务请求。
- **dev 模式 React StrictMode 双调用（实跑暴露）**：Next 16 默认开启 `reactStrictMode`，dev server 下挂载 effect 执行两次，`GET /me`、`GET /captcha` 各多发一次（生产构建不会）。u1 的请求序列断言因此从「绝对序列」改为「计数关系 + 先后顺序」：该发的一次不能少、不该发的必须为 0（如第一步失败时 `/register` 计数为 0），既容忍 StrictMode 又不放松契约。

**已知残余风险**：E2E 不在 `harness/run-all.ps1` 的十一道闸门内（`04-frontend` 只跑 `npm ci → build → test`），改写后的 u1 用例只能由 `npm run test:e2e` 手动验证。本轮已实跑：`npm run test:e2e` 退出码 0，`docs/e2e/test-results/.last-run.json` 为 `{"status":"passed","failedTests":[]}`（156 条）。
