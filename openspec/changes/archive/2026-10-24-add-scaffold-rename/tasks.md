# Tasks

## 1. 基线

- [x] 1.1 以当前 HEAD 为回滚基线（验证：`git status` 干净或记录未提交清单，`git log -1` 记录基线 hash）
- [x] 1.2 以 grep 复核三类旧名 token（`my-first-project` / `com.luyi` / `myfirst`）的命中文件与 design Context 的 10 文件清单一致（验证：差异为 0）

## 2. 改名脚本

- [x] 2.1 实现 `scaffold/rename.mjs`：纯 Node 内置模块；参数 `--name`（kebab-case 校验）与 `--package`（点分小写校验），缺失或非法即 stderr 提示 + 退出码 1（验证：缺参/非法参各跑一次，退出码均为 1）
- [x] 2.2 脚本内实现替换清单：三类旧名映射 + design D3 文件清单，逐文件精确替换，跳过 `openspec/changes/archive/` 与 `.git`（验证：由 3.1 演练覆盖）
- [x] 2.3 脚本内实现包目录重命名：`backend/src/main/java/com/luyi/myfirst` 与 test 侧同路径 → 新包名路径，在文本替换后执行（验证：由 3.1 演练覆盖）

## 3. 残留检查闸门

- [x] 3.1 实现 `harness/checks/05-scaffold-check.ps1`：复制仓库到临时目录（排除 `.git`、`target/`、`node_modules/`、`dist/`、`openspec/changes/archive/`）→ 副本内执行 `rename.mjs --name demo-app --package com.demo.app` → 副本内残留扫描（三类旧名 token，命中即输出位置并非 0）→ 清理临时目录；任一步失败 exit 1（验证：单独运行退出码 0，且模板仓库本身未被改动）
- [x] 3.2 反向验证闸门会拦错：临时在副本流程中注入一个未替换文件，确认闸门退出码 1 并输出命中位置（验证：退出码 1，随后恢复）

## 4. 文档同步

- [x] 4.1 更新 `README.md`：新增「模板改名」章节（改名命令、参数说明、改名后跑 `run-all.ps1` 的指引）（验证：章节存在，命令与脚本实际用法一致）
- [x] 4.2 更新 `AGENTS.md`：§6 目录地图加 `scaffold/` 与 05 闸门；§7 命令速查加改名命令与「只查改名」闸门命令（验证：与 README 措辞一致）

## 5. 集成验收

- [x] 5.1 运行 `powershell -File harness\run-all.ps1`，确认五道闸门全部 PASS、退出码 0（验证：输出 `RESULT: ALL CHECKS PASSED` 且 `$LASTEXITCODE` 为 0，05 闸门在列）
- [x] 5.2 真实演练冒烟：临时目录完整改名后，人工核对 `backend/pom.xml` 的 groupId/artifactId、`application.yml` 的应用名、包目录新路径、README 标题均已替换（验证：`Get-Content` 抽查关键文件 + 包目录结构正确，随后清理临时目录）

## Workflow follow-up

- 验收通过后按项目流程归档本 change：`/opsx:archive`（specs delta 将合并进 `openspec/specs/scaffold-rename/`，成为第二个主 spec）
- 提交时机由人决定，AI 不主动 commit
