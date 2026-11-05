# Proposal

## Why

仓库此前没有任何分支纪律的文字约束：改动可以直接落在 `main` 上，隔离、回滚与审计全靠当时的记忆或临时约定。上一轮 CI 接入已经撞上一次真实缺陷——`backend/.gitignore` 把媒体源码包一起忽略，问题是在验证链路上翻出来的；如果当时改动直接进 `main`，回滚只能靠 `revert`，而不是丢弃一条分支。

更根本的问题是：纪律只存在于对话记忆里，换一个 AI 工具、换一个协作者就丢失。`AGENTS.md` 自称「仓库对 AI 的唯一入口契约」，分支纪律不进这个文件，等于没有被约束过。

为什么现在：CI 已经能在每次 push / pull_request 上跑完整闸门，护栏第一次具备自动拦截能力；此时补上「改动先分支」的前置纪律，正好与「合并前必须有绿灯」衔接，成本最低。

## What Changes

- **AGENTS.md §3**：硬规则从六条扩为七条，新增第 7 条「任何改动先走分支」——`main` 只承载合并与同步推送。
- **AGENTS.md §4**：在标准工作流开头新增「分支纪律」小节：三类分支命名（`feat/<简述>-<yyyyMMdd>`、`fix/<简述>-<yyyyMMdd>`、一次性 `ci/<简述>`）、切出基线按依赖决定、分支内 BUG 就地修、无关问题另开补丁分支、`feat/` 与 `fix/` 合并后保留。
- **AGENTS.md §7**：命令速查补两条建分支命令。
- **docs/conventions/ 四份文档**：对「六条硬规则」的引用同步改为「七条硬规则」。
- **非目标**：不改任何代码、闸门脚本、子模块；不引入 GitHub 分支保护等平台配置（属于后续独立建议）。

## Capabilities

### New Capabilities

<!-- 本变更是协作约定与文档约束，不引入任何系统行为，不产生 delta spec。 -->

### Modified Capabilities

<!-- 无 spec 级行为变化：改的是仓库对 AI 的工作方式约束，产品行为、API、页面、命令语义全部不变。 -->

## Impact

- **文档**：`AGENTS.md`（§3 / §4 / §7）、`docs/conventions/README.md`、`docs/conventions/backend-conventions.md`、`docs/conventions/frontend-conventions.md`、`docs/conventions/styling-conventions.md`。
- **代码 / API / 闸门**：无改动；`harness/checks/`、`backend/`、`frontend/` 均不触碰。
- **验收**：`openspec validate add-branch-discipline --strict`、`07-doc-consistency`、`11-conventions-check` 退出码 0；改动走 `feat/branch-discipline-20261106` 分支，CI 全绿后交人工审阅再合并。
