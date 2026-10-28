# Proposal

## Why

两份人读文档落后于仓库现状，而且落后得不同步：`AGENTS.md` 已经跟着认证模块改造过（§1 业务描述、§6 目录树、§7 命令、§8 闸门清单），`README.md` 却只改了「快速开始」一段，其余三节仍停在 Todo 演示与 Flyway 迁移的旧世界。

后果不是「不好看」，是**误导操作**：

1. `README.md` 让使用者去配 `FLYWAY_DB_PASSWORD` / `FLYWAY_DB_HOST` 等变量——仓库里已经没有任何脚本读它们。`06-flyway` 已改名 `06-schema-check`，只认 `SCHEMA_DB_*`；`09-redis-check` 只认 `SCHEMA_REDIS_*`。照文档配完仍然过不了闸门，而报错不会告诉他「你看的文档是旧的」。
2. `README.md` 称「运行期不接数据库/缓存」「01/02/04 不依赖数据库」——现状相反：后端启动与 `02-test` 都直连 `127.0.0.1:8806` 的 `wanderchain` 库和 `127.0.0.1:6606` 的 Redis db 3，连不上就失败。按旧描述排查会往「为什么突然连库了」这个错误方向走。
3. `README.md` 仍以 Todo 为业务示例（目录说明写「Todo 领域」、设计取舍写「Todo 只是用来承载护栏的载体」、改名示例用 `todo-workbench`）。Todo 模块已随 `2026-10-27-remove-todo-demo` 删除，这些话现在指向不存在的代码。

`AGENTS.md` 自己也有一处新漂移：上一轮把 `service/auth` 拆成 接口 / `impl` / `support` / `model`，把拦截器移到 `web/auth/interceptor`，但 §6 的 backend 目录树只列到 `dao/auth`，`service/auth` 与 `web/auth` 整层缺席，新增的 `common/id`、`common/security` 同样没列。目录树是 agent 进仓库的第一张地图，缺一层等于让人以为业务逻辑长在 `dao` 里。

为什么现在做：认证模块正按 5.x 推进，`service/auth` 的结构刚定型。再往后加登录、登出、重置密码，目录树只会继续加宽，文档欠账更难补。趁 `README` 只差三节，一次对齐成本最低。

## What Changes

### README.md

- **§目录**：闸门链由 `... → flyway → doc-consistency` 改为实际的十道（`00-submodule-check` … `09-redis-check`）；`backend/` 行的业务描述由「Todo 领域」改为「wanderchain 账户认证」。
- **§前置环境**：一行 `Flyway 凭据：FLYWAY_DB_PASSWORD` 拆成按用途区分的三组——`SCHEMA_DB_PASSWORD`（06 建表断言）、`SCHEMA_REDIS_PASSWORD`（09 缓存连通）、`WANDERCHAIN_*`（应用启动与 `02-test`）；补 Redis 前置（6606 / db 3）与 `Test-NetConnection` 预检；删掉「Flyway 11.7.2 对 MySQL 8.3 的兼容提示」这类已不存在的问题。
- **§前置环境**：把「06 闸门在专用 schema `ai_chat_gate` 上执行」补全为 `ai_chat_gate` 与 `wanderchain` 两个 schema。
- **§设计取舍**：「运行期不接数据库/缓存」改写为现状——运行期依赖 8806 与 6606 两个既有实例，没有内存兜底；「业务极简：Todo 只是载体」改写为 wanderchain 认证子系统的定位。
- **§工作区改名**：示例 slug 由 `todo-workbench` 换成与业务无关的中性示例，避免再把「Todo 是业务」写回文档。

### AGENTS.md

- **§6 backend 目录树**：补 `common/id`、`common/security`、`service/auth`（含 `impl` / `support` / `model` 三个子目录的一句话职责）、`web/auth`（含 `dto` / `interceptor`）。
- 测试行保持「单元测试 + 容器装配契约测试 + 配置绑定测试」的概括粒度，不逐类罗列。

### 非目标

- 不改 `docs/spec-coverage-audit.md` 的统计口径与覆盖率数字——本变更不动规格文档，也不改变任何实现状态。
- 不重新引入 Flyway 或任何迁移框架，也不修改闸门脚本：本变更只让文档追上脚本，不是反过来。
- 不改 `openspec/changes/add-wanderchain-auth/design.md` 中作为历史背景的 Todo 陈述（`2026-10-27-remove-todo-demo` 的 tasks 2.4 已明确保留）。

## Capabilities

### New Capabilities

<!-- 本变更不引入能力。 -->

### Modified Capabilities

<!--
本变更不改变任何 spec 级行为：改的是两份人读文档对既有行为的描述，脚本、代码、闸门行为一律不动。
因此不产生 delta spec，`.openspec.yaml` 标记 `skip_specs: true`。
-->

## Impact

- **文档**：`README.md`（§目录 / §前置环境 / §设计取舍 / §工作区改名四处）、`AGENTS.md`（§6 目录树一处）。
- **代码 / API / 闸门**：无改动。`harness/checks/` 下脚本、`backend/` 与 `frontend/` 两个子模块都不碰。
- **验收**：`run-all.ps1` 退出码仍须为 0。`07-doc-consistency` 校验闸门清单标记与技术栈 token，本变更要改 `AGENTS.md`，需确认 `<!-- harness-checks: ... -->` 那一行未被误伤；`08-spec-doc-breakpoints` 与本变更无关，应保持绿灯。
- **风险**：低。文档不参与运行时；唯一可能变红的闸门是 `07-doc-consistency`，而它做的正是「文档别和仓库打架」，红了就说明还有漏改。
