# Design

## Context

动机与范围见 `proposal.md`。与做法直接相关的现状：

- 父仓库当前 HEAD 为 `06b8f2d`，工作区干净，`origin` 指向 `https://github.com/luyitiger6/my-first-project.git`；`backend/`、`frontend/` 是普通目录，各自没有 `.git`。
- 两个目标仓库已存在且**不是空仓库**：
  - backend: `https://github.com/luyitiger6/ai-workspace-backend`（`main` @ `b665293258968370e693bb653c4261a29c052bfb`，含 `LICENSE`、`README.md`；无 `.gitignore`，迁移时新建）
  - frontend: `https://github.com/luyitiger6/ai-workspace-frontend`（`main` @ `888ab2db99aaa0b14f777e7fcc18fe0c62620a0c`，含 `LICENSE`、`README.md`）
  因此迁移不能假设空仓库，也不能用强推清空远端历史。两个仓库名已统一为 `ai-workspace-*`，迁移命令按上述地址原样使用。
- `05-scaffold-check` 当前基线为红：临时副本复制了 `.idea/` 与 `docs/specs`，旧名扫描命中后返回 1。
- PowerShell 5.1 环境；脚本需保持现有编码约定，不新增交互。

## Goals / Non-Goals

**Goals:**

- 父仓库只保留工作区控制面（`openspec/`、`harness/`、`.agents/`、`scaffold/`、文档）与两个 gitlink；子模块保留完整历史与独立项目身份。
- 迁移顺序保证可回滚：远端推送成功之前不动本地 `backend/`、`frontend/`；推送失败可停在拆分分支。
- Harness 对“子模块未初始化 / 检出提交与 gitlink 不一致”给出确定失败与可执行修复命令。
- 工作区改名与子模块应用改名彻底解耦，改名脚本不再触碰子模块。

**Non-Goals:**

- 不改 GitHub 父仓库名、不创建远程仓库、不改 `artifactId` / `groupId` / Java 包名 / 前端包名。
- 不提供跨三个仓库的自动提交或推送编排；Harness 只读。
- 不把应用身份改名脚本迁入 backend；该能力在 backend 仓库另行立项。
- 不引入 CI、容器或外部中间件。

## Decisions

### D1：用 git submodule，而不是 subtree 或嵌套普通仓库

选择 submodule：父仓库以 gitlink 锁定两个子模块的精确提交，子模块拥有独立历史、独立远端与独立发布节奏。subtree 会把两端代码继续塞在父仓库历史里，无法形成独立仓库；嵌套普通仓库父仓库无法锁定版本，克隆后不可复现。代价是全新 clone 必须初始化子模块，由 D3 的闸门显式暴露。

### D2：先拆历史并合并远端初始提交，再替换本地目录

两个目标仓库已有初始提交，直接 `push` 会因无关历史被拒绝；`--force` 会丢弃远端提交，不可接受。采用：

1. `git subtree split --prefix=<dir> -b _migrate/<dir> HEAD` 拆出保留历史的临时分支。
2. `git fetch <url> main:refs/remotes/_migrate/<dir>-main`，再在临时分支上 `git merge --allow-unrelated-histories`。
3. 冲突处理：frontend 的 `README.md` 保留现有项目 README（远端 40 字节 README 留在历史中）；backend 保留远端 `LICENSE` / `README.md`，并新建 `.gitignore`（至少忽略 `target/`），补上子模块独立仓库缺少的构建产物规则。
4. `git push <url> _migrate/<dir>:main` 快进推送；`git ls-remote` 复核远端 HEAD 与本地分支一致后，才移动本地目录。

备选方案：`--force` 推送（丢弃远端初始提交，违反不可逆操作约束）；`git rebase --root --onto`（需重写全部迁移提交，冲突面更大）；以当前快照新建单提交（丢失历史）。三者均不采用。

### D3：00 检查只读，不自动初始化

`harness/checks/00-submodule-check.ps1` 在任何编译/测试前执行，检查：

- `.gitmodules` 存在且含 `backend`、`frontend` 两个 path 与 url；
- `git ls-files --stage -- <path>` 的条目类型为 `160000`；
- 子模块目录含标记文件（`backend/pom.xml`、`frontend/package.json`）；
- `git -C <path> rev-parse --is-inside-work-tree` 成功，且 `HEAD` 等于父仓库记录的 gitlink。

检查不执行 `git submodule update`、不访问网络、不提问；失败时列出全部问题并输出修复命令。自动初始化会引入网络、凭据与副作用，且让“初始化”这一步从验收中消失，因此不采用。

### D4：05 改名演练只覆盖工作区身份

05 闸门在临时副本中演练，不接触真实仓库。复制阶段排除 `.git`、`.gitmodules` 以外的子模块目录（`backend/`、`frontend/` 直接排除）、`openspec/`、`docs/`、`.idea/`、`.vscode/`、`.scaffold-tmp/` 与所有构建产物；同时保留 `.gitmodules` 并在演练前后比较哈希，验证改名脚本没有改动 URL。

残留扫描只认 `AIWorkSpace` 与 `ai-workspace` 两个 token，排除 `backend\`、`frontend\`、`openspec\`、`docs\`、`scaffold\`（脚本自身）、`.idea\`、`.vscode\`、`.gitmodules` 与 05 脚本自身。`.gitmodules` 必须单独排除：子模块 URL 很可能包含 `aiworkspace` / `ai-workspace` 片段，而 URL 明确不属于工作区改名范围，误扫会让合法配置永远无法通过；其完整性由演练前后的哈希比较保证。这样既修复当前红灯，也让“工作区身份不在其他文件里重复硬编码”成为可执行约束。

### D5：改名脚本收缩为工作区身份改名

`scaffold/rename.mjs` 改为：

- 必填 `--name`（kebab-case slug）与 `--display`（去空白后非空、1..60 字符、不含换行）；
- 只改 `AGENTS.md` 与 `README.md`；旧 token 为 `AIWorkSpace`（展示名）与 `ai-workspace`（slug）；
- 显式拒绝 `--package`，提示应用身份改名应在 backend 仓库内执行；
- 新值与旧值相同、或 `AGENTS.md` 中检测不到旧 token 时拒绝执行，防止空操作与二次执行；
- 不遍历子模块、不改包目录、不改 `.gitmodules`。

备选方案：保留 `--package` 并在子模块内执行（跨仓库修改，职责混乱）；把应用改名脚本复制进工作区（子模块内容变更无法由父仓库提交）。均不采用。

### D6：身份 token 只允许出现在两个文档中

`AIWorkSpace` / `ai-workspace` 只允许出现在 `AGENTS.md` 与 `README.md`；`openspec/` 属于历史工件，`scaffold/` 属于改名工具自身，`docs/` 属于模块规格，都不参与工作区改名。其他工作区文件（harness、skills、配置）不得硬编码这两个 token，否则 05 扫描会拦截。这是“改名可重复验证”的前提，而不是风格偏好。

## Risks / Trade-offs

- [远端推送失败（网络/凭据）] → 推送发生在移动本地目录之前；失败即停止，本地目录原样保留，临时分支可丢弃。
- [frontend README 合并冲突] → 固定保留现有项目 README，远端版本留在历史；冲突无法按此解决时 `git merge --abort` 并停止迁移。
- [仓库名带前后连字符，疑似笔误] → 两个 URL 已用 `git ls-remote` 验证可访问；迁移按用户提供的原样使用，仓库改名留给 GitHub 设置，不在本变更处理。
- [全新 clone 未初始化导致验收失败] → 由 00 闸门给出明确修复命令，并在 AGENTS.md/README 写明 clone 与 init 两种入口。
- [临时备份占用磁盘] → 备份放在被忽略的 `.scaffold-tmp/submodule-migration/`，验证全绿并经用户确认后再清理；不做自动删除。
- [05 修复被误认为放宽护栏] → 只移除“工作区不拥有的文件”与 IDE 目录；工作区自有的 `AGENTS.md`、`README.md`、harness 脚本仍在扫描范围内。

## Migration Plan

1. **Preflight**：`git status --short` 干净、记录 `git log -1`；`git ls-remote --symref <backend-url> HEAD` 与 frontend 同样检查。
2. **拆历史**：分别执行 `git subtree split --prefix=backend -b _migrate/backend HEAD`、`git subtree split --prefix=frontend -b _migrate/frontend HEAD`。
3. **合并远端并推送**：对每个子模块 `git fetch <url> main:refs/remotes/_migrate/<name>-main`，切到临时分支，`git merge --allow-unrelated-histories`，按 D2 解决冲突，`git push <url> _migrate/<name>:main`，再用 `git ls-remote` 复核。
4. **替换目录**：`Move-Item backend .scaffold-tmp\submodule-migration\backend`（frontend 同理）→ `git rm -r --cached backend frontend` → `git submodule add <backend-url> backend`、`git submodule add <frontend-url> frontend`。
5. **改造工作区文件**：写 `00-submodule-check.ps1`，重写 `scaffold/rename.mjs` 与 `05-scaffold-check.ps1`，更新 `AGENTS.md`、`README.md`；不修改 backend/frontend 内容。
6. **验收**：`powershell -File harness\run-all.ps1` 期望 6 道闸门全绿；另在临时副本中删掉一个子模块目录，验证 00 闸门返回 1。
7. **交付边界**：父仓库改动由用户审阅后提交；子模块仓库的远端历史已由第 3 步产生。备份目录在用户确认后清理。

**回滚**：第 3 步失败 → 删除 `_migrate/*` 分支与临时 refs，本地目录未动；第 4 步失败 → `git submodule deinit`/移除暂存项，从 `.scaffold-tmp` 恢复目录；第 6 步失败 → 保留备份并按闸门输出修复，不清理。
