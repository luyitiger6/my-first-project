# Proposal

## Why

两个自研技能（`systematic-debugging`、`verification-before-completion`）只存在于 `.agents/skills/`，用 Claude Code / Qoder / OpenCode 的人 clone 后拿不到技能文件，只能靠 `AGENTS.md` 的文字约束——而这两条技能正是 AGENTS.md §5 里标注「强制，禁止先改代码 / 禁止无证据声明」的行为规范，缺文件级强化等于把硬规则降级成建议。同时 `AGENTS.md` §9 仍写着「`openspec/specs/` 在第一次归档前是空的」，与仓库实际（已有 2 个主 spec）不符，过期陈述会误导下一个进入仓库的 agent。

## What Changes

- 把两个自研技能目录复制到 `.claude/skills/`、`.qoder/skills/`、`.opencode/skills/`，使四个 AI 工具适配层都拿到文件级强化；`.agents/skills/` 保持为编写真源
- 改写 `AGENTS.md` §9 那条过期表述为**不随归档状态过期**的说法（说明 `specs/` 只收录已归档能力），避免以后每次归档都要改文档
- `AGENTS.md` §6 目录地图补充自研技能的分发关系，§5 技能触发规则处标注四个适配层均可用
- 不新增闸门：副本漂移风险先由文档约定与人工审阅承担，等真出现不一致事故再按 §9「真实事故驱动」原则补闸门

## Capabilities

### New Capabilities
- `skill-distribution`: 项目自研的行为规范技能随仓库对所有 AI 工具适配层可用，且同名副本内容一致；入口契约的状态描述不随仓库演进而过期

### Modified Capabilities
（无）

## Impact

- `.claude/skills/`、`.qoder/skills/`、`.opencode/skills/`：各新增 2 个技能目录（含 `SKILL.md`，共 6 个文件）
- `AGENTS.md`：§5 触发规则、§6 目录地图、§9 已知边界三处措辞
- 不动 `commands/` 与 `openspec-*` 技能：它们是 `openspec init` 的生成物，跨工具的差异是适配设计而非缺陷
- 不改 `scaffold/rename.mjs` 的替换清单：本 change 涉及的路径不含模板身份标识
