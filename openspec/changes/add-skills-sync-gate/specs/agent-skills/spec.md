# Spec Delta

## Purpose

技能是三层分工里的行为层：真源只有一份，副本供各 AI 工具读取。本能力把「副本必须与真源逐字节一致」从口头约定变成由退出码守护的可验证事实，并明确 `openspec-*` 生成技能不在约束范围内。

## ADDED Requirements

### Requirement: 自研技能真源与三处副本逐字节一致

仓库 SHALL 以 `.agents/skills/` 下非 `openspec-*` 的目录作为自研技能的唯一真源，并要求 `.claude/skills/`、`.qoder/skills/`、`.opencode/skills/` 中的同名目录在文件相对路径集合与每个文件的 SHA256 上与真源完全一致。

#### Scenario: 副本与真源一致

- **WHEN** 三处副本的文件集合与 SHA256 均与真源相同
- **THEN** `12-skills-sync-check` 以退出码 0 结束，并报告校验过的技能数与副本根数

#### Scenario: 副本缺少技能目录

- **WHEN** 任一副本根下缺少某个自研技能目录
- **THEN** 闸门以退出码 1 结束，并列出缺失的路径

#### Scenario: 副本内容被单独修改

- **WHEN** 任一副本中的某个文件哈希与真源不同，或副本多出真源没有的文件
- **THEN** 闸门以退出码 1 结束，并列出差异文件的相对路径

### Requirement: 闸门只约束自研技能，不约束生成技能

`openspec-*` 技能由 `openspec init` / `openspec update` 按各工具适配生成，SHALL NOT 纳入逐字节比对；闸门 MUST 以目录名前缀排除它们，且新增一个非 `openspec-*` 技能目录时 MUST 自动纳入检查而无需修改脚本。

#### Scenario: 生成技能存在跨层差异

- **WHEN** 任一 `openspec-*` 目录在四层之间内容不同
- **THEN** 闸门仍以退出码 0 结束，不把生成差异判为漂移

#### Scenario: 新增自研技能自动纳入

- **WHEN** `.agents/skills/` 下新增一个非 `openspec-*` 的技能目录并同步到三处副本
- **THEN** 闸门不修改脚本即校验该技能
