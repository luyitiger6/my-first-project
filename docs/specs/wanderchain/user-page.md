# 用户页 · Public member page

| 项 | 值 |
|---|---|
| 单元编号 | 用户页（`/users/{publicId}`） |
| 归属能力 | `wanderchain-user-page` |
| 对应主 spec | `openspec/changes/add-user-detail-page/specs/wanderchain-user-page/spec.md`（在飞 delta；归档后同步主 spec） |
| 规格层级 | 人读契约。行为真相以 delta spec 为准，本文件只描述实现边界 |
| 单元性质 | 以 `publicId` 为唯一输入的只读页；资料与帖子列表并行取数，失败粒度彼此独立 |

---

## 1. 模块边界

界面语言：英文单语；用户填写的昵称、简介与兴趣标签原样展示，不翻译、不替换为 Mock 文案。资料四项之外不补假摘要、城市、关注数或账户状态。任何状态都不把 26 位对外标识当作昵称渲染——兜底只在昵称为空时使用 `Member` + 标识后四位。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 路由参数 | 路径段 `params.publicId` 原样交给取数层，页面不校验标识格式 |
| 2 | 资料头 | 头像、`h1` 昵称、简介、兴趣标签四项 |
| 3 | 昵称兜底 | 昵称为空（含纯空白）时展示 `Member {标识后四位}`（OQ2 决策） |
| 4 | 空字段标注 | 简介为空显示 `This member has not written a bio yet.`，兴趣为空显示 `No interests listed yet.`，不留视觉空洞 |
| 5 | 帖子列表 | 该作者已发布帖子，按发布时刻倒序，复用广场的 `PostCard` 与 `useInfinitePosts` |
| 6 | 列表翻页 | 原样透传不透明游标，`limit=20`，`publicId` 去重，到底提示 |
| 7 | 资料四态 | `loading` / `ready` / `not-found` / `error` 互斥；`not-found` 只渲染不存在态 |
| 8 | 列表三态 | `loading` 骨架 / `ready`（含空态）/ `error` 可重试；失败只影响列表区 |
| 9 | 骨架 | 资料未就绪时展示资料骨架与两张帖子骨架，不渲染任何假内容 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 关注 / 私信 / 用户搜索 / 用户列表 | 未立项 |
| 作者本人在用户页看草稿 | design D8：用户页恒只展示已发布，草稿留给后续「我的帖子」 |
| 关注数、粉丝数、加入时间 | 接口不返回，不补假字段 |
| 服务端渲染资料与列表 | 客户端取数（design D6 的已知代价：无 SEO） |
| 用户页缓存层 | design 非目标：读写频率低，不引入 Redis 键族 |
| 广场 feed 加作者参数 | design D1：用户页走独立端点，不改 `GET /api/posts` |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 资料 | **真实接口** `GET /api/profiles/{publicId}` | 经 `profileApi.publicProfile`，同源 `/api` 代理；**恒走真接口，不跟 `USE_MOCK_PROFILE`**（OQ1 决策） |
| 帖子列表 | **真实接口** `GET /api/profiles/{publicId}/posts?limit=20[&cursor=…]` | 经 `postsApi.byAuthor`，形状与广场 `PostFeedResponse` 一致 |
| 404 | 错误码 `PROFILE_NOT_FOUND` | 资料与列表共用同一个码；`isProfileNotFound` 归一成 `not-found` 态 |
| 头像 | 资料里的 `avatarUrl` | 原生 `<img>`，`alt=""`、`loading="lazy"`；空串或加载失败回退首字符占位 |

### 1.4 与其他单元的关系

- **依赖**：`lib/contracts/profile.ts` 的 `PublicProfileResponse`、`lib/contracts/posts.ts` 的 `POST_ENDPOINTS.byAuthor`、`lib/profile/{types,profile-api}.ts`、`lib/posts/{types,posts-api}.ts`、`components/posts/{post-list,post-card,post-card-skeleton,use-infinite-posts}`、`SectionError`、`firstCharacter`。
- **被依赖**：帖子广场卡片的作者区——`PostCard` 在名片 `ready` 时把昵称链到 `/users/{publicId}`。
- **衔接**：列表项的帖子链接指向 `/posts/{publicId}`，不带广场的 `sortBy` 词；从详情返回用户页依赖浏览器后退，页面不提供「返回用户页」的固定入口。

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 游客直接访问**
- When 未登录用户访问 `/users/{publicId}`
- Then 资料与帖子列表正常展示，不跳转登录页

**S2 · 资料四项完整**
- When 资料读取成功
- Then 渲染头像、昵称、简介与兴趣标签；兴趣为空列表时不渲染空 `<ul>`

**S3 · 昵称为空兜底**
- When 接口返回的昵称为空串或纯空白
- Then 标题与作者区都展示 `Member {标识后四位}`，不展示完整对外标识

**S4 · 帖子列表只含该作者已发布内容**
- When 该用户存在且有已发布帖子
- Then 列表项作者恒为本页用户，草稿与已删除帖子不出现

**S5 · 从广场卡片进入**
- When 用户在广场点击某张帖子卡片的作者名
- Then 进入该作者的用户页，展示四项资料与该用户的帖子列表

**S6 · 翻页**
- When 列表返回非空 `nextCursor` 且 sentinel 进入视口
- Then 原样透传游标追加下一页，按 `publicId` 去重，不解析游标、不重新排序

### 2.2 异常路径

**S7 · 用户不存在**
- When 资料返回 `PROFILE_NOT_FOUND`
- Then 只渲染 `User not found` 与返回广场的入口，**不渲染列表区，也不展示空列表态**

**S8 · 资料读取失败可重试**
- When 资料读取失败但不是 404（网络失败、5xx 等）
- Then 展示可读错误与 `Retry loading this profile`，点击后重新发起资料请求

**S9 · 列表失败只影响列表区**
- When 资料成功而列表失败
- Then 资料头保持展示，列表区展示 `Posts could not load. Please try again.` 与 `Retry loading posts`；重试只重发列表

**S10 · 用户存在但没有已发布帖子**
- When 资料成功且列表返回空数组
- Then 资料正常展示，列表区展示 `No posts yet.` 空态，不展示骨架与到底提示

**S11 · 取消不代表失败**
- When 切换页面或重试导致旧请求被取消
- Then 取消异常不落成错误态，也不覆盖新结果

**S12 · 名片未就绪时不生成入口**
- When 广场卡片的作者名片尚未返回或缺失
- Then 作者区只展示占位，不以对外标识代替作者名，也不生成指向用户页的链接

---

## 3. 数据结构

### 3.1 页面 Props

服务端壳只读取路由参数，客户端视图接收一个字符串：

```ts
interface UserPageProps {
  params: Promise<{ publicId: string }> // Next.js 16 的异步 params
}

// 客户端视图
UserPageContent({ publicId }: { publicId: string })
```

### 3.2 依赖的数据类型

```ts
interface PublicProfile {
  publicId: string
  displayName: string
  avatarUrl: string
  bio: string
  interests: string[]
}

type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: PublicProfile }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
```

列表复用 `PostPage` / `PostSummary` 与 `useInfinitePosts` 的 `InfinitePostsState`（三态：`loading` / `error` / `ready`）。

镜像真源是 `PublicProfileResponse`（`lib/contracts/profile.ts`），字段集合恰为五项，经 `toPublicProfile` 逐项映射。响应不含内部主键、邮箱、账户状态与软删除标记。

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `publicId` | 真实对外标识 | 路由参数与作者名片键；只在兜底文案里取后四位 |
| `displayName` | 接口原文，可为空串 | `h1` 与列表作者区；为空时兜底 `Member {后四位}` |
| `avatarUrl` | 空串表示无头像 | 有地址走 `<img>`，空串或加载失败回退首字符占位 |
| `bio` | 空串表示未填写 | 有值原样展示（保留换行），无值显示未填写标注 |
| `interests` | 字符串数组，可为空 | 描边胶囊列表；空数组显示未填写标注 |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| eyebrow | `Community · Member` |
| 资料加载 | `Loading this member…` |
| 列表加载 | `Loading posts…` |
| 用户不存在 | `User not found` / `This user does not exist or has left. Browse the community instead.` |
| 不存在页按钮 | `Browse all posts` |
| 资料失败 | `This profile could not load` |
| 资料重试 | `Retry loading this profile` |
| 列表失败 | `Posts could not load. Please try again.` |
| 列表重试 | `Retry loading posts` |
| 列表标题 | `Published posts` |
| 空简介 | `This member has not written a bio yet.` |
| 空兴趣 | `No interests listed yet.` |
| 昵称兜底 | `Member {后四位}` |
| 空列表 | 沿用 `PostList` 的 `No posts yet.` / `Be the first to share a route.` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 资料头渲染头像、昵称、简介与兴趣标签四项
- [ ] 昵称为空时展示 `Member` + 标识后四位，不展示完整对外标识
- [ ] 简介与兴趣为空时有明确标注，不留空白
- [ ] 列表只含本页用户的已发布帖子，卡片作者区指向本页
- [ ] 不展示关注数、粉丝数、加入时间或任何虚构字段

### 4.2 数据规则

- [ ] 资料恒走真接口，不受 `USE_MOCK_PROFILE` 影响
- [ ] 资料与列表并行发起；资料成功后列表独立渲染
- [ ] 列表原样透传游标、`publicId` 去重、`limit=20`
- [ ] 资料 404 时不再渲染列表区
- [ ] 列表失败重试只重发列表，资料保持不动

### 4.3 状态

- [ ] 加载态展示资料骨架与帖子骨架，不渲染假内容
- [ ] 用户不存在态与空列表态互斥且视觉可区分
- [ ] 资料失败与列表失败各自提供重试入口
- [ ] 取消的请求不落成错误态

### 4.4 无障碍与响应式

- [ ] 列表使用 `<ul>` / `<li>`，兴趣标签使用带 `aria-label="Interests"` 的列表
- [ ] 头像 `alt=""`（装饰性），失败回退首字符且 `aria-hidden`
- [ ] 骨架容器 `role="status"` 与 `aria-busy="true"`
- [ ] 错误表态使用 `role="alert"`
- [ ] 窄屏下头像与间距收窄，长昵称与长简介可折行

### 4.5 工程

- [ ] `app/users/[publicId]/user-page-content.test.tsx` 覆盖骨架、404 短路、列表独立重试、空列表、正常渲染与昵称兜底
- [ ] `components/posts/post-card.test.tsx` 覆盖作者区链接与不生成链接的两个分支
- [ ] `08-spec-doc-breakpoints.ps1` 返回 0
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- `app/users/[publicId]/page.tsx` 是服务端组件，只 `await params` 并套 `SiteHeader` / `SiteFooter`；视图组件带 `'use client'`
- 用 `key={publicId}` 让切人时整页重建，不在视图内做跨标识的状态残留
- 列表复用 `useInfinitePosts`，`load` 用 `useCallback` 绑定 `publicId` 保持引用稳定
- 不引入新的全局状态或数据请求库

### 5.2 CSS Modules 与站点令牌

样式在 `frontend/app/users/[publicId]/user-page.module.css`，取色使用 `--wc-*`，容器宽度由 `wc-container` 承担，局部限宽用 `max-width`。不引入 Tailwind、shadcn/ui 或其它 UI 库。

### 5.3 响应式（desktop-first）

真相源：`frontend/app/users/[publicId]/user-page.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 资料头左对齐，头像 64px，简介限宽 `62ch`；列表沿用广场网格 |
| `≤ 640px` | 头像缩至 52px、身份行间距收窄，失败与骨架卡片内边距收窄，提示区左右留白减小 |

### 5.4 图片

- 头像使用原生 `<img>`，非 `next/image`
- `alt=""`（装饰性）、`loading="lazy"`；空串或 `onError` 后回退首字符占位
- 占位底色 `--wc-sand-deep`、字色 `--wc-ink-soft`，与帖子卡片头像同一套令牌

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 页面壳 | `frontend/app/users/[publicId]/page.tsx` |
| 客户端视图 | `frontend/app/users/[publicId]/user-page-content.tsx` |
| 页面样式 | `frontend/app/users/[publicId]/user-page.module.css` |
| 视图测试 | `frontend/app/users/[publicId]/user-page-content.test.tsx` |
| 公开资料契约 | `frontend/lib/contracts/profile.ts` |
| 用户页列表端点 | `frontend/lib/contracts/posts.ts` |
| 公开资料取数 | `frontend/lib/profile/profile-api.ts`、`frontend/lib/profile/types.ts` |
| 按作者取帖子 | `frontend/lib/posts/posts-api.ts` |
| 列表渲染链路 | `frontend/components/posts/post-list.tsx`、`post-card.tsx`、`use-infinite-posts.ts` |
| 后端端点 | `backend/src/main/java/com/luyi/myfirst/web/profile/PublicProfileController.java`、`UserPostsController.java` |
| 后端资料读 | `backend/src/main/java/com/luyi/myfirst/service/profile/impl/ProfileServiceImpl.java` |
| 后端列表读 | `backend/src/main/java/com/luyi/myfirst/service/post/impl/PostServiceImpl.java` |
| 索引 | `backend/src/main/resources/schema.sql` 的 `idx_posts_author_published` |

```powershell
npm --prefix D:\my-first-project\frontend run test -- "app/users" components/posts/post-card.test.tsx
powershell -File harness/checks/08-spec-doc-breakpoints.ps1
powershell -File harness/checks/10-contract-check.ps1
```

### delta 场景对应

下表把在飞变更 `add-user-detail-page` 的 19 条 Scenario 逐条落到验证位置。后端用例在 `backend/src/test/java/com/luyi/myfirst/` 下，前端用例在 `frontend/app/users/[publicId]/` 与 `frontend/components/posts/`。

| delta Scenario | 对应验证 |
|---|---|
| 游客读取用户资料 | `PublicProfileControllerTest.guestReadsFiveFields` |
| 响应不含内部字段 | `PublicProfileControllerTest.guestReadsFiveFields` 的字段集合断言 |
| 资料未填写时返回空值 | `PublicProfileControllerTest.unwrittenFieldsStayPresent`、`ProfileServiceImplTest.readPublicReturnsEmptyDefaults` |
| 不存在的标识 | `PublicProfileControllerTest.threeMissesShareOneResponse`、`ProfileServiceImplTest.readPublicRejectsUnknown` |
| 已注销的用户 | `ProfileServiceImplTest.readPublicRejectsDeleted` |
| 形状不合的标识 | `PublicProfileControllerTest.threeMissesShareOneResponse` |
| 只返回该用户的已发布帖子 | `PostServiceTest.authorFeedContainsOnlyPublishedByThatAuthor`、`PostRepositoryTest.authorFeedFiltersByAuthor` |
| 已删除帖子不出现 | `PostRepositoryTest.authorFeedSkipsSoftDeleted` |
| 用户没有任何已发布帖子 | `PostServiceTest.authorFeedIsEmptyNotMissing`、用户页「空列表」用例 |
| 未知用户得 404 | `PostServiceTest.authorFeedRejectsUnknownAndDeletedAuthor`、`UserPostsControllerTest.unknownAuthorIsNotFound` |
| 游标继续下一页 | `PostServiceTest.authorFeedPagesByCursor`、`PostRepositoryTest.authorFeedCursorIsStableAtSameMillisecond` |
| 非法游标 | `PostServiceTest.authorFeedRejectsBrokenAndForeignCursor`、`UserPostsControllerTest.brokenCursorIsBadRequest` |
| 条数钳制 | `PostServiceTest` 的 limit 钳制用例（与广场共用 `normalizeLimit`） |
| 从帖子卡片进入用户页 | `post-card.test.tsx`「昵称指向用户页」、用户页「正常态渲染四项资料与该用户的帖子卡片」 |
| 游客可访问 | 用户页测试不注入 `AuthProvider`，`/api/profiles/*` 在 `AuthInterceptorTest.profileRoutesOwnership` 中登记为公开 |
| 名片未就绪时不生成入口 | `post-card.test.tsx`「请求中与名片缺失都不生成用户页链接」 |
| 用户不存在 | 用户页「资料 404 只展示用户不存在，不再渲染列表区」 |
| 读取失败可重试 | 用户页「列表失败只影响列表区，重试后恢复而资料保持不动」 |
| 用户没有已发布帖子 | 用户页「用户存在但没有已发布帖子：资料正常、列表展示空态」 |
