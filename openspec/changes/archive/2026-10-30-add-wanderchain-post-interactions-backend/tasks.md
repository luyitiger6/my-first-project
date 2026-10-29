# Tasks

## 1. 数据库表结构

- [x] 1.1 在 `backend/src/main/resources/schema.sql` 追加 `post_comments`、`post_votes`、`post_bookmarks` 三张表，含公共八列、外键、生成列唯一约束及索引。验证：启动后端，MySQL 元数据确认三表存在。
- [x] 1.2 验证 schema.sql 幂等：停止并重启后端，日志无 `Table already exists` 外报错，表结构不变。

## 2. 领域模型与仓储

- [x] 2.1 创建 `backend/src/main/java/com/luyi/myfirst/dao/post/entity/Comment.java`，继承 `BaseEntity`，含 `postId`、`authorId`、`content`、`parentId`。验证：编译通过。
- [x] 2.2 创建 `backend/src/main/java/com/luyi/myfirst/dao/post/entity/Vote.java`，继承 `BaseEntity`，含 `postId`、`authorId`、`direction`（默认 up）。验证：编译通过。
- [x] 2.3 创建 `backend/src/main/java/com/luyi/myfirst/dao/post/entity/Bookmark.java`，继承 `BaseEntity`，含 `postId`、`authorId`。验证：编译通过。
- [x] 2.4 创建三个 Repository 接口：`CommentRepository`、`VoteRepository`、`BookmarkRepository`，支持按 postId 软删除计数、按 (postId, authorId) 查有效记录。验证：`harness/checks/01-compile.ps1` 退出码 0。

## 3. Service 层

- [x] 3.1 创建 `backend/src/main/java/com/luyi/myfirst/service/post/interaction/PostInteractionService.java` 接口，声明评论/投票/收藏的创建、删除、计数方法。验证：编译通过。
- [x] 3.2 创建 `impl/PostInteractionServiceImpl.java` 实现上述接口，含作者判定、软删除、幂等收藏。验证：`PostInteractionServiceTest` 全部通过。
- [x] 3.3 扩展 `PostService.feed` 签名接受 `sortBy` 参数，并返回带 `commentCount`/`upVoteCount`/`bookmarkCount` 的 `PostSummary`。验证：`PostServiceTest` 全部通过。

## 4. Web 与 DTO

- [x] 4.1 创建 `backend/src/main/java/com/luyi/myfirst/web/post/interaction/` 包与 DTO（`CommentCreateRequest`、`CommentResponse`、`VoteCreateRequest`、`VoteResponse`、`BookmarkResponse`）。验证：编译通过。
- [x] 4.2 创建 `PostInteractionController`，暴露 `POST /api/posts/{publicId}/comments`、`DELETE /api/posts/{publicId}/comments/{commentPublicId}`、`POST /api/posts/{publicId}/votes`、`DELETE /api/posts/{publicId}/votes`、`POST /api/posts/{publicId}/bookmarks`、`DELETE /api/posts/{publicId}/bookmarks`。验证：端点映射正确。
- [x] 4.3 扩展 `PostController.feed` 接收 `sortBy` 查询参数，并扩展 `PostSummaryResponse` 与 `PostFeedResponse` 以包含统计字段和 `sortBy` 相关游标。验证：`PostControllerTest` 全部通过。
- [x] 4.4 更新 `AuthInterceptor` 的公开路径配置，确保互动写端点默认受保护。验证：`AuthRouteMatrixTest` 全部通过。

## 5. 游标与排序

- [x] 5.1 扩展 `FeedCursor` 记录携带 `sortBy` 与对应排序键值，更新编解码逻辑，非法游标仍抛 `VALIDATION_FAILED`。验证：`FeedCursorTest` 通过（或 `PostServiceTest` 中非法游标用例）。
- [x] 5.2 在 `PostRepository` 新增 `findFeedByUpVoteCount` 与 `findFeedByCommentCount` 查询，支持 keyset 分页。验证：`PostServiceTest` 中热度/评论排序分页用例通过。

## 6. 前端契约

- [x] 6.1 更新 `frontend/lib/contracts/posts.ts`，在 `PostSummaryResponse` 追加 `commentCount`、`upVoteCount`、`bookmarkCount`。验证：`harness/checks/10-contract-check.ps1` 退出码 0。
- [x] 6.2 在 `frontend/lib/contracts/posts.ts` 为 feed 端点追加 `sortBy` 查询参数类型（如 `PostSortBy`）。验证：TS 编译通过。

## 7. 测试

- [x] 7.1 编写 `PostInteractionServiceTest`，覆盖评论创建/删除/列表、投票/取消、收藏/取消及非作者拒绝场景。验证：`harness/checks/02-test.ps1` 退出码 0。
- [x] 7.2 编写 `PostInteractionControllerTest`，覆盖互动端点的 HTTP 状态码、错误码与来源校验。验证：`harness/checks/02-test.ps1` 退出码 0。
- [x] 7.3 扩展 `PostServiceTest` 与 `PostControllerTest`，覆盖排序切换、不同排序游标不混用、列表项含统计字段。验证：`harness/checks/02-test.ps1` 退出码 0。

## 8. 全量验收

- [x] 8.1 运行 `harness/run-all.ps1`，退出码 0。验证：所有闸门 PASS。
- [x] 8.2 运行 `openspec validate "add-wanderchain-post-interactions-backend" --strict`，退出码 0。

## Workflow follow-up

- 人工审阅本 change 的 proposal/specs/design/tasks。
- 审阅通过后执行 `/opsx:apply` 实施任务。
- 实施完成并跑通 `harness/run-all.ps1` 后归档 change。
