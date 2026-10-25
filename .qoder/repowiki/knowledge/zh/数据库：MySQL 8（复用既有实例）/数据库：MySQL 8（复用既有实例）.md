---
kind: external_dependency
name: 数据库：MySQL 8（复用既有实例）
slug: mysql
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

### 角色与集成点
- 不是本项目自管的依赖；闸门 `06-flyway.ps1` 要求本地已有一个发布到 `8806` 端口的 MySQL 8 实例（容器名形如 `docker-compose-cloud-db-mysql-1`）。
- 凭据来源：优先 `FLYWAY_DB_PASSWORD`，否则从发布该端口的容器环境变量 `MYSQL_ROOT_PASSWORD` 中自动提取。
- 字符集 `utf8mb4`、排序规则 `utf8mb4_0900_ai_ci`；JDBC URL 强制 `connectionTimeZone=UTC`、`forceConnectionTimeZoneToSession=true`、`characterEncoding=utf8`。

### 稳定约束
- 闸门通过 `docker exec` 或本地 `mysql` 客户端执行 SQL，二者至少其一可用。
- 专用 schema `ai_chat_gate` 由闸门重建；业务 schema `green-note` 只读校验，不得变更。