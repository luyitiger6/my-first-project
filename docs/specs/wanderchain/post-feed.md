# Post feed · 帖子广场

| 项 | 值 |
|---|---|
| 单元编号 | Post feed |
| 归属能力 | `wanderchain-post-feed` |
| 对应主 spec | `openspec/specs/wanderchain-post-feed/spec.md` |
| 规格层级 | 人读契约。已归档行为以主 spec 为准；本轮真实数据迁移以已审阅的在飞变更 delta 为准，归档后同步主 spec |
| 单元性质 | 客户端无限滚动帖子列表页 |

---

## 1. 模块边界

界面标签和状态文案使用英文；帖子标题、标签和作者标识直接展示真实接口内容，不翻译或替换为 Mock 英文字段。日期按 `en-US` 格式化并标注 `Created`，数据来自创建时间，不冒称发布时间。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 排序 Tab | `latest` / `hottest` / `mostDiscussed`，默认 `latest`，同步 URL `sortBy` |
| 2 | 真实帖子卡片 | 标题链接、封面/占位、标签、Author ID、创建时间、赞成票/评论/收藏统计 |
| 3 | 无限滚动 | `IntersectionObserver` 监听 sentinel，自动加载下一页 |
| 4 | 三态 | 加载态、错误态（可重试）、空态 |
| 5 | 分页反馈 | 加载中骨架屏、无更多数据到底提示、分页错误重试 |
| 6 | 日期与计数格式化 | 复用 `formatDate`（英文月日、Asia/Shanghai）与 `formatCount`（英文数字格式） |
| 7 | 详情入口 | 标题链接使用真实 `publicId`，保留经过验证的 UI `sortBy` |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 详情正文及评论/回复/本人删除/投票/收藏 UI | 本轮详情互动单元负责，广场只提供入口和公开统计 |
| 发帖/编辑帖子、评论编辑、评论投票、收藏列表、作者资料 API | 本轮范围外 |
| 虚构摘要、作者姓名、城市、浏览数、发布时间 | 不补假字段，不以 Mock 兜底 |
| 城市过滤与首页 Mock 迁移 | 广场读取真实已发布列表，首页 HotPosts 仍独立使用 Mock |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 帖子数据 | **需要 API（已接入）**：`postsApi.feed` → 同源 `GET /api/posts` | `PostFeedResponse` 经显式适配为 `PostPage`，不消费首页 Post |
| 当前排序 | **静态规则 + URL 查询参数**（`sortBy`） | `latest/hottest/mostDiscussed`；缺失或未知值按 latest 处理 |
| 日期与计数格式 | **静态工具函数**（`lib/home/format.ts`） | 纯格式化复用，无首页仓储依赖 |
| 首页 HotPosts | **Mock 契约**，独立于本页 | 仅通过 View all posts 进入真实广场，既有首页卡片不自动迁移 |

### 1.4 与其他单元的关系

- **依赖**：`wanderchain-posts` 真实列表端点、`lib/contracts/posts.ts` 镜像、`lib/posts/` 请求和 UI 类型；共享页头页脚、容器和纯格式化工具。
- **被依赖**：首页 HotPosts 的 `View all posts` 仍链接 `/posts?sortBy=hottest`。
- **衔接**：真实标题链接至 `/posts/{publicId}?sortBy={合法 UI 词}`。详情互动后返回广场须保留排序并重读统计，该跨页场景在任务 7.2 验收；当前卡片链接测试不证明详情正文已可用。

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 渲染页面**
- When 用户访问 `/posts`
- Then 页面渲染标题、排序 Tab 及当前加载/错误/列表状态
- And 仅在 `nextCursor` 非空时渲染分页 sentinel

**S2 · 默认排序**
- When 用户首次访问 `/posts` 且无 `sortBy` 参数
- Then `latest` Tab 高亮，发出 `GET /api/posts?sortBy=publishedAt&limit=20`

**S3 · 切换排序**
- When 用户点击 `hottest` / `mostDiscussed` Tab
- Then URL 保留 UI 排序词与其它查询参数，HTTP 分别使用 `upVoteCount/commentCount`，旧列表和游标清空
- And 旧请求被取消并按递增代次失效，迟到结果不能覆盖新列表或新游标

**S4 · 卡片字段完整**
- When 帖子列表渲染完成
- Then 展示真实标题、可用封面、接口顺序标签、Author ID、Created 时间及三项 outline 图标统计
- And Author ID 默认前 6 位/后 4 位缩略，原生 details/summary 可键盘展开完整标识；标签以轻量描边胶囊自然换行

**S5 · 零互动仍展示**
- When 某条帖子互动数量均为 0
- Then 卡片仍显示对应图标与数字 0

**S6 · 滚动加载下一页**
- When 用户滚动到 sentinel 进入视口且仍有下一页
- Then 原样透传不透明 `nextCursor`，固定 limit=20，追加并按 `publicId` 去重
- And 不解析游标、不构造 offset，不在前端重新排序；重复项保持首次位置并采用最后一次内容

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
- And 重试同一排序和原游标；错误期间 IO 不自动重发，不切换为 Mock

**S12 · 详情入口与缺图**
- When 用户以键盘激活标题，或封面为空/图片加载失败
- Then 缺图显示 `No cover image`，标题链接仍指向该项真实 publicId 和合法 UI 排序

**S13 · 首页入口保持独立**
- When 用户点击首页 `View all posts`
- Then 进入 `/posts?sortBy=hottest`，读取真实最热列表；首页 Mock 卡片保持原样

**S14 · 互动后返回重读（待跨页验收）**
- When 用户在详情完成互动后返回广场
- Then 保留合法排序并重读服务端列表，不将旧统计称为最新

---

## 3. 数据结构

### 3.1 页面 Props

页面为 Next.js App Router 的 Client Component，无外部 props；排序通过 URL 查询参数获取。

### 3.2 依赖的数据类型

```ts
type PostSortBy = 'latest' | 'hottest' | 'mostDiscussed'

interface PostSummary {
  publicId: string
  title: string
  coverImage: string
  tags: string[]
  status: 'draft' | 'published'
  authorPublicId: string
  createdAt: string
  commentCount: number
  upVoteCount: number
  bookmarkCount: number
}

interface PostPage {
  items: PostSummary[]
  nextCursor: string | null
  hasMore: boolean // 仅由 nextCursor !== null 派生
}

interface PostCardProps {
  post: PostSummary
  sortBy?: PostSortBy
}
```

镜像真源是 `PostSummaryResponse`：除上述字段外还含 `updatedAt`；封面类型为 string，缺图用空字符串，不是 nullable。HTTP `PostFeedResponse` 恰含 `items/nextCursor`，没有独立 hasMore。适配层显式选择字段，不复制首页 Mock 数据。

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `publicId` | 真实对外标识 | 列表 key、去重和详情路由，禁止数字 Mock ID |
| `title` / `tags` | 接口原文、原顺序 | h3 原生链接与描边胶囊，不伪造英文摘要 |
| `coverImage` | string，空串表示缺图 | 父容器保持 3:2；失败显示占位 |
| `authorPublicId` | 真实对外标识 | Author ID 缩略/可展开文本，不当作者姓名 |
| `createdAt` | ISO 时间 | time 的 dateTime 原值，英文格式并标注 Created |
| `upVoteCount` | 非负整数，只计有效赞成票 | outline 图标 + 英文数字，零值保留 |
| `commentCount` / `bookmarkCount` | 非负整数 | 评论/收藏 outline 图标 + 英文数字 |
| `nextCursor` | 不透明 string 或 null | 原样 URLSearchParams 编码；null 才是到底 |

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
| 分页失败 | `Could not load more posts.`（role=alert） |
| 缺封面 | `No cover image` |
| 作者/时间标签 | `Author ID:` / `Created` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 页面渲染标题、排序 Tab、列表容器
- [ ] 默认 `latest` 高亮并加载
- [ ] 切换排序后清空列表并重新加载第一页
- [ ] 真实标题、封面/占位、标签、可展开作者 ID、创建时间和三个统计完整
- [ ] 不展示假摘要/作者姓名/城市/浏览数/发布时间
- [ ] 标题可键盘导航至真实 publicId，合法排序保留；缺图不阻塞链接
- [ ] 零互动显示 0 且不隐藏统计项

### 4.2 数据规则

- [ ] 已发布过滤及排序由真实列表接口承担；UI 不另造 Mock 过滤结果
- [ ] 三种 UI 排序映射实际 HTTP 词，limit=20
- [ ] 切换排序清空旧页/游标；取消加代次隔离迟到响应
- [ ] 分页原样游标、publicId 去重；连续 IO 只启动一次请求
- [ ] 首页入口和 Mock 展示不变
- [ ] 互动后返回重读统计并保留排序（任务 7.2，尚未验收）

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

- [ ] 页面/卡片/排序/Hook 测试覆盖真实字段、游标、去重、迟到隔离与错误重试
- [ ] `docs/e2e/post-feed.spec.ts` 浏览器用例及桌面/窄屏成功截图通过
- [ ] 08 文档断点闸门返回 0
- [ ] `npm run build` 通过
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 页面文件首行 `'use client'`
- 使用 `useSearchParams` 读取 `sortBy`，使用 `next/navigation` 的 `router.replace` 更新 URL
- `useSearchParams` 调用必须包裹在 `Suspense` 边界内，避免构建期 prerender 报错

### 5.2 CSS Modules 与站点令牌

样式在 `frontend/app/posts/page.module.css` 与 `frontend/components/posts/*.module.css`，取色使用 `--wc-*`，留白由 `wc-container` 唯一承担，局部限宽用 `max-inline-size`。本轮无 Tailwind、shadcn/ui 或其它 UI 库，不进行样式迁移。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/posts/post-list.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 三列网格 `grid-template-columns: repeat(3, minmax(0,1fr))` |
| `≤ 1024px` | 网格收为两列 |
| `≤ 640px` | 网格收为单列 |

页面头部在 page.module.css 中另有窄屏堆叠；卡片标签自然换行、长标识可折行。08 仅校验上述列表 CSS 的断点集合，不证明未登记的页面/卡片 CSS 或具体视觉布局；列数、留白和溢出由浏览器验收。

### 5.4 图片

- 封面使用原生 `<img>`，非 `next/image`
- 封面父容器使用 CSS `aspect-ratio: 3 / 2`，img 填满并 object-fit: cover；不以固定 HTML 高宽扭曲比例
- 空串或图片 error 后显示占位；更换封面 URL 可恢复加载
- `alt=""`（封面为装饰性图片），loading=lazy

### 5.5 与现状的差异

| # | 旧广场契约 | 本轮迁移 | 验收边界 |
|---|---|---|---|
| 1 | 首页 Mock Post、数字 id | 真实 PostSummary/publicId、postsApi.feed | 不强转或填充假字段 |
| 2 | 摘要、姓名、publishedAt | 标签、Author ID、Created | 替代 delta 承接字段/零值/统计 |
| 3 | 共享 active 布尔隔离 | 请求代次、AbortController、同步锁 | deferred 行为测试及浏览器乱序桩 |
| 4 | 无详情入口 | publicId 标题链接 | 当前只验入口，详情及跨页校准后续验收 |
| 5 | 首页与广场共用 Mock 模型 | 首页 Mock 保持独立 | 不迁移首页卡片或请求 |

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
| 真实 DTO 镜像 | `frontend/lib/contracts/posts.ts` |
| 帖子 UI 类型与端点 | `frontend/lib/posts/types.ts`、`frontend/lib/posts/posts-api.ts` |
| 首页独立 Mock（不消费） | `frontend/lib/home/repository.ts`、`frontend/lib/home/mock-data.ts` |
| 浏览器验收 | `docs/e2e/post-feed.spec.ts`（任务 4.5） |
| IO mock | `frontend/vitest.setup.ts` |

```powershell
npm --prefix D:\my-first-project\frontend run test -- components/posts app/posts/page.test.tsx components/home/hot-posts.test.tsx lib/posts/posts-api.test.ts
powershell -File harness/checks/08-spec-doc-breakpoints.ps1
npm --prefix D:\my-first-project run test:e2e -- docs/e2e/post-feed.spec.ts
npm --prefix D:\my-first-project\frontend run build
powershell -File harness/run-all.ps1
```

### 替代 delta 场景对应

下表是验收定位清单，不代表尚未运行的浏览器场景已通过。浏览器编号对应任务 4.5 的 `post-feed.spec.ts`；局部 Vitest 已取得 6 文件/66 项退出码 0，完整回归与最终 Harness 仍待任务 7–8。

| delta Scenario | 对应验证 |
|---|---|
| 真实卡片字段完整 | post-card.test.tsx 真实字段/污染夹具；浏览器 F2/F3 |
| 图标化统计行 | post-card.test.tsx 三项统计；浏览器 F2/F3 |
| 零互动仍展示 | post-card.test.tsx 零值；浏览器 F2/F3 |
| 点击进入真实详情 | 卡片/页面 href 断言；浏览器 F2 键盘导航目标（不证明正文） |
| 封面不可用 | 卡片测试缺图/error/新 URL；浏览器 F2/F3 |
| 三种排序发出对应请求 | posts-api/page/sort-tabs 测试；浏览器 F1 |
| 翻页使用真实游标 | API/Hook/页面 IO 测试；浏览器 F4 |
| 排序切换隔离迟到结果 | Hook 旧首载成功/旧分页失败；浏览器 F6 |
| 无更多数据不重复请求 | Hook/页面空态/到底；浏览器 F4/F5 |
| 重试不丢失已有页 | Hook/页面分页 Retry；浏览器 F4 |
| 返回广场重新校准统计 | 任务 7.2 跨页集成待实施/验收，不以链接测试替代 |
| 首页入口和数据边界保持 | hot-posts.test.tsx 与页面不消费 Mock；浏览器 F7 |

旧“帖子卡片展示”和“数据契约与游标”的摘要/姓名/Mock 类型承诺明确移除；图标、零值、排序、分页、重试和状态隔离分别由上表新条款承接。其它主 spec 的页面入口、排序 Tab、状态与 IO 行为保持，不改主 spec 迁就实现。
