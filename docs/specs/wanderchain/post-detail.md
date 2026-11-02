# Post detail · 帖子详情

| 项 | 值 |
|---|---|
| 单元编号 | Post detail |
| 归属能力 | `wanderchain-post-interactions-frontend` |
| 对应主 spec | `openspec/specs/wanderchain-post-interactions-frontend/spec.md` |
| 承载 Requirement | `真实详情路由与内容`、`详情加载与错误分区`、`路由身份与迟到响应隔离`、`响应式与可访问操作` |
| 规格层级 | 人读契约。行为以主 spec 为准；本单元只描述详情壳层，不含互动栏与评论子单元 |
| 单元性质 | 客户端详情页壳层（正文、统计、状态分区与登录引导） |

---

## 1. 模块边界

界面标签和状态文案使用英文；标题、正文、标签与作者标识直接展示真实接口内容，不翻译、不补摘要、不编造作者姓名。正文以文本渲染并保留换行，任何 HTML 片段都按字面意思显示。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 详情路由 | `/posts/{publicId}` 服务端组件解析 `publicId` 与合法 `sortBy`，客户端组件承接交互 |
| 2 | 正文区 | 标题、可选标签、可展开作者标识、`Created` 时间、封面或占位、正文文本 |
| 3 | 统计行 | 复用 `PostCardStats` 展示 `upVoteCount` / `commentCount` / `bookmarkCount` |
| 4 | 状态分区 | 加载、未找到、可重试失败三种互斥壳层；评论与个人状态失败不影响正文 |
| 5 | 草稿只读 | 作者本人可读草稿正文，同时隐藏互动栏、评论表单与删除入口 |
| 6 | 返回入口 | 顶部返回链接保留合法 `sortBy`，缺省回到 `/posts` |
| 7 | 登录引导 | 触发登录时显示引导区并把焦点移到该区，携带当前详情回跳地址 |
| 8 | 待刷新提示 | 统计待刷新时展示 `Statistics pending refresh.` 与只读刷新入口 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 投票/收藏/评论按钮与选中态 | `post-interactions.md` |
| 评论列表、分页、回复上下文与本人删除 | `post-comments.md` |
| 评论输入框、字数与校验文案 | `post-comment-composer.md` |
| 发帖、编辑帖子、作者资料、评论编辑与评论投票 | 本轮范围外 |
| 用 Mock 正文兜底失败响应 | 禁止，失败只给重试入口 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 帖子详情 | **需要 API**：`postsApi.detail` → 同源 `GET /api/posts/{publicId}` | `PostResponse` 经 `toPostDetail` 适配为 `PostDetail`，空封面适配为空字符串 |
| 评论与个人状态 | **需要 API**（由 `use-post-detail` 编排） | 详情成功后并发读取评论第一页与本人互动状态；草稿只取消个人状态 |
| 当前身份 | **需要 API**：`AuthProvider` → 同源 `/api/auth/me` | 身份加载中视为不可写；会话只来自服务端 |
| 日期格式化 | **静态工具函数**（`lib/home/format.ts`） | `en-US`、`Asia/Shanghai`，标注 `Created` |
| 返回链接 | **静态规则 + URL 查询参数** | 仅当 `sortBy` 属于 `latest/hottest/mostDiscussed` 时保留 |

### 1.4 与其他单元的关系

- **依赖**：`use-post-detail` 状态机、`PostCardStats`、`PostInteractionBar`、`PostComments`、`CommentComposer`、`lib/auth/return-to` 的安全回跳工具。
- **被依赖**：帖子广场卡片与首页入口的详情链接目标；本单元是三个子单元的组合宿主。
- **衔接**：`sortBy` 由服务端 `searchParams` 归一化后传入，页面不自行解析 URL；互动完成后返回广场保留排序并重读统计属于任务 7.2 的跨页验收，本单元不证明该链路。

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 直接访问已发布详情**
- When 游客直接打开 `/posts/{publicId}`
- Then 不依赖先访问广场即可展示标题、正文、封面或占位、标签、作者标识、`Created` 时间与三项统计

**S2 · 加载可感知**
- When 身份或详情请求尚未返回
- Then 展示带 `role="status"` 与 `aria-busy` 的 `Loading post…` 占位，不把加载态误判为未找到

**S3 · 草稿只读**
- When 作者打开自己的草稿详情
- Then 展示草稿提示，不发个人状态请求，不渲染互动栏、评论表单与删除入口

**S4 · 返回广场保留排序**
- When 用户从 `?sortBy=hottest` 进入详情后点击返回
- Then 链接回到 `/posts?sortBy=hottest`；非法或缺失排序回到 `/posts`

**S5 · 缺少封面**
- When 接口返回空封面，或封面 `img` 触发 `onError`
- Then 展示 `No cover image` 占位，标题链接与正文不受影响；更换封面地址可恢复加载

**S6 · 统计待刷新**
- When 详情读取成功但数据被标记为 `stale`
- Then 统计行下方显示 `Statistics pending refresh.` 与 `Refresh server data` 只读入口，按钮在写入中禁用

### 2.2 异常路径

**S7 · 帖子不可见**
- When 详情返回 `404 / POST_NOT_FOUND`，或访客收到他人草稿
- Then 统一显示 `Post not found` 与 `This post is not available.`，取消后续评论与个人状态读取

**S8 · 服务不可达**
- When 详情请求网络失败或返回 `5xx`（含代理 `502`）
- Then 显示 `Post could not load` 与错误说明，提供 `Retry reading post`，不展示 Mock 正文

**S9 · 评论失败不遮挡正文**
- When 正文已就绪但评论第一页失败
- Then 正文、统计与返回入口保持可读，错误与重试留在评论区域

**S10 · 会话过期**
- When 任一受保护读取返回 `401 UNAUTHENTICATED`
- Then 清空旧账户个人状态、展示登录引导与 `Recheck session`；复核确认同一账户后恢复可写，未提交草稿保持锁定直到确认

**S11 · 切换帖子或登出**
- When A 帖子的响应在用户进入 B 帖子或登出之后才返回
- Then 旧响应因代次与 scope 失效被丢弃，页面只展示当前上下文

**S12 · 写入结果未知**
- When 写请求遇到网络错误或 `5xx` / `INVALID_RESPONSE`
- Then 显示 `Check server data` 只读入口并把详情标为待刷新，不自动重放写入，旧统计不称为最新

---

## 3. 数据结构

### 3.1 组件 Props

```ts
interface PostDetailProps {
  publicId: string
  sortBy?: PostSortBy // 仅 latest | hottest | mostDiscussed
}
```

页面层为 Server Component，`params` 与 `searchParams` 均为 `Promise`；`PostDetail` 以 `key={publicId}` 挂载，保证切换帖子时状态重新初始化。

### 3.2 依赖的数据类型

```ts
interface ReadState<T> {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'not-found'
  data: T | null
  error: string | null
  stale: boolean
}

interface PostDetail extends PostSummary {
  content: string
  updatedAt: string
}

interface View {
  key: string
  detail: ReadState<PostDetail>
  comments: ReadState<CommentsData>
  personal: ReadState<PostInteractionStateResponse>
  busy: boolean
  loadingMore: boolean
  mutationKind: 'vote' | 'bookmark' | 'comment' | 'delete' | null
  needsReview: boolean
  mutation: { status: 'idle' | 'writing' | 'refreshing' | 'success' | 'error' | 'uncertain'; message: string }
  sessionExpired: boolean
}
```

镜像真源是 `PostResponse`：除 `PostSummary` 字段外还含 `content` 与 `updatedAt`；`coverImage` 是 string，缺图为空串而非 null。`ReadState.stale` 语义是「有旧数据但已不可信」，不得与 `ready` 混用。

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `publicId` | 真实对外标识 | 路由参数与页面 `key`，禁止数字 Mock ID |
| `title` / `content` | 接口原文 | `h1` 与 `white-space: pre-wrap` 文本节点，不注入 HTML |
| `tags` | 接口原文、原顺序 | 描边胶囊列表，空数组时不渲染列表 |
| `coverImage` | string，空串表示缺图 | 缺图或失败显示占位，`alt=""`（装饰性） |
| `authorPublicId` | 真实对外标识 | 前 6 位加后 4 位缩略，`details/summary` 可键盘展开全文 |
| `createdAt` | ISO 时间 | `time[dateTime]` 原值，`Created` + 英文格式 |
| `status` | `draft` / `published` | `draft` 且为本人时进入只读分支 |
| `upVoteCount` / `commentCount` / `bookmarkCount` | 非负整数 | 三项齐全，零值保留 |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| eyebrow | `Community · Post` |
| 返回 | `← Back to all posts` |
| 加载 | `Loading post…`（`role="status"`） |
| 未找到 | `Post not found` / `This post is not available.` |
| 详情失败 | `Post could not load` + `Retry reading post` |
| 统计待刷新 | `Statistics pending refresh.` / `Refresh server data` |
| 草稿提示 | `Draft — only you can read this post. Interactions are unavailable.` |
| 缺封面 | `No cover image` |
| 登录引导 | `Log in to continue. Your previous action will not be submitted automatically.` |
| 复核入口 | `Recheck session` |
| 页面标题行 | `Author ID:` / `Created` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 直接访问展示真实正文、标签、可展开作者标识、`Created` 时间与三项统计
- [ ] 不展示摘要、作者姓名、城市、浏览数或发布时间等不存在的字段
- [ ] 正文 HTML 片段按文本呈现，长行不造成页面级横向溢出
- [ ] 草稿详情仅作者可读，且不出现互动与评论写入口

### 4.2 状态与数据

- [ ] 加载、未找到、可重试失败三种壳层互斥，不把加载误判为未找到
- [ ] `404` 统一进入未找到界面，且不再读取评论与个人状态
- [ ] 评论失败不影响正文、统计与返回入口
- [ ] 待刷新时显示提示与只读刷新入口，不使用乐观计数

### 4.3 身份与并发

- [ ] 会话过期后展示登录引导与复核入口，未提交草稿锁定而非自动提交
- [ ] 切换帖子或登出后旧响应不覆盖新上下文
- [ ] 写入结果未知时只提示复核，不自动重放写请求

### 4.4 无障碍与响应式

- [ ] 加载/错误/草稿提示分别使用 `role="status"` / `role="alert"` / `role="status"`
- [ ] 作者标识可用键盘展开，登录引导获得焦点并置顶滚动
- [ ] 窄屏保留站点留白、正文可读、按钮不遮挡内容
- [ ] 断点与真相源 CSS 一致（见 5.3）

### 4.5 工程

- [ ] `docs/e2e/post-interactions.spec.ts` 覆盖详情区块（任务 5.6，尚未运行）
- [ ] 组件与 Hook 行为测试覆盖身份、错误、竞态与输入边界（任务 7.1，尚未补齐）
- [ ] `powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 返回 0
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- `app/posts/[publicId]/page.tsx` 为 Server Component，`params` / `searchParams` 均按 Promise 解构
- `PostDetail` 首行 `'use client'`，交互、焦点与状态全部在客户端完成
- 页面不直接读 `window.location`，排序合法性在服务端归一化后传入

### 5.2 CSS Modules 与站点令牌

样式在 `frontend/components/posts/post-detail.module.css`，取色使用 `--wc-*`，留白由 `wc-container` 承担；正文限宽用 `max-inline-size: 820px` 而非 `width`，避免覆盖容器留白。仓库现状未安装 Tailwind 与 shadcn/ui，本单元不使用任何 UI 库。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/posts/post-detail.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 正文列限宽 820px 居中，标题 `clamp(28px, 4vw, 44px)`，正文 17px |
| `≤ 640px` | 主区留白收到 24px 上 / 32px 下，区块间距收到 20px，正文降到 16px，提示面板内边距收到 18px |

列宽与留白由浏览器验收，08 只比对上述 CSS 的断点集合。

### 5.4 图片

- 封面使用原生 `<img>`，非 `next/image`
- 封面容器裁剪溢出并限制 `max-block-size: 480px`，`object-fit: cover`；不以固定 HTML 宽高扭曲比例
- `alt=""`（装饰性），失败后展示占位文本并停止重试同一地址

### 5.5 与现状的差异

| # | 旧详情契约 | 本轮形态 | 验收边界 |
|---|---|---|---|
| 1 | 无详情路由 | `/posts/{publicId}` 直连真实详情接口 | 不依赖广场先加载 |
| 2 | 单一整页错误 | 详情 / 评论 / 个人状态三区独立 | 评论失败不遮挡正文 |
| 3 | 无草稿概念 | 作者可读草稿且全站只读 | 不向他人泄露草稿 |
| 4 | 无跨页校准 | 互动后由任务 7.2 验证返回广场重读 | 当前不宣称已验收 |
| 5 | 无焦点管理 | 登录引导与刷新入口显式聚焦 | 由 5.6 浏览器用例取证 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 页面 | `frontend/app/posts/[publicId]/page.tsx` |
| 详情组件 | `frontend/components/posts/post-detail.tsx` |
| 详情样式 | `frontend/components/posts/post-detail.module.css` |
| 状态机 Hook | `frontend/components/posts/use-post-detail.ts` |
| 统计行 | `frontend/components/posts/post-card-stats.tsx` |
| 真实 DTO 镜像 | `frontend/lib/contracts/posts.ts` |
| HTTP 客户端 | `frontend/lib/posts/posts-api.ts` |
| 浏览器验收 | `docs/e2e/post-interactions.spec.ts`（任务 5.6） |

```powershell
powershell -File harness/checks/08-spec-doc-breakpoints.ps1
npm --prefix D:\my-first-project\frontend run test -- components/posts
npm --prefix D:\my-first-project run test:e2e -- docs/e2e/post-interactions.spec.ts
```

### 场景对应

下表是验收定位清单，不代表尚未运行的浏览器场景已通过。

| 主 spec Scenario | 对应验证 |
|---|---|
| 直接访问已发布详情 | 页面直达用例；浏览器 D1（待 5.6） |
| 缺封面与长内容 | 封面 error 分支与 `pre-wrap` 断言（待 7.1） |
| 草稿详情只读 | 草稿分支不渲染互动栏与表单（待 7.1） |
| 初次加载可感知 | `role="status"` 加载占位（待 7.1） |
| 帖子不可见 | `404` 未找到界面与后续读取取消（待 5.6/7.1） |
| 服务不可达 | 网络/`5xx` 重试入口（待 5.6） |
| 评论失败不遮挡正文 | 分区错误用例（待 5.6） |
| 会话过期 | 登录引导与草稿锁定（待 5.6/7.1） |
| 快速切换帖子 / 登出后旧响应 | 代次隔离用例（待 7.1） |
| 窄屏与键盘 | 浏览器窄屏截图与键盘路径（待 5.6/6.6） |
