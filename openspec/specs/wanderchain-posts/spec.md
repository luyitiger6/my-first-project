# wanderchain-posts Specification

## Purpose
确立社区帖子的读写契约：任何游客都能读已发布内容，作者能发布、编辑与删除自己的帖子。帖子的对外身份、响应字段白名单、状态词表与错误码在此固定，作为前端、测试与闸门的共同依据。

## Requirements

### Requirement: 帖子的对外标识与软删除

帖子 MUST 以不可枚举的对外标识暴露，MUST NOT 暴露数据库自增主键。每条帖子 MUST 恰好属于一个作者，作者同样以对外标识引用。删除 MUST 为软删除：被删除的帖子 MUST NOT 出现在任何读接口中，其对外标识 MUST NOT 被重新分配。帖子状态 MUST 仅取 `draft` 与 `published` 两者之一；「下架」由软删除表达，MUST NOT 引入第三个状态值。

#### Scenario: 响应只出现对外标识

- **WHEN** 读取任一帖子的列表项或详情
- **THEN** 响应体用不可枚举的对外标识指代帖子与作者，不出现任何数据库自增主键

#### Scenario: 删除是软删除

- **WHEN** 作者删除一条帖子
- **THEN** 该帖子不再出现在任何列表与详情中，而其数据行仍然存在并留有删除发生的时间

#### Scenario: 状态词表只有两值

- **WHEN** 以任意输入创建或编辑帖子
- **THEN** 状态只可能是 `draft` 或 `published`，不存在第三个取值，也不存在「已删除」这个状态值

### Requirement: 发布帖子需登录且作者取自令牌

发布 MUST 为需登录的写操作：未携带有效令牌时 MUST 返回 `401` 与 `UNAUTHENTICATED`，且 MUST NOT 建立任何帖子。校验通过时 MUST 建立帖子并返回 `201` 与帖子详情。作者 MUST 取自令牌所代表的账户；请求体中若出现作者字段，MUST 被忽略而不是被采信。

#### Scenario: 未登录发帖被拒

- **WHEN** 不带有效令牌调用发布接口
- **THEN** 返回 `401` 与 `UNAUTHENTICATED`，帖子总数不变

#### Scenario: 登录后发帖成功

- **WHEN** 携带有效令牌提交标题、正文、封面地址、标签与状态
- **THEN** 返回 `201` 与帖子详情，作者为令牌所代表的账户

#### Scenario: 请求体不得指定作者

- **WHEN** 请求体里显式带上另一个作者的标识
- **THEN** 该字段被忽略，作者仍是令牌所代表的账户

### Requirement: 编辑与删除仅限作者本人

编辑与删除 MUST 只允许该帖子的作者执行。非作者执行时 MUST 返回 `403` 与 `POST_FORBIDDEN`，且 MUST NOT 修改任何数据。目标帖子的对外标识不存在或已软删除时 MUST 返回 `404` 与 `POST_NOT_FOUND`；该判定 MUST 先于作者判定，以免对外暴露某个标识是否存在。

#### Scenario: 作者编辑成功

- **WHEN** 作者以自己的令牌提交新的标题、正文、封面、标签或状态
- **THEN** 返回 `200` 与更新后的帖子详情，改动已生效

#### Scenario: 非作者编辑被拒

- **WHEN** 另一个已登录账户尝试编辑该帖子
- **THEN** 返回 `403` 与 `POST_FORBIDDEN`，帖子内容保持原样

#### Scenario: 非作者删除被拒

- **WHEN** 另一个已登录账户尝试删除该帖子
- **THEN** 返回 `403` 与 `POST_FORBIDDEN`，该帖子仍可被正常读取

#### Scenario: 目标不存在时的判定次序

- **WHEN** 对不存在的对外标识执行编辑或删除，且调用方是一个已登录账户
- **THEN** 返回 `404` 与 `POST_NOT_FOUND`，不返回作者不匹配

### Requirement: 帖子列表公开且只含已发布

列表 MUST 公开访问，不要求登录。列表 MUST 只返回状态为 `published` 的帖子；`draft` MUST NOT 出现在任何列表结果中。分页 MUST 采用游标方式并以游标继续翻页，MUST NOT 接受或实现深偏移量分页。列表查询 MUST 支持 `sortBy` 参数，默认按 `publishedAt` 倒序，可选按 `upVoteCount` 倒序或 `commentCount` 倒序。游标 MUST 编码当前排序维度与对应排序键值，切换排序后旧游标 MUST 被忽略或判为非法。

#### Scenario: 游客可读列表

- **WHEN** 不带任何令牌请求列表
- **THEN** 返回 `200` 与已发布帖子的列表，不要求登录

#### Scenario: 草稿不出现在列表

- **WHEN** 库中存在草稿帖子，且调用方为游客或非作者账户
- **THEN** 该草稿不出现在返回的列表项中

#### Scenario: 分页以游标继续

- **WHEN** 请求携带上一次返回的游标
- **THEN** 返回该游标之后的下一页，且不因新增帖子而重复或跳过已返回的条目

#### Scenario: 偏移量分页不被接受

- **WHEN** 请求携带偏移量参数
- **THEN** 该参数被忽略或请求以 `400` 与 `VALIDATION_FAILED` 拒绝，结果集不受其影响

#### Scenario: 默认按发布时间排序

- **WHEN** 不带 `sortBy` 请求列表
- **THEN** 返回结果按帖子发布时间倒序排列

#### Scenario: 按点赞数排序

- **WHEN** 请求 `sortBy=upVoteCount`
- **THEN** 返回结果按帖子点赞数倒序排列，同票数时按发布时间倒序兜底

#### Scenario: 按评论数排序

- **WHEN** 请求 `sortBy=commentCount`
- **THEN** 返回结果按帖子评论数倒序排列，同评论数时按发布时间倒序兜底

#### Scenario: 不同排序游标不混用

- **WHEN** 用 `sortBy=publishedAt` 得到的游标请求 `sortBy=upVoteCount`
- **THEN** 该游标被忽略或返回 `400` 与 `VALIDATION_FAILED`，列表从第一页按新排序返回

### Requirement: 帖子详情公开且草稿对他人不可见

详情 MUST 公开访问。已发布帖子 MUST 对任何调用方可见。草稿 MUST 仅对作者本人可见；其它调用方 MUST 得到 `404` 而不是 `403`，以免暴露草稿是否存在。已软删除的帖子 MUST 对所有人返回 `404`。

#### Scenario: 游客读已发布详情

- **WHEN** 不带令牌请求某条已发布帖子的详情
- **THEN** 返回 `200` 与帖子详情

#### Scenario: 游客读草稿得到未找到

- **WHEN** 不带令牌请求某条草稿的详情
- **THEN** 返回 `404` 与 `POST_NOT_FOUND`，不返回 `403`

#### Scenario: 作者读自己的草稿

- **WHEN** 作者携带自己的令牌请求自己的草稿详情
- **THEN** 返回 `200` 与帖子详情

#### Scenario: 已删除的帖子不可读

- **WHEN** 请求某条已软删除帖子的详情，调用方包括原作者
- **THEN** 返回 `404` 与 `POST_NOT_FOUND`

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

### Requirement: 帖子写请求继承来源校验

帖子写请求 MUST 继承既有的来源校验：来源头不匹配或缺失时 MUST 返回 `403` 与 `CROSS_SITE_REJECTED`，MUST NOT 进入凭证判定，MUST NOT 修改任何数据。该校验 MUST 先于认证判定执行。

#### Scenario: 跨站发帖被拒且先于认证

- **WHEN** 一个跨站的发帖请求同时缺少有效令牌
- **THEN** 返回 `403` 与 `CROSS_SITE_REJECTED`，不是 `401`

#### Scenario: 同源发帖不受干扰

- **WHEN** 发帖请求来自已登记的站点来源
- **THEN** 正常进入认证与业务处理

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

### Requirement: 帖子错误码取自固定集合

帖子端点的错误码 MUST 取自固定集合：`UNAUTHENTICATED`（`401`）、`CROSS_SITE_REJECTED`（`403`）、`VALIDATION_FAILED`（`400`）三者与认证端点共用；`POST_FORBIDDEN`（`403`）与 `POST_NOT_FOUND`（`404`）为帖子专有。新增错误码属于契约变更。

#### Scenario: 错误响应结构一致

- **WHEN** 任一帖子端点返回 `4xx` 或 `5xx`
- **THEN** 响应体含错误码与提示两个字段，且不含任何内部标识

#### Scenario: 错误码取自固定集合

- **WHEN** 任一帖子端点返回错误
- **THEN** 其错误码属于上述固定集合，且状态码与错误码的对应关系一致

### Requirement: 帖子入参校验

标题 MUST 为去除首尾空白后 1 至 120 个字符。正文 MUST 非空且不超过 65535 字节。封面地址 MUST 为空或合法的 `http(s)` 绝对地址。标签 MUST 最多 10 个、每个 1 至 32 个字符，且 MUST 在保存前按键值去重。任一条件不满足时 MUST 返回 `400` 与 `VALIDATION_FAILED`，且 MUST NOT 建立或修改任何帖子。

#### Scenario: 空标题被拒

- **WHEN** 提交只有空白字符的标题
- **THEN** 返回 `400` 与 `VALIDATION_FAILED`，不建立帖子

#### Scenario: 超长正文被拒

- **WHEN** 提交超过 65535 字节的正文
- **THEN** 返回 `400` 与 `VALIDATION_FAILED`，不建立帖子

#### Scenario: 标签去重后保存

- **WHEN** 提交含重复取值的标签集合
- **THEN** 保存的是去重后的集合，读取详情时每个标签只出现一次
