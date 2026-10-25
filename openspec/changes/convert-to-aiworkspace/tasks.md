# Tasks

远程地址（2026-10-25 通过 `git ls-remote` 验证）：

- backend: `https://github.com/luyitiger6/ai-workspace-backend`（`main` @ `b665293`）
- frontend: `https://github.com/luyitiger6/ai-workspace-frontend`（`main` @ `888ab2d`）

## 1. 迁移前置与远程历史

- [x] 1.1 记录迁移基线：`git status --short` 仅包含本次 change 工件（无其他修改）、`git log -1 --oneline` 记录当前 HEAD（`06b8f2d`），并执行 `git ls-remote --symref <backend-url> HEAD`、`git ls-remote --symref <frontend-url> HEAD` 确认两个远程可达且 `main` 非空（验证：命令输出与记录一致，两个 URL 均返回 HEAD）
- [x] 1.2 用 `git subtree split --prefix=backend -b _migrate/backend HEAD` 与 `git subtree split --prefix=frontend -b _migrate/frontend HEAD` 拆出历史分支（验证：`git ls-tree -r --name-only _migrate/backend` 含 `pom.xml` 且不含 `frontend/` 路径；frontend 分支含 `package.json` 且不含 `backend/` 路径）
- [x] 1.3 对每个子模块执行 `git fetch <url> main:refs/remotes/_migrate/<name>-main`，在临时分支上 `git merge --allow-unrelated-histories`；frontend 的 `README.md` 冲突保留现有项目 README，backend 保留远端 `LICENSE` / `README.md` 并新建 `.gitignore`（至少忽略 `target/`）（验证：`git log -1 --pretty=%P` 显示两个父提交；frontend `git rev-parse HEAD:README.md` 等于迁移前 `git hash-object frontend/README.md`；backend `HEAD:.gitignore` 含 `target/`）
- [x] 1.4 在用户已授权写入远程的前提下，执行 `git push <url> _migrate/<name>:main`，并用 `git ls-remote <url> refs/heads/main` 复核远端 SHA 等于本地临时分支 HEAD（验证：两个远端 SHA 与本地一致；任一失败立即停止，不移动本地目录）

## 2. 子模块落地

- [x] 2.1 将 `backend/`、`frontend/` 移动到 `.scaffold-tmp/submodule-migration/` 备份，再执行 `git rm -r --cached backend frontend`（验证：`git ls-files backend frontend` 输出为空，备份目录中 `backend/pom.xml` 与 `frontend/package.json` 仍存在）
- [x] 2.2 执行 `git submodule add <backend-url> backend` 与 `git submodule add <frontend-url> frontend`（验证：`git ls-files --stage backend frontend` 两行均为 `160000`；子模块内 `git rev-parse HEAD` 等于 1.4 记录的远端 SHA；`backend/pom.xml` 与 `frontend/package.json` 存在）
- [x] 2.3 检查两个子模块工作树是否干净；若 `backend` 出现 `target/` 未跟踪项，在 backend 仓库内把 `target/` 补入 `.gitignore`、提交并推送，再回父仓库更新 gitlink（验证：`git -C backend status --porcelain` 与 `git -C frontend status --porcelain` 均为空；若发生 backend 提交，父仓库 `git submodule status` 显示新 SHA）
- [x] 2.4 验证子模块边界：`git -C backend log --oneline -3`、`git -C frontend log --oneline -3` 显示各自历史；`git ls-files backend frontend` 在父仓库中不再列出普通文件（验证：父仓库索引只有两个 gitlink，两个子模块日志均含迁移前提交）

## 3. 工作区护栏与工具

- [x] 3.1 新增 `harness/checks/00-submodule-check.ps1`：校验 `.gitmodules`、两个 gitlink、标记文件、子模块工作树与 HEAD；失败输出 `git submodule update --init --recursive` 修复提示，不联网、不交互（验证：正常仓库运行返回 0；在 `.scaffold-tmp` 副本中移除 `frontend/package.json` 后运行返回 1 且输出修复命令）
- [x] 3.2 重写 `scaffold/rename.mjs` 为工作区身份改名：`--name`（kebab-case）与 `--display`（非空、1..60 字符）必填，只改 `AGENTS.md`、`README.md`，拒绝 `--package`、同值改名与重复执行（验证：在临时副本中分别执行合法改名、缺参、非法 slug、`--package`、二次执行，预期退出码依次为 0、1、1、1、1；改名前后 `.gitmodules` 哈希一致）
- [x] 3.3 重写 `harness/checks/05-scaffold-check.ps1`：复制排除 `backend/`、`frontend/`、`openspec/`、`docs/`、`.idea/`、`.vscode/`、`.scaffold-tmp/` 与构建产物；扫描额外排除 `.gitmodules`；token 改为 `AIWorkSpace` / `ai-workspace`；演练前后比较 `.gitmodules` 哈希（验证：当前仓库运行 05 返回 0；在临时副本的工作区自有文件中注入 `AIWorkSpace` 后运行返回 1；URL 含 `ai-workspace` 的 `.gitmodules` 不被误判）
- [x] 3.4 更新 `harness/run-all.ps1` 头部说明，使闸门顺序覆盖子模块 → 编译 → 测试 → 静态红线 → 前端 → 改名（验证：文件说明与实际 `checks/` 目录排序一致，运行 `harness\run-all.ps1` 时 00 位于 01 之前）

## 4. 文档与工作区身份

- [x] 4.1 更新 `AGENTS.md`：补充子模块边界（职责、提交边界、clone/init、`git submodule set-url`）、目录地图标注 submodule、命令速查替换 `--package` 为新参数、已知边界补网络依赖与应用改名职责外移（验证：文档含 `git submodule update --init --recursive`、`--display`、backend/frontend 的 submodule 标注，且不再出现 `rename.mjs --name ... --package` 指令）
- [x] 4.2 更新 `README.md`：AIWorkSpace 定位、带 `--recurse-submodules` 的 clone、子模块初始化、三仓库目录与工作区改名命令（验证：README 中的 clone/初始化/改名命令按文档原样执行时参数合法，且与 `scaffold/rename.mjs` 的用法一致）
- [x] 4.3 执行工作区身份核查：`git grep -n "AIWorkSpace\|ai-workspace"` 只应命中 `AGENTS.md`、`README.md`、`openspec/`（历史工件）、`scaffold/`（工具自身）、`.gitmodules`（子模块 URL）与本次 change 工件（验证：`harness/`、`.agents/`、其余配置无命中；`git hash-object .gitmodules` 前后一致）

## 5. 集成验收与交付边界

- [x] 5.1 运行 `powershell -File harness\run-all.ps1`，期望退出码 0 且摘要包含 `00-submodule-check` 至 `05-scaffold-check` 全部 PASS（验证：退出码与摘要；任一失败按 `systematic-debugging` 处理，禁止跳过或注释断言）
- [x] 5.2 核查提交边界：`git status --short` 中 backend/frontend 不作为普通文件出现、`git submodule status` 无 `-` 前缀、`git diff --cached --stat` 不含子模块文件内容（验证：父仓库变更只含工作区文件、`.gitmodules` 与 gitlink；两个子模块工作树干净）
- [x] 5.3 记录迁移审计点：把两个子模块远端 SHA、父仓库基线 HEAD、`.scaffold-tmp/submodule-migration/` 备份路径写入本次交付说明（验证：三个 SHA 与 `git ls-remote`/`git submodule status` 输出一致，说明中无遗漏）

## Workflow follow-up

- 人工审阅本 change 的 proposal/specs/design/tasks 后再进入 apply（AGENTS.md 规定的唯一强制人工卡点）。
- apply 完成且 `harness\run-all.ps1` 全绿后，由用户审阅并提交父仓库改动；AI 不自动 commit。
- 用户确认后清理 `.scaffold-tmp/submodule-migration/` 备份。
- 归档本 change，确认 `openspec/specs/` 新增 `workspace-layout`、`workspace-scaffold` 且 `scaffold-rename` 已退役删除。
- 可选的仓库整理：在 GitHub 设置中把父仓库重命名为 `AIWorkSpace`（slug 建议 `ai-workspace`），随后执行 `git remote set-url origin <新地址>`；该操作不在代码改动内。
