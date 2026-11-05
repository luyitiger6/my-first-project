# Proposal

## Why

`AGENTS.md` §5 声明两个自研技能以 `.agents/skills/` 为真源、逐字节分发到 `.claude/`、`.qoder/`、`.opencode/` 三处副本，但仓库没有任何闸门验证这件事。当前实测：两个自研技能在 6 组比对中全部一致；六个 `openspec-*` 技能因各工具生成适配，在 12 组比对中全部不同——一致性目前是事实，不是约束。

技能属于三层分工里的行为层，它的漂移既不会被编译发现，也不会被现有 12 道闸门拦截。一次「直接改副本」就能让四个适配层的 agent 行为分叉，而文档仍宣称它们逐字节一致。

为什么现在：CI 已能自动执行全部闸门，新增闸门的边际成本最低；且技能目录刚完成一次分发（8 个目录四层齐平），此时把一致性固化成护栏，基线是干净的。

## What Changes

- **新增闸门 `harness/checks/12-skills-sync-check.ps1`**：以 `.agents/skills/` 下非 `openspec-*` 目录为真源，逐文件比对三处副本的文件集合与 SHA256；缺失、多出、内容不同均 exit 1，并输出差异路径。
- **AGENTS.md**：§6 目录树补 12 号闸门一行、`<!-- harness-checks: ... -->` 标记追加 `12-skills-sync-check`、§7 命令速查补「只查技能同步」。
- **范围边界**：`openspec-*` 由 `openspec init` / `openspec update` 生成，各层存在适配差异，不纳入逐字节比对；新增自研技能会自动纳入，无需改脚本。
- **非目标**：闸门只报告、不自动同步副本；不改任何技能内容；不改 `run-all.ps1`（按文件名自动扫描）。

## Capabilities

### New Capabilities

- `agent-skills`: 自研技能以 `.agents/skills/` 为唯一真源，三处适配层副本必须逐字节一致，由闸门以退出码守护。

### Modified Capabilities

<!-- 无：现有能力的行为不变，本次只新增一道守护技能分发的闸门。 -->

## Impact

- **文件**：新增 `harness/checks/12-skills-sync-check.ps1`；修改 `AGENTS.md`（§6 / §7 / 闸门标记）。
- **CI**：闸门集合由 12 道变为 13 道；`run-all.ps1` 与 workflow 无需修改，07 闸门会自动校验标记与新文件的对应关系。
- **风险**：低。只有同时存在「真源与副本不一致」时才会变红；当前基线已实测一致，首次运行应为绿。
