# Tasks

## 1. 回滚基线

- [ ] 1.1 确认工作区干净并以当前 HEAD 为回滚基线（验证：`git status` 无改动输出，`git log -1` 记录基线 hash）

## 2. 目录迁移

- [ ] 2.1 创建 `backend/` 目录，将根 `pom.xml` 移动为 `backend/pom.xml`，将根 `src/` 整体移动为 `backend/src/`（验证：`backend/pom.xml` 与 `backend/src/main`、`backend/src/test` 存在，仓库根不再有 `pom.xml` 与 `src/`）
- [ ] 2.2 删除仓库根的过期构建产物 `target/`（验证：根 `target/` 不存在）

## 3. Harness 路径修正

- [ ] 3.1 修改 `harness/checks/01-compile.ps1`：在 `$projectRoot` 后追加 `Set-Location (Join-Path $projectRoot 'backend')`（验证：`powershell -File harness\checks\01-compile.ps1` 退出码 0）
- [ ] 3.2 修改 `harness/checks/02-test.ps1`：同样将 Maven 工作目录切到 `backend/`（验证：`powershell -File harness\checks\02-test.ps1` 退出码 0，输出 Tests run: 6, Failures: 0）
- [ ] 3.3 修改 `harness/checks/03-static-guard.ps1`：`$srcDir` 改为 `Join-Path $projectRoot 'backend\src'`，红线逻辑不变（验证：`powershell -File harness\checks\03-static-guard.ps1` 退出码 0，扫描 6 个文件）

## 4. 文档同步

- [ ] 4.1 更新 `AGENTS.md`：§6 目录地图中 `src/` 改为 `backend/src/`，§7 命令速查的启动命令改为 `mvn -f backend/pom.xml spring-boot:run`（验证：`Select-String` 检查 AGENTS.md 不再出现「根 pom」类旧描述，命令可原样执行）
- [ ] 4.2 更新 `README.md`：目录段将 `src/` 描述改为 `backend/`，快速开始第 2 步命令改为 `mvn -f backend/pom.xml spring-boot:run`（验证：按 README 快速开始命令逐条执行均成功）

## 5. 集成验收

- [ ] 5.1 运行 `powershell -File harness\run-all.ps1`，确认三道闸门全部 PASS、退出码 0（验证：输出 `RESULT: ALL CHECKS PASSED` 且 `$LASTEXITCODE` 为 0）
- [ ] 5.2 运行 `mvn -f backend/pom.xml spring-boot:run` 启动服务，访问 `http://localhost:8080/api/todos` 返回 JSON 数组（验证：HTTP 200，响应为 Todo 列表 JSON）

## Workflow follow-up

- 验收通过后按项目流程归档本 change：`/opsx:archive`
- 迁移验证全绿后提交第二个 commit，与 1.1 基线形成「迁移前 → 迁移后」两个审计点（提交时机由人决定，AI 不主动提交）
- 归档后 `openspec/specs/` 无新增（本 change 声明 skip_specs），`openspec/changes/archive/` 出现本 change
