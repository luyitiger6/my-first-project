# Post interactions · 详情互动栏

| 项 | 值 |
|---|---|
| 单元编号 | Post interactions |
| 归属能力 | `wanderchain-post-interactions-frontend` |
| 对应主 spec | `openspec/specs/wanderchain-post-interactions-frontend/spec.md` |
| 承载 Requirement | `身份与个人互动状态`、`投票方向切换与取消`、`收藏切换与恢复`、`写操作去重与服务端校准`、`错误按业务语义分流`、`响应式与可访问操作` |
| 规格层级 | 人读契约。写入与校准编排在 `use-post-detail`，本单元只负责表达与禁用语义 |
| 单元性质 | 客户端互动操作栏（投票 / 收藏 / 评论入口） |

---

## 1. 模块边界

标签与状态文案使用英文。按钮只表达状态并向上抛事件，不自行发请求、不自行加减计数；所有选中态最终由服务端返回的个人状态校准。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 四个动作 | `Upvote`、`Downvote`、`Bookmark`、`Comment`，均带 outline 图标与可见名称 |
| 2 | 选中态三值 | 已知态输出 `aria-pressed=true/false`；未知态省略该属性，不冒充未互动 |
| 3 | 投票互斥 | 两个方向由同一 `voteDirection` 派生，选中互斥 |
| 4 | 游客引导 | 游客点击任一动作只触发登录引导，不发写请求 |
| 5 | 读取态说明 | 个人状态加载中提示、读取失败提示与重试、未读取时的显式读取入口 |
| 6 | 禁用语义 | 写入中、身份加载中、待刷新、需复核、会话过期时按钮不可用 |
| 7 | 区域语义 | 区块 `aria-label="Post interactions"`，写入中 `aria-busy` |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 统计数字展示 | `post-card-stats`（详情与卡片共用） |
| 请求发出、去重锁、写后校准 | `use-post-detail.ts` |
| 登录与注册表单 | `wanderchain-auth-frontend` |
| 评论输入框 | `post-comment-composer.md` |
| 乐观计数、本地净票数 | 禁止，计数只能来自写后重读 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 个人互动状态 | **需要 API**：`GET /api/posts/{publicId}/interactions/me` | 响应恰为 `{ voteDirection, bookmarked }`，不提供计数 |
| 写操作 | **需要 API**：`POST|DELETE /api/posts/{publicId}/votes`、`POST|DELETE /api/posts/{publicId}/bookmarks` | 由父层调用，本单元只触发回调 |
| 当前身份 | **需要 API**：`AuthProvider` | `loading` / `user` / `guest` 三态决定按钮可用性 |
| 选中态真源 | **服务端状态** | 写入成功后重新读取，不使用本地布尔兜底 |

### 1.4 与其他单元的关系

- **依赖**：`use-post-detail` 提供的 `personal` 读取态、`busy`、`sessionExpired` 与各回调；`AuthProvider` 的身份状态。
- **被依赖**：`post-detail` 在已发布且非待刷新时挂载本单元；草稿详情不挂载。
- **衔接**：`Comment` 不写数据，只把焦点交给评论输入框或滚动到评论区域；评论写入由输入框单元发起。

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 刷新恢复选中**
- When 已投反对票并已收藏的账户刷新详情
- Then 个人状态读取成功后 `Downvote` 与 `Bookmark` 为 `aria-pressed="true"`，`Upvote` 为 `false`

**S2 · 首次赞成**
- When 未投票用户点击 `Upvote` 且写入成功
- Then 父层校准后 `Upvote` 选中、`Downvote` 未选中，赞成票数取服务端最新值

**S3 · 赞成改反对**
- When 已赞成的用户点击 `Downvote`
- Then 原选择被替换，两方向互斥，不出现同时选中

**S4 · 取消反对**
- When 已反对的用户再次点击 `Downvote`
- Then 两个方向都不选中，且不因取消在本地扣减赞成票数

**S5 · 收藏切换**
- When 未收藏点击 `Bookmark`，或已收藏再次点击
- Then 分别创建或取消收藏，校准后选中态与 `bookmarkCount` 取服务端值

**S6 · 评论入口**
- When 登录用户点击 `Comment`
- Then 焦点移到评论输入框（存在时）或评论区，不发出写请求

### 2.2 异常路径

**S7 · 游客点击**
- When 游客点击任一动作
- Then 只触发登录引导，按钮不发写请求，登录链接携带当前详情回跳地址

**S8 · 身份尚未确定**
- When 全局身份仍在加载
- Then 四个按钮全部禁用，不以访客结论发起个人状态读取

**S9 · 个人状态读取失败**
- When 已登录账户读取 `/interactions/me` 失败
- Then 显示错误说明与 `Retry reading my state`，投票与收藏保持不可写的未知态，正文与评论仍可读

**S10 · 未读取**
- When 已登录且个人状态为 `idle`
- Then 提供 `Read my interaction state` 显式入口，不默认填充未选中

**S11 · 写入中重复点击**
- When 写入与校准尚未结束用户再次点击
- Then 按钮禁用，只发出一次写请求，`aria-busy` 可被辅助技术感知

**S12 · 会话过期**
- When 受保护读或写返回 `401 UNAUTHENTICATED`
- Then 个人状态被清空、选中态回到未知，展示登录引导与复核入口

**S13 · 并发变化**
- When 取消投票或收藏返回 `403` / `404`
- Then 显示状态已变化或目标不可用，不展示取消成功

---

## 3. 数据结构

### 3.1 组件 Props

```ts
interface PostInteractionBarProps {
  authStatus: AuthStatus            // 'loading' | 'user' | 'guest'
  personal: ReadState<PostInteractionStateResponse>
  busy: boolean                     // 写入或校准进行中
  disabled: boolean                 // 待刷新或需复核
  sessionExpired: boolean
  onVote: (direction: 'up' | 'down') => void
  onBookmark: () => void
  onComment: () => void
  onLogin: () => void
  onRetry: () => void
}
```

### 3.2 依赖的数据类型

```ts
interface PostInteractionStateResponse {
  voteDirection: 'up' | 'down' | null
  bookmarked: boolean
}

interface ReadState<T> {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'not-found'
  data: T | null
  error: string | null
  stale: boolean
}
```

`known` 推导条件固定为 `authStatus === 'user' && personal.status === 'ready' && personal.data !== null && !sessionExpired`；只有 `known` 为真时才输出 `aria-pressed`，其余一律省略。

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `voteDirection` | `up` / `down` / null | 方向互斥；null 表示两方向都未选中 |
| `bookmarked` | 布尔 | `Bookmark` 的 `aria-pressed`，与收藏总数无关 |
| `personal.status` | 读取态枚举 | `loading` 显示提示、`error` 显示重试、`idle` 显示读取入口 |
| `busy` | 布尔 | 任一动作写入或校准期间四个按钮全部禁用 |
| `disabled` | 布尔 | 数据待刷新或写入结果未知时为真，避免在不可信状态上再写 |
| `sessionExpired` | 布尔 | 非游客时为真则锁写并展示登录引导 |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| 区块标签 | `Post interactions`（`aria-label`） |
| 四个按钮 | `Upvote` / `Downvote` / `Bookmark` / `Comment` |
| 读取中 | `Loading your interaction state…`（`role="status"`） |
| 读取失败 | `<错误说明> Your vote and bookmark state is unknown.` |
| 读取重试 | `Retry reading my state` |
| 未读取入口 | `Read my interaction state` |
| 游客提示 | `Log in to vote, bookmark, or join the conversation.` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 行为

- [ ] 四个动作都有可见名称与图标，图标带 `aria-hidden`
- [ ] 选中态来自服务端，未知态不输出 `aria-pressed="false"`
- [ ] 两方向互斥，取消不本地扣减赞成票数
- [ ] 收藏切换只影响本人标记，不把收藏总数当选中态

### 4.2 状态

- [ ] 身份加载中全部禁用
- [ ] 个人状态加载中显示提示，失败显示错误与重试，`idle` 显示读取入口
- [ ] 写入或校准期间禁用全部按钮，`aria-busy` 反映进行中
- [ ] 待刷新或需复核时禁止继续写

### 4.3 身份与错误

- [ ] 游客点击仅触发登录引导，无写请求
- [ ] `401` 清空选中并展示登录与复核入口
- [ ] `403` / `404` 不表现为操作成功
- [ ] `CROSS_SITE_REJECTED` 与 `VALIDATION_FAILED` 文案可区分（由 `describePostsError` 提供）

### 4.4 无障碍与响应式

- [ ] 四个按钮均为原生 `<button type="button">`，可键盘触达
- [ ] 窄屏按钮自然换行，不横向溢出、不遮挡正文
- [ ] 断点与真相源 CSS 一致（见 5.3）

### 4.5 工程

- [ ] 组件行为测试覆盖身份三态、未知态、错误与禁用（任务 7.1，尚未补齐）
- [ ] `docs/e2e/post-interactions.spec.ts` 覆盖投票/收藏区块（任务 5.6，尚未运行）
- [ ] `powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 返回 0
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 组件首行 `'use client'`，纯受控展示组件，内部只保留无状态图标
- 状态来源全部经 props 注入，组件不调用 `useAuth`，保证可独立测试

### 5.2 CSS Modules 与站点令牌

样式在 `frontend/components/posts/post-interaction-bar.module.css`，取色使用 `--wc-*`；按钮最小高度 44px 以满足触达目标。仓库现状未安装 Tailwind 与 shadcn/ui，选中态由 `[aria-pressed="true"]` 选择器驱动，而非额外状态类。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/posts/post-interaction-bar.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 动作行横向排列并允许换行，按钮内边距 10px 16px |
| `≤ 640px` | 动作间距收到 8px，按钮内边距收到 10px 12px，字号降到 14px |

按钮数量与换行位置由浏览器验收，08 只比对上述 CSS 的断点集合。

### 5.4 图片与图标

- 图标为内联 `svg`（`stroke="currentColor"`），随文字颜色变化，不额外请求资源
- 不适用封面图优化；`aria-hidden="true"` 避免图标读名与按钮名重复

### 5.5 与现状的差异

| # | 旧形态 | 本轮形态 | 验收边界 |
|---|---|---|---|
| 1 | 无互动栏 | 正文下方非悬浮图标加文字栏 | 窄屏自然换行 |
| 2 | 选中态只有布尔 | 三值语义（选中/未选中/未知） | 未知态省略 `aria-pressed` |
| 3 | 本地切换即时生效 | 写后重读服务端状态 | 不乐观计数 |
| 4 | 无禁用语义 | 写入、待刷新、需复核、过期四类禁用 | 由 5.6/7.1 取证 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 互动栏组件 | `frontend/components/posts/post-interaction-bar.tsx` |
| 互动栏样式 | `frontend/components/posts/post-interaction-bar.module.css` |
| 状态与写入编排 | `frontend/components/posts/use-post-detail.ts` |
| 错误文案归一 | `frontend/lib/posts/posts-api.ts`（`describePostsError`） |
| 真实 DTO 镜像 | `frontend/lib/contracts/posts.ts` |
| 浏览器验收 | `docs/e2e/post-interactions.spec.ts`（任务 5.6） |

```powershell
powershell -File harness/checks/08-spec-doc-breakpoints.ps1
npm --prefix D:\my-first-project\frontend run test -- components/posts
npm --prefix D:\my-first-project run test:e2e -- docs/e2e/post-interactions.spec.ts
```

### 场景对应

| 主 spec Scenario | 对应验证 |
|---|---|
| 刷新恢复选中状态 | 个人状态注入用例（待 7.1） |
| 游客互动需登录 | 游客点击只触发引导（待 7.1） |
| 身份尚未确定 | 加载态全禁用（待 7.1） |
| 个人状态读取失败 | 未知态与重试入口（待 7.1） |
| 首次赞成 / 赞成改反对 / 取消反对 | 方向互斥与取消不扣减（待 5.6/7.1） |
| 收藏成功 / 取消收藏 | 标记切换与计数重读（待 5.6） |
| 连续点击只发一次 | 忙态禁用（待 7.1） |
| 会话过期 | 401 清空与引导（待 5.6） |
| 取消遭遇并发变化 | 403/404 不称成功（待 5.6） |
| 键盘完成操作 | 浏览器键盘路径（待 6.6） |
