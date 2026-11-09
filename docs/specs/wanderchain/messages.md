# 私信消息（Direct messages）

| 项 | 值 |
|---|---|
| 单元编号 | Direct messages |
| 归属能力 | `wanderchain-direct-messages` |
| 对应主 spec | 归档后为 `openspec/specs/wanderchain-direct-messages/spec.md`；归档前以在飞 delta 为准 |
| 在飞变更 | `openspec/changes/add-direct-messages/` |
| 规格层级 | 人读契约。已归档行为以主 spec 为准；本轮以已审阅的在飞变更 delta 为准，归档后同步主 spec |
| 单元性质 | 会话列表页、会话页、顶栏消息入口与未读角标 |

---

## 1. 模块边界

界面标签与状态文案使用英文；消息正文、对方昵称与摘要直接展示接口内容，不翻译、不裁剪（摘要截断由后端负责）。日期按 `en-US` 格式化并锁 `Asia/Shanghai`。消息归属只用「发送者是否为对方」判定，不依赖当前用户标识（会话是一对一，非对方即本人）。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 会话列表 | `GET /api/dm/conversations`，按最近活跃倒序；没有消息的会话按创建时间参与同一排序 |
| 2 | 新建会话 | 表单接受用户页地址（`/users/<publicId>`、完整 URL）或 26 位公开标识；创建后跳转会话页 |
| 3 | 会话项 | 对方头像（失败回退首字符）、昵称、最后一条消息摘要、活跃时间、未读徽标 |
| 4 | 三态与空态 | 加载态、错误态（可重试）、无会话空态 |
| 5 | 会话页 | 消息按时间升序渲染（最新在底部），自动贴底 |
| 6 | 更早消息 | 有游标时展示 `Load earlier messages`，按原游标翻页并去重合并 |
| 7 | 发送框 | 客户端先做空白与 2000 码点校验，成功后追加到列表并清空输入 |
| 8 | 进入即已读 | 进入会话并发发出 `POST .../read` 与首页消息；`markRead` 顺带返回对方名片 |
| 9 | 实时推送 | 会话页用 `EventSource` 订阅 `.../stream`，按 `publicId` 去重合并 |
| 10 | 断线补齐 | `onOpen`（首次连接与每次重连）重拉首页合并，覆盖取数与建连之间的空窗 |
| 11 | 顶栏入口 | 已登录显示 `Messages` 与总未读角标（读 `GET /api/dm/unread-count`），超过 99 显示 `99+` |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 用户页的「发私信」入口 | 待 `add-user-detail-page` 归档后另补（见 change 的 Workflow follow-up） |
| 消息中心（评论 / 点赞 / 收藏提醒聚合） | 下一个 change，复用本次会话与未读模型 |
| 会话列表翻页 | 本期首屏取默认 20 条，不提供「查看更多会话」入口；后端限制保持 1–50 钳制 |
| 消息编辑 / 删除、已读回执、正在输入、附件与图片 | 本期不做 |
| WebSocket | 本期用 SSE（design D7），双向能力首版用不上 |
| 顶栏轮询 | 不做常驻定时器；只在窗口重新获得焦点时刷新一次角标 |
| 非参与者可见性 | 非参与者与不存在共用 404，前端文案同样不区分 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 会话列表 | **需要 API（已接入）**：`dmApi.conversations` → 同源 `GET /api/dm/conversations` | 响应 `DmConversationListResponse` 直接作为视图类型，不做恒等转换 |
| 新建会话 | **需要 API（已接入）**：`dmApi.create` → `POST /api/dm/conversations` | 重复发起返回 200 与既有会话；自聊 400，对方不存在 404 |
| 消息分页 | **需要 API（已接入）**：`dmApi.messages` → `GET .../messages?limit=20&cursor=` | `hasMore` 仅由 `nextCursor !== null` 派生 |
| 发送消息 | **需要 API（已接入）**：`dmApi.send` → `POST .../messages` | 与读取同一路径、方法不同；正文原文提交 |
| 标记已读 | **需要 API（已接入）**：`dmApi.markRead` → `POST .../read` | 返回更新后的会话摘要，同时充当「读单会话」 |
| 总未读 | **需要 API（已接入）**：`dmApi.unreadCount` → `GET /api/dm/unread-count` | 只返回 `{ count }`，不为一个数字拉整页会话（design D9） |
| 实时推送 | **需要 API（已接入）**：`dmApi.stream` → `EventSource GET .../stream` | `message` 事件载荷即 `DmMessageResponse`；`open` 事件转成一次 `onOpen` |
| 输入解析与校验 | **静态函数**：`lib/dm/dm-input.ts` | 与后端 `DmInputRules` 同口径的即时提示，最终仍以服务端判定为准 |
| 时间格式 | **静态函数**：`lib/home/format.ts` 的 `formatDate` | 英文月日，`Asia/Shanghai` |

Mock 约定：`NEXT_PUBLIC_DM_MOCK !== '0'` 时走进程内 Mock（默认），设 `0` 切真接口。页面只 import `dmApi`，不感知分流。

### 1.4 与其他单元的关系

- **依赖**：认证单元（会话状态只来自 `GET /api/auth/me`，401 一律视为会话失效）、共享页头页脚与 `wc-container`、`formatDate`、`lib/contracts/dm.ts` 契约镜像（10 号闸门双向比对）。
- **被依赖**：无。顶栏入口出现在所有页面，但未登录时不渲染、不发请求。
- **衔接**：登录跳转只到 `/login`，不扩 `safeReturnTo` 白名单；用户页「发私信」入口与消息中心在后续 change 接入。

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 列表页首屏**
- When 已登录用户访问 `/messages`
- Then 先显示 `role="status"` 加载提示，随后按最近活跃倒序展示会话项

**S2 · 新建会话**
- When 用户在表单粘贴 `/users/<publicId>` 或 26 位公开标识并提交
- Then 调用 `POST /api/dm/conversations`，成功后跳转 `/messages/<会话公开标识>`

**S3 · 会话项字段**
- When 列表渲染完成
- Then 每项显示对方头像或首字符占位、昵称、摘要、活跃时间与未读数；摘要为空时显示 `No messages yet.`

**S4 · 进入即已读**
- When 用户进入会话页
- Then `markRead` 与首页消息并发发出，对方名片取自 `markRead` 的返回

**S5 · 发送消息**
- When 用户输入非空且不超过 2000 码点的正文并提交
- Then 新消息按时间合并进列表底部，输入框清空

**S6 · 推送到达**
- When 会话页已就绪，对方发来新消息
- Then 页面无需刷新即出现；自己的消息与推送重复时只保留一条

**S7 · 断线重连补齐**
- When `EventSource` 自动重连成功（`onOpen` 触发）
- Then 重拉首页并按 `publicId` 合并，中断期间的消息不重复、不遗漏

**S8 · 载入更早**
- When 用户点击 `Load earlier messages`
- Then 按当前游标取更早一页并合并；游标为空后按钮消失

**S9 · 顶栏角标**
- When 已登录用户停留在任意页面
- Then 顶栏显示 `Messages` 入口；有未读时显示数字角标，超过 99 显示 `99+`

### 2.2 异常路径

**S10 · 未登录**
- When 游客访问列表页或会话页
- Then 不请求私信接口，展示登录提示并 `router.replace('/login')`

**S11 · 列表加载失败**
- When 会话列表请求失败
- Then 展示 `role="alert"` 与 `Retry`；点击后重新加载，不切换为 Mock

**S12 · 会话加载失败**
- When 会话首页或标记已读失败
- Then 展示 `role="alert"` 与 `Retry`；重试沿用同一条会话路径

**S13 · 新建输入非法**
- When 输入无法解析出公开标识
- Then 不发请求，就地提示 `That doesn't look like a member address.`

**S14 · 新建被拒**
- When 服务端返回 `DM_SELF_CONVERSATION` / `DM_PEER_NOT_FOUND` / `VALIDATION_FAILED`
- Then 表单内展示 `describeDmError` 的对应文案，不跳转

**S15 · 空态**
- When 当前用户没有任何会话
- Then 展示 `No conversations yet.` 与引导文案，不渲染列表

**S16 · 发送校验失败**
- When 正文为空 / 纯空白 / 超过 2000 码点
- Then 就地提示，不发请求；服务端 400 同样落在这条提示区

**S17 · 会话过期**
- When 任一请求返回 `UNAUTHENTICATED`
- Then 调 `expireSession()` 收回到游客态并按 S10 跳转

**S18 · 角标读取失败**
- When 总未读请求失败
- Then 不显示数字角标（不猜未读数），顶栏不变成错误提示区

**S19 · 列表页不建立推送**
- When 用户停留在会话列表页
- Then 不调用 `dmApi.stream`，未读仍由列表接口反映

---

## 3. 数据结构

### 3.1 页面 Props

`MessagesContent` 无外部 props；`Conversation` 接收 `publicId: string`（由服务端页面 `await params` 后传入，并用 `key` 隔离会话切换）。两者都是 Client Component。

### 3.2 依赖的数据类型

```ts
interface DmPeer {
  publicId: string
  displayName: string
  avatarUrl: string
}

interface DmConversation {
  publicId: string
  peer: DmPeer
  messageCount: number
  unreadCount: number
  lastMessagePreview: string | null
  lastMessageAt: string | null
  createdAt: string
}

interface DmMessage {
  publicId: string
  senderPublicId: string
  content: string
  createdAt: string
}

interface DmMessagePage {
  items: DmMessage[]
  nextCursor: string | null
  hasMore: boolean // 仅由 nextCursor !== null 派生
}
```

真源是 `frontend/lib/contracts/dm.ts` 的八个 interface，逐字镜像后端 `web/dm/dto/` 的 record；`lastMessagePreview` / `lastMessageAt` / `nextCursor` 在后端可空，前端按 `string | null` 声明（10 号闸门会把 `| null` 归一后比对）。

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `publicId` | 26 位 ULID | 列表 key、会话路由与推送去重键 |
| `peer.displayName` | 接口原文 | 会话标题与列表名称，不翻译 |
| `peer.avatarUrl` | string，空串表示无头像 | 加载失败或无地址回退首字符（`aria-hidden`） |
| `unreadCount` | 非负整数 | 大于 0 才显示徽标；视觉数字 + 隐藏文本 ` unread` |
| `lastMessagePreview` | 可空；后端已按 50 字符截断 | 空时显示 `No messages yet.` |
| `lastMessageAt` / `createdAt` | ISO 时间 | `dateTime` 原值；显示用 `formatDate`；排序取 `lastMessageAt ?? createdAt` |
| `senderPublicId` | 真实对外标识 | 仅用于判定气泡归属与已读推进，不渲染给用户 |
| `nextCursor` | 不透明 string 或 null | 原样透传，不解析、不构造 offset |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| 列表 eyebrow / 标题 | `Messages` / `Direct messages` |
| 会话检查中 | `Checking your session…`（`role="status"`） |
| 游客提示 | `Please log in to read your messages.` |
| 列表加载 | `Loading messages…`（`role="status"`） |
| 列表错误 | `describeDmError` 归一文案 + `Retry`（`role="alert"`） |
| 空态 | `No conversations yet.` / `Start one with a member's page address above.` |
| 新建表单 | `Start a conversation` / `Paste a member page address or public ID.` |
| 新建按钮 | `Open chat` / `Opening…` |
| 输入非法 | `That doesn't look like a member address.` |
| 会话项无消息 | `No messages yet.` |
| 会话页返回 | `Back to messages` |
| 会话页标题 | 对方昵称；名片未到时 `Conversation` |
| 会话加载 | `Loading conversation…`（`role="status"`） |
| 会话错误 | `describeDmError` 归一文案 + `Retry`（`role="alert"`） |
| 会话空态 | `No messages yet. Say hello.` |
| 载入更早 | `Load earlier messages` / `Loading…` |
| 发送按钮 | `Send` / `Sending…` |
| 正文校验 | `Write something before sending.` / `Messages must be 2000 characters or fewer.` |
| 顶栏入口 | `Messages`；角标隐藏文本 ` unread` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 列表页渲染标题、新建表单与会话列表
- [ ] 会话项显示对方名片、摘要、活跃时间与未读数
- [ ] 新建成功跳转对应会话；非法输入不发请求
- [ ] 会话页按时间升序渲染消息，最新一条在底部
- [ ] 发送成功后消息追加、输入清空
- [ ] 推送与重连补拉按 `publicId` 去重
- [ ] 顶栏已登录显示入口与角标，未登录不渲染

### 4.2 数据规则

- [ ] 列表排序取 `lastMessageAt ?? createdAt`，无消息会话不被排除
- [ ] 分页原样透传游标，`hasMore` 只由 `nextCursor` 派生
- [ ] 进入会话即调用 `markRead`，名片取自同一返回
- [ ] 正文按码点判长，2000 接受、2001 拒绝；空白拒绝
- [ ] 列表页不调用 `dmApi.stream`
- [ ] 401 统一走 `expireSession()`，不在页面内自造登录态

### 4.3 状态

- [ ] 加载态使用 `role="status"`
- [ ] 错误态使用 `role="alert"` 并提供重试
- [ ] 空态不渲染列表 / 消息列表
- [ ] 发送与新建的就地错误不打断已渲染内容
- [ ] 角标读取失败不显示数字

### 4.4 无障碍与响应式

- [ ] 消息列表使用 `<ol>` / `<li>`，容器 `aria-live="polite"`
- [ ] 头像 `alt=""`（装饰性）；首字符占位 `aria-hidden`
- [ ] 未读徽标带隐藏文本 ` unread`，读屏得到「3 unread」
- [ ] 发送框有可访问标签（视觉隐藏），按钮为可聚焦的 submit
- [ ] 顶栏入口是链接，键盘可达

### 4.5 工程

- [ ] `npx vitest run app/messages` 覆盖列表三条分支与会话五条分支
- [ ] `npx vitest run components/site` 覆盖角标显示 / 隐藏
- [ ] 08 文档断点闸门返回 0
- [ ] `npx tsc --noEmit` 无输出
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 列表页与会话页均为 Server Component 外壳 + Client Component 内容；`params` 是 Promise，服务端 `await` 后传 `publicId`
- 会话切换用 `key={publicId}` 隔离组件状态
- 数据只经 `lib/dm/dm-api.ts` 的 `dmApi`；页面不直接 `fetch`，也不写 Mock 分支
- 推送只经 `dmApi.stream`（`EventSource`），页面不自行 `new EventSource`
- 样式：`frontend/app/messages/messages.module.css` 与 `frontend/app/messages/[publicId]/conversation.module.css`

### 5.2 CSS Modules 与站点令牌

取色使用 `--wc-*`，留白由 `wc-container` 唯一承担，局部限宽用 `max-inline-size`。消息气泡保留 `white-space: pre-wrap` 与 `overflow-wrap: anywhere`，长串与换行都不撑破布局。

### 5.3 响应式（desktop-first）

真相源：`frontend/app/messages/messages.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 新建表单横向排列；会话项单行卡片 |
| `≤ 640px` | 列表页头部与新建表单纵向堆叠；会话页输入区纵向堆叠 |

会话页的 `conversation.module.css` 同样只声明 `640px` 一个断点，但 08 闸门只比对上面登记的列表页 CSS；会话页的具体视觉与气泡宽度由浏览器验收。

### 5.4 图片

- 头像使用原生 `<img>`，非 `next/image`；`alt=""`、`loading="lazy"`
- 无地址或加载失败回退首字符占位（`--wc-green-soft` 底 / `--wc-green` 字）
- 回退状态按会话 `publicId` 记录，换头像地址后自动重试加载

### 5.5 与规格的对齐说明

| # | 决策 | 依据与边界 |
|---|---|---|
| 1 | 接口按创建时间倒序，页面反向渲染为升序 | 聊天阅读顺序自上而下；「追加」才落在底部（tasks 6.2 已记录偏差） |
| 2 | 断线补齐用 `onOpen` 重拉首页 | `EventSource` 自带重连；`onOpen` 含首次连接，一并覆盖建连前的空窗 |
| 3 | 会话页在台时对方新消息静默 `markRead` | 未读不在打开着的会话里累积；失败不打断渲染 |
| 4 | 顶栏只在 focus 刷新，不轮询 | 避免常驻流量；列表/会话页自身的取数仍是未读的主来源 |
| 5 | 未登录只跳 `/login` | `safeReturnTo` 白名单仅允许 `/posts/<ulid>`，本次不扩 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 列表页 | `frontend/app/messages/page.tsx`、`frontend/app/messages/messages-content.tsx` |
| 列表页样式 | `frontend/app/messages/messages.module.css` |
| 会话页 | `frontend/app/messages/[publicId]/page.tsx`、`frontend/app/messages/[publicId]/conversation.tsx` |
| 会话页样式 | `frontend/app/messages/[publicId]/conversation.module.css` |
| 顶栏入口 | `frontend/components/site/message-badge.tsx`、`frontend/components/site/site-header.tsx` |
| 数据调用层 | `frontend/lib/dm/dm-api.ts` |
| 输入解析与校验 | `frontend/lib/dm/dm-input.ts` |
| 契约镜像 | `frontend/lib/contracts/dm.ts` |
| 页面用例 | `frontend/app/messages/messages-content.test.tsx`、`frontend/app/messages/[publicId]/conversation.test.tsx` |
| 顶栏用例 | `frontend/components/site/message-badge.test.tsx` |
| 调用层用例 | `frontend/lib/dm/dm-api.test.ts`、`dm-api.mock.test.ts`、`dm-input.test.ts` |

```powershell
cd frontend
npx vitest run app/messages components/site lib/dm
npx tsc --noEmit
powershell -File harness/checks/08-spec-doc-breakpoints.ps1
```

### 与在飞 delta 的对应

| delta Scenario | 对应验证 |
|---|---|
| 首次发起创建会话 / 重复发起返回同一会话 / 不能向自己发起 / 对方不存在 | 后端 `DmControllerTest`；`dm-api.mock.test.ts` 的重复与自聊分支；列表页新建成功跳转用例（浏览器链路见任务 7.1） |
| 只返回本人参与的会话 / 按最近活跃时间倒序 / 每项含对方名片与未读数 / 没有会话时返回空列表 | 后端 `DmServiceImplTest`；列表页列表渲染与空态用例 |
| 会话读写仅限参与者 / 未登录被拒绝 | 后端控制器 401/404 用例；页面 `isUnauthenticated` → `expireSession` 分支 |
| 消息游标分页 | 后端分页用例；`dm-api.test.ts` 游标与 `nextCursor`；页面「载入更早」 |
| 文本消息校验 | 后端 `DmInputRulesTest`；`dm-input.test.ts` 空/空白/2000/2001/emoji；页面发送用例 |
| 发送消息并更新会话摘要 | 后端实现与用例；页面发送成功追加用例 |
| 未读计数与已读标记 | 后端用例；会话页进入即已读、顶栏角标用例 |
| 会话内新消息实时推送 | 后端 `DmEventBrokerTest`；会话页推送去重与断线重连补齐用例；列表页不建立推送（S19） |
