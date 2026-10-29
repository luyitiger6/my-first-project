# Design

## Context

当前后端已实现帖子 CRUD 与游标分页（见 `service/post/`、`web/post/`、`dao/post/`），列表响应 `PostSummaryResponse` 不含互动统计，数据库仅 `posts` 一张业务表。前端计划展示的 `commentCount` / `upVoteCount` / `bookmarkCount` 与按热度/讨论数排序均依赖本次新增的数据来源。具体动机与范围见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 为评论、投票、收藏建立持久化表与领域模型。
- 提供评论/投票/收藏的创建、删除、列表、计数能力。
- 将三个统计字段注入 `PostSummaryResponse`，并扩展列表排序与游标。
- 保持现有三层分包与依赖方向（common ← dao ← service ← web）。

**Non-Goals:**
- 不实现评论的编辑、点赞/点踩双向投票、收藏列表查询等前端未要求的能力。
- 不引入 Redis 缓存计数；先以 SQL 实时 count 满足需求，后续数据量大时另立项优化。
- 不改动帖子详情 `PostResponse` 的字段集合（详情页互动统计另change处理）。

## Decisions

### D1. 数据模型：三张独立表，均继承公共八列

沿用 `BaseEntity` 的 `public_id`、`created_at`、`updated_at`、`deleted_at`、`version` 等公共字段，新增：

- `post_comments`（post_id, account_id, content, parent_id）
- `post_votes`（post_id, account_id, direction）
- `post_bookmarks`（post_id, account_id）

**理由**：评论、投票、收藏的生命周期与可见性规则不同，分表最清晰；与 `posts` 外键关联即可。`parent_id` 支持二级回复，`direction` 支持赞成/反对两种投票。

**被否方案**：在 `posts` 表上加计数列——写路径需维护，点赞/收藏这种高频写会锁住行，且无法表达「谁投的票」。

### D2. 唯一约束用生成列规避软删除失效

对 `post_votes` 与 `post_bookmarks` 建立 `(post_id, account_id)` 唯一约束，但直接加在含 `deleted_at` 的表上会因 NULL 不互等而失效。采用生成列模式：

```sql
active_account_id BIGINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, account_id, NULL)) STORED
UNIQUE KEY uk_post_votes_active (post_id, active_account_id)
```

**理由**：与 `accounts` 表的 `active_email` 生成列方案一致，已被 MySQL 8 验证有效。

### D3. 计数查询策略：实时 SQL count

列表项的三个统计字段通过子查询或 JOIN 聚合实时计算。

**理由**：当前数据量未知但功能刚上线，实时 count 最简单、最一致；避免过早引入 Redis 计数带来的写入事务与缓存失效复杂度。

**风险**：帖子数量大且每页 20~50 条时，每页对三表各做一次 count 可能有性能压力；后续可引入物化列或缓存。

### D4. 游标编码携带排序维度

扩展 `FeedCursor` 记录：`sortBy`（字符串）+ 对应排序键值 + `id`。

- `publishedAt` 排序：`(publishedAt, id)`
- `upVoteCount` 排序：`(upVoteCount, publishedAt, id)`
- `commentCount` 排序：`(commentCount, publishedAt, id)`

编码为 Base64 URL 不透明串，形如 `sortBy:publishedAt:epoch:id`。

**理由**：不同排序的游标语义不同，必须自描述；`id` 作为最终兜底保证唯一序。

**被否方案**：三种排序各用一个游标字段——会污染 `PostPage` / `PostFeedResponse` 的响应结构。

### D5. 服务层按交互类型分包

新增 `service/post/interaction/` 包：

- `PostInteractionService` 接口（顶层）
- `impl/PostInteractionServiceImpl` 实现
- `model/` 放评论/投票/收藏的视图记录

评论、投票、收藏的 web DTO 放在 `web/post/interaction/dto/`。

**理由**：与现有 `service/post/` 接口+`impl/` 的分包约定一致，避免把交互逻辑平铺进 `PostService`。

### D6. 投票设计为单次上行表达

每个账户对每条帖子最多一条投票记录；投票请求携带 `direction`（`up` 或 `down`），再次投票时新记录替换旧记录。`PostSummaryResponse` 中的 `upVoteCount` 只统计 `direction = 'up'` 的记录。

**理由**：用户决定在单条 change 内支持赞成与反对两种表达；列表统计仍只暴露 `upVoteCount` 以满足既有规格，投票响应显示实际方向。

### D7. 收藏幂等：先查后插

收藏接口先按 `(post_id, account_id, deleted_at is null)` 查询，存在则直接返回 `200`，不存在则插入。

**理由**：满足 spec 中「重复收藏幂等」的要求，同时利用生成列唯一约束兜底。

## Risks / Trade-offs

- **[性能]** 列表实时 count 在数据量大时可能拖慢 feed → 监控慢查询，后续考虑 Redis 或物化列。
- **[并发]** 高并发投票可能出现计数瞬时不一致 → 统计字段以 count 查询为准，不维护冗余计数列。
- **[游标漂移]** 投票/评论数变化会导致按热度排序的游标在翻页期间不稳定 → 这是热度排序的固有特性，spec 已要求「不因新增帖子而重复或跳过」仅针对默认排序；热度排序的测试重点改为「不返回已见条目」。
- **[schema 幂等]** `schema.sql` 新增表后重复启动不能报错 → 所有建表用 `IF NOT EXISTS`。

## Migration Plan

1. 更新 `backend/src/main/resources/schema.sql`，新增三张表与索引。
2. 启动后端应用，由 `spring.sql.init.mode=always` 自动建表。
3. 部署新代码后，旧帖子无互动记录，统计字段自然为 0，无需数据迁移。
4. 回滚：回退代码并可选删除三张表（本阶段无保留数据需求）。

## Open Questions

- [已确认] 评论列表支持二级回复：评论表增加 `parent_id`，列表接口返回含 `parentId` 的扁平结果。
- [已确认] 投票支持 upvote/downvote：请求体携带 `direction`，再次投票替换旧记录，列表只统计 `upVoteCount`。
