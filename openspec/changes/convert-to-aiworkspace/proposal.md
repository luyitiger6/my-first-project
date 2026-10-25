# Proposal

## Why

当前仓库把「工作区控制面」与「两个应用」混在同一个 git 历史里：`openspec/`、`harness/`、`AGENTS.md` 与 `backend/`、`frontend/` 共享一个仓库，任何一侧的改动都会污染另一侧的提交边界，也让「工作区模板」与「应用模板」两种身份纠缠在一起。升级为 AIWorkSpace 后，顶层只负责规格、护栏、技能与编排，前后端回到各自独立的仓库与历史。同时必须修复一个既有红灯：`05-scaffold-check` 当前因 `.idea/` 与 `docs/specs` 命中旧名扫描而返回 1，子模块化前需要先让扫描边界与新的工作区身份对齐。

## What Changes

- 工作区身份：展示名 `AIWorkSpace`，仓库/文档 slug 用 `ai-workspace`；只改工作区自有文档（`AGENTS.md`、`README.md`），不改后端 `artifactId`、`spring.application.name`、Java 包名 `com.luyi.myfirst`，也不改前端包名。
- **BREAKING**：`backend/`、`frontend/` 由父仓库直接跟踪的目录改为 git submodule；父仓库只记录 `.gitmodules` 与两个 gitlink SHA，不再保存子模块文件内容。
- **BREAKING**：现有 `backend/`、`frontend/` 的内容与提交历史通过 `git subtree split` 拆分为两个独立仓库并推送；父仓库相应移除这两个目录的普通文件条目。
- 新增闸门 `harness/checks/00-submodule-check.ps1`：验收前检查 `.gitmodules`、两个 gitlink 与工作树是否就绪；未初始化时以退出码 1 结束并给出 `git submodule update --init --recursive` 提示，不自动联网、不交互。
- 收缩 `scaffold/rename.mjs`：只接受 `--name`（kebab-case slug）与 `--display`（展示名），只替换 `AGENTS.md`、`README.md` 中的工作区身份；不再接受 `--package`，不再改 backend 文件、包目录或 `.gitmodules` URL。
- 调整 `harness/checks/05-scaffold-check.ps1`：改名演练只针对工作区身份；复制排除 `.idea/`、`.vscode/`、`docs/`、子模块目录与子模块 `.git` 文件；扫描排除 `.gitmodules`（其 URL 可能含身份 token，但不属于改名范围），改用哈希比较验证未被修改；修复当前退出码 1。
- 更新 `AGENTS.md`：新增子模块边界说明（工作区/子模块职责、提交边界、clone 与 init 命令、URL 替换方式），目录地图标注 backend/frontend 为 submodule，命令速查补子模块命令，已知边界补网络依赖与应用改名职责外移。
- 更新 `README.md`：AIWorkSpace 定位、带子模块的 clone/快速开始、工作区改名命令（去掉 `--package`）、三仓库目录说明。
- 为 `backend` 子模块补 `.gitignore`（至少忽略 `target/`），保证独立仓库工作树干净；`frontend/.gitignore` 已覆盖 `node_modules/` 与 `dist/`。

## Capabilities

### New Capabilities

- `workspace-layout`: 顶层工作区以 git submodule 承载 frontend/backend 两个独立仓库，定义子模块边界、初始化前置检查、提交边界与文档契约。
- `workspace-scaffold`: 工作区模板自身的身份改名能力（展示名 + slug），以及 Harness 中的改名演练与残留扫描边界。

### Modified Capabilities

- `scaffold-rename`: 该能力的三条 requirement 全部移除并退役；应用身份改名不再由工作区承担，由 `workspace-scaffold` 取代工作区级改名。变更需要在 `.openspec.yaml` 声明 `retire_capabilities: true`。

## Impact

- Git：新增 `.gitmodules` 与两个 gitlink；父仓库历史保留，但 backend/frontend 文件不再由父仓库跟踪；远程仓库为 backend `https://github.com/luyitiger6/ai-workspace-backend`（`main` @ `b665293`）与 frontend `https://github.com/luyitiger6/ai-workspace-frontend`（`main` @ `888ab2d`），两者均含初始提交；迁移采用合并无关历史后快进推送，不使用强推。两个仓库名统一为 `ai-workspace-*`。
- 构建与验收：`harness/run-all.ps1` 从 5 道闸门变为 6 道（00 子模块检查前置）；全新 clone 必须先初始化子模块，否则整体判定失败。
- 工具：`scaffold/rename.mjs` 参数从 `--name/--package` 变为 `--name/--display`；旧命令不再兼容。
- 文档：`AGENTS.md`、`README.md` 的目录地图、命令速查、工作流与已知边界。
- 不变：后端 API `/api/todos`、端口 8989、前端 Todo 行为、Java 包名、Maven/npm 依赖。
- 不在本次范围：在 GitHub 上重命名父仓库、创建远程仓库、把应用身份改名脚本迁入 backend 仓库（后续在 backend 仓库单独立项）。
- 前置条件：两个远程仓库 URL 已提供并通过 `git ls-remote` 验证；若 apply 期间远端不可达或推送失败，迁移停在临时拆分分支，不移动本地目录。
