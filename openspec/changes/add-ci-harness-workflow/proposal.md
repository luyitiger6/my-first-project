# Proposal

## Why

Harness 已经有十一道闸门，且每道都被设计成「拥有否决权」，但这套否决权目前只在一个条件下生效：有人记得手动执行 `powershell -File harness\run-all.ps1`。仓库里没有任何 CI 配置，`run-all` 在整个仓库中只被它自己的注释引用过一次。结果是：护栏存在，但没有人按铃——改动可以直接进入主干而不经过任何一道闸门。

闸门数量已经到十一，手工执行的时间成本与遗忘概率都在上升；同时这套脚本目前只能在 Windows 上跑（`run-all.ps1` 用 `powershell.exe` 拉起子进程、`05-scaffold-check.ps1` 调用 `node.exe`），连「换一台托管机器执行」都做不到。补上 CI 是让已有护栏真正生效，而不是新增护栏。

## What Changes

- 新增 `.github/workflows/harness.yml`：在 `push` 与 `pull_request` 时触发，检出工作区与两个递归子模块，准备 JDK 17、Maven 与 Node 20.9+，用 `services` 拉起 MySQL 8（发布 8806，预建 `wanderchain` 库）与 Redis 7（发布 6606），执行 `pwsh -File harness/run-all.ps1`；任一闸门非 0 退出即 job 失败。
- 修改 `harness/run-all.ps1`：子闸门改用当前 PowerShell 宿主拉起（Windows 下仍为 `powershell.exe`，非 Windows 下为 `pwsh`），使同一份总控脚本可在两个平台执行；Windows 本地行为不变。
- 修改 `harness/checks/05-scaffold-check.ps1`：调用 Node 时不再写死 `node.exe`，改为按平台可执行的 `node`，使改名演练可在非 Windows runner 上执行。
- **不新增闸门**：`harness/checks/` 集合不变，因此 `AGENTS.md` 的 `<!-- harness-checks -->` 标记不改动，07 闸门的比对范围不变。
- **不改子模块内容**：CI 只检出 `backend` / `frontend` 的 gitlink 提交，不写入、不提交任何子模块文件。

## Capabilities

### New Capabilities

- `ci-harness`: 托管 CI 在 push 与 pull_request 时执行全部闸门、供给外部依赖（MySQL / Redis）、以退出码判定结果，并使闸门脚本可在 Windows 与 Linux 两个平台执行。

### Modified Capabilities

无。

## Impact

- **受影响的仓库**：工作区根（`.github/workflows/harness.yml`、`harness/` 两个脚本）。`backend` 与 `frontend` 子模块不被修改。
- **不受影响**：`openspec/specs/` 既有 18 项能力、`harness/checks/` 的闸门集合与执行顺序、`AGENTS.md` 的闸门清单标记。
- **新增第三方依赖**：GitHub 官方 action `actions/checkout`（检出含子模块）、`actions/setup-java`（Temurin 17 + Maven 缓存）、`actions/setup-node`（Node 20.9+ 与 npm 缓存）；容器镜像 `mysql:8.0` 与 `redis:7`（作为 CI 内的临时依赖实例，不持久化、不含真实数据）。
- **运行期语义不变**：本地开发仍依赖 `127.0.0.1:8806` 与 `6606`；CI 只是把同样的依赖以 services 容器形式临时提供。
- **已知边界**：CI 内的 MySQL / Redis 是每次运行新建的临时实例，06 闸门会在其中 `DROP DATABASE` 后重建两个专用 schema；这与本地行为一致，但意味着 CI 不保留任何数据。
