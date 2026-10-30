# Proposal

## Why

后端已为帖子提供评论、投票、收藏能力，列表响应也包含互动统计与多排序支持。当前前端首页 `HotPosts` 仍以纯文字展示评论/浏览量，没有图标化互动统计，也没有独立的帖子广场页面供用户按最新/最热/最多讨论浏览。本 change 把互动数据可视化，并新增 `/posts` 列表页承载无限滚动与排序切换。

## What Changes

- **MODIFIED** `wanderchain-homepage`：首页 `HotPosts` 区块的列表项底部改为图标化互动统计行（点赞/评论/收藏），并在区块头部增加「View all posts」入口。
- **新增** `wanderchain-post-feed` 能力：新建 `/posts` 页面，含排序 Tab（最新 | 最热 | 最多讨论）、帖子卡片列表、`IntersectionObserver` 无限滚动、骨架屏与到底提示。
- 新增/复用前端组件：`PostCard`、`PostCardStats`、`PostList`、`SortTabs`、`PostCardSkeleton`、`useInfinitePosts`。
- 更新 `frontend/lib/home/repository.ts` 与类型契约，支持游标分页与 `sortBy` 参数；真实 API 未接入前用 mock 仓储实现。

## Capabilities

### New Capabilities

- `wanderchain-post-feed`：帖子广场页面 `/posts`，支持排序切换、游标分页、无限滚动与互动统计展示。

### Modified Capabilities

- `wanderchain-homepage`：首页 `HotPosts` 区块的卡片展示增加图标化互动统计行，并链接到 `/posts`。

## Impact

- 前端：新增 `app/posts/page.tsx`、`app/posts/page.module.css`；新增/修改 `components/home/` 或 `components/posts/` 下组件；更新 `lib/home/types.ts`、`lib/home/repository.ts`、`lib/home/mock-data.ts`。
- 测试：新增/扩展组件测试与页面测试，覆盖排序切换、无限滚动、骨架屏、空态、错误态。
- 样式：遵循 `styling-conventions.md`，新增 CSS Module 断点需同步 `docs/specs/wanderchain/` 单元文档与 `08-spec-doc-breakpoints.ps1` 配对表。
- 依赖：零新增第三方依赖，图标用 inline SVG 实现。
