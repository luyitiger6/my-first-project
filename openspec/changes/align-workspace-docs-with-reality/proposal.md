# Proposal

## Why

`rebuild-wanderchain-homepage` 归档后，`frontend/` 已从 Todo 最小界面换成 wanderchain 首页，`components/TodoApp.tsx` 与 `lib/api.ts` 在实施中按任务删除；但 `AGENTS.md` §6 的 frontend 目录树仍写着这两个文件，`app/page.tsx` 仍被描述成「挂载 TodoApp」。`AGENTS.md` 是本仓库对 AI 的唯一入口契约，目录树指向不存在的文件，agent 就会按错的地图动手。

`README.md` 同样把 frontend 说成「Todo 界面」；`harness/checks/03-static-guard.ps1` 头注释还写着「闸门 3/5」，而实际闸门已是 00–06。

根因是「文档不会自己跟上代码」：这次能改，下次换栈还会重演。所以除了把描述改回真相，还要加一道闸门，让文档与仓库现状的偏差变成退出码 1，而不是靠人偶然翻到。

## What Changes

- `AGENTS.md` §6 目录地图的 frontend 章节按现状重写：删除 `components/TodoApp.tsx` 与 `lib/api.ts`，补 `components/home/`、`components/auth/`、`components/site/`、`lib/home/`、`lib/auth/`、`app/login|register|community|attractions`、`vitest.setup.ts`；`package.json` 的脚本补 `start`。
- `AGENTS.md` §6 harness 章节新增 `<!-- harness-checks: ... -->` 机器可读标记（列出 00–07），供新增闸门与文档一致性闸门比对。
- `AGENTS.md` §6 `.agents/skills/` 条目补一句：该目录同时存放 `openspec init` 生成的 `openspec-*` 技能。
- `AGENTS.md` §7 命令速查补前端生产启动一行（`npm run start`，需先 `build`）。
- `README.md` 的 frontend 描述由「Todo 界面」改为 wanderchain 首页加同源 API 代理；把「七道闸门（00–06）」「00–06 全部执行」这类写死数量的表述改为不写死数量，避免每加一道闸门都要再改一遍文档。
- 修正 `harness/checks/03-static-guard.ps1` 头注释的「闸门 3/5」。
- 新增 `harness/checks/07-doc-consistency.ps1`：比对 `AGENTS.md` 的闸门清单标记与 `harness/checks/*.ps1` 实际文件集合，并扫描文档中已下线技术栈的残留 token，不一致即退出码 1。
- 清理未跟踪的遗留物：`frontend/dist/`（Vite 时代的构建产物）、空的 `frontend/src/`、仓库根 `.scaffold-tmp/`。

本次不改变任何运行时行为：后端接口、前端页面与既有测试均不变，`06-flyway` 仍只作用于 `ai_chat_gate` schema。`AGENTS.md` §6 的 00–06 闸门清单、§9 的四条红线与 §7 的 00/06 命令此前已经写对，本次不动。

## Capabilities

### New Capabilities

无。本次只修正文档与闸门元信息，不改变任何系统行为，按 OpenSpec 规则在 `.openspec.yaml` 声明 `skip_specs: true`。

### Modified Capabilities

无。

## Impact

- 受影响的文件：`AGENTS.md`、`README.md`、`harness/checks/03-static-guard.ps1`（仅头注释）、新增 `harness/checks/07-doc-consistency.ps1`。
- 本地删除（未跟踪，不在版本库内）：`frontend/dist/`、`frontend/src/`、`.scaffold-tmp/`。
- 闸门数量从 00–06 变为 00–07，`run-all.ps1` 无需改动（按文件名排序自动汇总）。
- 不影响 `backend/`、`frontend/` 两个子模块的提交内容；`openspec/specs/` 下现有主 spec 不变。
- `docs/specs/todo-module-spec.md` 的 v1.2.2 修订已在工作区存在，本次不提交、不改写，只登记在 tasks 的 follow-up 中交给人类处理。
