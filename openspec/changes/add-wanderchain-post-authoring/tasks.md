# Tasks

## 1. 请求层与校验口径

- [x] 1.1 在 `frontend/lib/posts/posts-api.ts` 补齐 `create(input)`、`update(publicId, input)`、`remove(publicId)` 三个方法，复用既有 `request()`、`PostsApiError` 与 `JSON` 写头；以三个方法分别命中 `POST /api/posts`、`PUT /api/posts/{publicId}`、`DELETE /api/posts/{publicId}`，`remove` 收到 204 时返回 `void` 为完成判据
- [x] 1.2 新建 `frontend/lib/posts/post-input.ts`，实现标题 trim 后 1–120 字符、正文非空且 `TextEncoder` 计 UTF-8 字节 ≤65535、标签按中英文逗号与换行拆分后去重且 ≤10 个、每个 1–32 字符、封面为空或 `http(s)` 绝对地址的归一与首个错误返回；以对合法输入产出与后端同形字段、对每种非法输入各返回对应错误为完成判据

## 2. 写帖表单与两个路由

- [x] 2.1 新建 `frontend/components/posts/post-editor.tsx` 与同名 CSS Module：标题、正文、标签、封面地址、状态选择，字段带可见 label，错误通过 `aria-describedby` 关联，提交中置 `aria-busy` 并禁用提交；以空标题、超限标签、非法封面三种输入都在本地被拦住且不出网，合法输入只触发一次提交回调为完成判据
- [x] 2.2 新建 `frontend/app/posts/new/page.tsx`：未登录时只渲染登录引导与回广场链接、不渲染表单；登录时渲染编辑器，发布成功跳 `/posts/{publicId}`，存草稿成功跳详情；以游客看不到表单、登录发布后落到详情且标题一致为完成判据
- [x] 2.3 新建 `frontend/app/posts/[publicId]/edit/page.tsx`：先读取详情并预填，保存走 `update` 后回详情；详情返回 404 时显示「该帖已不存在」并给回广场链接；以作者保存新标题后详情显示新标题、帖子数不增加为完成判据

## 3. 详情页作者操作

- [x] 3.1 在 `frontend/components/posts/use-post-detail.ts` 增加作者判定（当前账户 `publicId` 与详情 `authorPublicId` 相同）与删除写路径，删除失败按 `401/403/404` 分别落到会话失效、无权、已不存在的既有语义，不自动重试；以他人详情不出现作者操作、作者点击删除后只发一次 `DELETE` 为完成判据
- [x] 3.2 在 `frontend/components/posts/post-detail.tsx` 渲染编辑与删除入口及行内二次确认，`status === 'draft'` 时显示草稿徽标与「Only you can see this draft」；以取消确认不发请求、确认后跳 `/posts` 且列表不再含该帖为完成判据

## 4. 广场入口

- [x] 4.1 在 `frontend/app/posts/posts-content.tsx` 增加「Write a post」入口指向 `/posts/new`，游客态文案说明需先登录；以登录态点击进入写帖页、游客态文案与链接正确为完成判据

## 5. 真实联调

- [x] 5.1 走一次发布链路：登录 → 写帖并发布 → 广场按最新可见该帖 → 详情编辑标题 → 详情显示新标题 → 删除并确认 → 广场不再出现；以浏览器实际操作结果与 `npm --prefix frontend run build` 退出码 0 为完成判据
- [x] 5.2 走一次草稿链路：写帖存为草稿 → 详情显示草稿徽标 → 广场列表中查不到该帖；以实际页面结果并与 5.1 同期一次完成为完成判据

## Workflow follow-up

- proposal、specs、design 经人工审阅放行后才进入实施。
- 实施完成后按 `AGENTS.md` 的归档流程归档该 change（需单独授权）。
