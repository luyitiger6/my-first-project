# Spec Delta

## ADDED Requirements

### Requirement: 分组标题与回链文案

检索结果的三个分组标题 MUST 分别为 `Editor's picks`、`Posts`、`Attractions`；每个分组的回链文案 MUST 分别为 `See editor picks on the homepage`、`See trending posts on the homepage`、`See popular attractions on the homepage`，回链 MUST 分别指向 `/#editor-picks`、`/#hot-posts`、`/#hot-attractions`。

#### Scenario: 分组标题为固定英文字面量

- **WHEN** 检索结果渲染出任意分组
- **THEN** 该分组标题等于三个固定英文串中对应的一个，不随城市、关键词或命中数变化

#### Scenario: 回链文案与目标固定

- **WHEN** 用户查看某分组末尾的回链
- **THEN** 文案等于对应的固定英文串，链接指向对应的首页区块锚点

#### Scenario: 文案不随语言环境变化

- **WHEN** 浏览器语言或 `Accept-Language` 变化
- **THEN** 分组标题与回链文案仍为上述固定英文串，不出现中文或其它语言
