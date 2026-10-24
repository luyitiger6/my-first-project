# Proposal

## Why

本仓库作为脚手架模板分发时，clone 者拿到的代码里刻着模板作者的身份标识（项目名 `my-first-project`、groupId `com.luyi`、包名 `myfirst`），盘点确认散布在 10 个文件与 2 个包目录路径中。手动逐处替换漏一处即编译失败，且改名后没有机器可判定的验收手段。这是全栈脚手架计划的最后一块拼图（change 1 结构迁移、change 2 前端模板之后）。

## What Changes

- 新增 Node 版改名脚本 `scaffold/rename.mjs`：接收新项目名与新包名参数，一次性替换全部硬编码点并重命名包目录（跨平台，README 前置环境已含 Node）
- 新增闸门 `harness/checks/05-scaffold-check.ps1`：在临时目录演练改名并扫描旧名残留，保证模板仓库自身（未改名状态）与改名后的仓库都能通过 `run-all.ps1`
- 更新 `README.md`（「模板改名」章节）与 `AGENTS.md`（目录地图加 `scaffold/` 与 05 闸门，命令速查加改名命令）
- 不改任何业务源码：改名只发生在使用者 clone 之后，本仓库继续保持模板身份

## Capabilities

### New Capabilities
- `scaffold-rename`: 脚手架模板支持参数化改名，且改名结果可被 Harness 用退出码验证（替换完整性 + 旧名残留检查）

### Modified Capabilities
（无）

## Impact

- `harness/`：新增 05 闸门，按文件名排序自动接入 `run-all.ps1`（AGENTS.md §8 约定，总控脚本不改）
- `scaffold/`：新增目录，承载改名脚本（模板的一部分，随仓库分发）
- 文档：`README.md`、`AGENTS.md` 同步
- 改名脚本触及的文件范围（仅在被执行时）：`backend/pom.xml`、`backend/src/main/resources/application.yml`、6 个 Java 文件的 package/import、2 个包目录路径、`README.md`、`AGENTS.md`
