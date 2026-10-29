# Proposal

## Why

帖子详情页与列表页都需要展示互动数据（评论、点赞、收藏），前端也已规划在卡片底部展示互动统计行并在 `/posts` 列表页支持按热度/讨论数排序。当前后端只有帖子读写能力，没有评论、投票、收藏的持久化与查询入口，导致互动数据无来源、排序无依据。

## What Changes

- 新增 `wanderchain-post-interactions` 能力：为帖子提供评论、投票、收藏三类交互的后端支持，含数据表、领域模型、service 接口、web 端点与测试。
- **MODIFIED** `wanderchain-posts` 能力：在 `PostSummaryResponse` 中追加 `commentCount`、`upVoteCount`、`bookmarkCount` 三个统计字段；扩展列表查询支持 `sortBy` 参数与携带排序维度的游标。
- 更新 `frontend/lib/contracts/posts.ts` 与 `harness/checks/10-contract-check.ps1` 受管清单，保持前后端契约一致。

## Capabilities

### New Capabilities

- `wanderchain-post-interactions`：帖子评论、投票、收藏的创建、删除、计数查询与作者可见性规则。

### Modified Capabilities

- `wanderchain-posts`：列表项响应追加互动统计字段；列表查询新增按 `upVoteCount` / `commentCount` 排序及对应游标编码。

## Impact

- 后端：新增 `dao/post/entity/{Comment,Vote,Bookmark}`、`service/post/interaction/`、`web/post/interaction/` 及对应测试；修改 `PostSummaryResponse` / `PostPage` / `PostService#feed`。
- 数据库：`schema.sql` 新增 `post_comments`、`post_votes`、`post_bookmarks` 三张表及索引。
- 前端：契约文件 `frontend/lib/contracts/posts.ts` 需镜像新增字段；列表页排序与无限滚动依赖本次新增接口。
- 契约闸门：`10-contract-check.ps1` 的 `$contractPairs` 需纳入帖子 DTO 目录（若尚未纳入）。
