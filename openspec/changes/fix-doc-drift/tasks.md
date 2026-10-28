# Tasks

> design.md 写了三条决策（凭据按用途分组 / 设计取舍写可验证事实 / 目录树写职责不写类名），因为 `openspec status` 的 `isPlanningComplete` 要求该工件存在才放行 apply。本变更无跨模块影响、无新外部依赖、无数据模型变化，改动对象只有两份 markdown 的措辞。

## 1. README.md 对齐现状

- [x] 1.1 §目录：闸门链由 `... → flyway → doc-consistency` 改写为实际的十道（`00-submodule-check` 01-compile 02-test 03-static-guard 04-frontend 05-scaffold-check 06-schema-check 07-doc-consistency 08-spec-doc-breakpoints 09-redis-check）；`backend/` 行的业务描述由「Todo 领域」改为「wanderchain 账户认证」。判据：README 的闸门链与 `harness/checks/` 的实际文件名逐项对应。
- [x] 1.2 §前置环境：把一行 `Flyway 凭据：FLYWAY_DB_PASSWORD` 替换为三组按用途区分的凭据——`SCHEMA_DB_PASSWORD`（06 建表断言，未设置时从发布 8806 的容器读 `MYSQL_ROOT_PASSWORD`）、`SCHEMA_REDIS_PASSWORD`（09 缓存连通，未设置时从 6606 容器的 `--requirepass` 读）、`WANDERCHAIN_DB_USER` / `WANDERCHAIN_DB_PASSWORD` / `WANDERCHAIN_REDIS_PASSWORD` / `WANDERCHAIN_JWT_SECRET`（应用启动与 `02-test`）。判据：README 中出现的每个环境变量都能在 `harness/checks/02-test.ps1`、`06-schema-check.ps1`、`09-redis-check.ps1` 之一里被读到。
- [x] 1.3 §前置环境：补 Redis 前置（`127.0.0.1:6606`，db 3）与 `Test-NetConnection 127.0.0.1 -Port 6606` 预检；把「06 闸门在专用 schema `ai_chat_gate` 上执行」补全为 `ai_chat_gate` 与 `wanderchain` 两个 schema；删除「Flyway 11.7.2 已测试上限 8.1」这条已不存在的问题描述，以及 8806 下方的 `FLYWAY_DB_*` 覆盖说明。判据：README 全文不含 `FLYWAY_` 与 `Flyway`。
- [x] 1.4 §设计取舍：「运行期不接数据库/缓存」一条改写为现状——后端启动与 `02-test` 依赖 `127.0.0.1:8806` 的 `wanderchain` 库与 `127.0.0.1:6606` 的 Redis db 3，连不上即失败，不存在 H2 / 嵌入式 Redis 兜底；「业务极简：Todo 只是用来承载护栏的载体」一条改写为 wanderchain 认证子系统的定位说明。判据：§设计取舍 内不含 `Todo`，且两条描述与 `backend/src/main/resources/application.yml` 的实际依赖一致。
- [x] 1.5 §工作区改名：示例命令 `--name todo-workbench --display "Todo Workbench"` 换成与业务无关的中性示例（如 `--name example-workspace --display "Example Workspace"`），避免把「Todo 是业务」这条已删除的事实重新写进文档。
- [x] 1.6 收尾取证：`Select-String -Path README.md -Pattern 'Todo|todo|FLYWAY_|Flyway|\bflyway\b'` 零命中；`git diff README.md` 只落在 §目录 / §前置环境 / §设计取舍 / §工作区改名 四处。

## 2. AGENTS.md 后端目录树

- [x] 2.1 §6 的 backend 目录树补 `common/id`（ULID 生成）与 `common/security`（PasswordRules 口令规则），与 5.1 新增的两个包对应。
- [x] 2.2 补 `service/auth/`：顶层 4 个接口（CaptchaService / RegisterCodeService / RegisterService / LogoutService）、`impl/`（XxxServiceImpl）、`support/`（-er 支撑件与 CodePurpose）、`model/`（0 方法 record）。判据：目录树里这三层的职责一句话与 `src/main/java` 下的实际目录逐一对应。
- [x] 2.3 补 `web/auth/`：Controller、`AuthCookie`（cookie 唯一写入点）、`dto/`、`interceptor/`（AuthInterceptor / OriginGuard）。
- [x] 2.4 确认 §6 下方的 `<!-- harness-checks: 00-submodule-check ... 09-redis-check -->` 标记行逐字节未变——`07-doc-consistency` 会拿它与实际文件集合比对，误伤即变红。

## 3. 验收

- [x] 3.1 `powershell -File harness\checks\07-doc-consistency.ps1` 退出码 0。这是本变更唯一可能变红的闸门，也是它的验收标准。
- [x] 3.2 `powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 退出码 0，证明未误伤单元文档的断点声明。
- [x] 3.3 `powershell -File harness\run-all.ps1` 退出码 0（十道全 PASS），后端仍 133 例、前端仍 289 例——本变更不碰代码，测试条数不应变化。
