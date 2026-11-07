# change-scope Specification

## Purpose

每个在飞 change 一次只装一个可交付的能力面：能力数、任务数与 Scenario 数超过上限时必须留下带到期日的例外，否则闸门拒绝推进，避免评审与验收被超长变更稀释。

## Requirements

### Requirement: 在飞 change 的能力面不超过两个

每个在飞 change 的 `specs/` 目录下，包含 `spec.md` 的能力目录路径（相对 `specs/`，支持嵌套路径）去重后 MUST 不超过 2 个。`openspec/changes/archive/` 下的历史 change 不参与判定。

#### Scenario: 三能力的 change 判红

- **WHEN** 某个在飞 change 的 `specs/` 下存在 3 个含 `spec.md` 的能力目录
- **THEN** 14 号闸门以退出码 1 失败，并指出该 change 与超限项

#### Scenario: 两能力的 change 通过

- **WHEN** 在飞 change 的能力目录为 2 个，任务与 Scenario 数均未超限
- **THEN** 14 号闸门对该 change 判定通过

#### Scenario: 归档的超大 change 不影响判定

- **WHEN** `openspec/changes/archive/` 中存在能力数超过 2 的历史 change
- **THEN** 14 号闸门跳过它，不产生任何红灯

### Requirement: 任务数与 Scenario 数设上限

每个在飞 change 的 `tasks.md` 复选框条目 MUST 不超过 30 条；其 delta 规格中 `#### Scenario:` 标题 MUST 不超过 60 条。`tasks.md` 不存在时任务数按 0 计，由归档流程负责完整性检查。

#### Scenario: 任务数超限判红

- **WHEN** 某在飞 change 的 `tasks.md` 含 31 条复选框条目且无有效例外
- **THEN** 14 号闸门以退出码 1 失败，并报告实际数量与上限

#### Scenario: Scenario 数超限判红

- **WHEN** 某在飞 change 的 delta 规格含 61 条 `#### Scenario:` 且无有效例外
- **THEN** 14 号闸门以退出码 1 失败，并报告实际数量与上限

### Requirement: 超限须显式例外并到期失效

任一维度超限的 change MUST 在 change 根目录提供 `scope-exception.md`，其中 `Reason`、`RegisteredOn`、`Expires` 三个字段均不得为空；`RegisteredOn` 与 `Expires` MUST 为 `YYYY-MM-DD` 格式，且 `Expires` MUST 不早于判定当日。

#### Scenario: 有效例外放行

- **WHEN** 某超限 change 的 `scope-exception.md` 三字段完整、日期格式合法且 `Expires` 未到期
- **THEN** 14 号闸门放行该 change，并在输出中标注它走了例外

#### Scenario: 过期例外重新判红

- **WHEN** 例外文件的 `Expires` 早于判定当日
- **THEN** 14 号闸门以退出码 1 失败，并提示例外已过期

#### Scenario: 例外缺字段判红

- **WHEN** 例外文件缺少 `Reason`、`RegisteredOn`、`Expires` 中任一字段或字段为空
- **THEN** 14 号闸门以退出码 1 失败，并指出缺少的字段

### Requirement: 闸门不交互且只读取

14 号闸门 MUST 只读取 `openspec/changes/` 下的文件，不写入、不联网、不调用其他闸门；通过时退出码 0，任一问题退出码 1。

#### Scenario: 无在飞 change 时通过

- **WHEN** `openspec/changes/` 下只有 `archive` 目录
- **THEN** 14 号闸门以退出码 0 通过并说明没有在飞 change
