# Tasks

> 本变更只改文档，无外部行为变化，`.openspec.yaml` 标记 `skip_specs: true`；无需 design.md。

## 1. 契约文档

- [x] 1.1 `AGENTS.md` §3 改为「七条硬规则」，新增第 7 条：任何改动先走分支，`main` 只承载合并与同步推送。
- [x] 1.2 `AGENTS.md` §4 顶部新增「分支纪律」：三类分支命名与日期后缀、切出基线按依赖决定、分支内 BUG 就地修、无关问题记待办另开 `fix/`、`feat/` 与 `fix/` 合并后保留。
- [x] 1.3 `AGENTS.md` §7 命令速查补 `feat/` 与 `fix/` 建分支命令。
- [x] 1.4 `docs/conventions/` 四份文档中的「六条硬规则」引用同步改为「七条硬规则」。

## 2. 验收

- [x] 2.1 `openspec validate add-branch-discipline --strict` 退出码 0。
- [x] 2.2 `powershell -File harness\checks\07-doc-consistency.ps1` 与 `11-conventions-check.ps1` 退出码 0。
- [ ] 2.3 分支 `feat/branch-discipline-20261106` 推送后 CI 全绿。
- [ ] 2.4 交用户审阅，通过后合并 `main`；分支按规则保留。
