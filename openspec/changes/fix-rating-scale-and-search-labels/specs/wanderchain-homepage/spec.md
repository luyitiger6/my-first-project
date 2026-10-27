# Spec Delta

## ADDED Requirements

### Requirement: 景点评分取值域

景点评分 MUST 取自 0 到 5 之间、最多一位小数的数值；界面 MUST 以一位小数展示（如 `Rating 4.8`），MUST NOT 出现越界值、空值或 `NaN`。取值域属于数据契约，Mock 数据与将来的真实数据源 MUST 遵守同一约束。

#### Scenario: 取值域落在 0 到 5

- **WHEN** 检查全部景点的评分取值
- **THEN** 每个评分满足 `0 ≤ rating ≤ 5`，且乘以 10 后为整数（即最多一位小数）

#### Scenario: 越界即数据缺陷

- **WHEN** 某条景点数据的评分小于 0、大于 5，或小数位超过一位
- **THEN** 数据完整性守卫失败，该数据不得进入界面展示

#### Scenario: 展示口径为一位小数

- **WHEN** 评分取值为 `4.25`
- **THEN** 卡片与检索结果展示 `Rating 4.3`

#### Scenario: 边界值不出空值

- **WHEN** 评分取值为 `0` 或 `5`
- **THEN** 分别展示 `Rating 0.0` 与 `Rating 5.0`，不出现空值或 `NaN`
