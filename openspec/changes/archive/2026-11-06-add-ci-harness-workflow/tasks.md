# Tasks

## 1. 闸门脚本跨平台适配

- [x] 1.1 `harness/run-all.ps1` 按 `$PSVersionTable.PSEdition` 选择子进程宿主：`Desktop` 用 `powershell.exe`，`Core` 用 `pwsh`。验证：Windows PowerShell 5.1 中执行 `$PSVersionTable.PSEdition` 得 `Desktop`，脚本解析出的宿主仍为 `powershell.exe`；Linux 分支由首轮 CI 实际执行。
- [x] 1.2 `harness/checks/05-scaffold-check.ps1` 把 `node.exe` 改为 `node`。验证：本地执行该闸门以退出码 0 结束，改名演练与残留扫描结果不变。
- [x] 1.3 同类跨平台修复（实施中发现，属 spec「闸门脚本跨平台可执行」的必要范围）：`03-static-guard.ps1` 的 `backend\src` 与 node_modules 排除正则、`07-doc-consistency.ps1` 的 `harness\checks`、`10-contract-check.ps1` 的反斜杠路径拼接、`11-conventions-check.ps1` 的五处反斜杠路径与文档路径归一。验证：四道闸门在 Windows 本地各自以退出码 0 结束。

## 2. CI 工作流

- [x] 2.1 新增 `.github/workflows/harness.yml` 骨架：`push` 与 `pull_request` 触发，`actions/checkout` 配 `submodules: recursive` 与 `persist-credentials: false`，`actions/setup-java` 装 Temurin 17 并开 Maven 缓存，`actions/setup-node` 装 Node 22 并以 `frontend/package-lock.json` 开 npm 缓存，最后以 `pwsh -File harness/run-all.ps1` 执行总闸门；设 `timeout-minutes: 45` 与按 PR/ref 的 `concurrency`。验证：推送到分支后 GitHub Actions 出现运行记录且工作流无 YAML 解析错误。证据：run 42094846750（commit 1fb1a9e）中五个 setup 步骤全部 success。
- [x] 2.2 为工作流补 `services`：`mysql:8.0` 映射 `8806:3306` 并设 `MYSQL_ROOT_PASSWORD`、`MYSQL_DATABASE: wanderchain` 与健康检查，`redis:7` 映射 `6606:6379` 且不设密码；job 级 env 注入同一临时口令到 `SCHEMA_DB_PASSWORD` 与 `WANDERCHAIN_DB_PASSWORD`。验证：首轮 CI 中 `02-test`、`06-schema-check`、`09-redis-check` 均连接成功并以退出码 0 结束。证据：run 42094846750 中 `Initialize containers` success，总闸门 exit 0（遇错即停语义下 02/06/09 必然已通过）。
- [x] 2.3 在 `AGENTS.md` 目录地图补 `.github/` 与 CI 入口说明，`<!-- harness-checks: ... -->` 标记保持不变。验证：执行 `powershell -File harness\checks\07-doc-consistency.ps1` 退出码 0。

## 3. 首轮运行收敛

- [x] 3.1 推送后观察首轮运行，记录十二门闸门的通过情况与总耗时。验证：运行记录完整，失败项有对应的闸门输出可归因。证据：首轮 run 42075278436 失败于 `01-compile`（`package com.luyi.myfirst.service.media does not exist`），经 annotation 取到完整 Maven 报错；修复后 run 42094846750（commit 1fb1a9e）exit 0，job 耗时 2 分 54 秒。
- [x] 3.2 若 `npm ci` 因 `frontend/package-lock.json` 缺少 Linux optional 依赖失败：暂停并请求授权改 `frontend` 子模块（超出本 change 边界）；获授权后在 Linux 环境补锁文件并提交子模块，未发生时跳过。验证：CI 中 `04-frontend` 的 `npm ci` 退出码 0。结果：未发生——run 42094846750 的 `04-frontend` 一次通过，未改动 `frontend` 子模块。
- [x] 3.3 若 `02-test` 在空库上失败：按输出归因，优先在 workflow 侧补齐库/初始化；确需改测试代码则另立 change。验证：CI 中 `02-test` 退出码 0。结果：未发生——`MYSQL_DATABASE: wanderchain` 已让库在 02 之前存在，run 42094846750 中 `02-test` 一次通过。
- [x] 3.4 静态确认工作流无软通过写法：不含 `continue-on-error`、`|| true`、`-DskipTests`、`-ContinueOnError`，job 结果由 `pwsh` 进程退出码决定。验证：检索 workflow 全文无上述片段，且 `run-all.ps1` 的 `exit 1` 能直接使 job 失败。
- [x] 3.5 首轮失败归因（实施中发现，非 CI 配置问题）：`01-compile` 失败于 `PostServiceImpl` 找不到 `MediaStorage`。根因：`backend/.gitignore` 的 `media/` 缺前导斜杠，把 `service/media` 与 `web/media` 两个源码包一并忽略，8 个文件从未入库，只在本地磁盘存在。修复：忽略规则改为 `/media/`，补提交 8 个文件（backend `8e3c784`），工作区更新 gitlink（`1fb1a9e`）。验证：backend 内 `mvn -B -DskipTests clean compile` 158 个源文件 BUILD SUCCESS；CI run 42094846750 全绿。

## Workflow follow-up

- 提交工作区自有文件（`.github/workflows/harness.yml`、`harness/run-all.ps1`、`harness/checks/05-scaffold-check.ps1`、`AGENTS.md` 与本次 change 目录）并推送。
- 首轮 CI 全绿后归档该 change（`/opsx:archive`）。
