# Tasks

## 1. 后端：公开用户资料读取

- [x] 1.1 新增 `common/exception/ProfileErrorEnum`，只加 `PROFILE_NOT_FOUND("PROFILE_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND)`，沿用 `BaseError` 结构。验证：`mvn -f backend/pom.xml -q compile` 通过；该码在 1.5 的控制器测试里被断言到响应体。
- [x] 1.2 `ProfileService` 增加 `ProfileView readPublic(String publicId)`，实现走 `AccountRepository.findByPublicIdAndDeletedAtIsNull`，查不到抛 `PROFILE_NOT_FOUND`，查到复用私有 `toView`。验证：`ProfileServiceTest` 覆盖四例——存在返回四字段、已注销 404、不存在 404、未填写字段返回空串与空数组。
- [x] 1.3 新增 `web/profile/PublicProfileController`（`GET /api/profiles/{publicId}`）与 `web/profile/dto/PublicProfileResponse`（对外标识、昵称、头像、简介、兴趣标签五项，无内部字段）。验证：`mvn -f backend/pom.xml -q compile` 通过，且响应字段集合由 1.5 断言。
- [x] 1.4 `AuthInterceptor.publicRoutes()` 登记 `/api/profiles/*` 的 `GET`。验证：拦截器九宫格测试新增两行——`isPublicRoute("GET", "/api/profiles/01ABC")` 为真、`isPublicRoute("POST", "/api/profiles/01ABC")` 为假。
- [x] 1.5 新增 `PublicProfileControllerTest`：游客 200 且字段集合恰为五项、不存在 404、已注销 404、形状不合 404、三种 404 的响应体逐字相同。验证：`mvn -f backend/pom.xml test "-Dtest=PublicProfileControllerTest"` 全绿。

## 2. 后端：用户页帖子列表

- [x] 2.1 `PostRepository` 新增 `findPublishedByAuthor(Long authorId, Pageable)` 与 `findPublishedByAuthorAfter(Long authorId, Instant publishedAt, Long id, Pageable)`，条件为 `status = PUBLISHED and deletedAt is null and authorId = :authorId`，排序 `publishedAt desc, id desc`。验证：`PostRepositoryTest` 覆盖四例——作者过滤、草稿不出现、已删除不出现、游标之后不重复。
- [x] 2.2 `PostService` 增加 `PostPage feedByAuthor(String authorPublicId, String cursor, Integer limit)`：先解析作者（不存在或已注销抛 `PROFILE_NOT_FOUND`），再复用 `FeedCursor`（排序维度固定 `PUBLISHED_AT`）与既有 limit 钳制（默认 20、上限 50）。验证：`PostServiceTest` 覆盖五例——只含该用户已发布、空列表 200、未知用户 404、游标翻页、非法游标 400。
- [x] 2.3 新增 `web/profile/UserPostsController`（`GET /api/profiles/{publicId}/posts`，响应复用 `PostFeedResponse`），并在 `publicRoutes()` 登记 `/api/profiles/*/posts` 的 `GET`。验证：控制器测试覆盖 200／404／400 三态；拦截器九宫格测试新增一行 `isPublicRoute("GET", "/api/profiles/01ABC/posts")` 为真。
- [x] 2.4 `backend/src/main/resources/schema.sql` 增加 `idx_posts_author_published (author_id, status, deleted_at, published_at desc, id desc)`，并同步 `harness/checks/06-schema-check.ps1` 的索引清单。验证：`powershell -File harness\checks\06-schema-check.ps1` 退出码 0。

## 3. 前端：契约与取数

- [x] 3.1 `frontend/lib/contracts/profile.ts` 增加 `PublicProfileResponse` 与 `PROFILE_ENDPOINTS.publicProfile(publicId)`；`frontend/lib/contracts/posts.ts` 增加用户页列表端点常量（复用既有 `PostFeedResponse` 类型）。验证：`powershell -File harness\checks\10-contract-check.ps1` 退出码 0（契约对在 4.3 登记后）。
- [x] 3.2 `frontend/lib/profile/` 增加公开资料取数与视图模型：`profile-api.ts` 的 `publicProfile(publicId)`、`types.ts` 的 `PublicProfile` 与 `toPublicProfile`。实施前确认 OQ1（是否绕过 `USE_MOCK_PROFILE`）。验证：`npx vitest run lib/profile/profile-api.test.ts` 覆盖 200 映射、404 抛 `ProfileApiError(PROFILE_NOT_FOUND)`、网络错误归一化三例。
- [x] 3.3 `frontend/lib/posts/posts-api.ts` 增加 `byAuthor(publicId, cursor)`，结果复用 `toPostSummary` 与 `hasMore` 推导。验证：`npx vitest run lib/posts/posts-api.test.ts` 覆盖 URL 拼接、游标参数、错误码透传三例。
- [x] 3.4 `components/posts/post-card.tsx` 的 `AuthorArea` 在 `ready` 分支把昵称包进指向 `/users/{publicId}` 的 `Link`；`pending` 与名片缺失分支不生成链接。验证：`npx vitest run components/posts/post-card.test.tsx` 新增两例——ready 时存在 href 正确的链接、pending 时无链接。

## 4. 前端：用户页与文档

- [x] 4.1 新增 `frontend/app/users/[publicId]/page.tsx`、`user-page-content.tsx` 与 `user-page.module.css`：并行取资料与列表；资料 404 时只渲染「用户不存在」并短路列表；列表失败只在列表区给重试；列表为空展示空态；加载态展示骨架。实施前确认 OQ2（昵称为空时的兜底文案）。验证：`npx vitest run app/users/[publicId]` 覆盖五例——加载骨架、404 仅不存在态、列表失败独立重试、空列表、正常渲染四项资料与帖子卡片。
- [x] 4.2 新增 `docs/specs/wanderchain/user-page.md`（单元文档六段结构，声明断点真相源为 `user-page.module.css`），并在 `harness/checks/08-spec-doc-breakpoints.ps1` 的 `$pairs` 登记该对。验证：`powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 退出码 0 且文档数与登记数一致。
- [x] 4.3 `harness/checks/10-contract-check.ps1` 的 `$contractPairs` 追加用户页一组（`PublicProfileResponse` ↔ `frontend/lib/contracts/profile.ts`）。验证：`10` 闸门退出码 0，输出含用户页组的字段比对摘要。

## 5. 联调与验收

- [x] 5.1 真实链路自查：广场点击作者名 → 用户页展示四项资料与该用户已发布帖子 → 点进帖子详情 → 返回用户页；另测一个不存在标识直接访问得到「用户不存在」。验证：浏览器实际操作并记录截图路径；仅报告本次链路已调通，不证明其它 Scenario。
- [x] 5.2 完整验收（用户需要时集中执行）：`npx openspec validate "add-user-detail-page" --strict` 与 `powershell -File harness\run-all.ps1` 均退出码 0，先由 `spec-reviewer` 逐条对账再跑 E2E。未执行时明确后置，不得报告「完整验收通过」。
  - 2026-11-10 执行结果：`openspec validate` EXIT=0；`spec-reviewer` 对账 19 条 —— 对 17 / 错 0 / 警告 2；`harness\run-all.ps1` 16/16 PASSED（EXIT=0，207s，06 建表闸门跑前已 mysqldump 备份、跑后回灌并核对行数）。
  - E2E 回归：`post-feed` + `post-interactions` 共 21 例，18 通过 / 3 失败；3 条失败在 `main`（frontend `c317afa`）上逐条复现同样结果（post-feed 作者区 2 例停在骨架、post-interactions 375px 横向溢出 37px），属既有问题，已登记 `docs/harness-backlog.md` 2.13，不随本 change 携带。

## Workflow follow-up

- 规格与实现经人工审阅后合并到 `main`（先合前置层分支）。
- 合并后按归档流程执行 `openspec archive`，并更新 `docs/spec-evidence.json` 的本能力 Scenario 登记。
