# Design

## Context

当前首页 `HotPosts` 组件使用 `frontend/lib/home/repository.ts` 的 `HomeRepository.listHotPosts` 返回 `{ items, total }`，排序与截断均由 Mock 仓储完成。帖子类型 `Post` 已包含 `commentCount` 与 `viewCount`，但缺少 `upVoteCount` 与 `bookmarkCount`。后端 `add-wanderchain-post-interactions-backend` 变更完成后，帖子列表将支持按 `latest` / `hottest` / `mostDiscussed` 排序并返回游标分页结果。本设计在前端落地这些新能力，先以 Mock 实现保证首页与 `/posts` 页面可独立开发、独立测试。

## Goals / Non-Goals

**Goals：**
- 新增 `/posts` 页面，支持排序 Tab、无限滚动、图标化互动统计。
- 扩展首页 `HotPosts` 卡片，追加点赞/评论/收藏图标行与「View all posts」入口。
- 统一帖子 feed 数据契约，使 Mock 与真实 API 可互换而不改组件。
- 图标使用单色 outline SVG，不引入第三方图标库。

**Non-Goals：**
- 不实现投票/收藏/评论的创建交互（这些由后端 change 提供端点，但本 change 只展示统计）。
- 不接入真实后端 `/api/posts`（真实 API 未就绪前走 Mock）。
- 不改动首页其他区块或全局路由结构。

## Decisions

### D1：组件拆分

- `PostCard`：帖子卡片，展示封面、标题、摘要、作者、发布时间、互动统计行。
- `PostCardStats`：图标化互动统计行（点赞/评论/收藏），纯展示。
- `PostList`：列表容器，负责渲染 `PostCard` 数组、骨架屏、空态与到底提示。
- `SortTabs`：排序 Tab，管理 `latest` / `hottest` / `mostDiscussed` 状态与 URL 同步。
- `PostCardSkeleton`：骨架屏卡片，与真实卡片占位一致。
- `useInfinitePosts`：自定义 Hook，封装 `IntersectionObserver`、分页状态、错误重试与排序切换重置。

**理由**：把无限滚动逻辑收拢到 Hook，把渲染与交互状态分离，便于单元测试与后续替换真实数据源。

### D2：数据契约扩展

- 在 `frontend/lib/home/types.ts` 的 `Post` 接口追加 `upVoteCount`、`bookmarkCount`。
- 新增 `PostSortBy = 'latest' | 'hottest' | 'mostDiscussed'` 与 `PostFeedResult<T>`：
  ```ts
  export interface PostFeedResult<T> {
    items: T[]
    nextCursor: string | null
    hasMore: boolean
  }
  ```
- 在 `HomeRepository` 新增 `feedPosts(sortBy, cursor): Promise<PostFeedResult<Post>>`。
- Mock 实现按 `sortBy` 在内存排序并生成下一页游标（例如 Base64 编码的 `sortBy:offset`）。

**理由**：`Post` 类型与 `HomeRepository` 是首页与帖子广场共享的契约；新增 `feedPosts` 不破坏既有 `listHotPosts`。

### D3：游标 Mock 策略

- Mock 游标编码为 JSON 字符串的 Base64，包含 `sortBy` 与 `offset`。
- 解码后若 `sortBy` 与当前请求不一致，视为非法游标并抛出错误（模拟后端对跨排序游标的拒绝）。

**理由**：保证组件层对非法/过期游标的处理路径可被测试覆盖，且与后端 change 的「不同排序游标不混用」规则一致。

### D4：无限滚动实现

- 列表底部放置不可见的 `sentinel` div。
- `useInfinitePosts` 内使用 `IntersectionObserver` 监听 `sentinel`；当 `hasMore` 为真且不在加载中时触发 `loadMore`。
- 请求期间设置 `isLoadingMore` 锁，避免重复触发。
- 组件卸载或排序切换时取消未完成的请求（通过 `active` 标志）。

**理由**：`IntersectionObserver` 是浏览器原生能力，无需引入滚动库；在 jsdom 测试中可用 `IntersectionObserver` mock 或手动触发回调验证。

### D5：URL 与排序状态同步

- 默认路由 `/posts` 等价于 `/posts?sortBy=latest`。
- `SortTabs` 使用 `next/navigation` 的 `useSearchParams` 读取当前排序，点击时调用 `router.replace` 更新 URL。
- `useInfinitePosts` 以 `sortBy` 作为依赖，切换排序时清空 `items` 并重新请求第一页。

**理由**：URL 作为排序的唯一真相源，刷新页面后状态保持，也便于分享。

### D6：首页 `HotPosts` 轻改

- 保留现有排序（评论数 > 浏览数 > 发布时间）与最多 10 条截断。
- 列表项底部从纯文本 `N comments · M views` 改为 `PostCardStats` 组件，展示点赞/评论/收藏。
- 区块头部在标题与 note 之间或右侧增加 `next/link` 链接「View all posts」，指向 `/posts?sortBy=hottest`。

**理由**：最小化首页改动，复用新增 `PostCardStats` 组件，保持视觉与交互一致性。

### D7：图标实现

- 使用 inline SVG（`<svg>` 元素），`stroke="currentColor"`、`fill="none"`，尺寸 16px。
- 三个图标语义：点赞（向上箭头/拇指）、评论（气泡）、收藏（书签）。

**理由**：项目不使用 UI 库或图标库，单色 outline SVG 与现有设计令牌兼容，无额外依赖。

### D8：样式约定

- 新增 `app/posts/page.module.css` 与 `components/posts/*.module.css`。
- 容器宽度复用 `wc-container` 全局类；内容列宽度限制使用 `max-inline-size` 而非 `max-width`，避免 `08-spec-doc-breakpoints.ps1` 误判。
- 新增断点若影响布局，同步更新 `docs/specs/wanderchain/` 对应单元文档。

**理由**：遵循项目已验证的 styling-conventions，避免类名哈希变化与断点扫描误报。

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| 后端 `/api/posts` 尚未就绪，Mock 游标格式可能与真实后端不一致 | 将游标视为不透明字符串；组件与 Hook 不解析游标，只透传给 `feedPosts` |
| `IntersectionObserver` 在 jsdom 中不存在，可能导致测试失败 | 在 `vitest.setup.ts` 提供全局 mock 或测试时手动调用回调 |
| 首页 `HotPosts` 同时显示点赞/评论/收藏，但 Mock 数据初始可能缺少新字段 | 同步扩展 `frontend/lib/home/mock-data.ts` 的 `POSTS`，为每条记录补充 `upVoteCount` 与 `bookmarkCount` |
| 新增 `/posts` 页面与首页共享 `lib/home` 类型，可能造成域边界模糊 | 后续若帖子广场独立成域，可再迁到 `lib/posts`；本 change 保持最小改动 |

## Migration Plan

1. 后端 `add-wanderchain-post-interactions-backend` 归档并落地后，再启动本 change 的 Apply。
2. Apply 阶段先扩展类型契约与 Mock 数据，再实现 `/posts` 页面，最后修改首页 `HotPosts`。
3. 真实 API 就绪时，仅替换 `HomeRepository.feedPosts` 的实现为 `fetch(POST_ENDPOINTS.feed)`，组件层不动。

## Open Questions

无。排序维度、图标风格、页面入口位置已在探索阶段确认。
