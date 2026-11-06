# Tasks

## 1. 闸门实现

- [x] 1.1 新增 `harness/checks/12-skills-sync-check.ps1`：真源 `.agents/skills` 下非 `openspec-*` 目录 → 三副本比对文件集合与 SHA256；缺失、多出、内容不同均 exit 1；成功打印技能数与副本根数；不交互。
- [x] 1.2 更新 `AGENTS.md`：§6 目录树补 `12-skills-sync-check.ps1` 一行；`<!-- harness-checks: ... -->` 标记追加 `12-skills-sync-check`；§7 命令速查补「只查技能同步」。

## 2. 验收

- [x] 2.1 `powershell -File harness\checks\12-skills-sync-check.ps1` 退出码 0，输出校验过的技能数（2）与副本根数（3）。
- [x] 2.2 负向验证：临时篡改 `.qoder/skills/systematic-debugging/SKILL.md`，闸门 exit 1 并列出该文件；`git checkout --` 还原后复跑为绿。
- [x] 2.3 `powershell -File harness\checks\07-doc-consistency.ps1` 退出码 0（标记与 13 个闸门文件一致）。
- [x] 2.4 `powershell -File harness\checks\11-conventions-check.ps1` 退出码 0。
- [x] 2.5 `openspec validate add-skills-sync-gate --strict` 退出码 0。
- [x] 2.6 推送 `feat/skills-sync-gate-20261106` 后 CI 全绿（run 42112741660，conclusion=success）。

## 3. 归档前规格落点修正

- [x] 3.1 修正 delta 落点：原 `specs/agent-skills/spec.md` 改为 `specs/skill-distribution/spec.md`，用 MODIFIED 承接既有「同名技能跨适配层内容一致」（补「由闸门判定」），并 ADDED「一致性由闸门以退出码判定」「生成技能不纳入逐字节比对」两条要求——避免归档后与既有主规格出现「所有同名副本一致」与「`openspec-*` 排除」的口径冲突。
- [x] 3.2 `proposal.md` 能力归类改为 Modified Capabilities；`design.md` 补决策 5 记录改挂理由。
- [x] 3.3 `openspec validate add-skills-sync-gate --strict` 退出码 0，且 `07` / `11` / `12` 三道闸门复跑仍为 0。
