# Tasks

## 1. 契约文档对齐（AGENTS.md）

- [x] 1.1 重写 `AGENTS.md` §6 目录地图的 frontend 章节：删除已不存在的 `components/TodoApp.tsx` 与 `lib/api.ts`，`app/page.tsx` 不再描述为「挂载 TodoApp」，补 `components/home|auth|site/`、`lib/home|auth/`、`app/login|register|community|attractions`、`vitest.setup.ts`，`package.json` 脚本补 `start`；验证方式：目录树中出现的每个 frontend 路径都能在 `frontend/` 下找到（或能由 `npm run build` 生成）。
- [x] 1.2 `AGENTS.md` §6 harness 章节写入 `<!-- harness-checks: 00-submodule-check ... 07-doc-consistency -->` 标记，作为机器可读的闸门清单；验证方式：标记内的名字去掉扩展名后与 `harness/checks/*.ps1` 的 BaseName 集合完全一致。
- [x] 1.3 `AGENTS.md` §7 命令速查补 `npm run start` 一行并注明需先 `build`；验证方式：表中前端命令与 `frontend/package.json` 的 `scripts`（`dev`/`build`/`start`/`test`）逐条对应，无文档里有、脚本里没有的命令。
- [x] 1.4 `AGENTS.md` §6 的 `.agents/skills/` 条目补一句「该目录同时存放 `openspec init` 生成的 `openspec-*` 技能」；验证方式：`.agents/skills/` 实际目录数与条目描述一致（8 个技能目录）。

## 2. README 去掉写死数量

- [x] 2.1 `README.md` 的 frontend 描述由「Todo 界面」改为 wanderchain 首页加同源 API 代理；验证方式：`Select-String -Path README.md -Pattern 'Todo 界面'` 零命中。
- [x] 2.2 `README.md` 中「七道闸门（00–06）」「00–06 全部执行」这类写死数量的表述改为不写死数量，并保留「06 复用 8806 的既有 MySQL」这一事实；验证方式：`Select-String -Path README.md -Pattern '七道闸门|00–06|00-06'` 零命中。

## 3. 闸门元信息与新增文档一致性闸门

- [x] 3.1 修正 `harness/checks/03-static-guard.ps1` 头注释的「闸门 3/5」为与实际闸门数一致的说法；验证方式：`Select-String -Path harness/checks/03-static-guard.ps1 -Pattern '3/5'` 零命中。
- [x] 3.2 新增 `harness/checks/07-doc-consistency.ps1`：比对 `AGENTS.md` 的 `harness-checks` 标记与 `harness/checks/*.ps1` 实际文件集合，并扫描 `AGENTS.md` / `README.md` 中已下线技术栈 token（`App.vue`、`App.spec.ts`、`src/main.ts`、`TodoApp`、`Todo 界面`）；通过 `exit 0`、不一致 `exit 1`、全程不交互，失败时打印缺失项或命中行。
- [x] 3.3 验证新闸门真的会拦住漂移：正常状态运行 `powershell -File harness\checks\07-doc-consistency.ps1` 退出码 0；临时把标记里一个闸门名改错后重跑，退出码 1 且输出指出缺失项；还原后重跑退出码 0。

## 4. 清理未跟踪遗留物

- [x] 4.1 删除 `frontend/dist/`（Vite 时代的构建产物）与空的 `frontend/src/`；验证方式：`frontend` 内 `git status --short` 无新增改动，且 `npm run build` 仍以退出码 0 完成。
- [x] 4.2 删除仓库根 `.scaffold-tmp/`；验证方式：`git status --short` 不因此出现新条目（该目录已在 `.gitignore` 中）。

## 5. 集成验收

- [x] 5.1 在仓库根执行 `powershell -File harness\run-all.ps1`，退出码 0，摘要中 00–07 全部 PASS。
- [x] 5.2 执行 `openspec validate align-workspace-docs-with-reality --strict`，结果为 valid。

## Workflow follow-up

- `docs/specs/todo-module-spec.md` 工作区中已有 v1.2.2 未提交修订（修正前端适用模块映射），本次不提交、不改写，由人类决定提交时机。
- 审阅通过后归档本 change：`/opsx:archive align-workspace-docs-with-reality`。
