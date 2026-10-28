# Tasks

## 1. 删除后端模块

- [x] 1.1 删除 `backend/src/main/java/com/luyi/myfirst/domain/Todo.java`、`domain/TodoService.java`、`web/TodoController.java` 与 `src/test/java/com/luyi/myfirst/domain/TodoServiceTest.java`
- [x] 1.2 改写 `ApplicationContextTest`：不再断言 `todoController` / `todoService`，改为断言 `AuthProperties` / `GlobalExceptionHandler` / `DataSource`。同一项里补了 `02-test.ps1` 的凭据注入：此前闸门只在手工 export 过变量的 shell 里能绿，干净环境必红，而 `mvn test` 按 AGENTS.md §9 本就该直连真实库；`mvn test` 13 例全绿
- [x] 1.3 启动后端，确认 `GET /api/todos` 返回 404、服务在 8989 正常监听（同时实测 `/api/auth/me`、`/api/auth/login` 均为 404，印证认证端点尚未实现）

## 2. 文档与契约同步

- [x] 2.1 删除 `docs/specs/todo-module-spec.md`
- [x] 2.2 更新 `docs/spec-coverage-audit.md`：审计范围去掉 todo、总览表删除该行并重算合计（193→150 / 91→89 / 34→29 / 68→32，严格覆盖率 47.2%→59.3%）、删除 `### todo-module-spec.md` 整节、清理归因表 / P4-26 / P5 整节 / 结语中的 todo 结论；顺带把已改名的 `06-flyway` 修正为 `06-schema-check`
- [x] 2.3 更新 `AGENTS.md`：§1 业务描述改为 wanderchain 认证子系统、§6 的 backend 目录树改为 `common/enums`、`common/exception`、`common/web`、`config`、`dao/auth` 的实际结构、§7 启动命令去掉 `/api/todos` 并注明需先设置环境变量；同步改写 `README.md` 的启动命令块
- [x] 2.4 核对 `openspec/changes/add-wanderchain-auth` 的 Todo 引用：`tasks.md` 1.4 中「既有 Todo 接口不受影响」已删除；`design.md` 作为历史背景的陈述保留

## 3. 验收

- [x] 3.1 `powershell -File harness\run-all.ps1` 退出码 0（10 道闸门全 PASS；02 后端 13 例、04 前端 289 例）
