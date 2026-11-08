# Tasks

## 1. 后端配置与信任边界

- [x] 1.1 `backend/src/main/resources/application.yml` 的 `wanderchain.auth.trusted-proxies` 改为回环网段（`127.0.0.1/32`、`::1/128`），同步改写上方注释；验证：启动后端时 `TrustedProxySourceKeyResolver` 构造不抛异常，且注释不再声称「空列表是当前拓扑的诚实取值」
- [x] 1.2 `config/AuthProperties` 在 compact constructor 中拒绝空的 `trustedProxies`（抛 `IllegalStateException` 并带配置名），更新类注释；验证：新增单测断言空列表构造失败、回环列表构造成功
- [x] 1.3 新增 `config/WriteRateLimitProperties`（`wanderchain.rate-limit.write`：`window`、`max`、`unknown-max`，无代码内默认值），并在 `application.yml` 补齐三项；验证：上下文装配测试通过，删掉任一配置项时启动失败
- [x] 1.4 `backend/k8s/deployment.yaml` 注入 `WANDERCHAIN_AUTH_TRUSTED_PROXIES_0`（集群 Pod 网段，按下标注入，与既有 `ALLOWEDORIGINS` 同一写法），`deploy/k8s/ingress.yaml` 补注释固化「Ingress 必须设置 `X-Forwarded-For`」；验证：两份清单中对应键存在且说明与 `design.md` D8 一致

## 2. 后端写操作来源限流

- [x] 2.1 在 `web/auth/interceptor` 新增 `WriteRateLimitInterceptor`：跳过 `GET`/`HEAD`/`OPTIONS` 与 `/api/auth` 前缀，复用 `SourceKeyResolver`，`INCR + PEXPIRE` Lua 计数，超限取键剩余 TTL 作为 `Retry-After`（向上取整、最小 1 秒），只对 `DataAccessException` fail-open 并记 WARN；验证：单测覆盖超限 429、读放行、auth 跳过、`unknown` 独立额度、缓存异常放行
- [x] 2.2 `config/WebMvcConfig` 注册新拦截器，`ORDER = 5`（`OriginGuard` 之后、`AuthInterceptor` 之前）；验证：拦截器顺序测试断言跨站请求先得到 403 且不消耗写额度
- [x] 2.3 控制器级集成测试：对 `POST /api/posts` 等写端点连续请求至额度上限，验证第 N+1 次返回 `429` + `RATE_LIMITED` + `Retry-After`；`GET /api/posts` 不计数；`/api/auth/**` 不消耗写额度；验证：`mvn -f backend/pom.xml test` 中对应测试通过
- [x] 2.4 测试隔离：用例结束按 `wc:ratelimit:write:` 前缀清理自造计数键；验证：连续执行两次同一测试类均通过，不因共享 Redis 残留而假红

## 3. 前端代理转发 `X-Forwarded-For`

- [x] 3.1 `frontend/app/api/[...path]/route.ts` 的 `FORWARDED_REQUEST_HEADERS` 增加 `x-forwarded-for`，转发时使用上游原值、缺失不写该头；验证：`app/api/[...path]/route.test.ts` 新增「原样透传、不追加自身地址」与「缺失不伪造」两条用例并通过
- [x] 3.2 跑 `npm run test`（`frontend/`）确认代理用例与既有用例全绿；验证：45 个测试文件全部通过

## 4. 文档同步

- [x] 4.1 `AGENTS.md` 命令速查补「写操作来源限流」说明（`RATE_LIMITED`、`Retry-After`、`/api/auth/**` 例外）；验证：`harness/checks/07-doc-consistency.ps1` 通过
- [x] 4.2 `docs/conventions/backend-conventions.md` 按现有小节结构补来源识别与写限流约定（信任边界、最后一跳、fail-open）；验证：`harness/checks/11-conventions-check.ps1` 通过

## 5. 集成验证

- [x] 5.1 后端全量单测与容器装配测试通过；验证：`mvn -f backend/pom.xml test` 退出码 0
- [x] 5.2 前端构建与测试通过；验证：`npm run build` 与 `npm run test` 退出码 0
- [x] 5.3 change 工件自洽；验证：`openspec validate harden-source-rate-limit` 返回 valid

## Workflow follow-up

- 归档后把本 change 新增的 Scenario 登记进 `docs/spec-evidence.json`（auth 新增 8 条、frontend 新增 2 条），并跑 `powershell -File harness\checks\13-spec-evidence-check.ps1`。
- 归档后跑 `powershell -File harness\checks\10-contract-check.ps1`，确认无 DTO 变更时契约闸门仍通过。
- 部署前按 `design.md` 的 Migration Plan 顺序发布：后端（默认回环）→ 注入 Pod 网段 → 前端（转发 XFF）。
