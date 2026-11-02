# Post comments · 评论列表

| 项 | 值 |
|---|---|
| 单元编号 | Post comments |
| 归属能力 | `wanderchain-post-interactions-frontend` |
| 对应主 spec | `openspec/specs/wanderchain-post-interactions-frontend/spec.md` |
| 承载 Requirement | `评论分页与回复关系`、`本人评论删除与确认`、`错误按业务语义分流`、`响应式与可访问操作` |
| 规格层级 | 人读契约。分页游标与删除写入的编排在 `use-post-detail`，本单元负责列表表达与确认交互 |
| 单元性质 | 客户端评论区（列表、分页、回复上下文、本人删除确认） |

---

## 1. 模块边界

标签与状态文案使用英文；评论正文、作者标识与父评论标识直接展示接口原文，不翻译、不补全父正文。列表按接口返回顺序渲染，不做前端重新排序或分组。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 评论列表 | `ol` 有序列表，每条含作者标识、`Created` 时间与 `pre-wrap` 正文 |
| 2 | 回复上下文 | 回复条目显示父 `publicId`；父评论已加载时展示父正文预览与跳转链接，未加载时显示不可用提示 |
| 3 | 单层缩进 | 只有带 `parentPublicId` 的条目缩进一次，回复条目不再提供回复入口 |
| 4 | 分页 | 使用不透明 `nextCursor` 的 `Load more comments`，按 `publicId` 去重后追加 |
| 5 | 状态区 | 加载、空态、到底、分页加载中、读取失败五种提示 |
| 6 | 本人删除 | 仅本人可见 `Delete`，行内二次确认，支持 Escape 取消并恢复焦点 |
| 7 | 插槽 | `children` 用于放置评论输入框或游客登录按钮，位置在标题之后、列表之前 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 评论输入、字数与校验 | `post-comment-composer.md` |
| 评论创建请求与写后校准 | `use-post-detail.ts` |
| 评论编辑、评论投票、评论举报 | 本轮范围外 |
| 伪造父评论正文或把父标识改成自身标识 | 禁止 |
| 第三层回复入口 | 禁止，回复条目不再提供 `Reply` |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 评论第一页与分页 | **需要 API**：`GET /api/posts/{publicId}/comments?limit=20&cursor=` | 响应 `{ items, nextCursor }`，`limit` 固定 20 |
| 删除评论 | **需要 API**：`DELETE /api/posts/{publicId}/comments/{commentPublicId}` | 成功返回 `204`，软删除 |
| 当前账户标识 | **需要 API**：`AuthProvider` | 仅用于判断 `own`，不作为删除权限的最终判定 |
| 时间格式化 | **静态工具函数**（`lib/home/format.ts`） | `en-US`，标注 `Created` |

### 1.4 与其他单元的关系

- **依赖**：`use-post-detail` 的 `comments` 读取态、`loadingMore`、`onLoadMore` / `onRetry` / `onReload` / `onDelete` 回调；`formatDate`。
- **被依赖**：`post-detail` 在正文与统计之后渲染本单元；草稿详情传入 `readOnly` 并关闭全部写入口。
- **衔接**：`onReply` 只把顶级评论交给输入框单元，评论的实际创建由输入框单元提交；删除成功后列表先本地移除再重读校准。

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 首屏加载**
- When 评论第一页尚未返回
- Then 显示 `Loading comments…`，列表区 `aria-busy` 反映加载中

**S2 · 空列表**
- When 第一页返回空数组且 `nextCursor` 为 `null`
- Then 显示 `No comments yet.`，不显示加载占位、不显示到底提示

**S3 · 加载下一页**
- When 用户点击 `Load more comments` 且 `nextCursor` 非空
- Then 用原游标请求下一页，已加载条目保留，重复 `publicId` 不重复插入

**S4 · 到底**
- When `nextCursor` 为 `null` 且已有条目
- Then 显示 `You have reached the end of the comments.`，不再展示加载更多按钮

**S5 · 回复上下文可见**
- When 回复条目在父评论之后加载
- Then 显示 `In reply to comment ID: {parentPublicId}`、父正文预览与 `Go to parent comment`

**S6 · 回复不可直接再回复**
- When 用户查看任意一条带 `parentPublicId` 的条目
- Then 该条目不提供 `Reply`，历史回复正文仍可阅读

**S7 · 删除本人评论**
- When 评论作者点击 `Delete` 并确认
- Then 行内确认出现，确认后目标条目从列表移除并重读第一页与详情统计

**S8 · 确认键盘操作**
- When 确认框出现后用户按 Escape
- Then 取消确认、不发请求，焦点回到触发删除的按钮

### 2.2 异常路径

**S9 · 他人或游客**
- When 当前账户与评论 `authorPublicId` 不同，或身份为游客
- Then 不渲染该条目的 `Delete`

**S10 · 读取失败**
- When 评论第一页或分页请求失败
- Then 显示错误说明与 `Retry reading comments`、`Reload first page` 两个入口；已有条目保持可见

**S11 · 父评论跨页或已删除**
- When 回复先于父评论加载，或父评论已软删除
- Then 回复始终可见，父标识保持原值，显示 `Parent context is unavailable.`，不回显被删除的父正文

**S12 · 删除失败**
- When 确认后请求返回 `403` / `404` / 网络错误
- Then 条目不从列表消失，提示对应说明并保留重新读取入口

**S13 · 会话过期或写入中**
- When 会话过期、写入进行中或详情待刷新
- Then `Delete` / `Reply` / `Confirm delete` 全部禁用，不发送请求

---

## 3. 数据结构

### 3.1 组件 Props

```ts
interface PostCommentsProps {
  state: ReadState<CommentsData>
  authStatus: AuthStatus
  accountPublicId: string | null
  busy: boolean
  loadingMore: boolean
  readOnly: boolean
  disabled: boolean
  sessionExpired: boolean
  onLoadMore: () => void
  onRetry: () => void
  onReload: () => void
  onReply: (comment: CommentResponse) => void
  onLogin: () => void
  onDelete: (comment: CommentResponse) => Promise<'success' | 'failed' | 'ignored'>
  children?: ReactNode
}
```

### 3.2 依赖的数据类型

```ts
interface CommentsData {
  items: CommentResponse[]
  nextCursor: string | null
}

interface CommentResponse {
  publicId: string
  postPublicId: string
  parentPublicId: string | null
  authorPublicId: string
  content: string
  createdAt: string
  updatedAt: string
}
```

`ReadState<T>` 定义见 `post-detail.md`，`AuthStatus` 取自 `AuthProvider`。父评论通过当前已加载的 `items` 以 `publicId` 建表查找，不额外请求单条评论；`own` 只是展示条件，服务端仍校验所有权。

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `publicId` | 真实对外标识 | 列表 `key`、锚点 `#comment-{publicId}` 与去重依据 |
| `parentPublicId` | 顶级评论为 `null` | 非空条目缩进一次并展示父上下文，不提供 `Reply` |
| `authorPublicId` | 真实对外标识 | 前 6 位加后 4 位缩略，`details/summary` 可展开全文 |
| `content` | 接口原文 | `pre-wrap` 文本，不执行 HTML |
| `createdAt` | ISO 时间 | `Created` + 英文格式 |
| `nextCursor` | 不透明 string 或 null | 原样回传；null 才是到底 |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| 标题 | `Comments` |
| 加载 | `Loading comments…`（`role="status"`） |
| 空态 | `No comments yet.` |
| 待刷新 | `Comments pending refresh.` |
| 读取失败 | `<错误说明>` + `Retry reading comments` / `Reload first page` |
| 分页中 | `Loading more comments…` |
| 分页按钮 | `Load more comments` |
| 到底 | `You have reached the end of the comments.` |
| 回复上下文 | `In reply to comment ID: {id}` / `Go to parent comment` |
| 父不可用 | `Parent context is unavailable. It may not be loaded or may no longer be available.` |
| 删除入口 | `Delete` |
| 删除确认 | `Delete this comment? Its replies will remain.` / `Confirm delete` / `Cancel` |
| 行内动作 | `Reply` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 每条评论展示缩略作者标识、`Created` 时间与原始正文
- [ ] 回复条目展示父标识；父已加载时展示预览与跳转链接
- [ ] 父评论未加载或已删除时保留回复正文且不回显父正文
- [ ] 最多一层缩进，回复条目不出现 `Reply`

### 4.2 分页与状态

- [ ] 第一页加载、空态、到底三种提示互斥
- [ ] 加载更多使用原游标并去重，重复项不重复插入
- [ ] 分页失败保留已有条目，重试沿用原游标
- [ ] 读取错误同时提供重试与重载第一页两个入口

### 4.3 删除

- [ ] `Delete` 仅对当前账户本人的评论渲染
- [ ] 删除必须先确认，取消不发请求
- [ ] 确认后成功条目移除，其未删除回复仍可见
- [ ] 失败不伪造删除成功，条目保留
- [ ] Escape 可取消确认，结束后焦点不丢失

### 4.4 无障碍与响应式

- [ ] 评论列表为 `ol` / `li`，区块有 `aria-labelledby` 指向标题
- [ ] 确认框为 `role="group"` 并有可读名称，焦点进入取消按钮
- [ ] 窄屏回复缩进收窄且不无限制向内挤压
- [ ] 断点与真相源 CSS 一致（见 5.3）

### 4.5 工程

- [ ] 组件行为测试覆盖空态、分页、父不可用、删除确认与失败（任务 7.1，尚未补齐）
- [ ] `docs/e2e/post-interactions.spec.ts` 覆盖评论/回复/分页/删除（任务 6.6，尚未运行）
- [ ] `powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 返回 0
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 组件首行 `'use client'`；确认态、焦点恢复与删除去重锁在组件内用 `useState` / `useRef` 管理
- 列表容器带 `tabIndex={-1}` 作为焦点兜底，删除成功后焦点落在区块上

### 5.2 CSS Modules 与站点令牌

样式在 `frontend/components/posts/post-comments.module.css`，取色使用 `--wc-*`；回复缩进用 `margin-inline-start` 加左侧描边表达层级，不使用嵌套列表。仓库现状未安装 Tailwind 与 shadcn/ui。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/posts/post-comments.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 条目内边距 20px，回复缩进 24px，确认框内边距 16px |
| `≤ 640px` | 回复缩进收到 12px，条目内边距 16px，确认框内边距 12px |

缩进层级是否仍可读由浏览器验收，08 只比对上述 CSS 的断点集合。

### 5.4 图片

- 不适用：本单元无封面或图片资源，头像类内容不在本轮范围
- 作者标识以文本缩略呈现，不引入图片请求

### 5.5 与现状的差异

| # | 旧形态 | 本轮形态 | 验收边界 |
|---|---|---|---|
| 1 | 无评论列表 | 倒序游标分页列表 | 不前端重排 |
| 2 | 回复只有文本 | 父标识 + 预览 + 跳转，父不可用有提示 | 不伪造父正文 |
| 3 | 无删除交互 | 行内确认 + Escape 取消 + 焦点恢复 | 服务端仍校验所有权 |
| 4 | 无分页失败分支 | 保留已有页并沿用原游标重试 | 由 6.6 取证 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 评论列表组件 | `frontend/components/posts/post-comments.tsx` |
| 评论列表样式 | `frontend/components/posts/post-comments.module.css` |
| 分页与删除编排 | `frontend/components/posts/use-post-detail.ts` |
| 真实 DTO 镜像 | `frontend/lib/contracts/posts.ts` |
| 浏览器验收 | `docs/e2e/post-interactions.spec.ts`（任务 6.6） |

```powershell
powershell -File harness/checks/08-spec-doc-breakpoints.ps1
npm --prefix D:\my-first-project\frontend run test -- components/posts
npm --prefix D:\my-first-project run test:e2e -- docs/e2e/post-interactions.spec.ts
```

### 场景对应

| 主 spec Scenario | 对应验证 |
|---|---|
| 空评论列表 | 空态用例（待 7.1） |
| 加载下一页 | 游标与去重用例（待 7.1） |
| 分页失败与重试 | 保留已有页（待 6.6/7.1） |
| 父评论跨页或已删除 | 父上下文分支（待 7.1） |
| 删除本人评论 | 确认后移除（待 6.6） |
| 不显示他人的删除入口 | `own` 判定（待 7.1） |
| 删除取消或失败 | Escape 取消与失败保留（待 6.6/7.1） |
| 键盘完成操作 | 浏览器键盘路径（待 6.6） |
| 窄屏与减弱动效 | 窄屏截图与 `prefers-reduced-motion`（待 6.6） |
