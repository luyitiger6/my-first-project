# Design

## Context

当前后端是 Spring Boot 3.5.5 / Java 17 的内存版 Todo：没有 DataSource、没有 JPA，`02-test` 不依赖任何外部服务；Harness 已有 00–05 六道闸门，全部可在无容器环境执行。AGENTS.md §9 明确「不连接任何外部中间件」，同时约定接入数据库后必须把「起容器」纳入 Harness，否则护栏会出现空洞。本变更正是这条约定的第一次落地。

约束：单租户、单库、MySQL 8；前端与 Todo 业务不变；完成判定仍然只看 `harness\run-all.ps1` 退出码；数据库设计规范以人读文档形式放在 `docs/`，OpenSpec 只承载可验收的行为契约。

## Goals / Non-Goals

**Goals:**

- 用一条可执行的迁移建立 AI 会话核心表基线，并由 Flyway 独占结构变更
- 用一次性 MySQL 8 实例验证迁移可执行、结构正确、重复执行幂等
- 让「迁移失败 / 容器不可用 / 结构缺失」都能被退出码拦截
- 保持后端运行期与单元测试零数据库依赖，本变更不改变 Todo 行为

**Non-Goals:**

- 不接入 JPA、DataSource、连接池，不改 `application.yml`
- 不把 Todo 改为持久化，不新增业务接口
- 不做多租户、分库分表、读写分离；不引入 Snowflake / UUID 主键
- 不在本变更创建附件、提示词、反馈、模型配置等后续表
- 不把镜像构建或 Compose 编排纳入 Harness

## Decisions

### D1：主键用自增 BIGINT，对外暴露 ULID

内部主键 `BIGINT AUTO_INCREMENT`，保证 InnoDB 聚簇索引顺序写入与二级索引紧凑；对外用 `public_id CHAR(26)`（ULID）并建唯一索引，避免自增 ID 被枚举。

- 备选：Snowflake。被否——单租户单库没有分布式取号需求，workerId 分配与时钟回拨是纯成本；未来分片时再评估。
- 备选：UUIDv4 作主键。被否——随机值造成页分裂与索引膨胀；若必须用 UUID，也应 UUIDv7 + `BINARY(16)`，本期无此需求。

### D2：只引入迁移工具，不引入运行期数据源

Flyway 以 Maven 插件形式存在，`V1__init_ai_chat.sql` 放在 `backend/src/main/resources/db/migration/`；后端不添加 `flyway-core` 运行期依赖、不添加 JPA/DataSource。没有 DataSource 时 Spring Boot 的 Flyway 自动配置不会触发，应用启动与测试行为保持原样。

- 备选：Spring Boot Flyway 自动配置 + 真实 DataSource。被否——会把数据库拖进 `01/02` 与应用启动，超出本期范围，且需要同时改造 Todo。
- 备选：Hibernate `ddl-auto` 生成结构。被否——结构不可审计，无法作为长期迁移基线。

### D3：闸门用一次性 Docker MySQL 8 实例，不用 H2

`06-flyway.ps1` 启动临时 `mysql:8.0` 容器（随机容器名、随机本机端口、一次性密码），等待就绪后通过 Flyway Maven 插件执行迁移，再用 `information_schema` 断言表、索引、约束，随后再迁移一次验证幂等，最后在 `finally` 中删除容器。

- 备选：H2 的 MySQL 兼容模式。被否——`CHECK`、生成列、`ENGINE=InnoDB`、排序规则等 MySQL 特性无法等价验证，会给出假绿灯。
- 备选：Testcontainers 写进 `02-test`。被否——同样需要 Docker，却把容器依赖塞进单元测试；闸门应停留在脚本层，保持 `02` 不依赖数据库。
- 镜像可通过环境变量覆盖，默认 `mysql:8.0`，用于镜像加速器不可用或团队统一版本。

### D4：第一条迁移只建四张核心表

`V1__init_ai_chat.sql` 按依赖顺序创建 `users` → `conversations` → `messages` → `usage_records`：

- 四张表覆盖「谁在什么会话里说了什么、花了多少 token」的最小闭环
- 附件、提示词模板、反馈、模型配置在 `docs/db-design-spec.md` 中定义，由后续迁移引入
- 外键统一 `ON DELETE RESTRICT`，业务删除由应用层编排；禁用级联删除

### D5：软删除与唯一约束用生成列兜底

`users.email` 需要「有效记录内唯一」，但 MySQL 唯一索引把 NULL 视为互不相等，`UNIQUE(email, deleted_at)` 挡不住多个有效重复。V1 用 `active_email` 生成列（`IF(deleted_at IS NULL, email, NULL)`）承载唯一索引。

`messages`、`usage_records` 是追加型明细表，不加 `updated_at` / `version` / `deleted_at`，避免为「可改历史」留下入口。

### D6：Flyway 插件版本固定，结构断言放在脚本而不是 Java 测试

插件版本在 `backend/pom.xml` 中显式固定并附带 `flyway-mysql` 依赖；迁移位置指向 `filesystem:src/main/resources/db/migration`；禁用 `clean`，不做 `baselineOnMigrate`。结构断言用 `mysql` 客户端的 `-N -e` 查询完成，避免为闸门新增 Java 测试依赖。

- 备选：在 JUnit 中写迁移测试。被否——会把 Docker 依赖带进 `02-test`，且断言逻辑与闸门脚本重复。

### D7：闸门按文件名自动接入，01/02 保持无容器

`06-flyway.ps1` 放在 `harness/checks/` 下，`run-all.ps1` 按文件名排序自动执行，无需改总控。`01-compile`、`02-test` 不读取数据库，可单独运行；只有 `06` 要求 Docker。脚本必须存为 UTF-8 with BOM，并遵守「通过 exit 0、失败 exit 1、无交互提问」的既有约定。

### D8：文档与迁移的分工

`docs/db-design-spec.md` 是人读的完整规范（主键、公共字段、NULL 裁决、索引、全部表结构与 JPA/Flyway 约定）；`specs/database-baseline/spec.md` 只写可验收的行为契约（迁移所有权、核心表、闸门、运行期不接库）。V1 迁移与文档中的核心表必须一致，后续新增表先改文档再写迁移。

## Risks / Trade-offs

- **`run-all` 从此依赖 Docker** → 没有 Docker 的机器/CI 无法完整验收。缓解：README 与 AGENTS 明确前置条件；`06` 失败时输出可操作的原因；`01/02` 仍可独立运行。
- **镜像拉取失败**（本机曾遇到加速器 403）→ 闸门红。缓解：镜像可用 `FLYWAY_MYSQL_IMAGE` 覆盖；文档给出预拉取命令；失败信息区分「docker 不可用」与「镜像不可用」。
- **容器泄漏或端口占用** → 随机端口 + 唯一容器名 + `finally` 强制删除；启动前检查同名容器。
- **MySQL 启动慢导致误判** → 就绪轮询带超时（默认 90 秒），超时输出容器日志再失败。
- **Flyway 与 MySQL 8 版本不兼容** → 插件版本固定并由 `06` 每次真实执行验证，升级需单独变更。
- **文档与迁移漂移** → 闸门断言四张核心表与关键索引；文档变更纳入同一 change 的 tasks，后续表必须新增迁移。
- **密码出现在日志** → 一次性随机密码只通过环境变量/参数传递，不打印；容器随用随删。

## Migration Plan

1. 新增 `docs/db-design-spec.md` 与 `openspec` 工件（本 change）。
2. 在 `backend/pom.xml` 增加 Flyway Maven 插件与 `flyway-mysql` 依赖，不新增运行期依赖。
3. 新增 `V1__init_ai_chat.sql`，按 D4/D5 建四张表与约束。
4. 新增 `harness/checks/06-flyway.ps1`，实现启动、迁移、断言、幂等、清理。
5. 更新 `AGENTS.md`（§7 命令、§8 闸门、§9 边界）与 `README.md`（前置环境、闸门清单）。
6. 先单独跑 `06`，再跑 `run-all`；用一条临时错误迁移验证闸门会红，验证后删除。

回滚：删除 `06-flyway.ps1`、迁移脚本、pom 插件与文档改动即可；本变更不触碰运行期数据源，回滚不影响 Todo 启动与既有测试。
