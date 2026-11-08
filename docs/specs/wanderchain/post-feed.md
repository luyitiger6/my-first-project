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

界面标签和状态文案使用英文；帖子标题、标签和作者昵称直接展示真实接口内容，不翻译或替换为 Mock 英文字段。日期按 `en-US` 格式化并标注 `Created`，数据来自创建时间，不冒称发布时间。作者昵称与头像取自公开名片端点，任何状态都不把 26 位作者对外标识渲染给用户。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 排序 Tab | `latest` / `hottest` / `mostDiscussed`，默认 `latest`，同步 URL `sortBy` |
| 2 | 真实帖子卡片 | 标题链接、封面/占位、标签、作者昵称与头像（三态）、创建时间、赞成票/评论/收藏统计 |
| 3 | 无限滚动 | `IntersectionObserver` 监听 sentinel，自动加载下一页 |
| 4 | 三态 | 加载态、错误态（可重试）、空态 |
| 5 | 分页反馈 | 加载中骨架屏、无更多数据到底提示、分页错误重试 |
| 6 | 日期与计数格式化 | 复用 `formatDate`（英文月日、Asia/Shanghai）与 `formatCount`（英文数字格式） |
| 7 | 详情入口 | 标题链接使用真实 `publicId`，保留经过验证的 UI `sortBy` |
| 8 | 作者名片批量读取 | `use-author-cards`：按 `authorPublicId` 去重、剔除已缓存、≤50 切块、`pending / ready / missing` 三态 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 详情正文及评论/回复/本人删除/投票/收藏 UI | 本轮详情互动单元负责，广场只提供入口和公开统计 |
| 发帖/编辑帖子、评论编辑、评论投票、收藏列表 | 本轮范围外 |
| 详情与评论区的作者展示（仍渲染 26 位标识） | 阶段 2 收口，本 change 不改 `post-detail.tsx` / `post-comments.tsx` |
| 虚构摘要、作者昵称、城市、浏览数、发布时间 | 不补假字段，不以 Mock 兜底 |
| 城市过滤与首页 Mock 迁移 | 广场读取真实已发布列表，首页 HotPosts 仍独立使用 Mock |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 帖子数据 | **需要 API（已接入）**：`postsApi.feed` → 同源 `GET /api/posts` | `PostFeedResponse` 经显式适配为 `PostPage`，不消费首页 Post |
| 作者名片 | **需要 API（已接入）**：`profileApi.cards` → 同源 `GET /api/profiles?publicIds=…` | `ProfileCardListResponse` 经显式适配为 `ProfileCard`；按 `authorPublicId` 去重、≤50 切块，`pending / ready / missing` 三态 |
| 当前排序 | **静态规则 + URL 查询参数**（`sortBy`） | `latest/hottest/mostDiscussed`；缺失或未知值按 latest 处理 |
| 日期与计数格式 | **静态工具函数**（`lib/home/format.ts`） | 纯格式化复用，无首页仓储依赖 |
| 首页 HotPosts | **Mock 契约**，独立于本页 | 仅通过 View all posts 进入真实广场，既有首页卡片不自动迁移 |

### 1.4 与其他单元的关系

- **依赖**：`wanderchain-posts` 真实列表端点、`wanderchain-profile` 公开名片端点、`lib/contracts/posts.ts` / `lib/contracts/profile.ts` 镜像、`lib/posts/` / `lib/profile/` 请求与 UI 类型、`use-author-cards` 批量取数 Hook；共享页头页脚、容器和纯格式化工具。
- **被依赖**：首页 HotPosts 的 `View all posts` 仍链接 `/posts?sortBy=hottest`。
- **衔接**：真实标题链接至 `/posts/{publicId}?sortBy={合法 UI 词}`；作者区不承载跳转，标题链接仍是唯一详情入口。详情互动后返回广场须保留排序并重读统计，该跨页场景在任务 7.2 验收；当前卡片链接测试不证明详情正文已可用。

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
- Then 展示真实标题、可用封面、接口顺序标签、作者昵称与头像、Created 时间及三项 outline 图标统计
- And 作者区只显示头像与昵称，按名片状态分三态：已返回（头像 + 昵称，无头像回退首字符占位）、请求中（中性占位块 `aria-hidden`，无文本）、缺失/失败（人形图形 + `Author unavailable`）
- And 任何状态都不渲染 26 位作者对外标识；标签以轻量描边胶囊自然换行

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
- And 作者区不承载跳转，标题链接仍是唯一详情入口

**S13 · 首页入口保持独立**
- When 用户点击首页 `View all posts`
- Then 进入 `/posts?sortBy=hottest`，读取真实最热列表；首页 Mock 卡片保持原样

**S14 · 名片加载中不回退为标识**
- When 帖子列表已返回但对应名片请求尚未完成
- Then 卡片作者区显示中性占位（`aria-hidden`），不出现 26 位对外标识，也不阻塞标题与详情链接

**S15 · 名片缺失时降级**
- When 某条帖子的作者账户已注销，或名片批量读取未返回该标识，或该批名片读取失败
- Then 卡片显示统一的人形图形 + `Author unavailable`（逐字，不加句号），不显示对外标识、不出现破图或空白文本
- And 失败批次在翻页或重试时重新请求，不标记为永久缺失

**S16 · 互动后返回重读（待跨页验收）**
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

interface ProfileCard {
  publicId: string
  displayName: string
  avatarUrl: string
}

type AuthorCardStatus = 'pending' | 'ready' | 'missing'

interface AuthorCardEntry {
  status: AuthorCardStatus
  card: ProfileCard | null
}

interface PostCardProps {
  post: PostSummary
  sortBy?: PostSortBy
  authorCard?: AuthorCardEntry
}
```

镜像真源是 `PostSummaryResponse`：除上述字段外还含 `updatedAt`；封面类型为 string，缺图用空字符串，不是 nullable。HTTP `PostFeedResponse` 恰含 `items/nextCursor`，没有独立 hasMore。适配层显式选择字段，不复制首页 Mock 数据。名片真源是 `lib/contracts/profile.ts` 的 `ProfileCardResponse`（`publicId / displayName / avatarUrl`），经 `toProfileCard` 适配为 `ProfileCard`。

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `publicId` | 真实对外标识 | 列表 key、去重和详情路由，禁止数字 Mock ID |
| `title` / `tags` | 接口原文、原顺序 | h3 原生链接与描边胶囊，不伪造英文摘要 |
| `coverImage` | string，空串表示缺图 | 父容器保持 3:2；失败显示占位 |
| `authorPublicId` | 真实对外标识 | 仅用于查名片与去重，任何状态都不渲染给用户 |
| `authorCard` | 由 `use-author-cards` 按 `authorPublicId` 查得 | `ready` 头像+昵称 / `pending` 占位 / `missing` `Author unavailable` |
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
| 时间标签 | `Created` |
| 名片缺失 | `Author unavailable`（逐字，不加句号） |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 页面渲染标题、排序 Tab、列表容器
- [ ] 默认 `latest` 高亮并加载
- [ ] 切换排序后清空列表并重新加载第一页
- [ ] 真实标题、封面/占位、标签、作者昵称与头像（三态）、创建时间和三个统计完整
- [ ] 任何状态不渲染 26 位作者对外标识
- [ ] 不展示假摘要/伪造作者昵称/城市/浏览数/发布时间
- [ ] 标题可键盘导航至真实 publicId，合法排序保留；作者区不承载跳转，缺图不阻塞链接
- [ ] 零互动显示 0 且不隐藏统计项

### 4.2 数据规则

- [ ] 已发布过滤及排序由真实列表接口承担；UI 不另造 Mock 过滤结果
- [ ] 三种 UI 排序映射实际 HTTP 词，limit=20
- [ ] 切换排序清空旧页/游标；取消加代次隔离迟到响应
- [ ] 分页原样游标、publicId 去重；连续 IO 只启动一次请求
- [ ] 名片按 authorPublicId 去重、剔除已缓存、≤50 切块；失败批次在标识集合变化时重取
- [ ] 首页入口和 Mock 展示不变
- [ ] 互动后返回重读统计并保留排序（任务 7.2，尚未验收）

### 4.3 状态

- [ ] 首次加载展示 `role="status"` 加载提示
- [ ] 首次失败展示 `role="alert"` 错误与重试按钮
- [ ] 分页失败保留已有数据并展示重试入口
- [ ] 空态展示英文文案，不展示骨架屏或到底提示
- [ ] 无更多数据展示英文到底提示
- [ ] 名片 `pending` 展示占位、`missing` 展示 `Author unavailable`，均不渲染标识

### 4.4 无障碍与响应式

- [ ] 排序 Tab 使用 `role="tablist"` / `role="tab"` / `aria-selected`
- [ ] 列表使用 `<ul>` / `<li>`
- [ ] 封面图 `alt=""`（装饰性）
- [ ] 互动统计行带 `aria-label="Post interactions"`
- [ ] 作者区不可聚焦、不可点击；请求中占位整体 `aria-hidden`

### 4.5 工程

- [ ] 页面/卡片/排序/作者名片 Hook 测试覆盖真实字段、作者三态、游标、去重、迟到隔离与错误重试
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
- 名片批量取数收敛在 `use-author-cards`，卡片不各自请求；结果经 `PostList` 透传给卡片

### 5.2 CSS Modules 与站点令牌

样式在 `frontend/app/posts/page.module.css` 与 `frontend/components/posts/*.module.css`，取色使用 `--wc-*`，留白由 `wc-container` 唯一承担，局部限宽用 `max-inline-size`。本轮无 Tailwind、shadcn/ui 或其它 UI 库，不进行样式迁移。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/posts/post-list.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 三列网格 `grid-template-columns: repeat(3, minmax(0,1fr))` |
| `≤ 1024px` | 网格收为两列 |
| `≤ 640px` | 网格收为单列 |

页面头部在 page.module.css 中另有窄屏堆叠；卡片标签自然换行、长昵称可折行。08 仅校验上述列表 CSS 的断点集合，不证明未登记的页面/卡片 CSS 或具体视觉布局；列数、留白和溢出由浏览器验收。

### 5.4 图片

- 封面与头像使用原生 `<img>`，非 `next/image`
- 封面父容器使用 CSS `aspect-ratio: 3 / 2`，img 填满并 object-fit: cover；不以固定 HTML 高宽扭曲比例
- 空串或图片 error 后显示占位；更换封面 URL 可恢复加载
- 封面 `alt=""`（装饰性图片），loading=lazy
- 头像 `inline-size/block-size: 24px`、`border-radius: 999px`、`alt=""`；加载失败或无地址回退首字符占位（`--wc-sand-deep` 底 / `--wc-ink-soft` 字）

### 5.5 与现状的差异

| # | 旧广场契约 | 本轮迁移 | 验收边界 |
|---|---|---|---|
| 1 | 首页 Mock Post、数字 id | 真实 PostSummary/publicId、postsApi.feed | 不强转或填充假字段 |
| 2 | 摘要、姓名、publishedAt | 标签、作者昵称与头像、Created | 替代 delta 承接字段/零值/统计 |
| 3 | 共享 active 布尔隔离 | 请求代次、AbortController、同步锁 | deferred 行为测试及浏览器乱序桩 |
| 4 | 无详情入口 | publicId 标题链接 | 当前只验入口，详情及跨页校准后续验收 |
| 5 | 首页与广场共用 Mock 模型 | 首页 Mock 保持独立 | 不迁移首页卡片或请求 |
| 6 | `Author ID:` 缩略 + `<details>` 展开 | 作者区「头像 + 昵称」三态，`Author unavailable` 降级 | 任何状态不渲染 26 位标识 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 页面 | `frontend/app/posts/page.tsx`、`frontend/app/posts/posts-content.tsx` |
| 页面样式 | `frontend/app/posts/page.module.css` |
| 列表组件 | `frontend/components/posts/post-list.tsx` |
| 列表样式 | `frontend/components/posts/post-list.module.css` |
| 卡片组件 | `frontend/components/posts/post-card.tsx` |
| 卡片样式 | `frontend/components/posts/post-card.module.css` |
| 统计行组件 | `frontend/components/posts/post-card-stats.tsx` |
| 骨架屏 | `frontend/components/posts/post-card-skeleton.tsx` |
| 排序 Tab | `frontend/components/posts/sort-tabs.tsx` |
| 无限滚动 Hook | `frontend/components/posts/use-infinite-posts.ts` |
| 作者名片 Hook | `frontend/components/posts/use-author-cards.ts` |
| 真实 DTO 镜像 | `frontend/lib/contracts/posts.ts` |
| 名片契约镜像 | `frontend/lib/contracts/profile.ts` |
| 帖子 UI 类型与端点 | `frontend/lib/posts/types.ts`、`frontend/lib/posts/posts-api.ts` |
| 名片客户端 | `frontend/lib/profile/profile-api.ts`、`types.ts` |
| 首页独立 Mock（不消费） | `frontend/lib/home/repository.ts`、`frontend/lib/home/mock-data.ts` |
| 浏览器验收 | `docs/e2e/post-feed.spec.ts` |
| IO mock | `frontend/vitest.setup.ts` |

```powershell
npm --prefix D:\my-first-project\frontend run test -- components/posts app/posts
powershell -File harness/checks/08-spec-doc-breakpoints.ps1
npm --prefix D:\my-first-project run test:e2e -- docs/e2e/post-feed.spec.ts
npm --prefix D:\my-first-project\frontend run build
powershell -File harness/run-all.ps1
```

### 替代 delta 场景对应

下表把在飞变更 `openspec/changes/add-wanderchain-profile/specs/wanderchain-post-feed/spec.md` 的 7 条 delta Scenario 逐条落到验证位置。浏览器用例为 `docs/e2e/post-feed.spec.ts`；组件 / Hook 用例在 `frontend/components/posts/`。

| delta Scenario | 对应验证 |
|---|---|
| 真实卡片字段完整 | post-card.test.tsx 真实字段与作者三态；浏览器「卡片按真实 DTO 渲染标题、封面、标签、作者昵称、时间与三列统计」 |
| 图标化统计行 | post-card.test.tsx 三项统计；浏览器同上 |
| 零互动仍展示 | post-card.test.tsx 零值保留；浏览器同上 |
| 点击进入真实详情 | 卡片/页面 href 断言；浏览器「卡片详情链接进入真实详情路由」 |
| 封面不可用 | post-card.test.tsx 缺图/error/新 URL；浏览器「卡片按真实 DTO 渲染…」缺图断言 |
| 名片加载中不回退为标识 | use-author-cards.test.tsx 三态 pending；post-card.test.tsx 请求中占位不渲染标识 |
| 名片缺失时降级 | post-card.test.tsx 缺失态 `Author unavailable`；浏览器「名片缺失时作者区逐字显示 Author unavailable，不出现 26 位标识」 |

旧“帖子卡片展示”和“数据契约与游标”的摘要/姓名/Mock 类型承诺明确移除；作者昵称与头像取自公开名片端点，`Author ID:` 与 `<details>/<summary>` 展开行为整体删除。其它主 spec 的排序 Tab、分页、状态与 IO 行为保持，不改主 spec 迁就实现。
