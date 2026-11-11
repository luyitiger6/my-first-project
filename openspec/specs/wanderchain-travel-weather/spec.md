# wanderchain-travel-weather Specification

## Purpose
让站点头部随时可以回答「这座城市现在什么天气」，把出行前最关键的一件小事留在站内，覆盖平台既有的七个城市，并如实标注观测时间，不把缓存结果当作当前实况。

## Requirements

### Requirement: 头部天气入口

站点头部工具栏 SHALL 提供天气图标入口，点击后展开天气浮层；浮层 MUST 可通过关闭按钮与 Escape 键关闭，关闭后键盘焦点 MUST 归还触发入口。浮层展开期间 MUST NOT 阻断页面其余内容的滚动。

#### Scenario: 点击图标展开浮层

- **WHEN** 用户点击头部天气图标
- **THEN** 展开天气浮层并显示所查城市的当前天气

#### Scenario: 用 Escape 关闭并归还焦点

- **WHEN** 天气浮层处于展开状态且用户按下 Escape
- **THEN** 浮层关闭，键盘焦点回到头部天气图标

### Requirement: 天气查询的城市范围与默认值

天气浮层 SHALL 提供平台既有七个城市（Beijing、Shanghai、Guangzhou、Chengdu、Xi'an、Hangzhou、Sanya）的选择；首次打开 MUST 默认 Beijing，MUST NOT 提供自由文本输入，MUST NOT 出现平台城市清单之外的城市。

#### Scenario: 首次打开默认北京

- **WHEN** 用户从未选择过城市并首次打开天气浮层
- **THEN** 展示 Beijing 的天气，城市选择控件选中 Beijing

#### Scenario: 城市清单不含平台外城市

- **WHEN** 用户展开城市选择控件
- **THEN** 仅出现上述七个城市，没有输入任意城市名的入口

### Requirement: 城市选择被记住

用户在天气浮层选定的城市 SHALL 被记住，再次打开浮层时沿用该城市；记忆 MUST 只作用于当前浏览器，MUST NOT 依赖登录状态。

#### Scenario: 再次打开沿用上次城市

- **WHEN** 用户选择 Chengdu 后关闭浮层，随后重新打开
- **THEN** 浮层直接展示 Chengdu 的天气，城市选择控件选中 Chengdu

### Requirement: 天气结果的展示内容

天气结果 SHALL 同时展示以下四项：城市名、摄氏气温、天气状况文案与风速；天气状况 MUST 以英文呈现，气温 MUST 以整数形式展示并标明摄氏度单位。

#### Scenario: 成功查询时四项齐全

- **WHEN** 查询 Beijing 成功且数据源返回气温 9.0、天气代码 0、风速 5.0
- **THEN** 浮层展示 `Beijing`、`9` 与摄氏度标记、`Clear`、以及风速数值

### Requirement: 天气数据的新鲜度标注

天气浮层 SHALL 展示该结果的观测时间；当展示的是服务端缓存结果时，界面 MUST NOT 声称该数据为「当前实况」或使用等价的实时表述。

#### Scenario: 展示观测时间

- **WHEN** 数据源返回的观测时间为 17:15
- **THEN** 浮层展示该观测时间作为数据新鲜度说明

### Requirement: 天气读取失败的表现

外部天气数据源不可达、超时或返回不可解析内容时，天气浮层 SHALL 展示明确的失败提示与重试入口；MUST NOT 展示空值、`NaN`，也 MUST NOT 用上一次的成功结果冒充当前查询。

#### Scenario: 数据源失败时给出提示与重试

- **WHEN** 后端拿不到可用的天气数据
- **THEN** 浮层展示失败提示与重试按钮，不展示任何天气数值

#### Scenario: 切换城市后失败不残留旧城市结果

- **WHEN** 用户先成功查询 Beijing，随后切换到 Chengdu 且该次查询失败
- **THEN** 浮层展示失败提示，且不展示 Beijing 的天气数据

#### Scenario: 重试成功恢复展示

- **WHEN** 失败状态下用户点击重试且数据源已恢复
- **THEN** 浮层回到正常结果展示
