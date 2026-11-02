# Post comment composer · 评论输入框

| 项 | 值 |
|---|---|
| 单元编号 | Post comment composer |
| 归属能力 | `wanderchain-post-interactions-frontend` |
| 对应主 spec | `openspec/specs/wanderchain-post-interactions-frontend/spec.md` |
| 承载 Requirement | `评论创建与二级回复`、`写操作去重与服务端校准`、`错误按业务语义分流`、`响应式与可访问操作` |
| 规格层级 | 人读契约。提交编排、去重锁与写后校准在 `use-post-detail`，本单元负责输入、校验与焦点 |
| 单元性质 | 客户端评论输入表单（顶级评论与二级回复共用） |

---

## 1. 模块边界

标签、提示与错误文案使用英文。表单只收集文本与回复目标，不发送请求、不自行清空内容；输入内容按服务端相同口径去除首尾 `U+0000`–`U+0020` 后计数。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 单一输入区 | `textarea` 固定 `id="comment-content"`，供互动栏 `Comment` 聚焦 |
| 2 | 标题随目标变化 | 顶级为 `Your comment`，回复为 `Your reply` |
| 3 | 回复目标块 | 显示 `Replying to comment ID: {publicId}`、目标正文预览与 `Cancel reply` |
| 4 | 字数口径 | 显示去空白后 UTF-16 代码单元长度与上限 2000 |
| 5 | 客户端校验 | 空内容与超长在提交后提示；超长在输入过程中即时提示 |
| 6 | 目标锁定草稿 | 前一会话的草稿锁定时提示并禁用输入，不自动提交 |
| 7 | 焦点管理 | 选择回复目标时聚焦输入框，取消回复后焦点回到输入框 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 评论创建请求、去重锁、写后重读 | `use-post-detail.ts` |
| 评论列表与删除确认 | `post-comments.md` |
| 富文本、附件、@ 提及、Markdown 渲染 | 本轮范围外 |
| 第三层回复入口 | 禁止，回复目标只能是顶级评论 |
| 服务端校验替代 | 禁止，客户端校验只做提前拦截 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 输入状态 | **组件状态**：`CommentDraft` | `content`、`replyTo`、`ownerPublicId`、`locked` 由父层持有 |
| 校验口径 | **静态工具函数**（`lib/posts/comment-input.ts`） | `normalizeCommentContent` 与 `commentValidationError`，与 Java `String.trim()` 同口径 |
| 提交结果 | **回调**：`onSubmit(): Promise<'success' | 'failed' | 'ignored'>` | 只有 `success` 会重置已尝试状态并清空输入 |
| 服务端错误 | **props**：`error` | 仅评论类错误注入，投票/收藏错误不落到本表单 |

### 1.4 与其他单元的关系

- **依赖**：`use-post-detail` 的 `draft`、`editContent`、`chooseReply`、`submitComment`；`comment-input` 校验工具。
- **被依赖**：`post-detail` 在已登录或存在锁定草稿时，把本单元作为 `PostComments` 的 `children` 渲染。
- **衔接**：`PostComments` 的 `Reply` 把顶级评论交给 `chooseReply`，本单元据 `draft.replyTo` 切换标题与目标块；提交成功后由父层清空草稿并重读评论第一页。

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 发表顶级评论**
- When 登录用户输入合法内容并提交
- Then 发出一次创建请求（`parentPublicId` 为 `null`），成功后清空输入并重载评论与统计

**S2 · 回复顶级评论**
- When 用户点击某条顶级评论的 `Reply` 后提交
- Then 表单显示回复目标与 `Cancel reply`，请求体 `parentPublicId` 为该评论对外标识，而非数据库主键

**S3 · 取消回复目标**
- When 用户点击 `Cancel reply`
- Then 清除回复目标、保留已输入内容、焦点回到输入框，不发出请求

**S4 · 字数提示**
- When 用户输入任意文本
- Then 计数按去除首尾空白后的长度显示为 `n/2000`

**S5 · 回复时自动聚焦**
- When 新的回复目标被选中且表单可用
- Then 焦点自动进入输入框；同一目标重复选中不重复抢焦点

### 2.2 异常路径

**S6 · 空白输入**
- When 去空白后长度为 0 且用户提交
- Then 显示 `Write a comment before submitting.`，输入框标记 `aria-invalid` 并聚焦，不发请求

**S7 · 超长输入**
- When 去空白后长度超过 2000 个 UTF-16 代码单元
- Then 输入过程中即显示上限提示，提交被拦截；边界值恰好 2000 允许提交

**S8 · 创建失败保留输入**
- When 服务端返回业务拒绝或网络错误
- Then 显示对应错误，保留输入与回复目标，不增加评论数，不自动重发

**S9 · 草稿锁定**
- When 草稿属于前一会话账户且尚未确认同一账户
- Then 提示草稿锁定并禁用输入与提交，不自动提交

**S10 · 写入中重复提交**
- When 提交尚未结束用户再次提交
- Then 按钮显示 `Please wait…` 并禁用，只发出一次写请求

**S11 · 会话过期**
- When 会话过期导致表单不可写
- Then 输入框与提交按钮禁用，已输入内容保留，不丢失也不跨账户转移

---

## 3. 数据结构

### 3.1 组件 Props

```ts
interface CommentComposerProps {
  draft: CommentDraft
  disabled: boolean
  busy: boolean
  error: string | null
  onChange: (content: string) => void
  onCancelReply: () => void
  onSubmit: () => Promise<'success' | 'failed' | 'ignored'>
}
```

### 3.2 依赖的数据类型

```ts
interface CommentDraft {
  content: string
  replyTo: CommentResponse | null
  ownerPublicId: string | null
  locked: boolean
}

function normalizeCommentContent(content: string): string   // 去首尾 U+0000–U+0020
function commentValidationError(content: string): string | null
```

`CommentResponse` 与 `ReadState<T>` 的定义见 `post-detail.md` 与 `post-comments.md`；本单元只消费 `CommentResponse` 的 `publicId` 与 `content` 两个字段用于展示回复目标。

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `draft.content` | 原文，提交前归一 | 受控值，直接回填不做二次 trim |
| `draft.replyTo` | 顶级评论或 null | 非空时显示目标块与回复标题 |
| `draft.ownerPublicId` | 账户对外标识或 null | 与当前账户不一致时草稿被清空或锁定 |
| `draft.locked` | 布尔 | 为真时禁用输入与提交并显示锁定说明 |
| `error` | 服务端错误文案或 null | 与本地校验消息共用一个错误位，本地校验优先 |
| `busy` | 布尔 | 为真时按钮显示等待文案 |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| 顶级标签 | `Your comment` |
| 回复标签 | `Your reply` |
| 回复目标 | `Replying to comment ID: {publicId}` / `Cancel reply` |
| 帮助文本 | `Plain text. Up to 2000 UTF-16 code units after trimming.` |
| 计数 | `{n}/2000` |
| 空内容 | `Write a comment before submitting.` |
| 超长 | `Comments must be 2000 UTF-16 code units or fewer.` |
| 草稿锁定 | `This draft belongs to your previous session. Confirm the same account to unlock it; it will not be submitted automatically.` |
| 提交按钮 | `Post comment` / `Post reply` / `Please wait…` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容与校验

- [ ] 顶级与回复两种标题正确切换，回复目标块显示对外标识与预览
- [ ] 计数按去空白后长度显示，边界 2000 可提交、2001 被拦截
- [ ] 空白提交被拦截且聚焦输入框
- [ ] 校验消息通过 `aria-describedby` 与输入关联，并用 `aria-invalid` 标记

### 4.2 交互与焦点

- [ ] `Cancel reply` 清除目标、保留内容并把焦点交回输入框
- [ ] 选中新回复目标时自动聚焦输入框
- [ ] 提交成功后输入清空、回复目标清除
- [ ] 提交失败保留输入与目标

### 4.3 状态与身份

- [ ] 写入中按钮显示 `Please wait…` 且禁用，只发一次请求
- [ ] 草稿锁定时禁用输入与提交并显示锁定说明
- [ ] 会话过期时表单禁用但内容保留
- [ ] 不提供对回复再回复的入口

### 4.4 无障碍与响应式

- [ ] `label` 通过 `htmlFor="comment-content"` 绑定输入
- [ ] 错误区 `role="alert"`，锁定说明 `role="status"`
- [ ] 窄屏计数与帮助文本纵向堆叠，按钮不遮挡输入区
- [ ] 断点与真相源 CSS 一致（见 5.3）

### 4.5 工程

- [ ] 校验与提交行为测试覆盖空白、边界、锁定与失败保留（任务 7.1，尚未补齐）
- [ ] `docs/e2e/post-interactions.spec.ts` 覆盖回复输入与父不可用（任务 6.6，尚未运行）
- [ ] `powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 返回 0
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 组件首行 `'use client'`；`attempted` 与焦点引用在组件内维护，草稿内容完全受控于父层
- 表单提交统一 `event.preventDefault()`，通过 `onSubmit()` 的返回值决定是否重置尝试态

### 5.2 CSS Modules 与站点令牌

样式在 `frontend/components/posts/comment-composer.module.css`，取色使用 `--wc-*`；输入框最小高度 140px 且允许纵向拖拽。仓库现状未安装 Tailwind 与 shadcn/ui，不使用表单组件库。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/posts/comment-composer.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 帮助文本与计数同行左右分布，输入内边距 14px |
| `≤ 640px` | 帮助文本与计数改为纵向堆叠，输入内边距收到 12px |

文案换行与按钮位置由浏览器验收，08 只比对上述 CSS 的断点集合。

### 5.4 图片

- 不适用：本单元无图片资源
- 不使用 `next/image`；如后续引入附件预览需另立单元

### 5.5 与现状的差异

| # | 旧形态 | 本轮形态 | 验收边界 |
|---|---|---|---|
| 1 | 无评论输入 | 顶级与回复共用单一输入框 | 回复目标单一且可见 |
| 2 | 无字数口径 | 去空白后 UTF-16 计数 | 与服务端校验一致，服务端仍为终判 |
| 3 | 无草稿归属 | 草稿按账户归属并锁定 | 不跨账户转移 |
| 4 | 无焦点管理 | 选择目标、取消回复均处理焦点 | 由 6.6 取证 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 输入组件 | `frontend/components/posts/comment-composer.tsx` |
| 输入样式 | `frontend/components/posts/comment-composer.module.css` |
| 校验工具 | `frontend/lib/posts/comment-input.ts` |
| 提交编排 | `frontend/components/posts/use-post-detail.ts` |
| 浏览器验收 | `docs/e2e/post-interactions.spec.ts`（任务 6.6） |

```powershell
powershell -File harness/checks/08-spec-doc-breakpoints.ps1
npm --prefix D:\my-first-project\frontend run test -- components/posts lib/posts
npm --prefix D:\my-first-project run test:e2e -- docs/e2e/post-interactions.spec.ts
```

### 场景对应

| 主 spec Scenario | 对应验证 |
|---|---|
| 发表顶级评论 | 提交后清空与重载（待 6.6） |
| 回复根评论 | 目标块与 `parentPublicId`（待 6.6/7.1） |
| 不创建第三层回复 | 回复条目不提供入口（待 7.1） |
| 空白与超长输入 | 校验与边界用例（待 7.1） |
| 创建失败保留输入 | 失败保留且不重发（待 6.6/7.1） |
| 连续点击只发一次 | 忙态禁用（待 7.1） |
| 会话过期 | 表单禁用但保留内容（待 6.6） |
