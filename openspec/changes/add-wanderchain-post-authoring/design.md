# Design

## Context

见 `proposal.md` 的 Why。当前实现事实决定了这次的做法边界：

- 后端三个写端点已完整可用：`POST /api/posts`（缺省 `status=draft`）、`PUT /api/posts/{publicId}`、`DELETE /api/posts/{publicId}`；作者取自令牌，非作者返回 `403 POST_FORBIDDEN`，目标不存在或已软删返回 `404 POST_NOT_FOUND`，入参不合法返回 `400 VALIDATION_FAILED`。
- 入参规则集中在后端 `PostInputRules`：标题 1–120 字符（按 code point）、正文非空且 ≤65535 UTF-8 字节、封面为空或 `http(s)` 绝对地址且有 host、标签 ≤10 个且每个 1–32 字符、按值去重。
- 前端 `lib/posts/posts-api.ts` 已有统一 `request()`、`PostsApiError`、`PostsNetworkError` 与 `describePostsError()`，但只接了读与互动，没有 create/update/remove。
- `lib/auth/return-to.ts` 的 `safeReturnTo` 只放行 `[0-7][0-9A-HJKMNP-TV-Z]{25}` 形态的 `/posts/<publicId>`，任何其它路径都被丢弃。
- 详情页现有 `usePostDetail` 已管理详情、评论、个人状态的读取代次，以及投票/收藏/评论三类写锁。

## Goals / Non-Goals

**Goals:**

- 让作者在站内完成写帖 → 发布/存草稿 → 编辑 → 删除的闭环，结果以服务端返回为准。
- 前端校验口径与后端逐条对齐，但只作即时提示，不冒充服务端判定。
- 复用既有请求层、错误语义与认证回跳规则，不新增契约字段、不改后端。

**Non-Goals:**

- 图片上传与对象存储（封面只收 URL）。
- 草稿列表与「我的帖子」入口（草稿保存后靠详情页继续维护）。
- 自动保存、离线草稿、富文本 / Markdown 渲染。
- 帖子与景点关联、定时发布、审核流。

## Decisions

**D1. 两个路由共用一个表单组件。** `/posts/new` 与 `/posts/[publicId]/edit` 各自是薄 page，渲染同一个 `PostEditor`：new 传空初值，edit 传服务端取回的初值。替代方案是同一页用 query 参数区分，但那会让「缺公开标识」与「有标识」两种失败语义混在一个页面里，不好写清楚。

**D2. 不扩展认证回跳白名单。** `safeReturnTo` 只认 `/posts/<ULID>`，因此 `/posts/new` 不能作为登录后的 `next`。选的做法是：未登录进入 `/posts/new` 时页内直接给登录引导（链接 `/login`），登录后用户自行回到写帖页。替代方案是放宽白名单接受 `/posts/new`，但那会修改已归档的认证前端能力要求，为一次跳转引入一个 MODIFIED delta，不划算。

**D3. 作者判定用前端账户比对，不新增后端字段。** `auth.status === 'user' && auth.user.publicId === detail.authorPublicId` 时展示编辑与删除。替代方案是让后端在详情响应里加 `canEdit`，那属于契约变更且需要过 10 号闸门，本次不做。

**D4. 校验写成纯函数模块 `lib/posts/post-input.ts`。** 与既有 `comment-input.ts` 同风格：输入原始字段，返回归一结果或首个错误码。字符数按 code point 计，正文字节用 `TextEncoder` 计 UTF-8 长度，与 Java 侧 `getBytes(UTF_8).length` 同义。前端只负责「能不能发出去」的即时提示；真正的接受与否仍由服务端决定。

**D5. 标签用单行文本输入，提交前拆分。** 支持中英文逗号与换行分隔，`trim` 后按值去重并保持首次出现的顺序，与后端 `LinkedHashSet` 语义一致。替代方案是逐个 chip 输入，交互更重且对窄屏不友好。

**D6. 写成功后直接跳转，不做乐观插入。** 发布与存草稿都跳 `/posts/{publicId}`，由详情页重新读服务端数据；编辑保存后返回详情并重读。这样界面上不会出现「本地插了一篇、服务端没落地」的假成功，也不需要维护列表的本地缓存失效逻辑。

**D7. 删除沿用行内二次确认。** 与本人删除评论的既有形态一致（同页确认，取消不发请求），成功 `DELETE` 后 `router.push('/posts')` 并刷新。替代方案是原生 `confirm()`，但无法做可访问名称与键盘取消，且与站内其它确认形态不一致。

**D8. 失败语义直接复用 `describePostsError`。** 401 触发会话复核与登录入口，403/404/400 各自给对应文案，网络异常提示无法连接；写请求一律不自动重试，已填内容一律保留在表单里。

**D9. 草稿在详情页显式标注。** `status === 'draft'` 时渲染草稿徽标与「Only you can see this draft」，编辑入口保留。他人访问草稿由后端返 404，前端沿用既有「未找到」界面，不区分草稿与不存在。

**D10. 提交锁只在本组件内。** `submitting` 期间禁用提交按钮并置 `aria-busy`，防止重复投递；离开页面即丢弃结果，不做写作请求的取消编排——写请求不该被导航悄悄中止。

## Risks / Trade-offs

- **[游客点写帖要多走一步]** → 因为不改回跳白名单，游客登录后会落在登录页的默认目标，需要自己回到 `/posts/new`。缓解：入口文案与登录后引导明确写清「Log in, then come back to write」。
- **[草稿保存后没有列表可找]** → 保存后立即跳详情并显示草稿徽标，至少当场可见；长期由后续「个人内容中心」提供草稿列表。
- **[前后端校验口径漂移]** → 前端规则写在单个纯函数里并逐条对齐后端常量；即使漂移，服务端仍返回 `VALIDATION_FAILED` 并被界面按失败处理，不会产生非法数据。
- **[正文字节数在浏览器测得]** → 用 `TextEncoder` 而非 `content.length`，与 Java UTF-8 字节数一致；代理层只透传不转码。
- **[编辑页与删除并发]** → 帖子被他人删掉后 PUT/DELETE 返回 404，界面按「该帖已不存在」处理并给回广场链接，不重试。

## Migration Plan

无数据结构变更，也没有需要保住的数据。实施顺序：先补 `postsApi` 三个方法与 `post-input` 校验，再做表单与两个路由，然后接详情页作者操作与广场入口，最后走一次真实联调链路（登录 → 写帖 → 广场可见 → 编辑 → 删除 → 广场消失）。回滚只需回退前端提交，后端零改动。
