# Post feed · 帖子广场

| 项 | 值 |
|---|---|
| 单元编号 | Post feed |
| 归属能力 | `wanderchain-post-feed` |
| 对应主 spec | `openspec/specs/wanderchain-post-feed/spec.md` |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | 客户端无限滚动帖子列表页 |

---

## 1. 模块边界

界面语言：英文单语；卡片只渲染 `titleEn` / `summaryEn` / `authorEn`，日期按 `en-US` 格式化。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 排序 Tab | `latest` / `hottest` / `mostDiscussed`，默认 `latest`，同步 URL `sortBy` |
| 2 | 帖子卡片 | 封面、标题、摘要、作者、发布时间、点赞/评论/收藏统计 |
| 3 | 无限滚动 | `IntersectionObserver` 监听 sentinel，自动加载下一页 |
| 4 | 三态 | 加载态、错误态（可重试）、空态 |
| 5 | 分页反馈 | 加载中骨架屏、无更多数据到底提示、分页错误重试 |
| 6 | 日期与计数格式化 | `formatDate`（`MMM D`）+ `formatCount`（`en-US` 千分位） |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 帖子详情页与跳转 | 未立项 |
| 发帖、评论、点赞、收藏创建交互 | 未立项（本 change 只展示统计） |
| 真实后端 `/api/posts` | 真实 API 未接入前走 Mock 仓储 |
| 城市过滤 | 帖子广场当前展示全部已发布帖子 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 帖子数据 | **Mock 契约**（`mockRepository.feedPosts`） | 形状 `PostFeedResult<Post>` |
| 当前排序 | **URL 查询参数**（`sortBy`） | 组件通过 `useSearchParams` 读取 |
| 日期与计数格式 | 静态工具函数（`lib/home/format.ts`） | 纯函数，无副作用 |
| feed 接口 | **需要 API（本期未接）** | 本期零网络请求 |

### 1.4 与其他单元的关系

- **依赖**：`wanderchain-homepage` 的 `Post` 类型与 `HomeRepository`（`lib/home/types.ts`、`lib/home/repository.ts`）
- **被依赖**：首页 `HotPosts` 区块的「View all posts」入口链接到本页

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 渲染页面**
- When 用户访问 `/posts`
- Then 页面渲染标题、排序 Tab、帖子列表容器与 sentinel

**S2 · 默认排序**
- When 用户首次访问 `/posts` 且无 `sortBy` 参数
- Then `latest` Tab 高亮，列表按最新发布时间加载

**S3 · 切换排序**
- When 用户点击 `hottest` / `mostDiscussed` Tab
- Then URL `sortBy` 更新，原列表清空并重新加载第一页

**S4 · 卡片字段完整**
- When 帖子列表渲染完成
- Then 每张卡片同时包含封面、标题、摘要、作者、发布时间、点赞/评论/收藏图标与数量

**S5 · 零互动仍展示**
- When 某条帖子互动数量均为 0
- Then 卡片仍显示对应图标与数字 0

**S6 · 滚动加载下一页**
- When 用户滚动到 sentinel 进入视口且仍有下一页
- Then 自动请求下一页并追加到列表末尾

**S7 · 加载中展示骨架屏**
- When 下一页数据尚未返回
- Then 列表底部显示若干骨架卡片，且不重复触发请求

**S8 · 无更多数据展示提示**
- When 最后一页加载完成
- Then 列表底部显示英文到底提示，不再发起请求

### 2.2 异常路径

**S9 · 空列表**
- When 当前排序下没有任何帖子
- Then 列表区域展示英文空态文案，不展示骨架屏或到底提示

**S10 · 首次加载失败可重试**
- When 第一页数据请求失败
- Then 页面展示错误文案与重试按钮，点击后重新加载第一页

**S11 · 分页失败不清空已有数据**
- When 第 N 页请求失败（N > 1）
- Then 已加载的前 N-1 页数据保持可见，底部展示重试入口

---

## 3. 数据结构

### 3.1 页面 Props

页面为 Next.js App Router 的 Client Component，无外部 props；排序通过 URL 查询参数获取。

### 3.2 依赖的数据类型

```ts
interface Post {
  id: number
  title: string        // 中文标题（内容资产，不渲染）
  titleEn: string      // 英文标题（界面唯一可读标题）
  summaryEn: string    // 英文摘要
  author: string       // 中文作者名（内容资产，不渲染）
  authorEn: string     // 英文作者名
  city: CitySlug
  status: ContentStatus
  coverUrl: string
  commentCount: number
  viewCount: number
  upVoteCount: number
  bookmarkCount: number
  publishedAt: string
}

type PostSortBy = 'latest' | 'hottest' | 'mostDiscussed'

interface PostFeedResult<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}
```

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `titleEn` | 非空 | h3 标题 |
| `summaryEn` | 非空 | 摘要，最多两行（`-webkit-line-clamp: 2`） |
| `coverUrl` | 非空 URL | 封面图，比例 3:2 |
| `authorEn` | 非空 | 元信息首位 |
| `publishedAt` | 合法 ISO | `formatDate` → `MMM D` |
| `upVoteCount` | 非负整数 | 点赞图标 + 原值 |
| `commentCount` | 非负整数 | 评论图标 + 原值 |
| `bookmarkCount` | 非负整数 | 收藏图标 + 原值 |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| eyebrow | `Community` |
| 标题 | `All posts` |
| 加载 | `Loading posts…`（`role="status"`） |
| 错误 | `Posts could not load. Please try again.`（`role="alert"`） |
| 空态 | `No posts yet.` / `Be the first to share a route.` |
| 排序 Tab | `Latest` / `Hottest` / `Most discussed` |
| 重试按钮 | `Retry` |
| 到底提示 | `You have reached the end.` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 页面渲染标题、排序 Tab、列表容器
- [ ] 默认 `latest` 高亮并加载
- [ ] 切换排序后清空列表并重新加载第一页
- [ ] 每张卡片包含封面、标题、摘要、作者、发布时间、三个互动统计
- [ ] 零互动显示 0 且不隐藏统计项

### 4.2 数据规则

- [ ] 只展示 `status === 'published'` 的帖子
- [ ] 切换排序后旧游标不混用
- [ ] 分页追加而非覆盖

### 4.3 状态

- [ ] 首次加载展示 `role="status"` 加载提示
- [ ] 首次失败展示 `role="alert"` 错误与重试按钮
- [ ] 分页失败保留已有数据并展示重试入口
- [ ] 空态展示英文文案，不展示骨架屏或到底提示
- [ ] 无更多数据展示英文到底提示

### 4.4 无障碍与响应式

- [ ] 排序 Tab 使用 `role="tablist"` / `role="tab"` / `aria-selected`
- [ ] 列表使用 `<ul>` / `<li>`
- [ ] 封面图 `alt=""`（装饰性）
- [ ] 互动统计行带 `aria-label="Post interactions"`

### 4.5 工程

- [ ] `app/posts/page.test.tsx` 覆盖空态、加载态、错误态
- [ ] `components/posts/post-card.test.tsx` 覆盖字段渲染与零互动
- [ ] `components/posts/sort-tabs.test.tsx` 覆盖默认选中与切换
- [ ] `components/posts/use-infinite-posts.test.tsx` 覆盖游标分页、排序重置、错误重试
- [ ] `npm run build` 通过
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 页面文件首行 `'use client'`
- 使用 `useSearchParams` 读取 `sortBy`，使用 `next/navigation` 的 `router.replace` 更新 URL
- `useSearchParams` 调用必须包裹在 `Suspense` 边界内，避免构建期 prerender 报错

### 5.2 Tailwind CSS + shadcn/ui

**⚠ 现状：无 Tailwind、无 shadcn/ui**，样式在 `frontend/app/posts/page.module.css` 与 `frontend/components/posts/*.module.css`。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/posts/post-list.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 三列网格 `grid-template-columns: repeat(3, minmax(0,1fr))` |
| `≤ 1024px` | 网格收为两列 |
| `≤ 640px` | 网格收为单列；页面头部标题与 Tab 纵向堆叠 |

### 5.4 图片

- 封面使用原生 `<img>`，非 `next/image`
- 封面比例由 CSS `aspect-ratio: 3 / 2` 控制
- `alt=""`（封面为装饰性图片）

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | 新增 `/posts` 页面 | 此前无独立帖子广场 | 新增能力与路由 |
| 2 | 无限滚动 | 此前首页 `HotPosts` 为静态 Top 10 | 新增交互模式 |
| 3 | 图标化互动统计行 | 此前 `HotPosts` 为纯文本 `N comments · M views` | 复用新 `PostCardStats` 组件 |
| 4 | Tailwind + shadcn | CSS Modules 手写 | 换栈须保留语义结构 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 页面 | `frontend/app/posts/page.tsx`、`frontend/app/posts/posts-content.tsx` |
| 页面样式 | `frontend/app/posts/page.module.css` |
| 列表组件 | `frontend/components/posts/post-list.tsx` |
| 列表样式 | `frontend/components/posts/post-list.module.css` |
| 卡片组件 | `frontend/components/posts/post-card.tsx` |
| 统计行组件 | `frontend/components/posts/post-card-stats.tsx` |
| 骨架屏 | `frontend/components/posts/post-card-skeleton.tsx` |
| 排序 Tab | `frontend/components/posts/sort-tabs.tsx` |
| 无限滚动 Hook | `frontend/components/posts/use-infinite-posts.ts` |
| 数据契约 | `frontend/lib/home/types.ts`、`frontend/lib/home/repository.ts` |
| Mock 数据 | `frontend/lib/home/mock-data.ts` |
| IO mock | `frontend/vitest.setup.ts` |

```powershell
cd frontend
npx vitest run components/posts app/posts/page.test.tsx
npm run build
cd ..
powershell -File harness\run-all.ps1
```
