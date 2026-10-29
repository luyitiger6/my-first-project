# Spec Delta

## Purpose

为帖子提供评论、投票、收藏三类交互能力，支持详情页与列表页展示互动统计，并为列表排序提供可验证的数据来源。

## ADDED Requirements

### Requirement: 评论需登录且绑定作者

发表评论 MUST 要求调用方携带有效令牌，作者 MUST 取自令牌所代表的账户。评论内容 MUST 为去除首尾空白后 1 至 2000 个字符。未登录、内容为空或超长时 MUST 返回 `400` 与 `VALIDATION_FAILED`，且 MUST NOT 建立评论。

#### Scenario: 登录用户发表评论成功

- **WHEN** 携带有效令牌向某条已发布帖子提交合法评论内容
- **THEN** 返回 `201` 与评论详情，作者为令牌账户，该帖子评论数加 1

#### Scenario: 未登录发表评论被拒

- **WHEN** 不带有效令牌调用评论创建接口
- **THEN** 返回 `401` 与 `UNAUTHENTICATED`，不建立评论

#### Scenario: 空评论内容被拒

- **WHEN** 提交只有空白字符的评论内容
- **THEN** 返回 `400` 与 `VALIDATION_FAILED`，不建立评论

### Requirement: 评论删除仅限作者且为软删除

评论删除 MUST 只允许该评论的作者执行。非作者删除时 MUST 返回 `403` 与 `POST_FORBIDDEN`，且 MUST NOT 修改数据。目标评论不存在或已软删除时 MUST 返回 `404` 与 `POST_NOT_FOUND`；该判定 MUST 先于作者判定。删除后评论 MUST 不再出现在评论列表中，对应帖子的 `commentCount` MUST 减 1。

#### Scenario: 作者删除自己的评论

- **WHEN** 评论作者携带自己的令牌删除该评论
- **THEN** 返回 `204`，评论在列表中消失，帖子评论数减 1

#### Scenario: 非作者删除评论被拒

- **WHEN** 另一个已登录账户尝试删除该评论
- **THEN** 返回 `403` 与 `POST_FORBIDDEN`，评论保持可见

### Requirement: 评论列表只含未删除评论且支持二级回复

按帖子查询评论列表时，已软删除的评论 MUST NOT 出现在结果中。列表 MUST 按创建时间倒序返回，支持游标分页。评论 MAY 携带 `parentId` 表示对另一条评论的回复；顶级评论的 `parentId` 为 `null`。游客 MUST 可以读取任意已发布帖子的评论列表。

#### Scenario: 游客读取评论列表

- **WHEN** 不带令牌请求某条已发布帖子的评论列表
- **THEN** 返回 `200` 与未删除评论列表，不含软删除评论

#### Scenario: 删除后评论不再出现在列表

- **WHEN** 作者删除一条评论后再次请求该帖子评论列表
- **THEN** 被删除评论不在返回结果中

#### Scenario: 回复评论携带 parentId

- **WHEN** 用户回复某条评论
- **THEN** 创建的新评论 `parentId` 等于被回复评论的对外标识，且列表接口返回该字段

### Requirement: 投票为登录用户的单次方向表达

每个账户对每条帖子最多只能有一条投票记录。投票 MUST 要求有效令牌，作者取自令牌账户。投票请求 MUST 携带 `direction` 字段，取值为 `up` 或 `down`。已投票账户再次投票时，新投票 MUST 替换旧投票。未登录投票 MUST 返回 `401` 与 `UNAUTHENTICATED`。

#### Scenario: 登录用户首次点赞

- **WHEN** 携带有效令牌对某条帖子投赞成票
- **THEN** 返回 `201`，该帖子 `upVoteCount` 加 1

#### Scenario: 同一账户重复投票被替换

- **WHEN** 同一账户对同一帖子先投赞成票再投反对票
- **THEN** 返回 `200`，原赞成票被替换为反对票，`upVoteCount` 减 1

#### Scenario: 未登录投票被拒

- **WHEN** 不带有效令牌调用投票接口
- **THEN** 返回 `401` 与 `UNAUTHENTICATED`，不记录投票

#### Scenario: 非法方向被拒

- **WHEN** 提交 `direction` 不是 `up` 或 `down`
- **THEN** 返回 `400` 与 `VALIDATION_FAILED`，不记录投票

### Requirement: 投票删除仅限投票人

投票人可取消自己对某条帖子的投票。非投票人取消时 MUST 返回 `403` 与 `POST_FORBIDDEN`。目标投票不存在时 MUST 返回 `404` 与 `POST_NOT_FOUND`。取消后该帖子 `upVoteCount` MUST 减 1。

#### Scenario: 投票人取消投票

- **WHEN** 投票人携带自己的令牌取消投票
- **THEN** 返回 `204`，该帖子点赞数减 1

#### Scenario: 非投票人取消投票被拒

- **WHEN** 另一个已登录账户尝试取消该投票
- **THEN** 返回 `403` 与 `POST_FORBIDDEN`，点赞数不变

### Requirement: 收藏为登录用户的私有标记

收藏 MUST 要求有效令牌，作者取自令牌账户。同一账户对同一帖子多次收藏 MUST 幂等，不重复建立收藏记录。删除收藏 MUST 只允许收藏人执行。收藏建立后帖子 `bookmarkCount` 加 1，删除后减 1。

#### Scenario: 登录用户收藏帖子

- **WHEN** 携带有效令牌收藏某条已发布帖子
- **THEN** 返回 `201`，该帖子 `bookmarkCount` 加 1

#### Scenario: 重复收藏幂等

- **WHEN** 同一账户对同一帖子再次调用收藏接口
- **THEN** 返回 `200`，`bookmarkCount` 不重复增加

#### Scenario: 收藏人取消收藏

- **WHEN** 收藏人携带自己的令牌取消收藏
- **THEN** 返回 `204`，该帖子 `bookmarkCount` 减 1

### Requirement: 互动端点继承来源校验与公开写保护

评论、投票、收藏端点 MUST 继承既有的来源校验：来源头不匹配或缺失时 MUST 返回 `403` 与 `CROSS_SITE_REJECTED`，且 MUST NOT 进入凭证判定或修改数据。这些端点的写方法 MUST 要求有效令牌，缺令牌时 MUST 返回 `401` 与 `UNAUTHENTICATED`。

#### Scenario: 跨站评论被拒且先于认证

- **WHEN** 一个跨站的评论请求同时缺少有效令牌
- **THEN** 返回 `403` 与 `CROSS_SITE_REJECTED`，不是 `401`

#### Scenario: 未登录收藏被拒

- **WHEN** 不带令牌调用收藏接口
- **THEN** 返回 `401` 与 `UNAUTHENTICATED`，不建立收藏

### Requirement: 互动响应字段为白名单

评论、投票、收藏相关响应 MUST NOT 返回持久化实体本身。评论详情对外字段 MUST 限定为：评论对外标识、帖子对外标识、父评论对外标识（可为 null）、作者对外标识、内容、创建时间、更新时间。内部主键、删除时间、版本号以及创建人/更新人的内部主键 MUST NOT 出现在响应中。

#### Scenario: 评论详情字段等于白名单

- **WHEN** 读取一条评论详情
- **THEN** 响应字段集合与白名单相等，既不多也不少

### Requirement: 互动错误码取自固定集合

互动端点的错误码 MUST 取自固定集合：`UNAUTHENTICATED`（`401`）、`CROSS_SITE_REJECTED`（`403`）、`VALIDATION_FAILED`（`400`）三者与认证端点共用；`POST_FORBIDDEN`（`403`）与 `POST_NOT_FOUND`（`404`）为帖子/互动专有。新增错误码属于契约变更。

#### Scenario: 错误码属于固定集合

- **WHEN** 任一互动端点返回错误
- **THEN** 其错误码属于上述固定集合，且状态码与错误码的对应关系一致
