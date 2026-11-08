# Design

## Context

见 `proposal.md` 的 Why。实现形状由以下四条现状决定：

1. `Post` 实体无计数字段；`PostServiceImpl` 的 `countsOf` 对每条帖子调三次 repository count，`InteractionCounts` 只承载这三次数值。
2. `PostRepository` 的四个排序查询在 JPQL 内嵌 `select count(...)`；`FeedCursor` 已把排序维度的 score 编码进游标，score 的类型与取值不因数据源切换而变。
3. `BaseEntity.updatedAt` 是 `@Generated(event = {INSERT, UPDATE})` + `insertable = false, updatable = false`，列定义带 `ON UPDATE CURRENT_TIMESTAMP(3)`；Hibernate 对实体的 UPDATE 默认包含全部可更新列（无 `@DynamicUpdate`）。
4. 三个 count 方法（`CommentRepository.countByPostIdAndDeletedAtIsNull`、`VoteRepository.countByPostIdAndDirectionAndDeletedAtIsNull`、`BookmarkRepository.countByPostIdAndDeletedAtIsNull`）经 grep 确认只被 `PostServiceImpl.countsOf` 引用，测试与前端无直接引用。

## Goals / Non-Goals

**Goals:**

- 列表与详情的三个计数来自 `posts` 计数列，列表页不再产生逐帖聚合查询。
- 四个排序查询只读计数列，相关子查询全部消失，两条新索引可被使用。
- 互动写入与计数更新同事务、单语句原子增量，提交后读到的计数与互动事实一致。

**Non-Goals:**

- 不引入事件、消息或异步对账：一致性靠同事务。
- 不做定时修复任务：计数漂移的兜底是一致性校验 SQL 与 CHECK，不建调度器。
- 不改端点、DTO、排序参数与游标格式。
- 不把 `@Version` 纳入计数更新：计数是派生数据，不应与帖子编辑的乐观锁互相干扰。

## Decisions

### D1：计数列映射为只读（`insertable = false, updatable = false`）

Hibernate 对实体的 UPDATE 默认包含全部可更新列。编辑帖子时 `posts.saveAndFlush(post)` 会用实体里加载时的旧计数覆盖数据库的当前值，把并发期间别人的点赞写丢。把三列标记为只读后，实体 INSERT 不写它们（由数据库默认 0 兜底）、实体 UPDATE 不碰它们，计数只能由原子增量语句修改。

放弃的备选：`@DynamicUpdate`——只更新脏字段能缓解，但计数一旦被加入实体写路径仍有覆盖风险，且影响所有实体更新行为。

### D2：原子增量用原生 SQL，并显式保持 `updated_at`

三条语句形如：

```sql
update posts set up_vote_count = up_vote_count + ?, updated_at = updated_at
where id = ? and deleted_at is null
```

- `列 = 列 + 增量` 是数据库侧原子运算，并发下无丢失更新。
- MySQL 在行内其它列变化时会自动刷新 `ON UPDATE CURRENT_TIMESTAMP(3)`；显式写 `updated_at = updated_at` 抑制该行为，保证互动不改变帖子的更新时间（spec「互动不刷新帖子更新时间」）。JPQL bulk update 无法可靠表达「保持列原值」，所以走 `nativeQuery = true`。
- `deleted_at is null` 是防御条件：写路径已先校验帖子存在，并发删除的窗口内更新 0 行不报错、也不产生副作用。

放弃的备选：读改写——需要悲观锁或依赖 `@Version`，热点帖会把整行锁成串行，且仍要处理版本冲突。

### D3：`@Modifying(flushAutomatically = true, clearAutomatically = true)`

`flushAutomatically` 确保互动记录先落库再改计数；`clearAutomatically` 清掉持久化上下文，避免同一事务后续读到旧的 `Post` 计数。互动响应（评论、投票、收藏详情）不含帖子计数，清理不会影响已 flush 记录的字段读取。

放弃的备选：不清理上下文——当前路径够用，但把「同事务读到旧计数」留成隐雷，代价太小不值。

### D4：读取路径删除 N+1 与 `InteractionCounts`

`countsOf(List<Post>)`、`countsOf(Post)` 与 record `InteractionCounts` 全部删除；`toView` / `toSummary` / `scoreOf` 直接读 `post.commentCount()` 等 getter。`toSummary` 中 `counts == null ? 0L : ...` 的兜底分支一并删除。三个 count 方法随引用消失一并删除，避免留下无人调用的「实时聚合」入口。

### D5：排序查询切列，游标语义不变

四个 JPQL 查询把 `(select count(...) ...)` 换成 `p.upVoteCount` / `p.commentCount`，游标条件保持字典序：

```
p.upVoteCount < :upVoteCount
or (p.upVoteCount = :upVoteCount and (p.publishedAt < :publishedAt
    or (p.publishedAt = :publishedAt and p.id < :id)))
```

`FeedCursor` 的 score 仍编码计数列的值；因为写侧同步后计数列等于实时聚合值，旧游标在新实现下语义一致。

### D6：写侧增减对照表

| 写路径 | 触发条件 | `comment_count` | `up_vote_count` | `bookmark_count` |
|---|---|---|---|---|
| `createComment` | 保存成功 | +1 | — | — |
| `deleteComment` | 软删除成功 | −1 | — | — |
| `vote` 新建 | `direction = up` | — | +1 | — |
| `vote` 新建 | `direction = down` | — | 0 | — |
| `vote` 换向 | up → down | — | −1 | — |
| `vote` 换向 | down → up | — | +1 | — |
| `vote` 换向 | 同向 | — | 0 | — |
| `cancelVote` | 原方向 `up` | — | −1 | — |
| `cancelVote` | 原方向 `down` | — | 0 | — |
| `bookmark` 新建 | 无有效收藏 | — | — | +1 |
| `bookmark` 已存在 | 幂等返回 | — | — | 0 |
| `cancelBookmark` | 软删除成功 | — | — | −1 |

换向的差额在内存中由「旧方向、新方向」算出，再发一条带正负号的原子增量；不做两次更新。

### D7：回填 SQL 一次性执行，不放进 `schema.sql`

`schema.sql` 每次启动都会执行，把全表重算放进去等于每次启动扫三张互动表，且会覆盖启动期间的真实增量。回填与校验作为一次性脚本放进 `scripts/`（或实施任务中的文档化步骤），执行后必须跑校验查询且返回 0 行：

```sql
select count(*) from posts p
where p.up_vote_count <> (select count(*) from post_votes v where v.post_id = p.id and v.direction = 'up' and v.deleted_at is null)
   or p.comment_count <> (select count(*) from post_comments c where c.post_id = p.id and c.deleted_at is null)
   or p.bookmark_count <> (select count(*) from post_bookmarks b where b.post_id = p.id and b.deleted_at is null);
```

## Risks / Trade-offs

- [旧数据计数为 0 导致排序与统计错误] → 迁移步骤强制回填 + 校验 SQL 返回 0 行后才切换；生产当前无数据，若上线时已有数据同样先回填。
- [实体只读映射后，`publish` 返回的计数依赖默认值] → 数据库默认 0 + 实体字段原始类型默认 0，双保险；`PostControllerTest` 已断言新帖三计数为 0。
- [原生 SQL 绕过 Hibernate 的审计列] → 语句只改计数列并保持 `updated_at`，不触碰 `version`、`deleted_at` 等列；`version` 不递增是有意为之（计数非业务状态）。
- [并发下事务未提交时读到旧计数] → 属于隔离级别的正常表现；提交后一致，规格只要求写后读一致。
- [CHECK 负数导致互动失败] → 逻辑上增量与记录同事务成对出现，不会越过 0；CHECK 是兜底，一旦触发即回滚整笔互动，不会留下单侧生效。
- [测试库已有旧数据未回填] → 测试用例自建帖子与互动，计数由写侧同步；迁移验证用演示库执行回填与校验。

## Migration Plan

1. 确认前置 `add-post-count-columns` 已合入，本地库已有三列（否则先重建或 `ALTER TABLE posts`）。
2. 执行回填 SQL，再执行校验 SQL，确认不一致行数为 0。
3. 部署后端：实体只读映射 → 排序查询切列 → 读取去 N+1 → 写侧同步（同一提交内完成，避免中间态）。
4. 回滚策略：代码回滚即可；计数列保留无害（旧代码不读），回填结果也不影响旧逻辑。

## Open Questions

| 问题 | 现状 |
|---|---|
| 是否需要定时对账任务修复极端场景下的漂移 | 本阶段不做；先靠同事务与 CHECK，出现真实漂移再单开 change |
| 回填脚本是否纳入 `scripts/` 的通用造数入口 | 实施时按现有脚本风格决定；不影响规格与任务拆分 |
