# Requirement → 测试 / 闸门映射

本文件把 `specs/wanderchain-posts/spec.md` 的 10 条 Requirement / 30 个 Scenario
逐项钉到代码或闸门的具体位置，没有「仅口头覆盖」的项。

| Req | Scenario | 覆盖位置 |
|---|---|---|
| R1 帖子的对外标识与软删除 | 响应只出现对外标识 | `PostControllerTest.responseFieldsMatchWhitelist`（白名单双向差集为空）<br>`PostServiceTest.publishBindsAuthorToToken`（`publicId` 为 26 字符 ULID） |
| R1 | 删除是软删除 | `PostServiceTest.authorDeleteIsSoft`（删除后按未删除条件查不到，但行仍在）<br>`PostRepositoryTest.softDeletedPostIsInvisibleButRowSurvives`（库层断言） |
| R1 | 状态词表只有两值 | `PostStatus` 枚举仅含 `DRAFT`/`PUBLISHED`；`PostStatusConverter` 映射<br>`06-schema-check.ps1` 断言 `ck_posts_status` 约束 |
| R2 发布帖子需登录且作者取自令牌 | 未登录发帖被拒 | `PostControllerTest.unauthenticatedPostIsRejected`（401 + `UNAUTHENTICATED`） |
| R2 | 登录后发帖成功 | `PostControllerTest.createPost`（201 + 白名单字段）<br>`PostServiceTest.publishBindsAuthorToToken`（作者 = 令牌账户） |
| R2 | 请求体不得指定作者 | `PostControllerTest.requestBodyAuthorFieldIsIgnored`（请求体塞 `authorPublicId` 被忽略）<br>`PostServiceTest.authorComesFromTokenNotPayload`（换令牌则作者变） |
| R3 编辑与删除仅限作者本人 | 作者编辑成功 | `PostServiceTest.authorEditsOwnPost`<br>`PostControllerTest.updateAndDeletePost`（200） |
| R3 | 非作者编辑被拒 | `PostServiceTest.nonAuthorCannotEdit`（403 + `POST_FORBIDDEN`，内容不变） |
| R3 | 非作者删除被拒 | `PostServiceTest.nonAuthorCannotDelete`（403 + `POST_FORBIDDEN`，帖子仍可读） |
| R3 | 目标不存在时的判定次序 | `PostServiceTest.missingPostIsNotFoundNotForbidden`（404 先于 403） |
| R4 列表公开且只含已发布 | 游客可读列表 | `PostServiceTest.guestReadsFeed`<br>`PostControllerTest.readAndFeedArePublic`（GET 不带令牌 200） |
| R4 | 草稿不出现在列表 | `PostServiceTest.draftsNeverReachFeed` |
| R4 | 分页以游标继续 | `PostServiceTest.keysetPagingDoesNotRepeatOrSkip`（翻页途中新增不重复/不遗漏）<br>`PostRepositoryTest.keysetPagingIsStableAtSameMillisecond`（同毫秒边界） |
| R4 | 偏移量分页不被接受 | `PostControllerTest.offsetParameterIsIgnored`<br>`PostServiceTest.brokenCursorIsRejected`（非法游标 400） |
| R5 详情公开且草稿对他人不可见 | 游客读已发布详情 | `PostServiceTest.guestReadsPublishedDetail`<br>`PostControllerTest.readAndFeedArePublic` |
| R5 | 游客读草稿得到未找到 | `PostServiceTest.guestReadingDraftGetsNotFound`（404 非 403） |
| R5 | 作者读自己的草稿 | `PostServiceTest.authorReadsOwnDraft` |
| R5 | 已删除的帖子不可读 | `PostServiceTest.deletedPostIsUnreadableForEveryone`（含原作者） |
| R6 读公开写受保护且默认拒绝 | 未登记的写方法默认受保护 | `AuthRouteMatrixTest.unregisteredApiPathIsDeniedByDefault`（`/api/anything` 401）<br>`AuthRouteMatrixTest.endpointsKeepTheirOwnership` 对 `POST /api/auth/logout` 等受保护端点 |
| R6 | 公开读不需要令牌 | `AuthRouteMatrixTest.endpointsKeepTheirOwnership` 对公开 GET 端点<br>`PostControllerTest.readAndFeedArePublic` |
| R6 | 既有认证端点的归属不变 | `AuthRouteMatrixTest.endpointsKeepTheirOwnership`（九宫格逐行） |
| R7 帖子写请求继承来源校验 | 跨站发帖被拒且先于认证 | `PostControllerTest.crossSiteWriteWithoutTokenIsForbidden`（403 + `CROSS_SITE_REJECTED`，不是 401） |
| R7 | 同源发帖不受干扰 | `PostControllerTest.sameSiteWriteWithoutTokenIsUnauthorized`（同源缺令牌进认证判定，返回 401）<br>`PostControllerTest.createPost`（同源 + 令牌 → 201） |
| R8 响应字段为白名单且不含实体 | 字段集合等于白名单 | `PostControllerTest.responseFieldsMatchWhitelist`（详情 = 白名单，列表项 ⊂ 白名单） |
| R8 | 审计与并发字段不外泄 | `PostControllerTest.responseFieldsMatchWhitelist`（显式断言不含 `id`/`deletedAt`/`version`/`createdBy`/`updatedBy`/`publishedAt`） |
| R9 帖子错误码取自固定集合 | 错误响应结构一致 | `PostControllerTest.crossSiteWriteWithoutTokenIsForbidden`<br>`PostControllerTest.sameSiteWriteWithoutTokenIsUnauthorized`<br>`PostControllerTest.unauthenticatedPostIsRejected`（均断言 `$.code`） |
| R9 | 错误码取自固定集合 | `PostErrorEnumTest.postErrorCodesAreExactlyTwo`<br>`PostErrorEnumTest.sharedCodesAreReusedFromAuthSide`<br>`PostErrorEnumTest.authErrorCodesAreUntouched` |
| R10 帖子入参校验 | 空标题被拒 | `PostServiceTest.blankTitleIsRejected`（只含空白也算空，不写库） |
| R10 | 超长正文被拒 | `PostServiceTest.contentByteBoundary`（65535 通过、65536 被拒且不写库） |
| R10 | 标签去重后保存 | `PostServiceTest.duplicateTagsAreDeduplicatedBeforePersist`（清缓存后重读仍去重）<br>`PostServiceTest.tagCountBoundary`（最多 10 个）<br>`PostServiceTest.tagLengthBoundary`（32 通过/33 与空标签被拒）<br>`PostServiceTest.coverImageRules`（封面 http(s) 校验） |

## 跨 Requirement 的闸门覆盖

| 闸门 | 覆盖范围 |
|---|---|
| `06-schema-check.ps1` | R1 状态词表（`ck_posts_status`）、R1 软删除（`deleted_at` 列与 `findByPublicIdAndDeletedAtIsNull` 语义）、R10 标签 JSON 列；同时断言 `posts` 表、`uk_posts_public_id`/`idx_posts_feed`/`idx_posts_author` 索引与 `fk_posts_author`/`ck_posts_version` 约束 |
| `10-contract-check.ps1` | R8 的字段名与类型契约：`frontend/lib/contracts/posts.ts` 与后端 `web/post/dto/*.java` 双向一致；新增/删除字段、大小写漂移、类型漂移均判红 |
| `03-static-guard.ps1` | 全量测试未被 `@Disabled`/`it.skip` 等跳过写法伪造；无 `TODO/FIXME` 占位交付 |
| `07-doc-consistency.ps1` | 本 change 对 `AGENTS.md` 目录树与命令速查的更新已同步 |
| `01-compile.ps1` / `02-test.ps1` | 所有上述 Java 测试在真实 MySQL 8806 / Redis 6606 上通过 |
| `04-frontend.ps1` | `frontend/lib/contracts/posts.ts` 通过 `npx tsc --noEmit` 与前端构建 |

## 未覆盖声明

- 无。30 个 Scenario 均已在代码或闸门中找到具体锚点。
