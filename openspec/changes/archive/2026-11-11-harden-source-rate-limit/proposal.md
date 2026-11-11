# Proposal

## Why

生产链路是「Ingress → 前端 Next Route Handler → 后端」，但前端代理不转发 `X-Forwarded-For`，后端 `wanderchain.auth.trusted-proxies` 又是空列表。两处各自自洽，叠加后所有请求都落入「未知来源」单桶：来源限流退化成全站共享 20 次/10 分钟，单个攻击者打满即可锁死全站登录。

同时，除登录与发码外，发帖、评论、投票、收藏、封面上传、资料修改等写端点没有任何来源限流，可被单来源无限刷。

## What Changes

- 前端同源代理把 `x-forwarded-for` 纳入请求头白名单，并**原样透传上游值、不追加自身地址**（后端按「最后一跳」取值，追加会让所有请求重新聚成一个桶）。
- 后端 `trusted-proxies` 默认取本机回环，生产由部署注入集群 Pod 网段；配置为空时启动失败，不再允许「配了但没生效」的静默状态。
- 新增统一写操作来源限流：`/api/**` 的非 `GET`/`HEAD`/`OPTIONS` 请求共享一个来源级额度（默认 60 次/分钟），`/api/auth/**` 除外（登录与发码已有专门限流，避免双桶叠加）。
- 未知来源使用独立且更小的额度（默认 20 次/分钟），使代理配置异常时只影响无转发头的请求，不波及正常流量。
- 超限返回 `429`、错误码 `RATE_LIMITED` 与 `Retry-After`；计数落在共享缓存，多实例共用同一额度。
- 共享缓存不可用时放行写请求并记录告警（可用性优先），该取舍写入规格。

无 BREAKING 变更：仅新增限流行为，端点与契约字段不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `wanderchain-auth`：来源识别规则补充「代理层必须提供可信转发头」这一部署前提与空配置启动失败约束；新增「全站写操作来源限流」Requirement，覆盖额度、未知来源独立桶、429 语义与缓存故障取舍。
- `frontend-nextjs`：代理请求头白名单由 `Cookie`/`Origin`/`Referer` 扩展为并含 `X-Forwarded-For`，并规定「原样透传、不追加」。

## Impact

- 后端：`web/auth/interceptor`（复用来源解析，新增写限流拦截器）、`config/WebMvcConfig`（装配顺序）、`config/AuthProperties`（空配置校验）、`application.yml`、`k8s/deployment.yaml`（注入 `trusted-proxies`）。
- 前端：`app/api/[...path]/route.ts`（白名单与透传规则）及其测试。
- 部署：`deploy/k8s/ingress.yaml` 无需改配置，但需在注释中固化「Ingress 必须设置 `X-Forwarded-For`」这一前提。
- 文档：`AGENTS.md` 的接口速查与 `docs/conventions` 中来源识别说明同步。
