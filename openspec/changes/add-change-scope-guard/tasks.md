# Tasks

## 1. 闸门实现

- [x] 1.1 新增 `harness/checks/14-change-scope-check.ps1`（UTF-8 BOM）：遍历 `openspec/changes/` 下非 `archive` 目录，统计能力数 / 任务数 / Scenario 数，任一超限且无有效 `scope-exception.md` 即退出码 1；通过时打印每个在飞 change 的三项计数与例外标记。
- [x] 1.2 例外文件解析：`Reason` / `RegisteredOn` / `Expires` 三字段非空、两个日期均匹配 `YYYY-MM-DD`、`Expires` 不早于当日；缺字段、格式错误、过期分别报不同报文。

## 2. 文档接入

- [x] 2.1 `AGENTS.md`：§6 目录树补 `14-change-scope-check.ps1`、`<!-- harness-checks: ... -->` 标记追加、§7 命令速查补「只查 change 粒度」、§9 已知边界补「只对在飞 change 生效，归档不追溯；例外是到期失效的欠账」。
- [x] 2.2 `docs/conventions/README.md` 机械守卫补 14 号。

## 3. 验收

- [x] 3.1 `powershell -File harness\checks\14-change-scope-check.ps1` 退出码 0，打印在飞 change 数与各自三项计数。
- [x] 3.2 负向验证 A：临时造一个 tasks 数 31 的在飞 change → exit 1 并报告实际数量；删除后复绿。实测报文：`change 粒度过大：zz-scope-negative-test；tasks 31 > 30；未提供 scope-exception.md`。另验能力 3 → `能力 3 > 2（test-cap, test-cap-b, test-cap-c）`；Scenario 61 → `scenarios 61 > 60`。
- [x] 3.3 负向验证 B：同一超限 change 补一份 `Expires` 已过期的 `scope-exception.md` → exit 1 并提示过期；改为未来日期后 exit 0。实测报文：`例外已过期：zz-scope-negative-test -> Expires=2026-01-01`；改为 2026-12-31 后输出 `（例外放行）` 并 exit 0。
- [x] 3.4 负向验证 C：例外文件缺 `Reason` → exit 1 并指出字段；补齐后复绿。实测报文：`例外缺字段：zz-scope-negative-test -> Reason`。
- [x] 3.5 `07` / `11` / `12` / `13` 闸门与 `openspec validate add-change-scope-guard --strict` 均退出码 0（07 报 15 个闸门一致；14 报 2 个在飞 change 全部在额内）。
- [x] 3.6 推送 `feat/change-scope-guard-20261106` 后 CI 全绿（workflow run #18，commit 86e70e0，conclusion=success）。
