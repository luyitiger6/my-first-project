# database-baseline Specification

## Purpose

为 AI 会话项目提供可审计的数据库结构基线与迁移验收：核心表由版本化迁移建立，Harness 在既有 MySQL 8 实例的专用 schema 上验证迁移可执行、结构正确且可重复执行。

## Requirements

### Requirement: AI 会话核心表基线

AI 会话库的 DDL 脚本 SHALL 建立 `users`、`conversations`、`messages`、`usage_records` 四张核心表，并包含主键、对外唯一标识、会话归属外键与消息顺序唯一约束。

#### Scenario: 核心表齐全

- **WHEN** 建表完成后查询数据库元数据
- **THEN** 四张核心表全部存在，且每张表都有主键与创建时间字段

#### Scenario: 对外标识唯一

- **WHEN** 向同一张核心表插入两条相同的对外标识
- **THEN** 数据库以唯一键冲突拒绝第二条记录

#### Scenario: 消息顺序唯一

- **WHEN** 在同一会话中插入两条相同顺序号的消息
- **THEN** 数据库以唯一键冲突拒绝第二条记录

#### Scenario: 角色取值受控

- **WHEN** 插入角色不在 `system`、`user`、`assistant`、`tool` 之内的消息
- **THEN** 数据库以 CHECK 约束拒绝该记录

#### Scenario: 计数不可为负

- **WHEN** 插入 token 计数为负数的消息或用量记录
- **THEN** 数据库以 CHECK 约束拒绝该记录

#### Scenario: 会话归属受外键保护

- **WHEN** 插入一条引用不存在会话的消息
- **THEN** 数据库以外键约束拒绝该记录

#### Scenario: 会话列表与消息翻页有索引

- **WHEN** 查询数据库索引元数据
- **THEN** 会话按用户与最近活跃排序、消息按会话与主键翻页所需索引均存在

### Requirement: 数据库结构由受版本控制的 DDL 脚本定义

数据库结构 SHALL 由受版本控制的 DDL 脚本定义，脚本 MUST NOT 依赖迁移框架，且 MUST 幂等（重复执行无副作用）。本阶段库内无可保留数据，结构变更以重建库代替演进；一旦出现必须在生产保住的数据，该决定 MUST 重新评估而不是沿用默认。

#### Scenario: 空库建表成功

- **WHEN** 在空的 MySQL 8 库上执行对应库的 DDL 脚本
- **THEN** 执行以退出码 0 结束，目标表、索引与命名约束均存在

#### Scenario: 重复执行无副作用

- **WHEN** 对已建表的库再次执行同一份 DDL 脚本
- **THEN** 命令仍以退出码 0 结束，既有表结构与数据不变

#### Scenario: DDL 报错即阻断

- **WHEN** DDL 脚本存在语法错误、缺少表或缺少命名约束
- **THEN** 执行以非 0 退出码结束，且闸门判定失败并指出失败原因

### Requirement: 建表闸门纳入 Harness

Harness SHALL 提供独立的建表闸门，在既有 MySQL 8 实例上重建各项目专属 schema、执行对应 DDL 脚本并校验结构；数据库不可达、凭据缺失或建表失败时 MUST 以非 0 退出码结束，且 MUST NOT 静默跳过。

该闸门 MUST 覆盖本仓库全部专属 schema：AI 会话库 `ai_chat_gate` 与 wanderchain 库 `wanderchain`，两者各自独立重建与断言，互不影响。

#### Scenario: 闸门通过

- **WHEN** 运行 `harness\run-all.ps1` 且 `127.0.0.1:8806` 的 MySQL 8 可连接、凭据可用
- **THEN** 建表闸门重建两个专属 schema、各执行一次 DDL、校验结构与幂等，并以退出码 0 结束

#### Scenario: 数据库不可达即失败

- **WHEN** `127.0.0.1:8806` 不可达，或未提供可用凭据
- **THEN** 建表闸门以非 0 退出码结束并输出明确原因，整体验收判定失败

#### Scenario: 结构缺陷被拦截

- **WHEN** DDL 脚本存在语法错误、缺少核心表或缺少命名约束
- **THEN** 建表闸门以非 0 退出码结束并指出失败原因

#### Scenario: 生成列与唯一键确实生效

- **WHEN** 向未注销账户写入两条相同邮箱
- **THEN** 数据库以唯一键冲突拒绝第二条，证明 `active_email` 生成列参与的唯一键真实生效

#### Scenario: 不触碰既有业务库与容器

- **WHEN** 建表闸门执行结束，无论成功或失败
- **THEN** 未创建或删除任何容器，`green-note` 业务库的表集合保持不变

### Requirement: 后端运行期依赖数据库与缓存

后端应用 MUST 依赖 MySQL 与 Redis：账户、会话与吊销记录 MUST 持久化到 MySQL；图形码、注册码、重置码、重发冷却、邮箱发码日配额、登录失败计数与来源限流窗口 MUST 存放于 Redis。

应用启动时 MUST 通过 `schema.sql` 幂等建出所需表结构，且 MUST NOT 依赖 ORM 的自动建表；任一依赖不可达时 MUST 启动失败或使认证链路整体失败，MUST NOT 静默降级为内存实现。单元测试 MUST 连接真实实例，MUST NOT 用 H2 或嵌入式 Redis 替身——生成列与命名 CHECK 的语义只有真实 MySQL 能验证。

#### Scenario: 启动即建表

- **WHEN** 在空库上启动后端应用
- **THEN** 应用启动后表结构已由 `schema.sql` 建出，且无需人工执行任何建表命令

#### Scenario: 数据库不可达时启动失败

- **WHEN** 未配置数据源或 MySQL 不可达时启动后端
- **THEN** 启动以失败结束并输出明确原因，不以内存实现顶替

#### Scenario: 缓存不可达时认证链路失败

- **WHEN** Redis 不可达时调用注册或登录端点
- **THEN** 端点返回错误而非静默放行，且不写入任何绕过限流的状态

#### Scenario: 单元测试连接真实实例

- **WHEN** 执行后端单元测试
- **THEN** 测试连接 `127.0.0.1:8806` 与 `127.0.0.1:6606`，且对生成列与命名约束的断言在真实 MySQL 上执行

### Requirement: wanderchain 表集合基线

wanderchain 库 SHALL 由 `schema.sql` 建立八张表：`accounts`、`auth_sessions`、`posts`、`post_comments`、`post_votes`、`post_bookmarks`、`attractions`、`attraction_comments`。任一张缺失 MUST 使建表闸门失败。`attraction_comments` 本期只建表，没有实体、仓储、端点与消费方，但 MUST NOT 因无消费方而从基线中移除。

#### Scenario: 八张表齐全

- **WHEN** 建表完成后查询 `wanderchain` 库的表元数据
- **THEN** 上述八张表全部存在

#### Scenario: 占位表缺失被拦截

- **WHEN** `schema.sql` 中删除 `attraction_comments` 的建表语句
- **THEN** 建表闸门以非 0 退出码结束并指出缺失的表

### Requirement: 对外标识与软删除唯一性基线

业务表 `accounts`、`posts`、`post_comments`、`post_votes`、`post_bookmarks`、`attractions`、`attraction_comments` MUST 以 `public_id` 作为对外唯一标识并建有唯一键；`auth_sessions` MUST 以 JWT 的 `jti` 唯一标识。软删除后需要释放唯一性的列 MUST 用 STORED 生成列实现（`accounts.active_email`、`post_votes.active_account_id`、`post_bookmarks.active_account_id`），并 MUST 由包含该生成列的唯一键兜底，MUST NOT 用应用层查重替代。

#### Scenario: 对外标识重复被拒绝

- **WHEN** 向任一业务表插入两条相同的 `public_id`
- **THEN** 数据库以唯一键冲突拒绝第二条记录

#### Scenario: 注销后同邮箱可重新注册

- **WHEN** 账户被注销（`deleted_at` 非空）后，用同一邮箱注册新账户
- **THEN** 插入成功，因为旧行的 `active_email` 已为 NULL，不参与唯一键比较

#### Scenario: 取消投票后可重新投票

- **WHEN** 同一账号取消对同一帖子的投票（软删除）后再次投票
- **THEN** 插入成功，因为 `uk_post_votes_active` 只约束未删除行

### Requirement: 关联与取值约束基线

wanderchain 表的关联完整性 MUST 由具名外键约束保证（`auth_sessions.account_id`、`posts.author_id`、`post_comments` 的 `post_id`/`account_id`/`parent_id`、`post_votes` 与 `post_bookmarks` 的 `post_id`/`account_id`、`attraction_comments` 的 `attraction_id`/`account_id`/`parent_id`），删除与更新行为 MUST 为 `RESTRICT`。状态、方向、评分、城市、版本与计数列 MUST 有具名 CHECK 约束。列表排序索引 MUST 采用 `(等值列…, deleted_at, 排序列 DESC, id DESC)` 形状。

#### Scenario: 引用不存在的帖子被拒绝

- **WHEN** 插入一条 `post_id` 指向不存在帖子的评论
- **THEN** 数据库以外键约束拒绝该记录

#### Scenario: 非法状态被拒绝

- **WHEN** 向 `posts.status` 写入 `draft`、`published` 之外的值
- **THEN** 数据库以 CHECK 约束拒绝该记录

#### Scenario: 排序索引存在

- **WHEN** 查询 `wanderchain` 库的索引元数据
- **THEN** `idx_posts_feed`、`idx_posts_author`、`idx_attractions_hot`、`idx_attractions_rating`、`idx_attractions_new` 与三个策展榜单索引均存在

### Requirement: 帖子互动计数列的存储形态

`posts` MUST 提供 `up_vote_count`、`comment_count`、`bookmark_count` 三个冗余计数列，类型 `INT NOT NULL DEFAULT 0`，且各带具名非负 CHECK。`posts` MUST 另有 `idx_posts_up_vote_count` 与 `idx_posts_comment_count` 两条排序索引，形状与 `idx_posts_feed` 同构。计数列的增减时机与读写口径由帖子与互动能力规定，本基线只固定存储形态。

#### Scenario: 计数列默认零

- **WHEN** 插入一条未指定计数列的新帖子
- **THEN** 三个计数列的取值均为 0

#### Scenario: 负计数被拒绝

- **WHEN** 将任一计数列更新为 -1
- **THEN** 数据库以 CHECK 约束拒绝该更新

#### Scenario: 计数排序索引存在

- **WHEN** 查询 `wanderchain` 库的索引元数据
- **THEN** `idx_posts_up_vote_count` 与 `idx_posts_comment_count` 存在，且列顺序为 `(status, deleted_at, 计数列 DESC, id DESC)`

### Requirement: 建表闸门断言 wanderchain 结构要点

建表闸门 MUST 断言 `wanderchain` 库的八张表、具名唯一键/索引/外键/CHECK、生成列（按「表+列」组合）、`created_at` 列，以及 `posts` 三个计数列与两条排序索引；任一缺失或改名 MUST 以非 0 退出码结束并指出缺失项。闸门 MUST NOT 逐列镜像列类型与长度——两者以 `schema.sql` 为唯一真源。

#### Scenario: 缺表或改名即失败

- **WHEN** `schema.sql` 中任一基线表、具名索引、外键或 CHECK 被删除或改名
- **THEN** 建表闸门以非 0 退出码结束并输出缺失项

#### Scenario: 同名生成列不互相掩盖

- **WHEN** `post_votes` 与 `post_bookmarks` 中只有一处的 `active_account_id` 生成列缺失
- **THEN** 建表闸门以非 0 退出码结束，指出缺失的表与列

#### Scenario: 新增计数列被断言

- **WHEN** `posts` 的三个计数列或两条排序索引缺失
- **THEN** 建表闸门以非 0 退出码结束

#### Scenario: 不逐列镜像列类型

- **WHEN** 仅调整某列的长度或字符集而未改变结构要点
- **THEN** 闸门不对该变化做断言，也不因其失败
