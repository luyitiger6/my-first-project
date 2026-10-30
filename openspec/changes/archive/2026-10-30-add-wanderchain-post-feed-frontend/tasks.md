# Tasks

## 1. 数据契约与 Mock 数据扩展

- [x] 1.1 在 `frontend/lib/home/types.ts` 的 `Post` 接口追加 `upVoteCount`、`bookmarkCount`，新增 `PostSortBy` 联合类型与 `PostFeedResult<T>` 接口。验证：`npm run test` 中类型相关测试通过。
- [x] 1.2 在 `frontend/lib/home/repository.ts` 的 `HomeRepository` 追加 `feedPosts(sortBy, cursor)` 方法，Mock 实现按 `sortBy` 内存排序并返回 `{ items, nextCursor, hasMore }`。验证：`npm run test` 通过。
- [x] 1.3 扩展 `frontend/lib/home/mock-data.ts` 的 `POSTS`，为每条记录补充 `upVoteCount` 与 `bookmarkCount`，并保证取值合理。验证：数据完整性测试通过。

## 2. 共享组件与 Hook

- [x] 2.1 创建 `frontend/components/posts/post-card-stats.tsx` 与对应 CSS Module，实现单色 outline SVG 图标行（点赞/评论/收藏）。验证：组件测试覆盖零值、正常值与 aria 标签。
- [x] 2.2 创建 `frontend/components/posts/post-card.tsx` 与 `post-card-skeleton.tsx`，展示封面、标题、摘要、作者、发布时间与互动统计。验证：渲染测试通过。
- [x] 2.3 创建 `frontend/components/posts/sort-tabs.tsx` 与对应 CSS Module，支持 `latest` / `hottest` / `mostDiscussed` 切换并同步 URL。验证：点击 Tab 后 URL 与组件高亮状态一致。
- [x] 2.4 创建 `frontend/components/posts/use-infinite-posts.ts`，封装 `IntersectionObserver`、分页状态、错误重试与排序切换重置。验证：Hook 测试覆盖首次加载、加载更多、排序重置、错误重试。

## 3. `/posts` 页面

- [x] 3.1 创建 `frontend/app/posts/page.tsx` 与 `page.module.css`，组合 `SortTabs`、`PostList`、`sentinel` 与状态提示。验证：页面可访问且无构建错误。
- [x] 3.2 创建 `frontend/components/posts/post-list.tsx`，负责渲染卡片数组、骨架屏、空态、错误态与到底提示。验证：列表测试覆盖空态、加载更多、错误重试。
- [x] 3.3 在 `frontend/vitest.setup.ts` 补充 `IntersectionObserver` mock，确保无限滚动测试在 jsdom 下可运行。验证：`npm run test` 通过。

## 4. 首页 `HotPosts` 改造

- [x] 4.1 修改 `frontend/components/home/hot-posts.tsx`，列表项 底部改用 `PostCardStats` 展示点赞/评论/收藏。验证：首页 E2E / 组件测试仍通过。
- [x] 4.2 在 `HotPosts` 区块头部增加「View all posts」链接，指向 `/posts?sortBy=hottest`。验证：链接存在且点击后导航正确。
- [x] 4.3 调整 `frontend/components/home/hot-posts.module.css`，保证新增图标行在桌面端与移动端不溢出。验证：视觉回归或截图对比通过。

## 5. 测试

- [x] 5.1 新增 `frontend/components/posts/post-card.test.tsx`， 覆盖字段渲染与零互动展示。验证：`npm run test` 通过。
- [x] 5.2 新增 `frontend/components/posts/sort-tabs.test.tsx`， 覆盖默认选中与切换。验证：`npm run test` 通过。
- [x] 5.3 新增 `frontend/components/posts/use-infinite-posts.test.tsx`，覆盖游标分页、排序重置、错误重试。验证：`npm run test` 通过。
- [x] 5.4 新增 `frontend/app/posts/page.test.tsx`，覆盖空态、加 载态、错误态。验证：`npm run test` 通过。
- [x] 5.5 扩展 `frontend/components/home/hot-posts.test.tsx`（如存在）或新增测试，覆盖互动统计行与「View all posts」链接。验证：`npm run test`  通过。

## 6. 文档与断点同步

- [x] 6.1 若 `app/posts/page.module.css` 或 `components/posts/*.module.css` 新增媒体查询断点，同步更新 `docs/specs/wanderchain/` 对应单元文档与 `harness/checks/08-spec-doc-breakpoints.ps1` 配对表。验证：`harness/checks/08-spec-doc-breakpoints.ps1` 退出码 0。
- [x] 6.2 更新 `frontend/lib/contracts/posts.ts` 中的 `PostSummaryResponse`，追加 `commentCount`、`upVoteCount`、`bookmarkCount` 与 `PostSortBy`，保持与后端 DTO 镜像。验证：`harness/checks/10-contract-check.ps1` 退出码 0。

## 7. 全量验收

- [x] 7.1 运行 `harness/run-all.ps1`，退出码 0。验证：所有闸门 PASS。
- [x] 7.2 运行 `openspec validate "add-wanderchain-post-feed-frontend" --strict`，退出码 0。

## Workflow follow-up

- 人工审阅本 change 的 proposal/specs/design/tasks。
- 审阅通过后执行 `/opsx:apply` 实施任务。
- 实施完成并跑通 `harness/run-all.ps1` 后归档 change。
