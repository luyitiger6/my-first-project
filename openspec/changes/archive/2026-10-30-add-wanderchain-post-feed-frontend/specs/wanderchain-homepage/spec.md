# Spec Delta

## MODIFIED Requirements

### Requirement: 热门帖子区块

首页 SHALL 展示最多 10 条已发布帖子，排序为评论数降序、浏览数降序、发布时间降序；非 `published` 状态的帖子 MUST NOT 出现。每个列表项底部 SHALL 展示图标化互动统计行，包含点赞数、评论数与收藏数；区块头部 SHALL 提供「View all posts」链接，点击后导航至 `/posts?sortBy=hottest`。

#### Scenario: 最多 10 条

- **WHEN** Mock 数据中已发布帖子多于 10 条
- **THEN** 区块只展示排序后的前 10 条

#### Scenario: 三级排序

- **WHEN** 两条帖子评论数不同
- **THEN** 评论数多者在前；评论数相同则浏览数多者在前；两者都相同则发布时间晚者在前

#### Scenario: 只含已发布

- **WHEN** Mock 数据中存在草稿或已删除帖子
- **THEN** 区块不展示这些帖子

#### Scenario: 图标化互动统计行

- **WHEN** 热门帖子区块渲染完成
- **THEN** 每条帖子卡片底部以图标形式展示点赞数、评论数与收藏数，数字按英文口径展示

#### Scenario: 零互动仍展示

- **WHEN** 某条热门帖子的点赞/评论/收藏数量均为 0
- **THEN** 卡片仍显示对应图标与数字 0，不隐藏该统计项

#### Scenario: 查看全部入口

- **WHEN** 首页 `HotPosts` 区块渲染完成
- **THEN** 区块头部出现「View all posts」链接，点击后跳转至 `/posts?sortBy=hottest`
