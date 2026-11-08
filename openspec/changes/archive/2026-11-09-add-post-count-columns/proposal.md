# Proposal

## Why

帖子列表支持按点赞数（`upVoteCount`）与评论数（`commentCount`）排序，但 `posts` 表没有任何计数列支撑：`PostRepository` 的四个排序查询都在查询期用相关子查询 `select count(...)` 聚合 `post_votes` / `post_comments`，复杂度随帖子总数线性放大；读取列表与详情还会逐帖再跑三次 count（N+1）。数据量上来后，首页与广场会成为全库最慢的查询。

同时，`database-baseline` 只固定了 AI 会话四张表，wanderchain 八张表的列类型、长度、索引与唯一约束没有规格；06 建表闸门的 wanderchain 断言清单也漏了 `post_comments` / `post_votes` / `post_bookmarks` 三张表——表建了，但没有任何规格或闸门能发现它被改坏。

## What Changes

- `posts` 表新增三个冗余计数列：`up_vote_count`、`comment_count`、`bookmark_count`，均 `INT NOT NULL DEFAULT 0` 并带非负 CHECK。
- 新增两条排序索引：`idx_posts_up_vote_count`、`idx_posts_comment_count`，形状为 `(status, deleted_at, 计数列 DESC, id DESC)`，与既有 `idx_posts_feed` 同构。
- `database-baseline` 新增 wanderchain 结构要点基线：固定八张表清单、对外唯一标识、软删除生成列唯一键、外键、状态/计数 CHECK、排序索引与三个计数列的存储形态；列类型与长度以 `schema.sql` 为唯一真源，不做逐列镜像。
- 06 建表闸门的 wanderchain 断言清单补齐三张漏掉的表及其索引/约束，把生成列断言从纯列名升级为「表+列」组合，并纳入本次新增的计数列与排序索引。
- 本 change 只做结构：计数列暂不由服务读写（默认 0，不影响任何响应或排序），写侧同步与读侧切换由后续 `sync-interaction-counts` 承接。

无 BREAKING 变更：不改端点、请求体与响应字段；计数列是新增列，旧行按默认值 0 落库。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `database-baseline`: 新增 wanderchain 结构要点基线 Requirement 与闸门断言范围 Requirement（八张表、唯一标识、软删除释放唯一、外键、CHECK、排序索引、计数列）。

## Impact

- 后端：`backend/src/main/resources/schema.sql`（posts 三列 + 两索引 + 三 CHECK）。
- 闸门：`harness/checks/06-schema-check.ps1`（wanderchain 断言清单补齐）。
- 本地库：`CREATE TABLE IF NOT EXISTS` 不会给已存在的 `posts` 补列，已有本地库需重建或手工 `ALTER TABLE`（沿用 `schema.sql` 头部既有约定）。
- 无前端与契约变更：共享 DTO 字段未变。
