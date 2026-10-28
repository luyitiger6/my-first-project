# Proposal

## Why

Todo 是脚手架自带的演示模块，用来证明「编译 → 测试 → 闸门」这条链路能跑通。这条链路已经由认证模块的真实代码接过，演示使命结束。

三条现实理由：

1. 工作区的真实目标是 AI 会话应用与 wanderchain，Todo 不在任何产品规划里。它现在的唯一作用是每次读后端代码时多绕一次路。
2. 认证模块上线后，`/api/todos` 会成为唯一不需要鉴权的业务端点。留着它，就得为它单独解释「为什么不鉴权」，而这个解释本身就是维护成本。
3. 它挂着一份 651 行、43 条场景的目标规格文档，实现覆盖率只有 16.3%。这是一份不会有人补齐的负债——留着比删掉更有害，因为它看起来像「待办」。

## What Changes

- 删除后端 Todo 三件套：`domain/Todo.java`、`domain/TodoService.java`、`web/TodoController.java`，以及 `TodoServiceTest`。
- `ApplicationContextTest` 不再断言 `todoController` / `todoService`，改为只断言应用上下文可装配。
- 删除 `docs/specs/todo-module-spec.md`（651 行目标契约，其定义的功能不在路线图上）。
- 更新 `docs/spec-coverage-audit.md`：移除 todo 相关统计与章节，重算汇总与覆盖率。
- 更新 `AGENTS.md`：§1 的业务描述、§6 的 backend 目录树、§7 的启动命令。
- 修正 `openspec/changes/add-wanderchain-auth` 中已失效的验收条件（tasks 1.4 的「既有 Todo 接口不受影响」），历史背景陈述保留。

## Capabilities

### New Capabilities

<!-- 本变更不新增能力。 -->

### Modified Capabilities

<!--
主 spec 中没有 todo 能力：Todo 从未被 OpenSpec 纳管，只存在于 docs/ 的单元规格文档里。
因此本变更不产生 delta spec，也不需要 REMOVED 条目。
-->

## Impact

- **代码**：`backend/` 减少三个生产类与一个测试类；`frontend/` 无改动——全局搜索 Todo 命中 0 条，wanderchain 首页早已不消费它。
- **API**：`/api/todos` 三个端点消失。前端同源代理 `frontend/app/api/[...path]/route.ts` 是通用透传，无需改动。
- **文档**：`docs/specs/todo-module-spec.md` 删除；`docs/spec-coverage-audit.md` 与 `AGENTS.md` 需同步。
- **闸门**：`02-test` 的测试条数减少；`03-static-guard` 检查的是 `TODO` / `FIXME` 占位符，与业务 Todo 无关，不受影响，也不得因此放宽。
- **非目标**：不删除 `docs/specs/wanderchain/*` 中「无 `TODO` / `FIXME`」这类占位符检查项；不改动认证模块的任何行为。
