# Spec Delta

## Purpose

让站点头部随时可以回答「一元人民币值多少外币」这个旅行途中的高频小问题，覆盖最常用的五个币种，并以数据源的真实更新频率如实标注新鲜度，不制造实时汇率的错觉。

## ADDED Requirements

### Requirement: 头部汇率入口

站点头部工具栏 SHALL 提供汇率图标入口，点击后展开汇率浮层；浮层 MUST 可通过关闭按钮与 Escape 键关闭，关闭后键盘焦点 MUST 归还触发入口。浮层展开期间 MUST NOT 阻断页面其余内容的滚动。

#### Scenario: 点击图标展开浮层

- **WHEN** 用户点击头部汇率图标
- **THEN** 展开汇率浮层并显示查询结果

#### Scenario: 用 Escape 关闭并归还焦点

- **WHEN** 汇率浮层处于展开状态且用户按下 Escape
- **THEN** 浮层关闭，键盘焦点回到头部汇率图标

### Requirement: 汇率查询的币种范围

汇率浮层 SHALL 以 1 CNY 为基准，固定展示 JPY、USD、EUR、THB、HKD 五个币种；MUST NOT 提供任意币种对选择，MUST NOT 提供金额输入或双向换算。

#### Scenario: 展示固定的五个币种

- **WHEN** 汇率浮层展开且查询成功
- **THEN** 展示且仅展示 JPY、USD、EUR、THB、HKD 五项，每项标明 1 CNY 对应的数值

### Requirement: 汇率数值的展示精度

汇率数值 SHALL 按数量级决定小数位：数值大于等于 1 时保留两位小数，小于 1 时保留四位小数；界面 MUST NOT 出现空值、`NaN` 或科学计数法。

#### Scenario: 大于一的币种保留两位

- **WHEN** 1 CNY 兑日元为 23.7139
- **THEN** 界面展示 `23.71`

#### Scenario: 小于一的币种保留四位

- **WHEN** 1 CNY 兑美元为 0.149528
- **THEN** 界面展示 `0.1495`

### Requirement: 汇率数据的新鲜度标注

汇率浮层 SHALL 展示数据源给出的最后更新日期；由于数据源每天只更新一次，界面 MUST NOT 使用「实时」「live」「real-time」等表述。

#### Scenario: 展示数据源更新日期

- **WHEN** 数据源返回的更新时间为 2026-11-11
- **THEN** 浮层展示该日期作为数据新鲜度说明，且不出现实时性表述

### Requirement: 汇率的署名义务

汇率浮层 SHALL 展示一条指向 `https://www.exchangerate-api.com` 的署名链接，文案 MUST 表明汇率由该站提供，链接 MUST 在新标签页打开且 MUST 带 `rel="noopener noreferrer"`。

#### Scenario: 署名链接存在且可打开

- **WHEN** 用户查看汇率浮层
- **THEN** 浮层内存在汇率数据署名链接，点击后在新标签页打开该站

### Requirement: 汇率读取失败的表现

外部汇率数据源不可达、超时或返回不可解析内容时，汇率浮层 SHALL 展示明确的失败提示与重试入口；MUST NOT 展示空表、零值或用旧值冒充当前结果。

#### Scenario: 数据源失败时给出提示与重试

- **WHEN** 后端拿不到可用的汇率数据
- **THEN** 浮层展示失败提示与重试按钮，不展示任何汇率数值

#### Scenario: 重试成功恢复展示

- **WHEN** 失败状态下用户点击重试且数据源已恢复
- **THEN** 浮层回到正常结果展示
