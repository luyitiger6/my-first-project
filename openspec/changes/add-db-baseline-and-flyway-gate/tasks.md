# Tasks

## 1. 数据库设计规范文档

- [x] 1.1 新增 `docs/db-design-spec.md`，写明单租户/单库前提、主键策略（自增 BIGINT + ULID 对外标识、明确不采用 Snowflake/分片）、公共字段、NULL 裁决、软删除唯一约束、外键策略、索引规则、核心表与后续表结构、Flyway/JPA 约定与红线；验证：文档存在且上述章节齐全，核心表字段与 3.1 的 V1 迁移逐列一致
- [x] 1.2 在文档中标注本期只落地 `users`、`conversations`、`messages`、`usage_records` 四张表，其余表明确标为后续迁移；验证：四张表与「后续表」清单可区分，无歧义

## 2. Flyway 迁移工具接入

- [x] 2.1 在 `backend/pom.xml` 增加 Flyway Maven 插件并附带 `flyway-mysql` 与插件作用域的 `mysql-connector-j`，版本固定为 11.7.2（Spring Boot 3.5.5 管理的版本）；配置迁移位置为 `filesystem:src/main/resources/db/migration`，禁用 `clean` 与 `baselineOnMigrate`；验证：`mvn -f backend/pom.xml help:describe -Dplugin=org.flywaydb:flyway-maven-plugin:11.7.2` 退出码 0（该版本没有 `flyway:help` goal）
- [x] 2.2 确认没有新增运行期依赖：不添加运行期 `flyway-core`、JPA、JDBC 驱动与 DataSource 配置（`mysql-connector-j` 仅挂在 Flyway 插件上）；验证：`mvn -f backend/pom.xml dependency:tree -Dincludes=org.flywaydb:*,com.mysql:*` 输出为空，且 `application.yml` 无数据源配置

## 3. 第一条迁移

- [x] 3.1 新增 `backend/src/main/resources/db/migration/V1__init_ai_chat.sql`：按 `users` → `conversations` → `messages` → `usage_records` 顺序建表，使用 InnoDB、`utf8mb4_0900_ai_ci`、`DATETIME(3)`；包含 `public_id` 唯一索引、`active_email` 生成列唯一索引、消息 `(conversation_id, seq)` 与 `(conversation_id, request_id)` 唯一键、角色与 token 非负 CHECK、外键 `ON DELETE RESTRICT` 及会话/消息查询索引；验证：由 4.1 的闸门在空库执行成功，且 4.2 的元数据断言全部通过
- [x] 3.2 确认迁移文件命名符合 `V<版本>__<描述>.sql` 且编码为 UTF-8；验证：文件名为 `V1__init_ai_chat.sql`，Flyway 在 4.1 中识别为版本 1

## 4. Flyway Harness 闸门

- [x] 4.1 新增 `harness/checks/06-flyway.ps1`（UTF-8 with BOM）：检查 `127.0.0.1:8806` 的 MySQL 8 可连接；凭据优先读 `FLYWAY_DB_PASSWORD`，未设置时若 8806 由 Docker 容器发布则从容器环境读取 root 密码；只重建专用 schema `ai_chat_gate`（schema 名守卫，禁止对 `green-note` 执行 DDL）；调用 Flyway Maven 插件迁移；用容器内 `mysql` 客户端查询 `information_schema` 断言四张表、关键唯一键/索引/CHECK/生成列存在；再次迁移验证幂等；不启动/删除容器；失败时输出原因并 exit 1，不做交互提问；验证：单独运行脚本退出码 0，`green-note` 表集合不变，`docker ps` 前后容器列表一致
- [ ] 4.2 负向验证闸门：临时新增一条语法错误的 `V2__broken.sql`，运行 `06-flyway.ps1` 确认退出码 1 且输出指向失败迁移；删除临时文件后再次运行确认退出码 0；验证：两次退出码分别为 1 和 0，且两次执行前后容器列表一致，`green-note` 未被改动
- [ ] 4.3 确认 `run-all.ps1` 无需修改即可按文件名排序执行第 6 道闸门；验证：`run-all.ps1` 输出包含 `06-flyway`，且 01–05 仍按原顺序执行

## 5. 入口文档与边界更新

- [x] 5.1 更新 `AGENTS.md`：§6 目录地图补 `06-flyway.ps1`；§7 增加单独运行 Flyway 闸门与 8806 连通性预检的命令；§8 说明 06 遵守同一接入约定；§9 改写「不连接外部中间件」为「运行期不接数据源，Harness 的 06 复用 8806 MySQL 8 专用 schema」；验证：三处均能检索到 `06-flyway` 与 8806 MySQL 前置说明
- [x] 5.2 更新 `README.md`：前置环境增加 8806 MySQL 8 与凭据，快速上手注明 `run-all` 与单独闸门的差异；不再要求 `mysql:8.0` 镜像；验证：按 README 命令可复现 4.1 与 4.2

## 6. 集成验收

- [x] 6.1 在未启动 MySQL 的情况下单独运行 `01-compile.ps1` 与 `02-test.ps1`；验证：两个脚本退出码均为 0
- [x] 6.2 在未配置数据源的情况下启动后端并调用 Todo 接口；验证：应用正常启动，`GET /api/todos` 返回 200
- [ ] 6.3 运行完整 `harness\run-all.ps1`；验证：退出码 0，00–06 全部通过，未新建/删除容器，且 `green-note` 表集合未变
- [ ] 6.4 运行 `openspec validate "add-db-baseline-and-flyway-gate" --strict`；验证：输出 valid，无警告

## Workflow follow-up

- 人工审阅 proposal / spec / design / tasks 后，再进入 apply 实施。
- 实施完成后按仓库约定提交；归档前确认迁移与文档一致。
