# wanderchain-post-interactions Specification

## Purpose
为帖子提供评论、投票、收藏三类交互能力，支持详情页与列表页展示互动统计，并为列表排序提供可验证的数据来源。

## Requirements

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

### Requirement: 评论删除仅限作者且为软删除

评论删除 MUST 只允许该评论的作者执行。非作者删除时 MUST 返回 `403` 与 `POST_FORBIDDEN`，且 MUST NOT 修改数据。目标评论不存在或已软删除时 MUST 返回 `404` 与 `POST_NOT_FOUND`；该判定 MUST 先于作者判定。删除后评论 MUST 不再出现在评论列表中，对应帖子的 `commentCount` MUST 减 1。

#### Scenario: 作者删除自己的评论

- **WHEN** 评论作者携带自己的令牌删除该评论
- **THEN** 返回 `204`，评论在列表中消失，帖子评论数减 1

#### Scenario: 非作者删除评论被拒

- **WHEN** 另一个已登录账户尝试删除该评论
- **THEN** 返回 `403` 与 `POST_FORBIDDEN`，评论保持可见

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

### Requirement: 评论写入同步帖子评论数

新建未删除评论 MUST 使所属帖子的 `comment_count` 加 1；软删除评论 MUST 使该值减 1。计数变更 MUST 与评论记录的建立或软删除处于同一事务，任一环节失败 MUST NOT 留下单侧生效的结果。

#### Scenario: 发表评论后计数加一

- **WHEN** 登录用户向已发布帖子提交合法评论
- **THEN** 返回 `201`，该帖 `commentCount` 加 1

#### Scenario: 删除评论后计数减一

- **WHEN** 评论作者软删除自己的评论
- **THEN** 返回 `204`，该帖 `commentCount` 减 1

#### Scenario: 非法评论不改变计数

- **WHEN** 提交空内容或超长评论被拒绝
- **THEN** 返回 `400`，该帖 `commentCount` 不变

### Requirement: 投票写入同步帖子点赞数

`up_vote_count` MUST 只统计未删除的赞成票。新建赞成票 MUST 加 1，新建反对票 MUST NOT 改变该值；方向由赞成改为反对 MUST 减 1，由反对改为赞成 MUST 加 1，同方向重复提交 MUST NOT 改变；取消赞成票 MUST 减 1，取消反对票 MUST NOT 改变。计数变更 MUST 与投票记录的写入处于同一事务。

#### Scenario: 首次赞成加一

- **WHEN** 登录用户首次对帖子投赞成票
- **THEN** 返回 `201`，该帖 `upVoteCount` 加 1

#### Scenario: 反对票不计入

- **WHEN** 登录用户首次对帖子投反对票
- **THEN** 返回 `201`，该帖 `upVoteCount` 不变

#### Scenario: 换向按差额调整

- **WHEN** 同一账户把赞成票改为反对票
- **THEN** 返回 `200`，该帖 `upVoteCount` 减 1

#### Scenario: 取消赞成与取消反对

- **WHEN** 投票人取消自己的赞成票，或取消自己的反对票
- **THEN** 取消赞成票使 `upVoteCount` 减 1，取消反对票使其不变

### Requirement: 收藏写入同步帖子收藏数

新建未删除收藏 MUST 使所属帖子的 `bookmark_count` 加 1；重复收藏 MUST NOT 重复计数；软删除收藏 MUST 使该值减 1。计数变更 MUST 与收藏记录的写入处于同一事务。

#### Scenario: 收藏加一

- **WHEN** 登录用户首次收藏帖子
- **THEN** 返回 `201`，该帖 `bookmarkCount` 加 1

#### Scenario: 重复收藏幂等

- **WHEN** 同一账户再次调用收藏接口
- **THEN** 返回 `200`，`bookmarkCount` 不再增加

#### Scenario: 取消收藏减一

- **WHEN** 收藏人取消收藏
- **THEN** 返回 `204`，`bookmarkCount` 减 1

### Requirement: 计数同步的原子性与边界

计数更新 MUST 是单条原子增量语句（`列 = 列 + 增量`），MUST NOT 先读后写。计数列 MUST NOT 被更新为负数；更新与互动记录写入 MUST 同属一个事务，互动失败 MUST 使计数变更一并回滚。计数更新 MUST NOT 改变帖子的 `updated_at`。

#### Scenario: 两次赞成累计为二

- **WHEN** 两个不同账户先后向同一帖子投赞成票且都成功
- **THEN** 该帖 `upVoteCount` 最终为 2，不出现只记 1 次

#### Scenario: 互动失败计数回滚

- **WHEN** 投票或评论在事务内失败
- **THEN** 对应的计数列回到操作前的值

#### Scenario: 互动不刷新帖子更新时间

- **WHEN** 对帖子点赞、评论或收藏后读取帖子详情
- **THEN** 帖子 `updatedAt` 与互动前相同

#### Scenario: 计数不可为负

- **WHEN** 任一计数列被尝试更新为负值
- **THEN** 数据库以 CHECK 约束拒绝，事务失败
