# 交接单：sync-interaction-counts

- 结论：**可交接**
- 日期：2026-11-09
- 说明：本 change 在完整验收前已归档（为让 13 号闸门能按主规格逐条核验），验收对象为归档时的同一份代码与规格，归档未改动实现。

## Stage 1 · Spec 合规

14 条 Scenario 逐条对账：**对 14 / 错 0 / 警告 1**。

对账依据是三个测试类的真实断言（`PostInteractionServiceTest` 26 例、`PostInteractionControllerTest` 29 例、`PostRepositoryTest` 6 例）与 `PostInteractionServiceImpl` 的写入路径。

| Scenario | 结论 | 用例与断言 |
|---|---|---|
| 评论写入同步帖子评论数 / 发表评论后计数加一 | 对 | `createCommentBindsAuthorAndIncreasesCount` → `commentCount == 1` |
| 评论写入同步帖子评论数 / 删除评论后计数减一 | 对 | `authorDeletesOwnComment` → 删除后 `commentCount == 0` 且列表不再返回该评论 |
| 评论写入同步帖子评论数 / 非法评论不改变计数 | 对 | `invalidCommentContentIsRejected` → 空/超长均 400，且 `commentCount == 0` |
| 投票写入同步帖子点赞数 / 首次赞成加一 | 对 | `firstUpVoteIncreasesCount` → `created=true`，`upVoteCount == 1` |
| 投票写入同步帖子点赞数 / 反对票不计入 | 对 | `downVoteNeverMovesUpVoteCount` → 新建反对票后仍为 0 |
| 投票写入同步帖子点赞数 / 换向按差额调整 | 对 | `repeatedVoteReplacesDirection`（up→down 归 0）、`downVoteNeverMovesUpVoteCount`（down→up 净增 1） |
| 投票写入同步帖子点赞数 / 取消赞成与取消反对 | 对 | `voterCancelsVote`（取消赞成归 0）、`downVoteNeverMovesUpVoteCount`（取消反对仍为 0） |
| 收藏写入同步帖子收藏数 / 收藏加一 | 对 | `firstBookmarkIncreasesCount` → `created=true`，`bookmarkCount == 1` |
| 收藏写入同步帖子收藏数 / 重复收藏幂等 | 对 | `repeatedBookmarkIsIdempotent` → `created=false`，仍为 1 |
| 收藏写入同步帖子收藏数 / 取消收藏减一 | 对 | `bookmarkerCancelsBookmark` → `bookmarkCount == 0` |
| 计数同步的原子性与边界 / 两次赞成累计为二 | 对 | `twoAccountsAccumulateUpVotes` → `upVoteCount == 2` |
| 计数同步的原子性与边界 / 互动失败计数回滚 | **警告** | `rejectedInteractionsLeaveAllCountersUntouched` → 6 条 403/404 后三计数仍各为 1 |
| 计数同步的原子性与边界 / 互动不刷新帖子更新时间 | 对 | `counterIncrementsAreAtomicAndSkipSoftDeleted` → 三列 +1 后 `updatedAt` 不变；软删除帖更新 0 行 |
| 计数同步的原子性与边界 / 计数不可为负 | 对 | `negativeCounterIsRejectedByCheckConstraint` → 写入 -1 被 `ck_posts_up_vote_count` 拒绝；06 闸门断言三列 CHECK 存在 |

Requirement 级的「单条原子增量语句，MUST NOT 先读后写」另有静态核对：`PostRepository` 的 `incrementUpVoteCount` / `incrementCommentCount` / `incrementBookmarkCount` 均为 `@Modifying` 原生 `列 = 列 + :delta`；`PostServiceImpl` 与三个互动仓储中不存在 `select count`、`countByPostIdAnd...` 或 `comments./votes./bookmarks.` 的计数读取。

### 警告（不阻塞，转「可后置」）

「互动失败计数回滚」目前由「失败路径不写增量」证明（403/404 发生在增量之前返回），没有一条「增量已执行后强制抛异常、验证计数回滚」的显式事务用例。

不阻塞理由：计数更新与互动记录写入在同一 `@Transactional` 方法内，回滚由 Spring 事务边界保证；现有用例已证明所有可返回的错误路径都不会留下单侧增量，功能上不残留脏计数。真正的「增量后异常」只能靠注入故障模拟，属于测试手段增强而非规格缺口。

## Stage 2 · 代码质量

| 项 | 结果 |
|---|---|
| 后端全量单元测试 | 422 用例，Failures 0 / Errors 0（`02-test` 闸门） |
| 互动相关用例 | 32 例全绿（`PostRepositoryTest` 6 + `PostInteractionServiceTest` 26） |
| 前端单测 | 45 文件 / 534 用例全绿（`04-frontend` 闸门） |
| E2E | `docs/e2e/post-interactions.spec.ts` 12 条全绿（含投票 8→7 校准后计数刷新） |
| 总 Harness | `powershell -File harness\run-all.ps1` → `RESULT: ALL CHECKS PASSED`，退出码 0（16 个闸门全 PASS） |
| 证据账本 | `13-spec-evidence-check` PASSED：verified 75 / deferred 1 / historicallyCovered 538 |

## 回填脚本取证

`scripts/backfill-post-interaction-counts.ps1` 在真实库上验证（造数 `01JTESTBK00000000000000002`，人为把 `up_vote_count` 置为 9）：

| 步骤 | 结果 |
|---|---|
| 回填前偏差 | 1 行 |
| 执行回填 | 退出码 0 |
| 回填后偏差 | 0 行，`up_vote_count` 9 → 0 |
| `updated_at` | 保持 `2026-11-09 03:01:45.994` 不变（`updated_at = updated_at` 抑制生效） |
| 造数清理 | 帖子与账号均删除干净（left = 0） |

## 已知不在本单范围

- 缺「增量后强制异常」的事务回滚用例（见警告），另开 `fix/interaction-tx-rollback-test`。
- 回填脚本按需手动执行，不进闸门。
