# Proposal

## Why

`wanderchain-profile` 让帖子作者从一串 ULID 变成了「昵称 + 头像」，但这个人到此为止：名片只有三个字段，帖子卡片的作者区不可点击，读者看完一篇稻城的游记，没有任何路径去看看这个人还写过什么。

后果和前一个 change 之前一样可观测：社区仍然只能围绕内容组织，不能围绕人。已归档的 profile proposal 把「用户详细页 `/users/{publicId}`」明确列为阶段 2，本 change 就是那一步——它也是后续「关注作者」「私信作者」的共同前置：两者都需要一个可以落脚的人的主页。

## What Changes

- 新增公开的单用户资料读取：按对外标识返回昵称、头像、简介、兴趣标签四项；不存在、已注销、形状不合的标识一律 `404`，不区分原因。
- 新增公开的用户页帖子列表：只含该用户的已发布帖子，按发布时间倒序，游标分页；不存在或已注销的用户同样 `404`。
- 新增前端用户页 `/users/{publicId}`：展示四项资料与该用户的帖子列表，覆盖加载、空列表、读取失败、用户不存在四态；游客可访问，不要求登录。
- 帖子卡片的作者区由纯展示改为可点击入口，点击进入该用户的用户页；名片尚未返回时仍只显示占位，`MUST NOT` 回退为对外标识。
- **BREAKING**：无。既有 `GET /api/posts` 的入参与响应不变，作者过滤走独立端点，不给现有 feed 增加可选参数。

## Capabilities

### New Capabilities

- `wanderchain-user-page`：公开用户页能力——单用户四项资料的公开读取、该用户已发布帖子的时间倒序分页列表、前端用户页的路由与四态、内容流到用户页的入口。

### Modified Capabilities

无。本 change 新增独立端点与独立页面，不改既有 feed 的入参契约，也不改名片的三字段口径。

## Impact

- **backend**：`service/profile` 增加单用户公开读（复用 `AccountRepository`，只读、过滤已注销）；`service/post` 增加按作者取已发布列表（新增两个 `PostRepository` 查询：首页与游标之后，排序键只用 `published_at`）；`web/profile` 新增用户页控制器（资料 + 帖子两个 `GET`），并在 `AuthInterceptor.publicRoutes()` 登记这两个公开读。
- **frontend**：新增 `app/users/[publicId]/`（页面壳与客户端视图）、`lib/profile/` 增加单用户资料取数与视图模型、`lib/posts/` 增加该用户帖子列表取数；`components/posts/post-card.tsx` 的作者区加指向 `/users/{publicId}` 的链接。
- **harness**：`10-contract-check.ps1` 的 `$contractPairs` 追加用户页两个响应体；`08-spec-doc-breakpoints.ps1` 的 `$pairs` 登记新增的用户页单元文档。
- **不影响**：既有 `GET /api/posts` 的三种排序与游标语义、名片的三个字段、个人中心的本人读写、`/api/auth/me` 的字段集合。
