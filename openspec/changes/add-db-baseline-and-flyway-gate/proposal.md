# Proposal

## Why

AI 会话项目需要一套可演进、可审计的数据库基线，而当前仓库没有任何持久化结构，Harness 也不校验迁移脚本。先在单租户、单库前提下引入 Flyway 与最小核心表，避免后续接入 JPA 时靠手写 DDL 或 ORM 自动生成，导致表结构无法追溯。

## What Changes

- 新增 `docs/db-design-spec.md`：单租户 MySQL 8 的数据库设计规范，覆盖主键策略、公共字段、NULL/NOT NULL 裁决、索引策略、AI 会话表结构与 Flyway/JPA 约定。
- 后端引入 Flyway **迁移工具**（Maven 插件），不引入运行期数据源与 JPA；现有 Todo 仍为内存实现，`01-compile`、`02-test` 不依赖数据库。
- 新增第一条迁移 `backend/src/main/resources/db/migration/V1__init_ai_chat.sql`：创建 `users`、`conversations`、`messages`、`usage_records` 四张核心表，含唯一键、外键、CHECK 与查询索引。
- 新增 Harness 第 6 道闸门 `harness/checks/06-flyway.ps1`：启动临时 MySQL 8 容器 → 执行迁移 → 断言表结构与约束 → 再执行一次验证幂等 → 清理容器；任一步失败即整体失败。
- 更新 `AGENTS.md` 与 `README.md`：登记第 6 道闸门、Docker 前置依赖，以及「运行期仍不接数据库、仅迁移校验需要容器」的边界说明。
- **BREAKING**（仅开发环境）：`run-all.ps1` 从此需要 Docker 守护进程与可获取的 `mysql:8.0` 镜像；Docker 不可用视为闸门失败，不做静默跳过。

## Capabilities

### New Capabilities

- `database-baseline`: AI 会话核心数据表基线、Flyway 迁移所有权，以及迁移在 Harness 中的验收闸门。

### Modified Capabilities

（无）

## Impact

- **代码/配置**：`backend/pom.xml`（Flyway Maven 插件）、`backend/src/main/resources/db/migration/V1__init_ai_chat.sql`、`harness/checks/06-flyway.ps1`、`AGENTS.md`、`README.md`、`docs/db-design-spec.md`。
- **依赖**：新增 Flyway Maven 插件与 `flyway-mysql`；不新增运行期依赖，不改 `application.yml`。
- **API**：无变化；Todo 的三个接口保持原样。
- **环境**：Harness 新增 Docker + MySQL 8 容器依赖；机器首次执行需要能拉取 `mysql:8.0` 镜像。
- **不在范围**：JPA 实体与数据源接入、Todo 持久化改造、多租户、分库分表、Snowflake/UUID 主键、附件/提示词/反馈等后续表（规范文档中定义，由后续迁移引入）。
