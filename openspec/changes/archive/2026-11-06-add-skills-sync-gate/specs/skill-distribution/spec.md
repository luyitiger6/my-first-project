# Spec Delta

## MODIFIED Requirements

### Requirement: 同名技能跨适配层内容一致

同一自研技能在各适配层目录中的同名副本 SHALL 内容一致，避免工具按自身顺序静默去重时行为不可预期；该一致性 MUST 由仓库闸门以退出码判定，而不是仅由文档声明。

#### Scenario: 副本逐字节一致
- **WHEN** 比对各适配层目录下同名技能文件的字节内容
- **THEN** 所有副本与真源目录中的文件逐字节一致

#### Scenario: 真源修订后同步副本
- **WHEN** 真源目录中的技能文件被修订
- **THEN** 各适配层中的同名副本同步为相同内容，不出现新旧混存

## ADDED Requirements

### Requirement: 技能一致性由闸门以退出码判定

仓库 SHALL 提供闸门 `12-skills-sync-check`，比对真源与三处适配层副本的文件相对路径集合与每个文件的 SHA256。任何缺失、多出或内容不同 MUST 使闸门以退出码 1 结束并列出差异路径；全部一致时 MUST 以退出码 0 结束并报告校验过的技能数与副本根数。闸门 MUST NOT 自动修改副本。

#### Scenario: 副本与真源一致
- **WHEN** 三处副本的文件集合与 SHA256 均与真源相同
- **THEN** 闸门以退出码 0 结束，并报告校验过的技能数与副本根数

#### Scenario: 副本缺少技能目录
- **WHEN** 任一副本根下缺少某个自研技能目录
- **THEN** 闸门以退出码 1 结束，并列出缺失的路径

#### Scenario: 副本内容被单独修改
- **WHEN** 任一副本中的某个文件哈希与真源不同，或副本多出真源没有的文件
- **THEN** 闸门以退出码 1 结束，并列出差异文件的相对路径

### Requirement: 生成技能不纳入逐字节比对

`openspec-*` 技能由 `openspec init` / `openspec update` 按各工具适配生成，SHALL NOT 纳入逐字节比对；闸门 MUST 以目录名前缀排除它们，并在 `.agents/skills/` 新增非 `openspec-*` 目录时自动纳入检查而无需修改脚本。

#### Scenario: 生成技能存在跨层差异
- **WHEN** 任一 `openspec-*` 目录在四层之间内容不同
- **THEN** 闸门仍以退出码 0 结束，不把生成差异判为漂移

#### Scenario: 新增自研技能自动纳入
- **WHEN** `.agents/skills/` 下新增一个非 `openspec-*` 的技能目录并同步到三处副本
- **THEN** 闸门不修改脚本即校验该技能
