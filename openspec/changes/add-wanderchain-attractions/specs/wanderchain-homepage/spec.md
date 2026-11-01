# Spec Delta

## MODIFIED Requirements

### Requirement: 功能导航栏

首页 SHALL 展示旅游社区、景点攻略、AI 助手三张平台入口卡片，每张 MUST 含图标、标题与一句话描述，且点击后进入对应入口；当前城市不是 `all` 时，景点攻略入口 MUST 把该城市 slug 作为 `city` 参数带到 `/attractions`。

#### Scenario: 三张卡片齐全

- **WHEN** 首页渲染完成
- **THEN** 三张卡片分别展示旅游社区、景点攻略、AI 助手的标题与描述

#### Scenario: 入口可点击

- **WHEN** 用户点击任一卡片
- **THEN** 浏览器导航到该卡片对应的入口地址

#### Scenario: 景点攻略入口保留当前城市

- **WHEN** 用户选中某城市后点击景点攻略入口
- **THEN** 导航到 `/attractions?city=<该城市 slug>`，景点列表页以同一城市展示内容

#### Scenario: 全城范围不带城市参数

- **WHEN** 当前城市为 `all`，用户点击景点攻略入口
- **THEN** 导航到 `/attractions` 且不携带 `city` 参数

#### Scenario: 移动端不溢出

- **WHEN** 视口宽度小于 768px
- **THEN** 卡片纵向排列且页面不出现横向滚动

### Requirement: 热门景点区块

首页 SHALL 展示景点接口返回的最多 5 个已发布景点，排序为浏览数降序、发布时间降序；非 `published` 状态的景点 MUST NOT 出现；每张卡片 MUST 链接到该景点的 `/attractions/<publicId>` 详情页。

#### Scenario: 最多 5 条

- **WHEN** 接口返回的已发布景点多于 5 个
- **THEN** 区块只展示排序后的前 5 个

#### Scenario: 排序正确

- **WHEN** 两个景点浏览数不同
- **THEN** 浏览数多者在前；浏览数相同则发布时间晚者在前

#### Scenario: 只含已发布

- **WHEN** 接口返回中混有草稿或已删除景点
- **THEN** 区块不展示这些景点

#### Scenario: 卡片进入景点详情

- **WHEN** 用户点击任一热门景点卡片
- **THEN** 浏览器导航到 `/attractions/<该景点的 publicId>`

#### Scenario: 接口不可达时展示错误态

- **WHEN** 景点接口请求失败
- **THEN** 该区块展示英文错误态文案，其余区块仍正常渲染
