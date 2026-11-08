# Design

## Context

生产链路是「Ingress → 前端 Next Route Handler → 后端」，动机见 `proposal.md`。与本设计相关的现状：

- 后端来源识别已就绪：`TrustedProxySourceKeyResolver` 先看对端是否在 `trusted-proxies` 内，可信才取 `X-Forwarded-For` 的最后一跳，解析失败归 `UNKNOWN_SOURCE`，IPv6 按 `/64` 聚合。
- 但 `application.yml` 的 `trusted-proxies` 是空列表，且 `AuthProperties` 把空列表当作合法取值；叠加前端代理不转发 `X-Forwarded-For`，全站请求落在 `unknown` 单桶。
- 写请求已有来源校验：`OriginGuard`（`ORDER = 0`，`POST`/`PUT`/`PATCH`/`DELETE`，缺失 Origin 时回退 Referer）。
- 认证拦截器 `AuthInterceptor.ORDER = 10`，按「全站保护 + 代码内公开路由表」注册。
- 登录失败限流 `LoginThrottle` 已用 Lua 保证 `INCR` 与 `PEXPIRE` 原子，键为 `wc:login:fail:src:{sourceKey}`。
- 统一拒绝出口是 `BizException(error, retryAfterSeconds)` + `GlobalExceptionHandler`，后者负责写 `Retry-After` 头；`AuthErrorEnum.RATE_LIMITED` 已是 429。
- 前端代理白名单当前只有 `Cookie`、`Origin`、`Referer` 三个头（`frontend/app/api/[...path]/route.ts`）。

## Goals / Non-Goals

**Goals:**

- 让来源识别在真实拓扑下产出稳定、不可伪造的客户端来源键，而不是全站一个桶。
- 让所有非认证写端点具备来源级限流，且多实例共享同一额度。
- 部署时「忘配 `trusted-proxies`」直接启动失败，而不是静默退化成未知单桶。
- 不改变任何端点路径、请求体、响应体字段。

**Non-Goals:**

- 不改 Ingress 配置与路由拓扑（`/api` 仍全部落前端，不按路径分流）。
- 不引入令牌桶/滑动窗口等更精细算法；固定窗口足够防刷。
- 不做账户维度的全站写配额（仅登录失败保留账户维度）。
- 不把 `X-Forwarded-For` 以外的转发头（如 `X-Real-IP`、`Forwarded`）纳入白名单。

## Decisions

### D1 来源识别：代理原样透传 + 后端取最后一跳

前端代理把 `X-Forwarded-For` 纳入白名单，并把上游值**原样**写入转发请求；不追加自身地址，缺失时不补值。

理由：`TrustedProxySourceKeyResolver` 的语义是「最后一跳是最近一层可信代理写入的对端地址」。Ingress（nginx）默认把客户端地址追加到 XFF 末尾；前端若再追加自己的地址，最后一跳就变成前端 Pod 的地址，所有请求重新聚成一个桶，等于把 A1 修复抵消。

备选与放弃原因：

- 前端追加自身地址 + 后端取「倒数第二跳」：规则更绕，且一旦多一层代理就错位。
- 后端取 XFF 第一跳：第一跳完全由调用方控制，可伪造。
- 前端改用 `X-Real-IP`：Ingress 默认不保证设置，且与既有解析器不兼容。

### D2 `trusted-proxies` 空配置启动失败

`AuthProperties` 的 compact constructor 里校验 `trustedProxies` 非空，空则抛 `IllegalStateException`，与既有 `requireResolved` 的启动失败风格一致；`application.yml` 默认值改为回环网段（`127.0.0.1/32`、`::1/128`），生产由部署注入 Pod 网段。

理由：空配置在运行期没有任何可观察的异常，只在攻击发生时表现为「全站被一个人限流」。启动失败把配置错误提前到部署阶段。

备选与放弃原因：

- 保留空列表合法、仅在启动日志告警：告警会被忽略。
- 默认信任所有网段：等于允许伪造转发头，比未知单桶更糟。

### D3 写限流拦截器：`ORDER = 5`，覆盖 `/api/**` 非安全方法

新增 `WriteRateLimitInterceptor`，注册在 `OriginGuard`（0）之后、`AuthInterceptor`（10）之前，`ORDER = 5`。

- 在 `OriginGuard` 之后：跨站请求先得到 403 `CROSS_SITE_REJECTED`，不消耗额度。
- 在 `AuthInterceptor` 之前：未登录的匿名写请求（如撞库式发帖）也受限，而不是先 401 再无限重试。
- 跳过规则：`GET`/`HEAD`/`OPTIONS` 放行；`/api/auth` 与 `/api/auth/**` 跳过（登录、发码、找回密码已有专门限流，避免双桶叠加）。

来源键复用 `SourceKeyResolver.resolve(request)`，不另写一套解析。

### D4 计数键与窗口算法

键：`wc:ratelimit:write:{sourceKey}`，复用 `LoginThrottle` 的 `INCR + PEXPIRE` Lua（首次自增时设 TTL），TTL 等于窗口长度，默认 1 分钟。窗口从该来源第一次写请求起算，不做自然分钟对齐。

理由：

- 单键 + 首次设 TTL 的实现与既有 `LoginThrottle` 完全同构，评审与排障成本最低。
- 键落在共享 Redis（db3），多实例天然共用额度。
- 自然分钟对齐会让窗口边界出现双倍突刺，且需要额外算键名；非对齐固定窗口的突刺只发生在单个来源自己的窗口边界，可接受。

额度：已解析来源默认 60 次/分钟，`unknown` 独立桶默认 20 次/分钟。两者都来自新配置 `wanderchain.rate-limit.write`（`window`、`max`、`unknown-max`），不写代码内默认值，缺项启动失败。

### D5 超限响应与 `Retry-After`

超限抛 `BizException(AuthErrorEnum.RATE_LIMITED, retryAfterSeconds)`，由既有 `GlobalExceptionHandler` 输出 `429` + `{"code":"RATE_LIMITED"}` + `Retry-After` 头，响应结构与登录限流一致。

`retryAfterSeconds` 取当前键的剩余 TTL（向上取整，最小 1 秒），而不是固定值：写请求的窗口短，固定值可能让客户端多等近一个窗口。超限是低频路径，额外一次 `PTTL` 可接受。

### D6 缓存故障 fail-open

`preHandle` 内只捕获 `DataAccessException`（Redis 连接/超时），记录 WARN 后放行；其它异常不捕获，保持「代码 bug 显性暴露」的既有口径。

理由：限流是防刷手段，不是业务正确性前提。缓存故障时拒绝所有写请求会把一次 Redis 抖动放大成全站不可写。该取舍已写入规格的 Scenario。

### D7 前端白名单扩展

`FORWARDED_REQUEST_HEADERS` 增加 `'x-forwarded-for'`，转发时直接使用上游 `headers.get('x-forwarded-for')` 的原值；`null` 时不写该头。不新增任何地址解析逻辑。

### D8 部署注入

`backend/k8s/deployment.yaml` 增加 `WANDERCHAIN_AUTH_TRUSTED_PROXIES_0` 环境变量（下标形式，与既有 `WANDERCHAIN_AUTH_ALLOWEDORIGINS_*` 同一写法；变量名不得省掉 `auth` 段，否则绑不到 `wanderchain.auth.trusted-proxies`），值为集群 Pod 网段；`deploy/k8s/ingress.yaml` 只补注释，固化「Ingress 必须设置 XFF」这一前提，不改配置。

## Risks / Trade-offs

- [固定窗口边界突刺] → 额度只用于防刷而非精确计费，可接受；若日后需要精确，替换 D4 的键算法即可，规格不变。
- [fail-open 期间无限流] → 已写入规格并记 WARN；监控告警依赖日志，属于已知取舍。
- [60 次/分钟可能误伤批量操作] → 额度可配置；上线后按真实流量校准。
- [`trusted-proxies` 被误配成宽网段] → 默认值为回环，生产值与 Ingress 拓扑一起评审；配置错误会扩大信任边界，需要在部署清单评审时拦截。
- [Ingress 未设置 XFF] → 所有请求落入 `unknown` 桶，额度更小（20 次/分钟），仍有限流，但正常用户可能被误伤；由部署注释与联调验证覆盖。
- [前端代理与后端的最后一跳语义耦合] → 由两个能力的 Scenario 同时约束（前端「不追加」、后端「取最后一跳」），任一侧单方面改动都会被规格对账发现。

## Migration Plan

1. 后端发布：`trusted-proxies` 默认回环，行为对现有部署不变（无代理时仍是 `unknown` 桶）。
2. 部署注入 `WANDERCHAIN_TRUSTED_PROXIES`（集群 Pod 网段），滚动重启后端。
3. 前端发布：代理开始转发 `X-Forwarded-For`，来源识别切到真实客户端地址。
4. 回滚：前端与后端可各自回滚镜像；旧前端不转发 XFF 时，新后端按 `unknown` 桶限流；旧后端不认识新头时忽略，行为回到修复前。

## Open Questions

| 问题 | 级别 | 影响 | 默认倾向 |
|---|---|---|---|
| 写额度 60 次/分钟、`unknown` 20 次/分钟是否贴合真实流量 | 一般 | 仅配置值，不影响规格与实现 | 先按默认上线，按日志校准 |
| 是否需要 E2E 覆盖「跨站 + 写限流」组合 | 一般 | 仅测试范围 | 本 change 以集成测试覆盖，E2E 后置 |
