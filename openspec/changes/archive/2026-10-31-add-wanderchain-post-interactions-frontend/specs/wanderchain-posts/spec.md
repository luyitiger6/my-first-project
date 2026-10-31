# Spec Delta

## REMOVED Requirements

### Requirement: 读公开写受保护且默认拒绝

**Reason**: “帖子路径下所有 GET 公开”与当前账户互动状态的受保护 GET 矛盾，原公开读场景须明确只覆盖登记的公开读。
**Migration**: 由“明确公开读登记与个人读保护”承接默认拒绝、写保护和既有认证归属，列表、详情与评论仍可公开读取已发布内容。

## ADDED Requirements

### Requirement: 明确公开读登记与个人读保护

公开读 SHALL 仅包含 `GET /api/posts`、`GET /api/posts/{publicId}`、`GET /api/posts/{publicId}/comments`，并遵守各端点内容可见性。`GET /api/posts/{publicId}/interactions/me` MUST 要求有效令牌；所有帖子写方法和未登记的路径方法 MUST 默认进入认证，缺令牌返回 `401 UNAUTHENTICATED`。既有认证端点归属 MUST 不变。

#### Scenario: 未登记的写方法默认受保护

- **WHEN** 对帖子路径新增一个未登记的写方法且不带令牌调用
- **THEN** 返回 `401` 与 `UNAUTHENTICATED`，而不是被放行

#### Scenario: 明确公开读不需要令牌

- **WHEN** 不带令牌读取列表、已发布详情或已发布帖子的评论列表
- **THEN** 请求不因缺少令牌被拒，仍须遵守内容可见性

#### Scenario: 个人互动 GET 不公开

- **WHEN** 不带有效令牌读取 `GET /api/posts/{publicId}/interactions/me`
- **THEN** 返回 `401` 与 `UNAUTHENTICATED`，不返回任何账户互动状态

#### Scenario: 未登记 GET 默认受保护

- **WHEN** 不带令牌调用帖子路径下未登记的其它 GET
- **THEN** 返回 `401` 与 `UNAUTHENTICATED`，不因方法是 GET 自动放行

#### Scenario: 既有认证端点的归属不变

- **WHEN** 遍历既有的认证端点逐一检查是否需要令牌
- **THEN** 每个端点的公开或受保护归属与本变更之前完全一致

## MODIFIED Requirements

### Requirement: 响应字段为白名单且不含实体

帖子相关响应 MUST NOT 返回持久化实体本身。帖子列表项与详情（含创建、编辑返回的详情）对外字段 MUST 限定为白名单：帖子对外标识、标题、正文、封面地址、标签、状态、作者对外标识、创建时间、更新时间、评论数、点赞数、收藏数。当前账户互动状态使用互动能力的独立白名单，MUST NOT 混入公开列表或详情。内部主键、删除时间、版本号以及创建人/更新人的内部主键 MUST NOT 出现在任何帖子响应中。

#### Scenario: 字段集合等于白名单

- **WHEN** 收集列表项与详情响应的全部字段名
- **THEN** 该集合与白名单相等，既不多也不少

#### Scenario: 审计与并发字段不外泄

- **WHEN** 检查任一帖子响应
- **THEN** 响应中不出现内部主键、删除时间、版本号、创建人与更新人的内部主键

#### Scenario: 列表项含互动统计

- **WHEN** 读取帖子列表项
- **THEN** 响应包含 `commentCount`、`upVoteCount`、`bookmarkCount` 三个数字字段

#### Scenario: 详情项含真实互动统计

- **WHEN** 读取可见帖子的详情，或创建、编辑接口返回帖子详情
- **THEN** `PostResponse` 包含非负整数 `commentCount`、`upVoteCount`、`bookmarkCount`，分别计入未删除评论、有效赞成票与未删除收藏，不计反对票和已软删除互动

#### Scenario: 无互动详情统计为零

- **WHEN** 帖子不存在任何有效评论、赞成票或收藏
- **THEN** 详情的三个统计字段均为数字 0，而不是 null 或缺失

#### Scenario: 读取统计不泄漏个人状态

- **WHEN** 游客或任意账户读取帖子列表与详情
- **THEN** 只获得公开总数，不包含 `voteDirection`、`bookmarked` 或其他账户的互动信息；个人状态仅由独立受保护响应提供
