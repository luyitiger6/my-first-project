# Design

## Context

现状与约束（动机见 proposal.md）：

- 资料域已有四个入口：本人读 `GET /api/profile`、本人改 `PUT /api/profile`、名片批量 `GET /api/profiles?publicIds=`、兴趣清单 `GET /api/profile/interests`。名片只回三字段；本人读回四字段，但以令牌为准，**没有按对外标识读他人的入口**。
- 帖子域：`PostRepository` 已有 6 个 feed 查询（3 种排序 × 首页/游标），另有 `findAllByAuthorIdAndDeletedAtIsNullOrderByCreatedAtDesc`（按 `created_at` 排序、含草稿，注释写明「产品侧没有我的帖子入口」）。
- `AuthInterceptor.PUBLIC_ROUTES` 以「路径 → 方法集合」登记公开读，未登记的 GET 默认受保护（`wanderchain-posts` 的「明确公开读登记与个人读保护」要求）。
- 前端 `lib/profile/profile-api.ts` 有 `USE_MOCK_PROFILE` 开关，默认 Mock，仅 `NEXT_PUBLIC_PROFILE_MOCK=0` 时走真接口；`postsApi` 无 mock，全走真接口。
- 帖子卡片 `AuthorArea` 目前是纯展示：`pending` 显示骨架、`ready` 显示昵称头像、名片缺失显示占位，任何状态都不生成链接。
- 错误码按域分枚举（`AuthErrorEnum` / `PostErrorEnum` / `AttractionErrorEnum`），资料域复用 `AuthErrorEnum.VALIDATION_FAILED`，**没有自己的 404 码**。

## Goals / Non-Goals

**Goals:**

- 新增两个公开读端点与一个前端页面，形成「内容流 → 作者主页 → 该作者的帖子 → 帖子详情」的闭环。
- 复用既有游标、limit 钳制与 `PostSummaryResponse` 形状，不引入第二套分页语义。
- 资料读的 404 口径与帖子读的 404 口径在对外表现上一致。

**Non-Goals:**

- 不做「我的帖子」入口：作者本人在用户页也只看已发布，草稿留给后续的本人视图。
- 不做关注 / 私信 / 用户搜索，也不做用户列表页。
- 不改 `GET /api/posts` 的入参与响应，不给 feed 增加作者参数。
- 不做缓存层：用户页读写频率低，先不引入 Redis 键族。

## Decisions

### D1 新端点 `/api/profiles/{publicId}` 与 `/api/profiles/{publicId}/posts`，不给 feed 加参数

理由：feed 的 6 个 JPQL 是「3 种排序 × 首页/游标」的笛卡尔积，加作者维度要再翻一倍到 12 个；而用户页只需要发布时间倒序一种。把作者过滤放进 feed 还会让 `sortBy=hottest` 与作者参数组合出无意义语义。新端点归属于资料域，语义是「这个人的主页」。

代价与缓解：分页逻辑与 feed 有形式重复，但游标编解码复用 `FeedCursor` 的同一套实现（排序维度固定为 `publishedAt`），limit 钳制复用同一常量口径。

### D2 资料与列表分成两个端点，不做聚合响应

理由：列表翻页时不重复取资料；两者失败粒度独立——资料成功而列表失败，页面仍能展示这个人是谁，只在列表区给重试；聚合响应则会把整页拖成失败态。

### D3 公开资料用独立 DTO `PublicProfileResponse`，不复用 `ProfileResponse`

两者字段此刻相同（对外标识、昵称、头像、简介、兴趣标签），但入口语义不同：`ProfileResponse` 是「我的资料」，将来加私有字段（如邮箱、未读通知数）时不应自动公开。独立 record 让「公开读能返回什么」只有一个改动点，契约闸门也能把它与本人读分开比对。

### D4 新增 `ProfileErrorEnum.PROFILE_NOT_FOUND`，不复用 `POST_NOT_FOUND`

理由：错误码是前端文案映射的键，`POST_NOT_FOUND` 在用户页会渲染成「帖子不存在」。新枚举沿用既有 `BaseError` 结构，只加一个 `404` 常量；`PROFILE_NOT_FOUND` 同时用于资料与列表两个端点，保证未找到口径一致。

### D5 列表响应复用 `PostFeedResponse` 形状

`items` + `nextCursor` 与广场完全一致，前端可直接复用 `toPostSummary` 与 `PostCard`，一条列表渲染链路只维护一次。列表项**不带**作者名片：发起请求的人已经知道作者是谁，多带一份名片等于多一次无意义的序列化。

### D6 用户页用「服务端壳 + 客户端视图」，沿用帖子详情页的结构

`app/users/[publicId]/page.tsx` 只负责取 `params` 与套 `SiteHeader/SiteFooter`；资料与列表的取数、四态、重试都在客户端视图里（`Promise.all` 并行发两个请求）。资料返回 404 时整页进入「用户不存在」，**不再渲染列表区**；列表失败只影响列表区。这与 `app/posts/[publicId]` 的既有模式一致，也避免把 `USE_MOCK_PROFILE` 这类运行期开关带进服务端组件。

### D7 作者区只在名片就绪时生成链接

`AuthorArea` 的三种状态对应三种行为：`pending` 骨架无链接、`ready` 昵称包进 `/users/{publicId}` 的 `Link`、名片缺失保留占位且**不生成链接**（没有可信标识时不制造死链）。链接是纯展示层决定，不构成权限：用户是否存在仍由服务端 404 裁定。

### D8 用户页列表只含已发布，作者本人也不放宽

即便访问者是作者本人，用户页也只展示已发布帖子。放宽会让「用户页」与将来的「我的帖子」出现两套可见性规则，也把草稿的对外可见性绑在了页面类型上。草稿的本人可见性仍只在帖子详情与后续本人视图中兑现。

### D9 新增索引 `idx_posts_author_published`

按 `(author_id, status, deleted_at, published_at desc, id desc)` 建复合索引，覆盖用户页列表的两条查询。`schema.sql` 与 `06-schema-check.ps1` 的索引清单必须同改，否则建表闸门会拦。

## Risks / Trade-offs

- **[列表查询可能退化为全表扫]** → D9 的复合索引；`06` 闸门在约束层兜住「索引存在」，列顺序仍靠实现端正对 spec。
- **[`USE_MOCK_PROFILE` 默认开启，用户页资料与真实作者标识对不上]** → 见 Open Questions 第 1 条；倾向让用户页绕过 Mock 走真接口。
- **[昵称为空时页面出现空白作者名]** → 见 Open Questions 第 2 条；倾向统一兜底文案。
- **[公开四字段扩大了信息面]** → 简介与兴趣标签本就是个人中心鼓励填写的对外展示内容；邮箱、状态、软删除标记一律不进 DTO，`ProfileResponse` 与 `PublicProfileResponse` 的分离保证将来加私有字段不会自动泄漏。
- **[两个端点带来两次往返]** → 客户端并行发起；资料 404 时立即短路，不再等列表。

## Migration Plan

无数据迁移与回滚动作：只新增端点、索引与页面。索引随 `schema.sql` 的 drop 重建生效，旧数据无需回填。

## Open Questions

| # | 级别 | 问题 | 默认倾向 | 影响任务 |
|---|---|---|---|---|
| 1 | 阻塞 | 用户页的资料读取是否沿用 `USE_MOCK_PROFILE`（默认 Mock），还是固定走真接口？ | 用户页固定走真接口：本页的意义就是「按真实作者标识查人」，Mock 会让整条链路永远无法验证；个人中心保持现状不动 | 3.1 / 3.2 |
| 2 | 一般 | 用户 `display_name` 为空时页面如何兜底？ | 展示 `Member` + 对外标识后四位，与现有名片 Mock 的文案一致 | 3.3 |
| 3 | 一般 | 用户页列表每页条数是否保持 20？ | 保持 20，与广场一致；上限仍是 50 | 2.2 |
