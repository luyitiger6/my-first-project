# Spec Delta

## Purpose

让规格里的每条 Scenario 都能回答「验过没有」：有证据就指向可核验来源，没有就登记成欠账。账本只保证登记齐全与引用真实，不宣称行为正确。

## ADDED Requirements

### Requirement: 账本与能力集合双向一致

`docs/spec-evidence.json` SHALL 为 `openspec/specs/` 下的每个能力提供一条记录，且 MUST NOT 记录不存在的能力。

#### Scenario: 能力新增未登记
- **WHEN** `openspec/specs/` 下新增一个能力目录，账本中没有对应记录
- **THEN** 闸门以退出码 1 结束，并指出缺失的能力名

#### Scenario: 账本残留已删能力
- **WHEN** 账本记录了某个能力，但 `openspec/specs/` 下已无该目录
- **THEN** 闸门以退出码 1 结束，并指出残留的能力名

### Requirement: Scenario 必须被显式分类覆盖

每个能力的每条 Scenario SHALL 以 `<Requirement 标题> / <Scenario 标题>` 为键，恰好属于 `verified`、`deferred`、`historicallyCovered` 三类之一，三类的并集 MUST 与该能力的实际键集合完全相同。

#### Scenario: 新 Scenario 未登记
- **WHEN** 某能力的规格中新增一条 Scenario，账本三类里都没有它
- **THEN** 闸门以退出码 1 结束，并列出未登记的 Scenario 标题

#### Scenario: 账本指向已不存在的 Scenario
- **WHEN** 账本登记了一条标题，而规格中已无该 Scenario
- **THEN** 闸门以退出码 1 结束，并列出失效标题

#### Scenario: 重复登记
- **WHEN** 同一键同时出现在两类中，或同一能力的规格里出现重复键
- **THEN** 闸门以退出码 1 结束，并指出冲突的键

### Requirement: 证据引用必须在仓库中真实存在

`sources` 与 `verified` 中的每个引用 MUST 指向真实存在的对象：`gate` 指向 `harness/checks/` 下的闸门脚本，`test` 指向存在的测试文件，`e2e` 指向存在的 e2e 用例文件，`runner` 指向总闸门或 CI 工作流。引用类型 MUST 属于这四类。

#### Scenario: 引用指向不存在的文件
- **WHEN** 账本引用一个已被删除的闸门或测试文件
- **THEN** 闸门以退出码 1 结束，并列出该引用

#### Scenario: 使用未知证据类型
- **WHEN** 账本里出现 `gate` / `test` / `e2e` / `runner` 之外的 `kind`
- **THEN** 闸门以退出码 1 结束，并指出未知类型

### Requirement: 欠账条目必须可追溯、可解锁

`deferred` 的每条记录 MUST 包含非空的 `reason`、`registeredOn`（`YYYY-MM-DD`）与 `unlock`。闸门 MUST NOT 因欠账数量或登记时间而判红。

#### Scenario: 欠账缺字段
- **WHEN** 某条欠账缺少 `reason`、`registeredOn` 或 `unlock`，或日期不是 `YYYY-MM-DD`
- **THEN** 闸门以退出码 1 结束，并指出该标题与缺失字段

#### Scenario: 存在欠账仍可通过
- **WHEN** 所有分类与引用都合法，且存在若干欠账条目
- **THEN** 闸门以退出码 0 结束，并打印 verified / deferred / historicallyCovered 三组计数
