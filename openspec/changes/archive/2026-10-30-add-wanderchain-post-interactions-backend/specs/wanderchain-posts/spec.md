# Spec Delta

## MODIFIED Requirements

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

### Requirement: 响应字段为白名单且不含实体

帖子相关响应 MUST NOT 返回持久化实体本身，对外字段 MUST 限定为白名单：帖子对外标识、标题、正文、封面地址、标签、状态、作者对外标识、创建时间、更新时间、评论数、点赞数、收藏数。内部主键、删除时间、版本号以及创建人/更新人的内部主键 MUST NOT 出现在任何帖子响应中。

#### Scenario: 字段集合等于白名单

- **WHEN** 收集列表项与详情响应的全部字段名
- **THEN** 该集合与白名单相等，既不多也不少

#### Scenario: 审计与并发字段不外泄

- **WHEN** 检查任一帖子响应
- **THEN** 响应中不出现内部主键、删除时间、版本号、创建人与更新人的内部主键

#### Scenario: 列表项含互动统计

- **WHEN** 读取帖子列表项
- **THEN** 响应包含 `commentCount`、`upVoteCount`、`bookmarkCount` 三个数字字段
