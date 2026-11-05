# Tasks

## 1. 闸门脚本跨平台适配

- [x] 1.1 `harness/run-all.ps1` 按 `$PSVersionTable.PSEdition` 选择子进程宿主：`Desktop` 用 `powershell.exe`，`Core` 用 `pwsh`。验证：Windows PowerShell 5.1 中执行 `$PSVersionTable.PSEdition` 得 `Desktop`，脚本解析出的宿主仍为 `powershell.exe`；Linux 分支由首轮 CI 实际执行。
- [x] 1.2 `harness/checks/05-scaffold-check.ps1` 把 `node.exe` 改为 `node`。验证：本地执行该闸门以退出码 0 结束，改名演练与残留扫描结果不变。
- [x] 1.3 同类跨平台修复（实施中发现，属 spec「闸门脚本跨平台可执行」的必要范围）：`03-static-guard.ps1` 的 `backend\src` 与 node_modules 排除正则、`07-doc-consistency.ps1` 的 `harness\checks`、`10-contract-check.ps1` 的反斜杠路径拼接、`11-conventions-check.ps1` 的五处反斜杠路径与文档路径归一。验证：四道闸门在 Windows 本地各自以退出码 0 结束。

## 2. CI 工作流

- [ ] 2.1 新增 `.github/workflows/harness.yml` 骨架：`push` 与 `pull_request` 触发，`actions/checkout` 配 `submodules: recursive` 与 `persist-credentials: false`，`actions/setup-java` 装 Temurin 17 并开 Maven 缓存，`actions/setup-node` 装 Node 22 并以 `frontend/package-lock.json` 开 npm 缓存，最后以 `pwsh -File harness/run-all.ps1` 执行总闸门；设 `timeout-minutes: 45` 与按 PR/ref 的 `concurrency`。验证：推送到分支后 GitHub Actions 出现运行记录且工作流无 YAML 解析错误。
- [ ] 2.2 为工作流补 `services`：`mysql:8.0` 映射 `8806:3306` 并设 `MYSQL_ROOT_PASSWORD`、`MYSQL_DATABASE: wanderchain` 与健康检查，`redis:7` 映射 `6606:6379` 且不设密码；job 级 env 注入同一临时口令到 `SCHEMA_DB_PASSWORD` 与 `WANDERCHAIN_DB_PASSWORD`。验证：首轮 CI 中 `02-test`、`06-schema-check`、`09-redis-check` 均连接成功并以退出码 0 结束。
- [x] 2.3 在 `AGENTS.md` 目录地图补 `.github/` 与 CI 入口说明，`<!-- harness-checks: ... -->` 标记保持不变。验证：执行 `powershell -File harness\checks\07-doc-consistency.ps1` 退出码 0。

## 3. 首轮运行收敛

- [ ] 3.1 推送后观察首轮运行，记录十二门闸门的通过情况与总耗时。验证：运行记录完整，失败项有对应的闸门输出可归因。
- [ ] 3.2 若 `npm ci` 因 `frontend/package-lock.json` 缺少 Linux optional 依赖失败：暂停并请求授权改 `frontend` 子模块（超出本 change 边界）；获授权后在 Linux 环境补锁文件并提交子模块，未发生时跳过。验证：CI 中 `04-frontend` 的 `npm ci` 退出码 0。
- [ ] 3.3 若 `02-test` 在空库上失败：按输出归因，优先在 workflow 侧补齐库/初始化；确需改测试代码则另立 change。验证：CI 中 `02-test` 退出码 0。
- [x] 3.4 静态确认工作流无软通过写法：不含 `continue-on-error`、`|| true`、`-DskipTests`、`-ContinueOnError`，job 结果由 `pwsh` 进程退出码决定。验证：检索 workflow 全文无上述片段，且 `run-all.ps1` 的 `exit 1` 能直接使 job 失败。

## Workflow follow-up

- 提交工作区自有文件（`.github/workflows/harness.yml`、`harness/run-all.ps1`、`harness/checks/05-scaffold-check.ps1`、`AGENTS.md` 与本次 change 目录）并推送。
- 首轮 CI 全绿后归档该 change（`/opsx:archive`）。
