# Tasks

## 1. 账本与闸门

- [x] 1.1 生成 `docs/spec-evidence.json`：19 个能力各一条记录；`sources` 按能力声明真实存在的闸门 / 测试 / e2e / runner；现有 538 条 Scenario 进入 `historicallyCovered`；已有客观运行证据的条目落 `verified`（如 `skill-distribution` 的「副本与真源一致」指向 12 号闸门）。
- [x] 1.2 新增 `harness/checks/13-spec-evidence-check.ps1`（UTF-8 BOM）：能力双向一致、三类划分恰好覆盖、引用类型合法且文件存在、欠账三字段完整、通过时打印三组计数；不交互，退出码 0 / 1。

## 2. 文档接入

- [x] 2.1 `AGENTS.md`：§6 目录树补 `13-spec-evidence-check.ps1` 与 `docs/spec-evidence.json`、`<!-- harness-checks: ... -->` 标记追加、§7 命令速查补「只查证据账本」、§9 已知边界补「账本证明登记齐全，不证明行为正确」。
- [x] 2.2 `docs/conventions/README.md` 机械守卫补 13 号。

## 3. 验收

- [x] 3.1 `powershell -File harness\checks\13-spec-evidence-check.ps1` 退出码 0，打印 19 个能力与 verified / deferred / historicallyCovered 三组计数。
- [x] 3.2 负向验证 A：临时新增一条未登记 Scenario → exit 1 并列出标题；还原后复绿。
- [x] 3.3 负向验证 B：把某条引用改为不存在的路径 → exit 1 并列出该引用；还原后复绿。
- [x] 3.4 `07` / `11` / `12` 闸门与 `openspec validate add-spec-evidence-ledger --strict` 均退出码 0。
- [x] 3.5 推送 `feat/spec-evidence-ledger-20261106` 后 CI 全绿（run 42154215667，commit 41f0b52，conclusion=success）。
