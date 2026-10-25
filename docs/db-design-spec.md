# 数据库设计规范（AI 会话应用）

> 适用范围：本项目后端（Spring Boot 3.5.5 / Java 17 + JPA + MySQL 8 + Flyway）。
> 本文是人读的完整规范；`openspec/specs/database-baseline/spec.md` 只保留可验收的行为契约。
> 本期只落地 `users`、`conversations`、`messages`、`usage_records` 四张表，其余表见 §9.6，由后续迁移引入。

## 1. 前提与边界

- **单租户、单库、单实例**：不设 `tenant_id`，不做分库分表、读写分离与跨库事务。
- **数据库**：MySQL 8.0+，存储引擎 InnoDB，默认字符集 `utf8mb4`，默认排序规则 `utf8mb4_0900_ai_ci`。
- **时间**：统一存 UTC，列类型用 `DATETIME(3)`，不用 `TIMESTAMP`（避免会话时区隐式转换）。
- **结构变更**：只允许通过 Flyway 版本化迁移；已应用的迁移不可修改。
- **运行期边界**：本规范不要求应用启动时连接数据库；数据源与 JPA 接入由后续变更单独引入。
- **ID 边界**：数据库内部用自增 `BIGINT`；对外 API 只暴露 `public_id`（ULID），不暴露自增 ID。

## 2. 命名与通用约定

| 对象 | 规则 | 示例 |
|---|---|---|
| 表 | 小写蛇形、复数 | `users`、`conversations`、`messages` |
| 列 | 小写蛇形 | `created_at`、`conversation_id` |
| 主键 | `id` | `id BIGINT` |
| 外键列 | `<被引用表单数>_id` | `user_id`、`conversation_id` |
| 唯一索引 | `uk_<表>_<语义>` | `uk_users_active_email` |
| 普通索引 | `idx_<表>_<语义>` | `idx_messages_conv_id` |
| 外键约束 | `fk_<表>_<语义>` | `fk_messages_conversation` |
| CHECK 约束 | `ck_<表>_<语义>` | `ck_messages_role` |
| 迁移文件 | `V<版本>__<蛇形描述>.sql` | `V1__init_ai_chat.sql` |

其他约定：

- 字符串统一 `utf8mb4`；标识类列（`public_id`、`request_id`、`role`、`status`、`model`、`currency`）用 `ascii` + `ascii_bin`，减少索引体积并保证大小写敏感。
- 金额用 `DECIMAL(18,6)`；禁止 `FLOAT` / `DOUBLE`。
- 布尔用 `TINYINT(1)`，只允许 0/1；列名用 `is_` / `enabled` 等正向语义。
- 枚举用 `VARCHAR(16)` + `CHECK`，不用 MySQL `ENUM`（改枚举值需要 DDL，且与 JPA 映射不直观）。
- 大文本用 `MEDIUMTEXT`；JSON 只放元数据、配置、变量，不放消息正文与文件内容。
- 文件本身进对象存储，数据库只存 `file_key`、`file_name`、`mime_type`、`size_bytes`、`sha256`。
- 不使用数据库触发器与存储过程；业务一致性放在应用层事务里。

## 3. 主键策略

### 3.1 结论

**内部主键 `BIGINT AUTO_INCREMENT` + 对外 `public_id CHAR(26)`（ULID）**，两者同时存在：

- `id`：InnoDB 聚簇索引键，顺序写入、二级索引紧凑、JOIN 快；只用于数据库内部与后端关联。
- `public_id`：ULID（26 字符，按时间有序），建唯一索引；所有 API、URL、日志对外标识都用它。

### 3.2 方案对比

| 方案 | 适用场景 | 本项目 | 原因 |
|---|---|---|---|
| `BIGINT AUTO_INCREMENT` | 单库、单写入、高吞吐 | **采用（内部主键）** | 顺序写入、索引小、JPA `IDENTITY` 直接支持 |
| `CHAR(26)` ULID | 需要对外不可枚举、可按时间排序 | **采用（对外标识）** | 不暴露自增 ID；生成不依赖数据库；可按时间粗略排序 |
| Snowflake `BIGINT` | 多写入节点、分库分表、需要全局趋势递增 | 不采用 | 单租户单库没有取号协调需求，workerId 分配与时钟回拨是额外成本 |
| UUIDv4 `CHAR(36)` / `BINARY(16)` | 离线生成、多节点合并、无中心库 | 不采用 | 随机主键造成页分裂与索引膨胀；若未来需要，应改用 UUIDv7 + `BINARY(16)` |
| 自然键（email、手机号、用户名） | 极少 | 禁止 | 业务值会变；作为主键会级联污染所有外键 |

### 3.3 使用规则

- 所有核心表都必须有 `id` 与 `public_id`；`public_id` 由应用在插入前生成，数据库只负责唯一约束。
- 外键一律引用 `id`，不引用 `public_id`；API 入参先用 `public_id` 解析出 `id`。
- 禁止把自增 `id` 放进 URL、前端状态、日志检索键或对外错误信息。
- `public_id` 一旦生成不可修改；ULID 的大小写统一为大写。
- 分页、排序、关联用 `id`；展示与幂等键用 `public_id`。

### 3.4 JPA 影响

- `@GeneratedValue(strategy = GenerationType.IDENTITY)` 会导致 Hibernate 关闭 JDBC 批量插入。当前消息量可接受；若未来单会话写入成为瓶颈，再评估「应用侧生成 `BIGINT`（Snowflake/号段）+ 批量插入」，届时另立变更。
- `public_id` 在 `@PrePersist` 中生成；不要依赖数据库函数。

## 4. 公共字段

### 4.1 业务实体表模板

适用于 `users`、`conversations`、`prompt_templates`、`model_configs` 等可修改、可软删除的表：

| 字段 | 类型 | NULL | 默认值 | 语义 |
|---|---|---|---|---|
| `id` | `BIGINT` | NO | AUTO_INCREMENT | 内部主键 |
| `public_id` | `CHAR(26) ascii_bin` | NO | 无 | 对外 ULID |
| `created_at` | `DATETIME(3)` | NO | `CURRENT_TIMESTAMP(3)` | 创建时间（UTC） |
| `updated_at` | `DATETIME(3)` | NO | `CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)` | 最后修改时间（UTC） |
| `deleted_at` | `DATETIME(3)` | YES | NULL | 软删除时间；NULL = 有效 |
| `version` | `INT` | NO | 0 | 乐观锁版本，JPA `@Version` |
| `created_by` | `BIGINT` | YES | NULL | 创建人 `users.id`；NULL = 系统 |
| `updated_by` | `BIGINT` | YES | NULL | 最后修改人 `users.id`；NULL = 系统 |

说明：

- `created_by` / `updated_by` 是**逻辑引用，不建外键**，避免删除用户时被审计字段阻塞；业务归属列（如 `conversations.user_id`）必须建外键。
- 单租户不设 `tenant_id`；未来若转多租户，按 expand-contract 先加可空列、回填、再加约束，不在本期预留。
- `version` 只用于需要并发修改的表；追加型明细表不需要。

### 4.2 追加型明细表模板

适用于 `messages`、`usage_records`、`attachments`、`audit_logs` 等只插入、不原地修改的表：

| 字段 | 类型 | NULL | 默认值 | 语义 |
|---|---|---|---|---|
| `id` | `BIGINT` | NO | AUTO_INCREMENT | 内部主键 |
| `public_id` | `CHAR(26) ascii_bin` | NO | 无 | 对外 ULID（仅对外暴露的表需要） |
| `created_at` | `DATETIME(3)` | NO | `CURRENT_TIMESTAMP(3)` | 写入时间（UTC） |
| `request_id` | `VARCHAR(64) ascii_bin` | YES | NULL | 请求链路标识；NULL = 非请求触发 |

追加型表**不加** `updated_at`、`version`、`deleted_at`：

- 消息内容不允许原地修改；要修正就追加新消息或用 `parent_message_id` 表达分支。
- 用量记录是账本，不允许改；冲正用新的负数/调整记录，而不是 UPDATE。
- 需要撤回时用业务状态或新记录表达，不能把历史行删掉。

## 5. NULL / NOT NULL 裁决

### 5.1 总原则

1. **默认 `NOT NULL`**：只有「未知」或「不适用」才允许 NULL。
2. NULL 表示未知/不适用；空字符串表示「已知为空」；0 表示「已知为零」。三者不能混用。
3. 唯一键中的 NULL 要单独设计：MySQL 唯一索引把多个 NULL 视为互不相等，不能靠 `UNIQUE(col, deleted_at)` 实现软删除唯一。
4. 必选关系 `NOT NULL` + 外键；可选关系才允许 NULL + 外键。
5. 金额、计数、版本号 `NOT NULL DEFAULT 0`；不要用 NULL 表示 0。

### 5.2 字段裁决表

| 表.字段 | NULL | 理由 |
|---|---|---|
| `users.email` | NO | 登录标识必填；写入前 trim + 转小写 |
| `users.password_hash` | NO | 本期为邮箱密码体系；第三方登录应新增 `auth_identities` 表，而不是把密码列改成可空 |
| `users.display_name` | NO，默认 `''` | 「已知没有昵称」用空串，不用 NULL |
| `users.status` | NO，默认 `active` | 状态机必填；取值 `active` / `disabled` |
| `users.deleted_at` | YES | NULL = 有效 |
| `conversations.title` | NO，默认 `''` | 新会话允许暂无标题，空串是确定值 |
| `conversations.model` | NO | 创建会话时必须选定默认模型 |
| `conversations.last_message_at` | YES | 空会话没有最后消息时间 |
| `conversations.deleted_at` | YES | NULL = 有效 |
| `messages.role` | NO | `system` / `user` / `assistant` / `tool`，CHECK 约束 |
| `messages.content` | NO | 消息正文必填；允许空串表示空内容，但应用层应拒绝无意义空消息 |
| `messages.model` | YES | 用户消息、系统消息没有模型；NULL = 不适用 |
| `messages.parent_message_id` | YES | 根消息没有父消息 |
| `messages.request_id` | YES | 只有 assistant/tool 响应设置，用于幂等；NULL = 非响应消息 |
| `messages.prompt_tokens` / `completion_tokens` | NO，默认 0 | 未知时也应先记 0，不能留 NULL |
| `usage_records.message_id` | YES | 非消息型用量（如 embedding）没有 message |
| `usage_records.cost` | NO，默认 0 | 已知为零；不允许 NULL |
| `created_by` / `updated_by` | YES | NULL = 系统任务，不是「未知」 |

### 5.3 软删除唯一约束

`users.email` 只在「未删除」记录内唯一。MySQL 唯一索引对 NULL 不生效，因此用生成列承载唯一键：

```sql
email VARCHAR(255) NOT NULL,
deleted_at DATETIME(3) NULL,
active_email VARCHAR(255)
  GENERATED ALWAYS AS (IF(deleted_at IS NULL, email, NULL)) STORED,
UNIQUE KEY uk_users_active_email (active_email)
```

- 有效用户：`active_email = email`，重复邮箱被唯一键拒绝。
- 已删除用户：`active_email = NULL`，同一邮箱可以重新注册。
- 其他需要「软删除 + 业务唯一」的表沿用同一模式，例如 `active_name`、`active_slug`。

## 6. 数据类型与约束

| 用途 | 类型 | 说明 |
|---|---|---|
| 内部主键 / 外键 | `BIGINT` | 有符号；与 Java `long` 对齐 |
| 对外标识 | `CHAR(26) ascii_bin` | ULID，大写 |
| 请求标识 | `VARCHAR(64) ascii_bin` | 客户端/网关幂等键 |
| 短文本 | `VARCHAR(n)` | 邮箱 255、标题 200、显示名 64、模型 64 |
| 长文本 | `MEDIUMTEXT` | 消息正文、提示词正文；应用层限制长度 |
| 枚举 | `VARCHAR(16) ascii_bin` + `CHECK` | 不用 MySQL `ENUM` |
| 时间 | `DATETIME(3)` | UTC；毫秒精度 |
| 布尔 | `TINYINT(1)` | 0/1，配合 `CHECK` |
| 金额 | `DECIMAL(18,6)` | 单价、费用；禁止浮点 |
| 哈希 | `CHAR(64) ascii_bin` | SHA-256 十六进制 |
| 对象键 | `VARCHAR(512) utf8mb4_bin` | 对象存储 key，不做前缀模糊查询 |
| 元数据 | `JSON` | 变量、模型参数；不存正文 |

约束要求：

- MySQL 8.0.16+ 才真正强制执行 `CHECK`；本项目以 8.0+ 为基线。
- 所有 `CHECK` 必须有明确名字，便于闸门断言与错误定位。
- `DATETIME(3)` 的默认值与 `ON UPDATE` 由数据库给出；应用写入时也统一用 UTC。
- 字符集在表级声明 `utf8mb4 COLLATE=utf8mb4_0900_ai_ci`；标识列单独声明 `ascii_bin`。

## 7. 外键与删除策略

- **核心业务关系必须建外键**：`conversations.user_id`、`messages.conversation_id`、`messages.parent_message_id`、`usage_records.user_id` / `conversation_id` / `message_id`。
- **外键统一 `ON DELETE RESTRICT ON UPDATE RESTRICT`**；禁止 `CASCADE`，避免一次误删穿透整棵会话树。
- **外键列必须有索引**；MySQL 会自动为外键建索引，但仍显式命名，保证闸门能断言。
- **审计字段不建外键**：`created_by` / `updated_by` 允许指向已删除用户。
- **软删除优先**：业务实体用 `deleted_at`；明细表不删除。需要物理删除时走单独的数据清理流程，按「子表 → 父表」顺序执行。
- **合规删除**：用户要求彻底删除时，单独编排删除会话、消息、用量与对象存储文件；不能用软删除冒充合规删除。

## 8. 索引策略

### 8.1 什么时候加索引

1. 业务唯一键：`public_id`、有效邮箱、会话内消息序号。
2. 每个外键列。
3. 高频等值查询列（`user_id`、`conversation_id`）。
4. 等值 + 排序：把等值列放前、排序列放后，例如会话列表 `(user_id, deleted_at, last_message_at DESC, id DESC)`。
5. 高频分页：消息按 `(conversation_id, id)` 做 keyset 分页。
6. 覆盖索引：只对「返回列少、查询极热」的场景；不要把 `MEDIUMTEXT` 放进索引。
7. JSON 内的稳定查询字段：用生成列 + 索引，不直接对 JSON 做函数过滤。
8. 中文全文检索：需要时用 `FULLTEXT ... WITH PARSER ngram`，不在 V1 引入。

### 8.2 什么时候不加

- 低基数单列（`status`、`role`、`content_type`）单独建索引，除非它与高基数条件组合。
- 已有复合索引的最左前缀重复建索引。
- 写多读少的表上堆冗余索引；每多一个索引都会增加插入与更新成本。
- 对列做函数、前导通配符 `LIKE '%x%'`、隐式类型转换的查询，索引无法有效使用。
- 消息正文、提示词正文等大文本的 B-Tree 索引。

### 8.3 AI 会话域索引清单

| 查询 | 索引 | 说明 |
|---|---|---|
| 按邮箱找有效用户 | `uk_users_active_email (active_email)` | 软删除唯一 |
| 按对外 ID 找用户 | `uk_users_public_id (public_id)` | API 入口 |
| 用户会话列表 | `idx_conversations_user_active (user_id, deleted_at, last_message_at DESC, id DESC)` | 过滤有效 + 最近活跃排序 |
| 会话内消息翻页 | `idx_messages_conv_id (conversation_id, id)` | keyset：`id < ? ORDER BY id DESC` |
| 会话内消息顺序 | `uk_messages_conv_seq (conversation_id, seq)` | 序号唯一，防并发重号 |
| 响应幂等 | `uk_messages_conv_request (conversation_id, request_id)` | `request_id` 只写在 assistant/tool 行 |
| 父消息检索 | `idx_messages_parent (parent_message_id)` | 分支/引用 |
| 用户用量时间线 | `idx_usage_user_time (user_id, created_at)` | 账单与限额 |
| 会话用量 | `idx_usage_conversation_time (conversation_id, created_at)` | 单会话成本 |
| 消息用量 | `idx_usage_message (message_id)` | 按消息对账 |

### 8.4 索引命名与维护

- 唯一索引 `uk_`、普通索引 `idx_`、外键 `fk_`、检查 `ck_`。
- 复合索引列顺序按「等值 → 范围 → 排序」设计，不按字段重要程度排。
- 上线后用 `sys.schema_unused_indexes`、`sys.schema_redundant_indexes` 定期清理；删除索引也要走迁移。

## 9. 表结构设计

### 9.1 关系概览

```text
users 1 ── n conversations 1 ── n messages
  │                              │
  │                              ├── parent_message_id（自引用，可空）
  │                              └── 1 ── n usage_records
  └────────────── n usage_records
```

- 一个用户多个会话；一个会话多条消息；消息可引用父消息形成分支。
- 用量记录按「用户 + 会话 + 可选消息」记账，一条消息可对应多条用量（多模型/多工具）。

### 9.2 users

```sql
CREATE TABLE users (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  public_id       CHAR(26)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email           VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  display_name    VARCHAR(64)  NOT NULL DEFAULT '',
  status          VARCHAR(16)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3)  NULL,
  active_email    VARCHAR(255) GENERATED ALWAYS AS (IF(deleted_at IS NULL, email, NULL)) STORED,
  version         INT          NOT NULL DEFAULT 0,
  created_by      BIGINT       NULL,
  updated_by      BIGINT       NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_public_id (public_id),
  UNIQUE KEY uk_users_active_email (active_email),
  CONSTRAINT ck_users_status CHECK (status IN ('active', 'disabled')),
  CONSTRAINT ck_users_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

要点：

- `email` 写入前 trim + 转小写；`active_email` 继承表排序规则，大小写不敏感。
- `password_hash` 存 Argon2id / bcrypt 哈希，不存明文；第三方登录以后新增 `auth_identities`，不要放宽本列。
- `display_name` 空串表示「未设置昵称」，不用 NULL。
- `status` 与 `deleted_at` 分离：`disabled` 是业务禁用，`deleted_at` 是逻辑删除。

### 9.3 conversations

```sql
CREATE TABLE conversations (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id          BIGINT       NOT NULL,
  title            VARCHAR(200) NOT NULL DEFAULT '',
  model            VARCHAR(64)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status           VARCHAR(16)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
  last_message_at  DATETIME(3)  NULL,
  message_count    INT          NOT NULL DEFAULT 0,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at       DATETIME(3)  NULL,
  version          INT          NOT NULL DEFAULT 0,
  created_by       BIGINT       NULL,
  updated_by       BIGINT       NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_conversations_public_id (public_id),
  KEY idx_conversations_user_active (user_id, deleted_at, last_message_at DESC, id DESC),
  CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_conversations_status CHECK (status IN ('active', 'archived')),
  CONSTRAINT ck_conversations_message_count CHECK (message_count >= 0),
  CONSTRAINT ck_conversations_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

要点：

- `model` 是会话默认模型；单条消息可覆盖，覆盖值记在 `messages.model`。
- `last_message_at` 为空表示还没有消息；发消息时与 `message_count` 在同一事务更新。
- `message_count` 同时用作 `messages.seq` 的取值来源，见 §9.4。
- 归档用 `status = 'archived'`；删除用 `deleted_at`，两者不混用。

### 9.4 messages

```sql
CREATE TABLE messages (
  id                  BIGINT       NOT NULL AUTO_INCREMENT,
  public_id           CHAR(26)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  conversation_id     BIGINT       NOT NULL,
  seq                 INT          NOT NULL,
  role                VARCHAR(16)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  content             MEDIUMTEXT   NOT NULL,
  content_type        VARCHAR(16)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'text',
  model               VARCHAR(64)  CHARACTER SET ascii COLLATE ascii_bin NULL,
  prompt_tokens       INT          NOT NULL DEFAULT 0,
  completion_tokens   INT          NOT NULL DEFAULT 0,
  parent_message_id   BIGINT       NULL,
  request_id          VARCHAR(64)  CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_messages_public_id (public_id),
  UNIQUE KEY uk_messages_conv_seq (conversation_id, seq),
  UNIQUE KEY uk_messages_conv_request (conversation_id, request_id),
  KEY idx_messages_conv_id (conversation_id, id),
  KEY idx_messages_parent (parent_message_id),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_messages_parent FOREIGN KEY (parent_message_id) REFERENCES messages (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_messages_role CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  CONSTRAINT ck_messages_content_type CHECK (content_type IN ('text', 'markdown', 'json')),
  CONSTRAINT ck_messages_seq CHECK (seq >= 1),
  CONSTRAINT ck_messages_prompt_tokens CHECK (prompt_tokens >= 0),
  CONSTRAINT ck_messages_completion_tokens CHECK (completion_tokens >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

要点：

- **追加型**：没有 `updated_at`、`version`、`deleted_at`；修正内容用新消息。
- `seq` 在会话内从 1 递增；写入事务先对 `conversations` 行做 `UPDATE ... SET message_count = message_count + 1`，再用新值作为 `seq`，最后插入消息；唯一键兜住并发重号，冲突时重试。
- `request_id` 只写在 assistant/tool 响应行；唯一键 `(conversation_id, request_id)` 用于重试幂等。用户消息的 `request_id` 为 NULL，MySQL 允许多个 NULL。
- `parent_message_id` 表达分支/重生成；自引用外键 `RESTRICT`，父消息不能被删。
- `content` 是正文，不能建 B-Tree 索引；需要搜索时用全文索引或外部检索。

### 9.5 usage_records

```sql
CREATE TABLE usage_records (
  id                 BIGINT        NOT NULL AUTO_INCREMENT,
  public_id          CHAR(26)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id            BIGINT        NOT NULL,
  conversation_id    BIGINT        NOT NULL,
  message_id         BIGINT        NULL,
  model              VARCHAR(64)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  prompt_tokens      INT           NOT NULL DEFAULT 0,
  completion_tokens  INT           NOT NULL DEFAULT 0,
  total_tokens       INT           GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  cost               DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  currency           CHAR(3)       CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'CNY',
  request_id         VARCHAR(64)   CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_usage_public_id (public_id),
  KEY idx_usage_user_time (user_id, created_at),
  KEY idx_usage_conversation_time (conversation_id, created_at),
  KEY idx_usage_message (message_id),
  CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_usage_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_usage_message FOREIGN KEY (message_id) REFERENCES messages (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_usage_prompt_tokens CHECK (prompt_tokens >= 0),
  CONSTRAINT ck_usage_completion_tokens CHECK (completion_tokens >= 0),
  CONSTRAINT ck_usage_cost CHECK (cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

要点：

- 追加型账本：不更新、不软删除；冲正用新记录。
- `message_id` 可空：embedding、图片生成等非消息型用量没有 message。
- `total_tokens` 是生成列，JPA 映射为 `insertable = false, updatable = false`。
- `cost` 用 `DECIMAL(18,6)`；币种单独存，不把符号混进金额。
- `request_id` 用于对接网关/计费链路，不强制唯一（一次请求可能产生多条模型用量）。

### 9.6 后续表（本期不建）

以下表在本文定义结构方向，由后续迁移引入，不进入 V1：

| 表 | 用途 | 关键约束 |
|---|---|---|
| `attachments` | 消息附件元数据 | `message_id` 外键；`file_key` 唯一；文件进对象存储 |
| `prompt_templates` | 提示词模板 | `(name, version)` 唯一；`variables JSON`；软删除 |
| `feedbacks` | 消息反馈 | `(message_id, user_id)` 唯一；`rating` 1..5 CHECK |
| `model_configs` | 模型供应商配置 | `provider + model_name` 唯一；只存 `secret_ref`，不存密钥 |
| `audit_logs` | 安全审计 | 追加型；按 `actor_id + created_at` 建索引；保留期单独定义 |

后续表同样遵守 §4 的公共字段模板与 §8 的索引规则。

## 10. Flyway 规范

- 迁移目录：`backend/src/main/resources/db/migration/`。
- 命名：`V<版本>__<描述>.sql`；版本从 1 开始，只增不减；描述用蛇形英文。
- 已应用的迁移**不可修改**（Flyway 校验 checksum）；修正用新版本迁移。
- `flyway_schema_history` 与业务表同库，不手工改。
- 禁用 `clean`（`cleanDisabled=true`）；生产账号不得有 `DROP` 权限。
- 使用空库首次迁移，不做 `baselineOnMigrate`；历史库迁移另行评估。
- 结构变更遵循 expand-contract：先加可空列/新表 → 双写/回填 → 切读 → 删旧列/旧表。
- 大表加列、加索引使用 online DDL 或外部工具，必须在维护窗口评估锁表时间。
- 数据回填分批提交，禁止一条 SQL 更新全表；回填脚本与结构迁移分开。
- 生产迁移由发布流水线在应用启动前执行，不依赖 `spring.flyway` 自动运行。
- CI/本地用 `06-flyway.ps1` 连接 `127.0.0.1:8806` 的既有 MySQL 8 实例，在专用 schema `ai_chat_gate` 上执行迁移并断言结构；不新建/删除容器，不触碰 `green-note` 业务库；迁移失败即整体验收失败。
- 当前既有实例为 MySQL 8.3；Flyway 11.7.2 官方已测试到 MySQL 8.1，会打印升级警告，但迁移与结构断言已实际通过。

## 11. JPA 映射约定

数据源接入后按以下约定落地（本期只建表，不建实体）：

- `spring.jpa.hibernate.ddl-auto=validate`；禁止 `update` / `create`。
- `spring.jpa.open-in-view=false`；DTO 投影或 `@EntityGraph` 解决懒加载。
- 主键：`@Id @GeneratedValue(strategy = GenerationType.IDENTITY)`，Java 类型 `Long`。
- 对外 ID：`public_id` 在 `@PrePersist` 生成 ULID；不要用数据库函数。
- 枚举：`@Enumerated(EnumType.STRING)`，与 `VARCHAR + CHECK` 对齐；不要用 ordinal。
- 乐观锁：需要并发修改的表加 `@Version private int version;`。
- 生成列：`total_tokens`、`active_email` 用 `@Column(insertable = false, updatable = false)`，只读。
- 关联：`@ManyToOne(fetch = FetchType.LAZY)`；禁止双向 `toString()` 与 Lombok `@Data`。
- 时间：`hibernate.jdbc.time_zone=UTC`；JDBC URL 加 `connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true`。
- 软删除：仓储方法显式带 `deleted_at IS NULL`；如用 Hibernate `@SQLRestriction`，必须确认原生查询与统计口径一致。
- 批量：`IDENTITY` 关闭 JDBC 批插入；需要高吞吐时另立变更评估应用侧 ID。
- 事务：`@Transactional` 放在 service 层；消息序号分配与插入必须在同一事务。
- 命名：物理命名策略统一 snake_case；关键表/列用 `@Table` / `@Column` 显式声明，避免重构改名。

## 12. 查询与分页

- 会话列表：

```sql
SELECT id, public_id, title, last_message_at, message_count
FROM conversations
WHERE user_id = ? AND deleted_at IS NULL
ORDER BY last_message_at DESC, id DESC
LIMIT ?;
```

- 消息翻页（keyset，禁止深 offset）：

```sql
SELECT id, public_id, seq, role, content, created_at
FROM messages
WHERE conversation_id = ? AND id < ?
ORDER BY id DESC
LIMIT ?;
```

- 首页不传 `id` 条件；后续页用上一页最后一条的 `id`。
- 计数查询单独执行，不在列表 SQL 里做 `SQL_CALC_FOUND_ROWS`。
- 禁止对 `content` 做 `LIKE '%关键词%'`；需要检索时走全文索引或外部搜索引擎。

## 13. 红线

1. 用自然键（邮箱、手机号、用户名）作主键。
2. 用 `FLOAT` / `DOUBLE` 存金额。
3. 用 `TIMESTAMP` 存业务时间并依赖服务器时区。
4. 全表可空、靠应用猜默认值。
5. 对消息正文、提示词正文建 B-Tree 索引或前导通配符查询。
6. 明文存密钥、令牌、密码；大文件直接入库。
7. 用软删除冒充合规删除。
8. 生产使用 `ddl-auto=update` 或 Hibernate 自动建表。
9. 修改已应用的迁移文件。
10. 外键 `ON DELETE CASCADE`。
11. 暴露自增 `id` 给前端或外部系统。
12. 无索引的外键列与高频查询列。

## 14. 本期落地与后续迁移

**本期（V1）落地：**

- `users`
- `conversations`
- `messages`
- `usage_records`

**后续迁移：**

- `attachments`、`prompt_templates`、`feedbacks`、`model_configs`、`audit_logs`
- 数据源/JPA 接入、Todo 持久化（独立变更）
- 多租户（如未来需要，先加 `tenant_id` 可空列并回填，再加唯一键与外键）

**变更流程：**

1. 先改本文档，明确表、列、约束、索引与迁移版本。
2. 新增 `V<n>__<描述>.sql`，不修改旧迁移。
3. 更新 `06-flyway.ps1` 的结构断言（新增表/关键约束时）。
4. 运行 `harness\run-all.ps1`，退出码 0 才算完成。

## 15. 验收对照

| 规范要求 | 验收方式 |
|---|---|
| 迁移可在空库执行 | `06-flyway.ps1` 连接既有 8806 MySQL 8，重建专用 schema 并迁移成功 |
| 重复执行幂等 | 同一专用 schema 再次迁移，退出码 0 |
| 四张核心表存在 | `information_schema.tables` 断言 |
| 关键唯一键/索引/CHECK 存在 | `information_schema.statistics` / `table_constraints` 断言 |
| 迁移失败会红 | 临时错误迁移，闸门退出码非 0 |
| 不触碰业务库与容器 | `green-note` 表集合不变，执行前后容器列表一致 |
| 运行期不依赖数据库 | 未启动 MySQL 时 `01-compile`、`02-test`、应用启动均通过 |
