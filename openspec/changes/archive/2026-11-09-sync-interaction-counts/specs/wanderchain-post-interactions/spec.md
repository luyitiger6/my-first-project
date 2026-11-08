# Spec Delta

## ADDED Requirements

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
