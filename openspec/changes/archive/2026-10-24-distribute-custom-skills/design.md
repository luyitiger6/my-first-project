# Design

## Context

取证结果：

- 分发单元：`.agents/skills/systematic-debugging/SKILL.md`（1603 字符）、`.agents/skills/verification-before-completion/SKILL.md`（1590 字符），每个技能只有一个文件，无附属资源
- 缺口：`.claude/skills/`、`.qoder/skills/`、`.opencode/skills/` 各 6 个目录（全部是 `openspec-*` 内置技能），两个自研技能缺席
- 命令耦合检查：两个自研技能的正文**不引用任何斜杠命令**（grep `/opsx|/openspec-|command` 零命中），因此副本无需按工具做命令名适配，可逐字节复制
- 过期表述：`AGENTS.md` L135「`openspec/specs/` 在第一次归档前是空的，这是正常的：真相从第一次变更开始积累」；实际已有 `frontend-template`、`scaffold-rename` 两个主 spec
- 已知坑（记忆沉淀）：Qoder 同时读 `~/.agents/skills`、项目 `.agents/skills`、`.qoder/skills`，对同名技能**静默去重**，胜出方由加载顺序决定；`.agents` 与 `.qoder` 下的 `openspec-*` 技能同名但内容不同，已证实这种不一致会让技能指向不存在的命令

## Goals

- 四个工具的 agent 拿到同一套行为规范强化，不再依赖各自读 AGENTS.md 文字
- 副本内容一致（对应上面那个静默去重坑），行为可预期
- 入口契约里不再留下会随归档演进而失真的陈述

## Decisions

### D1: 逐字节复制，不用符号链接或生成脚本
Windows 创建符号链接需要管理员权限或开发者模式，模板分发场景不可靠；跨平台链接语义也不一致。自研技能只有 2 个小文件，复制成本最低且行为确定。

### D2: `.agents/skills/` 是自研技能的编写真源
其余三个适配层目录中的同名技能是分发副本。修订流程固定为「先改 `.agents/skills/` 真源 → 再同步三处副本」，此约定写进 AGENTS.md §6 目录地图注释，避免有人直接在副本里改导致漂移。

### D3: 本次不加副本一致性闸门（用户拍板）
副本漂移由文档约定 + 人工审阅承担。理由：AGENTS.md §9 的「红线由真实事故驱动增补」原则——目前没有发生因副本不一致导致的行为异常，预先加闸门会增加维护成本。若日后出现漂移事故，再按 §8 约定新增 `06-skill-sync.ps1`（比对四个目录同名文件哈希）。

### D4: 不动 `commands/` 与 `openspec-*` 技能
它们是 `openspec init` 的生成物；`.claude/commands` 与 `.qoder/commands` 的内容差异来自为各工具写的适配头，属设计而非缺陷。手工修改会在下次 `openspec update` 时被覆盖。

### D5: §9 表述改写为状态无关的说法
把「在第一次归档前是空的」替换为不依赖归档状态、也不写具体数字的描述：`openspec/specs/` 只收录**已归档**能力的规格，在飞变更的 delta 位于 `openspec/changes/<change-id>/specs/`，因此某能力在 `specs/` 中缺席只说明它尚未归档。这样第 N 次归档都不需要再修订该条（对应 spec「归档数量变化无需改文档」Scenario）。

## Risks

- 三处副本与真源共 4 份，改真源忘改副本会漂移：无闸门兜底，靠 D2 的文档约定与审阅；已在 spec 里把「逐字节一致」定为验收标准，审阅时可比对
- `openspec update` 重新生成适配层时是否会清掉手工放入的自研技能：当前判定为不会（它只写自己生成的 `openspec-*` 与 `commands/opsx`），若某次刷新后发现自研技能被清掉，属于新事故，按 §9 原则届时补闸门或改方案
- 不同工具加载同名技能的优先级仍不可控：D1/D2 的一致性要求把风险收敛到「内容相同、加载谁都一样」，这是本 change 能做的最大消除

## Migration Plan

1. 从 `.agents/skills/` 复制两个技能目录到 `.claude/skills/`、`.qoder/skills/`、`.opencode/skills/`
2. 校验四份副本逐字节一致（哈希比对）
3. 改写 `AGENTS.md` §9 该条为状态无关表述；§6 目录地图补充分发关系与真源约定；§5 标注四适配层均可用
4. `run-all.ps1` 五闸门全绿（本 change 不触代码与构建，闸门用于确认无回归）
