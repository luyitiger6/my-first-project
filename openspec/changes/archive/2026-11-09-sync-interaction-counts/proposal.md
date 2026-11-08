# Proposal

## Why

`add-post-count-columns` 已给 `posts` 加上 `up_vote_count`、`comment_count`、`bookmark_count` 三列与两条排序索引，但当前没有任何代码读写它们：

- `PostRepository` 的四个排序查询仍在查询期用相关子查询 `select count(...)` 聚合 `post_votes` / `post_comments`，复杂度随帖子总数线性放大，新建的两条索引完全用不上。
- `PostServiceImpl.countsOf` 逐帖再跑三次 count（列表页 N+1），`InteractionCounts` 只是把实时聚合结果搬进响应。
- 互动写入（评论、投票、收藏）只改互动表，不维护 `posts` 的计数列——计数列会永久停在 0。

这条链路不改，change 1 加的三列只是多占空间。

## What Changes

- `Post` 实体映射三个计数列，且映射为 `insertable = false, updatable = false`：计数只由原子增量语句维护，任何实体 UPDATE（编辑、删除）MUST NOT 覆盖它。
- `PostRepository` 的四个排序查询改为直接读 `p.upVoteCount` / `p.commentCount`，删除全部相关子查询；游标条件改为对计数列做字典序比较。
- `PostServiceImpl` 删除 `countsOf` 的逐帖三次 count 与 `InteractionCounts`，列表、详情、发布与编辑响应直接读实体计数。
- `PostRepository` 新增三条原子增量语句（`列 = 列 + :delta`），用原生 SQL 显式把 `updated_at` 保持为原值，避免互动操作刷新帖子的更新时间。
- `PostInteractionServiceImpl` 在六类写路径上同事务同步计数：评论创建 +1 / 删除 -1；投票新建赞成 +1、反对不变、换向 ±1、取消按原方向 -1；收藏建立 +1（重复收藏不加）、取消 -1。
- 删除三个只被 `PostServiceImpl` 使用的 count 方法（`CommentRepository`、`VoteRepository`、`BookmarkRepository` 各一个）。
- 提供一次性回填 SQL：按互动表重算三列，并给出「计数列与实时聚合不一致行数为 0」的校验查询；本地与演示库在切换前执行。

无 BREAKING 变更：端点、请求体、响应字段与排序语义均不变，计数口径（未删除评论、有效赞成票、未删除收藏）与现状一致。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `wanderchain-post-interactions`: 新增「互动写入同步帖子统计」的四条 Requirement——评论数同步、点赞数同步、收藏数同步、原子性与事务边界。

## Impact

- 后端：`dao/post/entity/Post`、`dao/post/repository/PostRepository`、`service/post/impl/PostServiceImpl`、`service/post/interaction/impl/PostInteractionServiceImpl`，以及三个 count 方法的删除。
- 数据：已有帖子的计数列默认为 0，本地与演示库需在切换前执行一次性回填；生产当前无数据，若上线时已有数据同样必须先回填。
- 无前端与契约变更：三个计数字段与排序参数未变。
- 依赖前置：本 change 的前置是 `add-post-count-columns` 已合入且本地库已补三列。
