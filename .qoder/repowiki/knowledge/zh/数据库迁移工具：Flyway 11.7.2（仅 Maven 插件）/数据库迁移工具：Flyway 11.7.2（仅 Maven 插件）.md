---
kind: external_dependency
name: 数据库迁移工具：Flyway 11.7.2（仅 Maven 插件）
slug: flyway
category: external_dependency
category_hints:
    - sdk_real_api
    - client_constraint
scope:
    - '**'
---

### 角色与集成点
- 仅在 Maven 插件阶段使用，**不引入运行期 `flyway-core` / DataSource / JPA**；运行时数据源尚未接入。
- 迁移目录 `src/main/resources/db/migration`，首个迁移 `V1__init_ai_chat.sql`，目标 schema `ai_chat_gate`。

### 稳定用法
- 通过环境变量 `FLYWAY_URL` / `FLYWAY_USER` / `FLYWAY_PASSWORD` 传入连接参数（Windows 下 `mvn.cmd` 会把 JDBC URL 中的 `&` 拆成命令分隔符，不能拼在命令行）。
- 闸门断言表集合、索引名、CHECK/FK 约束名、生成列（`active_email`、`total_tokens`）、`created_at` 审计列、`flyway_schema_history` 成功条数，并二次执行验证幂等。
- 业务 schema `green-note` 在闸门前后快照比对，禁止被改动。
- 首次接入已有库需先 `baseline`，生产禁用 `clean`。