# Tasks

## 1. 实体与仓储

- [x] 1.1 `dao/post/entity/Post` 新增 `upVoteCount`、`commentCount`、`bookmarkCount` 三个 `int` 字段，映射为 `@Column(name = "...", nullable = false, insertable = false, updatable = false)` 并提供同名 getter；验证：应用启动成功，新帖详情返回三个计数均为 0，且 `Post` 的实体 UPDATE 不包含这三列
- [x] 1.2 `dao/post/repository/PostRepository` 的四个排序查询改为 `order by p.upVoteCount` / `p.commentCount`，游标条件改为对计数列的字典序比较，删除全部 `select count(...)` 子查询；验证：文件中不再出现 `select count`，`sortBy=upVoteCount` 与 `commentCount` 的列表排序测试通过
- [x] 1.3 同仓储新增三条原生增量语句（`up_vote_count` / `comment_count` / `bookmark_count`），均为 `列 = 列 + :delta`、`updated_at = updated_at`、`where id = :id and deleted_at is null`，并标注 `@Modifying(flushAutomatically = true, clearAutomatically = true)`；验证：仓储级测试断言 +1 与 -1 生效、`updatedAt` 前后相同、已软删除帖子更新 0 行
- [x] 1.4 删除 `CommentRepository.countByPostIdAndDeletedAtIsNull`、`VoteRepository.countByPostIdAndDirectionAndDeletedAtIsNull`、`BookmarkRepository.countByPostIdAndDeletedAtIsNull`；验证：`mvn -f backend/pom.xml -q compile` 通过，且全仓 grep 这三个方法名无残留引用

## 2. 读取路径

- [x] 2.1 `service/post/impl/PostServiceImpl` 删除 `countsOf(List)`、`countsOf(Post)` 与 `InteractionCounts`，`toView`、`toSummary`、`scoreOf` 改读 `post.commentCount()` 等 getter，删除 `counts == null` 兜底与不再使用的 import；验证：`PostControllerTest` 与 `PostInteractionServiceTest` 的列表、详情计数断言通过
- [x] 2.2 列表页不再产生逐帖聚合；验证：`PostServiceImpl` 中不再出现 `comments.count`、`votes.count`、`bookmarks.count`，且列表请求的 SQL 只查 `posts` 与作者

## 3. 写路径

- [x] 3.1 `service/post/interaction/impl/PostInteractionServiceImpl` 的 `createComment` 与 `deleteComment` 在记录建立/软删除后调用评论计数增量（+1 / -1）；验证：测试断言创建后 `commentCount` 加 1、删除后减 1、非法内容被拒时计数不变
- [x] 3.2 同类的 `vote`：新建按方向决定 +1 或 0；换向按「旧方向、新方向」算差额（up→down 为 -1，down→up 为 +1，同向为 0），只发一条增量；验证：五种投票场景的 `upVoteCount` 断言全部通过
- [x] 3.3 同类 `cancelVote` 按原方向 -1（赞成）或 0（反对）；`bookmark` 新建 +1、已存在幂等为 0；`cancelBookmark` 软删除后 -1；验证：取消赞成/反对、重复收藏、取消收藏四类断言通过
- [x] 3.4 计数更新与互动记录写入保持同一事务；验证：构造 403/404 失败路径后，三个计数列均与操作前相同（新增用例断言回滚）

## 4. 迁移与集成

- [x] 4.1 新增一次性回填与校验 SQL（`scripts/` 下脚本或文档化命令）：按互动表重算三列，校验查询返回不一致行数；验证：本地库执行后校验查询返回 0
- [x] 4.2 后端全量测试通过；验证：`mvn -f backend/pom.xml test` 退出码 0
- [x] 4.3 change 工件自洽；验证：`openspec validate sync-interaction-counts` 返回 valid，delta 的 Scenario 均使用 4 个 `#`

## Workflow follow-up

- 归档后把本 change 新增的 Scenario 登记进 `docs/spec-evidence.json`，并跑 `powershell -File harness\checks\13-spec-evidence-check.ps1`。
- 归档后跑 `powershell -File harness\checks\10-contract-check.ps1`，确认无 DTO 变更时契约闸门仍通过。
- 集中验收时跑 `powershell -File harness\run-all.ps1` 与 `docs/e2e` 的帖子互动用例。
