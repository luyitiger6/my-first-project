# Spec Delta

## ADDED Requirements

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
