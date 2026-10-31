# Spec Delta

## MODIFIED Requirements

### Requirement: 评论需登录且绑定作者

发表评论 MUST 要求调用方携带有效令牌，作者 MUST 取自令牌所代表的账户。缺有效令牌 MUST 返回 `401` 与 `UNAUTHENTICATED`。评论内容 MUST 为按 Java `String.trim()` 去除首尾空白后 1 至 2000 个 UTF-16 代码单元；内容为空或超长时 MUST 返回 `400` 与 `VALIDATION_FAILED`。上述拒绝 MUST NOT 建立评论，既有来源校验仍先于认证。

#### Scenario: 登录用户发表评论成功

- **WHEN** 携带有效令牌向某条已发布帖子提交合法评论内容
- **THEN** 返回 `201` 与评论详情，作者为令牌账户，该帖子评论数加 1

#### Scenario: 未登录发表评论被拒

- **WHEN** 不带有效令牌调用评论创建接口
- **THEN** 返回 `401` 与 `UNAUTHENTICATED`，不建立评论

#### Scenario: 空评论内容被拒

- **WHEN** 提交只有空白字符的评论内容
- **THEN** 返回 `400` 与 `VALIDATION_FAILED`，不建立评论

#### Scenario: 超长评论被拒

- **WHEN** 登录用户提交去空白后超过 2000 个 UTF-16 代码单元的内容
- **THEN** 返回 `400` 与 `VALIDATION_FAILED`，不建立评论

## REMOVED Requirements

### Requirement: 评论列表只含未删除评论且支持二级回复

**Reason**: 旧场景将对外字段写为 `parentId`，与实际 DTO 的 `parentPublicId` 不一致；跨页及父已删除时的关系需要明确定义。
**Migration**: 由“评论游标列表与父评论对外标识”承接公开读取、倒序、分页、软删除过滤和回复关系；保持现有 DTO 字段 `parentPublicId`，不引入数据库主键字段。

### Requirement: 投票删除仅限投票人

**Reason**: 原正文和取消场景未区分赞成与反对，错误要求取消任何投票都扣减 `upVoteCount`。
**Migration**: 由“取消本人投票按原方向计数”承接取消权限及不存在错误，并分别验收两种方向；不改变取消端点路径或状态码。

## ADDED Requirements

### Requirement: 评论游标列表与父评论对外标识

评论列表 MUST 过滤已软删除评论，按创建时间倒序及稳定次序游标分页；游客 SHALL 可读已发布帖子的评论。评论创建与读取 MUST 使用 `parentPublicId`：顶级为 null，回复为真实父评论对外标识，不得返回内部主键或错误地返回回复自身标识。父不在当前页或已删除时，未删除回复 MUST 仍保留其父对外标识，不回显已删除父正文。

#### Scenario: 游客读取评论列表

- **WHEN** 不带令牌请求某条已发布帖子的评论列表
- **THEN** 返回 `200` 与未删除评论列表，不含软删除评论

#### Scenario: 删除后评论不再出现在列表

- **WHEN** 作者删除一条评论后再次请求该帖子评论列表
- **THEN** 被删除评论不在返回结果中，其未删除回复不被级联删除

#### Scenario: 回复携带真实 parentPublicId

- **WHEN** 用户回复某条评论并读取包含该回复的列表页
- **THEN** 创建响应和列表响应的 `parentPublicId` 都等于被回复评论的对外标识

#### Scenario: 父与回复跨页

- **WHEN** 列表页包含回复但其父评论不在该页
- **THEN** 回复的 `parentPublicId` 仍为真实父标识，不能为 null 或回复自身标识

#### Scenario: 父被软删除

- **WHEN** 父评论已删除但回复未删除
- **THEN** 返回回复及原父对外标识，不返回父正文或内部删除信息

#### Scenario: 游标与上限保持

- **WHEN** 不指定 limit、指定超过现有上限的 limit、提交非法 cursor 或继续下一页
- **THEN** 默认返回最多 20 项、超上限截断到 50 项、非法游标返回 `400 VALIDATION_FAILED`；下一页继续原倒序，`nextCursor=null` 表示到底

#### Scenario: 回复目标无效

- **WHEN** 登录用户向不存在、已删除或属于另一帖子的评论提交回复
- **THEN** 返回 `404 POST_NOT_FOUND`，不建立评论，不泄漏其它帖子的评论内容

### Requirement: 取消本人投票按原方向计数

投票人 SHALL 可取消本人有效投票，成功返回 `204`；非投票人取消 MUST 返回 `403 POST_FORBIDDEN`，目标投票不存在 MUST 返回 `404 POST_NOT_FOUND`。取消赞成票 MUST 使该帖 `upVoteCount` 减 1，取消反对票 MUST 不改变赞成票数；后续个人状态读取 MUST 为未投票。

#### Scenario: 投票人取消赞成票

- **WHEN** 已投赞成票的账户携带自己的令牌取消投票
- **THEN** 返回 `204`，该帖点赞数减 1，个人状态为未投票

#### Scenario: 投票人取消反对票

- **WHEN** 已投反对票的账户携带自己的令牌取消投票
- **THEN** 返回 `204`，该帖点赞数不变，个人状态为未投票

#### Scenario: 非投票人取消投票被拒

- **WHEN** 另一个已登录账户尝试取消该投票
- **THEN** 返回 `403` 与 `POST_FORBIDDEN`，点赞数不变

#### Scenario: 无投票取消被拒

- **WHEN** 已登录账户取消不存在的目标投票
- **THEN** 返回 `404` 与 `POST_NOT_FOUND`，不改变任何互动统计

### Requirement: 当前账户互动状态读取

`GET /api/posts/{publicId}/interactions/me` MUST 要求有效令牌，以令牌账户作为唯一查询主体。成功响应 MUST 恰有 `voteDirection`（`up`、`down` 或 null）与 `bookmarked`（boolean），只反映未删除的本人记录；未互动为 `200`、null 与 false，不以 `404` 表示。响应 MUST 不含实体、内部标识或其他账户状态，并使用 `Cache-Control: no-store`。

#### Scenario: 未互动账户读取

- **WHEN** 登录账户读取可见帖子且本人无有效投票或收藏
- **THEN** 返回 `200`，`voteDirection=null` 且 `bookmarked=false`

#### Scenario: 已互动账户读取

- **WHEN** 登录账户已对可见帖子投反对票并收藏
- **THEN** 返回 `200`，`voteDirection=down` 且 `bookmarked=true`，不返回总数或多余字段

#### Scenario: 账户互不串用

- **WHEN** A 与 B 分别读取同一帖子的个人状态，或请求携带伪造的账户参数
- **THEN** 各自仅获得令牌账户的状态，客户端参数不能改变查询主体

#### Scenario: 取消或软删除记录不算有效状态

- **WHEN** 本人投票、收藏记录已经软删除后再次读取
- **THEN** 对应状态为 null 或 false，不复活已取消的选择

#### Scenario: 个人响应禁止共享缓存

- **WHEN** 任一账户读取个人状态成功
- **THEN** 响应带 `Cache-Control: no-store`，不被共享为其它账户的结果

### Requirement: 附属读取遵守帖子可见性

评论列表与当前账户互动状态读取 MUST 先遵守帖子详情的存在与可见性：不存在或已删除返回 `404 POST_NOT_FOUND`；草稿仅作者可读，游客或他人不能通过附属读取识别草稿。受保护个人状态的认证 MUST 先于业务可见性，无有效令牌仍为 `401 UNAUTHENTICATED`。

#### Scenario: 草稿评论不向游客或他人泄漏

- **WHEN** 游客或非作者账户请求草稿帖子的评论列表
- **THEN** 返回 `404 POST_NOT_FOUND`，不返回评论、数量或确认草稿存在的提示

#### Scenario: 作者可读草稿附属数据

- **WHEN** 作者携带自己的令牌读取自己的草稿评论列表或个人状态
- **THEN** 可以得到该帖的可读附属响应，不扩大到其它账户；前端草稿页面仍只读

#### Scenario: 个人状态隐藏他人草稿

- **WHEN** 已登录非作者请求草稿帖子的个人状态
- **THEN** 返回 `404 POST_NOT_FOUND`，不返回 `403` 或空状态来确认草稿存在

#### Scenario: 已删除或不存在帖子附属读取

- **WHEN** 有权进入读取接口的调用方请求不存在或已删除帖子的评论列表或个人状态
- **THEN** 返回 `404 POST_NOT_FOUND`，不返回孤立的互动记录

#### Scenario: 未登录个人状态始终先认证

- **WHEN** 无有效令牌请求任意帖子标识的个人状态
- **THEN** 返回 `401 UNAUTHENTICATED`，不执行会暴露帖子存在性的业务读取
