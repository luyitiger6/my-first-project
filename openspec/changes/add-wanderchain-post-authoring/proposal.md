# Proposal

## Why

wanderchain 目前只能「消费」帖子：广场能按三种维度浏览、详情能投票收藏评论，但全站没有任何发帖入口，内容只能靠脚本或直接写库产生。后端 `POST /api/posts`、`PUT /api/posts/{publicId}`、`DELETE /api/posts/{publicId}` 在 `wanderchain-posts` 中早已定稿并实现（含作者校验、草稿可见性、入参校验），前端却一条都没接——这是当前最直接的业务断头路。

## What Changes

- 新增 `/posts/new` 写帖页：标题、正文、标签、封面图地址、状态（发布 / 草稿），提交走同源 `POST /api/posts`。
- 新增 `/posts/{publicId}/edit` 编辑页：作者本人可改标题、正文、标签、封面、状态，走 `PUT /api/posts/{publicId}`。
- 详情页对作者本人展示编辑与删除入口；删除前必须明确确认，成功后回到广场。
- 广场页与详情页提供「Write a post」入口；未登录点击引导登录并带回跳目标。
- 表单校验与后端口径一致并即时提示：标题去首尾空白后 1–120 字符、正文非空且不超过 65535 字节、标签最多 10 个且每个 1–32 字符、封面为空或 `http(s)` 绝对地址；前端提示不作为最终判定，落库与否由服务端决定。
- 草稿保存后不进入任何列表；本人可凭详情地址继续编辑，并在详情页看到草稿标识与他人不可见说明。
- 补齐前端 `postsApi` 的 `create` / `update` / `remove` 三个方法与对应调用。
- 明确不做：图片上传（无对象存储，封面只收 URL）、草稿列表（属于后续「个人内容中心」）、帖子与景点关联、任何后端改动。

## Capabilities

### New Capabilities

- `wanderchain-post-authoring`: 作者在前端完成「写帖 → 编辑 → 删除」的完整行为：入口与路由、表单字段与校验口径、提交成功与失败后的界面结果、作者可见性与草稿提示、删除确认与后果。

### Modified Capabilities

- 无。后端契约能力 `wanderchain-posts` 已完整覆盖这三个端点，本次不新增端点、不改字段、不改错误码；广场页与详情页既有的读法与互动要求（`wanderchain-post-feed`、`wanderchain-post-interactions-frontend`）不发生变化，新增的只是页面上的作者操作入口，由新能力承载。

## Impact

- 前端代码：`lib/posts/posts-api.ts`（新增三个方法）、`lib/posts/post-input.ts`（表单归一与校验，风格对齐既有 `comment-input.ts`）、`app/posts/new/page.tsx`、`app/posts/[publicId]/edit/page.tsx`、`components/posts/`（表单组件与其 CSS Module）、`post-detail.tsx` 与 `use-post-detail.ts`（作者操作与删除）、`posts-content.tsx`（写帖入口）。
- 后端：不改代码，只复用已存在的三个写端点。
- 契约：`lib/contracts/posts.ts` 已有 `PostCreateRequest` 与 `PostUpdateRequest`，字段名与类型无增删，`harness/checks/10-contract-check.ps1` 不受影响。
- 认证：复用既有 `safeReturnTo` 白名单回跳；发帖与编辑路由必须登录，未登录时引导登录并带回跳。
- 验证口径：按快速 MVP，只走一次真实前后端联调链路（登录 → 写帖 → 广场可见 → 编辑 → 删除 → 广场消失），不写单元测试与 E2E，不跑全量 Harness。
