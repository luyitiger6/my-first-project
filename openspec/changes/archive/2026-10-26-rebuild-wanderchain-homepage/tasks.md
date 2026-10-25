# Tasks

## 1. 契约与 Mock 数据层（单元 0）

- [x] 1.1 新建 `lib/home/types.ts`：`CitySlug`、`EditorPick`、`Post`、`Attraction`、`ContentStatus`（published/draft/removed）、`ListQuery`、`ListResult<T>`。
- [x] 1.2 新建 `lib/home/cities.ts`：8 个 MVP 城市（`all` + 北京、上海、广州、成都、西安、杭州、三亚），含 slug、中文名、主题色；导出 `parseCity` 把非法值归一化为 `all`。
- [x] 1.3 新建 `lib/home/mock-data.ts`：不少于 6 条编辑精选、14 条帖子（含草稿与已删除）、9 个景点（含草稿），城市覆盖全部 7 城。
- [x] 1.4 新建 `lib/home/repository.ts`：`HomeRepository` 接口 + `mockRepository`，实现城市过滤、Top N 截断与三级排序（sort_order/id；评论数/浏览数/发布时间；浏览数/发布时间）。
- [x] 1.5 新建 `lib/home/repository.test.ts`：断言排序、截断、过滤、仅 published、重复调用结果稳定。

## 2. 清理旧界面与首页骨架（单元 2）

- [x] 2.1 删除 `components/TodoApp.tsx`、`components/TodoApp.test.tsx`、`lib/api.ts`；保留 `app/api/[...path]/route.ts` 与 `route.test.ts`。
- [x] 2.2 重写 `app/page.tsx`：服务端组件组合五个区块，读取 `searchParams.city` 后向内容区块下发；返回按钮布局与页脚。
- [x] 2.3 重写 `app/layout.tsx` 元信息为 wanderchain（标题、描述、`lang="zh-CN"`），并接入 `AuthProvider`。
- [x] 2.4 重写 `app/globals.css` 为设计令牌（色板、字号、间距、圆角、阴影）与基础排版；删除 Todo 相关样式。
- [x] 2.5 新建 `components/home/section-boundary.tsx`：客户端 Error Boundary，失败时渲染区块级错误态，不影响其他区块。
- [x] 2.6 新建 `app/page.test.tsx`：断言区块顺序、`?city=` 透传、非法回归 `all`、单区块异常隔离。

## 3. 功能导航栏（单元 3）

- [x] 3.1 新建 `components/home/feature-nav.tsx` + `feature-nav.module.css`：三张卡片（旅游社区 `/community`、景点攻略 `/attractions`、AI 助手按钮），含图标、标题、描述。
- [x] 3.2 新建 `app/community/page.tsx` 与 `app/attractions/page.tsx` 占位页：说明板块建设中并提供返回首页链接，保证导航不落入 404。
- [x] 3.3 新建 `components/home/feature-nav.test.tsx`：三张卡片齐全、链接指向正确、AI 卡片触发面板、移动端结构断言。

## 4. AI 助手入口（单元 4）

- [x] 4.1 新建 `components/home/ai-assistant.tsx` + `ai-assistant.module.css`：悬浮按钮 + 顶部入口共用同一面板，面板为客户端状态。
- [x] 4.2 实现关闭路径：关闭按钮、Esc、点击遮罩；打开时把焦点移入面板，关闭后归还焦点到触发按钮。
- [x] 4.3 新建 `components/home/ai-assistant.test.tsx`：两种入口打开同一面板、三种关闭方式、打开期间不产生 fetch/XHR（mock 全局 `fetch` 并断言调用次数为 0）。

## 5. 城市快速入口（单元 5）

- [x] 5.1 新建 `components/home/city-switcher.tsx` + `city-switcher.module.css`：渲染 8 个入口，当前城市高亮，`aria-pressed` 标记选中态。
- [x] 5.2 点击时用 `router.replace` 写入 `?city=`（保留其他查询参数），非 `all` 城市清空后仍可回到 `all`。
- [x] 5.3 新建 `components/home/city-switcher.test.tsx`：点击改写 URL、直接访问时高亮、非法值回落 `all`、选中态唯一。

## 6. 内容区块三单元（单元 6/7/8）

- [x] 6.1 新建 `components/home/editor-picks.tsx` + `editor-picks.module.css`：卡片含封面、标题、城市、编辑署名、摘要；空态文案。
- [x] 6.2 新建 `components/home/hot-posts.tsx` + `hot-posts.module.css`：序号、标题、作者、评论数、浏览数、发布时间；空态文案。
- [x] 6.3 新建 `components/home/hot-attractions.tsx` + `hot-attractions.module.css`：封面、名称、城市、评分、浏览量；空态文案。
- [x] 6.4 新建三个对应 `*.test.tsx`：断言条数上限、顺序、只展示 published、空态，全部使用 Mock 数据切片，不发起网络请求。

## 7. Mock 认证（单元 1）

- [x] 7.1 新建 `lib/auth/mock-auth.ts`：注册、登录、登出、读取会话；localStorage 持久化；令牌为三段式假 JWT（payload 含 `sub/role/exp`），内置 `admin@wanderchain.dev` 账号。
- [x] 7.2 新建 `components/auth/auth-provider.tsx`：`AuthProvider` + `useAuth()`，暴露 loading / guest / user 三态与 login/register/logout 方法。
- [x] 7.3 新建 `app/login/page.tsx` 与 `app/register/page.tsx`：邮箱 + 密码（注册含用户名与确认密码）、错误提示、成功后回首页。
- [x] 7.4 新建 `components/auth/account-menu.tsx`：头部登录入口 / 用户名与退出按钮，接入首页骨架。
- [x] 7.5 新建 `lib/auth/mock-auth.test.ts` 与 `components/auth/account-menu.test.tsx`：注册后进入登录态、密码错误被拒、刷新保持、角色字段、退出后回访客态。

## 8. 规格维护与验收

- [x] 8.1 修订 `openspec/specs/frontend-nextjs/spec.md` 的 Purpose：去掉"Todo 最小界面"，改为 wanderchain 首页；其余 Requirement 结构不动。
- [x] 8.2 全仓检索 `Todo`、`api/todos`、`getTodos`，确认无残留在前端源码、测试与 README 中（历史 change 与 archive 除外）。
- [x] 8.3 在 `frontend/` 执行 `npm run build` 与 `npm run test`，两者退出码均为 0，测试用例数不少于 30。
- [x] 8.4 在仓库根执行 `powershell -File harness\run-all.ps1`，退出码为 0（00–06 全通过）。
- [x] 8.5 执行 `openspec validate rebuild-wanderchain-homepage --strict`，结果为 valid。
