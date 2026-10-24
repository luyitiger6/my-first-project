# Tasks

## 1. 基线

- [ ] 1.1 以当前 HEAD 为回滚基线（验证：`git log -1` 记录 hash，`git status` 干净）
- [ ] 1.2 复核缺口现状与 design Context 一致：`.agents/skills/` 含 2 个自研技能，`.claude/.qoder/.opencode` 的 skills 各 6 个目录且均缺这 2 个（验证：缺失清单为 `[systematic-debugging, verification-before-completion]` × 3 层）

## 2. 技能分发

- [ ] 2.1 从 `.agents/skills/` 复制 `systematic-debugging/` 与 `verification-before-completion/` 两个目录到 `.claude/skills/`、`.qoder/skills/`、`.opencode/skills/`（验证：三层 skills 目录数各由 6 增至 8，缺失清单为空）
- [ ] 2.2 校验同名技能在四个目录中逐字节一致（验证：对 2 个技能分别计算四目录内 `SKILL.md` 的 SHA256，每组 4 个哈希值全等）

## 3. 入口契约修订

- [ ] 3.1 按 design D5 改写 `AGENTS.md` §9 的过期条目为状态无关表述（验证：不再出现「第一次归档前是空的」，且不含会随归档数量变化的数字）
- [ ] 3.2 更新 `AGENTS.md` §6 目录地图：标注 `.agents/skills/` 为自研技能真源、其余三层为分发副本，并写明「先改真源再同步副本」的修订顺序（验证：§6 出现真源与副本约定）
- [ ] 3.3 更新 `AGENTS.md` §5 技能触发规则：说明两个强制技能在四个适配层均可用（验证：§5 有分发说明，且与 §6 措辞一致）

## 4. 集成验收

- [ ] 4.1 确认 `scaffold/rename.mjs` 无需变更：本次新增路径不含模板身份标识（验证：对新增文件 grep 三类旧名 token 命中 0，改名演练仍 PASSED）
- [ ] 4.2 运行 `powershell -File harness\run-all.ps1`，确认五道闸门全部 PASS、退出码 0（验证：输出 `RESULT: ALL CHECKS PASSED`）
- [ ] 4.3 逐条比对 spec Scenario 的可验证点并贴证据：四适配层技能存在、同名副本哈希一致、AGENTS.md 无过期陈述（验证：三项各贴一条命令输出）

## Workflow follow-up

- 验收通过后按项目流程归档本 change：`/opsx:archive`（delta 合并为 `openspec/specs/skill-distribution/` 主 spec）
- 副本一致性闸门按 design D3 明确推迟，出现漂移事故时再按 AGENTS.md §8 新增 `06-skill-sync.ps1`
- 提交时机由人决定，AI 不主动 commit
