---
kind: error_handling
name: 跨端错误处理：Spring 异常冒泡 + Next.js try/catch + 代理层兜底
category: error_handling
scope:
    - '**'
source_files:
    - backend/src/main/java/com/luyi/myfirst/domain/TodoService.java
    - backend/src/main/java/com/luyi/myfirst/web/TodoController.java
    - frontend/lib/api.ts
    - frontend/components/TodoApp.tsx
    - frontend/app/api/[...path]/route.ts
---

## 1. 总体方案

仓库包含两个独立应用（Spring Boot 后端、Next.js 前端），没有统一的错误框架或全局异常处理器。错误处理是**分散式**的：
- 后端：领域层抛出 `IllegalArgumentException`，由 Spring MVC 默认异常处理器转为 HTTP 500；控制器不捕获异常。
- 前端：`lib/api.ts` 在 fetch 非 ok 时抛 `Error`，组件用 `try/catch` 捕获并写入 `error` state，通过 `<p className="error" role="alert">` 展示。
- 代理层：`app/api/[...path]/route.ts` 对上游 fetch 做 `try/catch`，将网络不可达统一返回 `{ error: '后端服务不可达' }` (HTTP 502)。

不存在自定义错误类型、错误码枚举、`@ExceptionHandler`、`GlobalException`、`ResponseEntity.error`、`Result.fail` 等集中式结构。

## 2. 关键文件

- `backend/src/main/java/com/luyi/myfirst/domain/TodoService.java` — 业务校验与参数非法的直接抛出点。
- `backend/src/main/java/com/luyi/myfirst/web/TodoController.java` — REST 控制器，无异常处理逻辑，依赖 Spring 默认行为。
- `frontend/lib/api.ts` — 唯一 HTTP 客户端封装，统一把非 2xx 响应包装为 `Error`。
- `frontend/components/TodoApp.tsx` — UI 层 try/catch 收集错误并渲染。
- `frontend/app/api/[...path]/route.ts` — Next.js API Route 代理，兜底上游网络异常。

## 3. 架构与约定

### 后端（Spring Boot）
- 领域方法对入参做防御性检查：`TodoService.create` 对空 title 抛 `IllegalArgumentException("title must not be blank")`；`complete` 对缺失 id 抛 `IllegalArgumentException("todo not found: " + id)`。
- 控制器不做 try/catch，也不定义 `@ExceptionHandler`，异常直接冒泡到 Spring DispatcherServlet，最终由 Spring Boot 默认的 `BasicErrorController` 生成 HTML 错误页（HTTP 500）。
- 未使用 `@Valid` / Bean Validation，也未引入自定义异常类。

### 前端（Next.js App Router）
- `lib/api.ts` 的 `request<T>` 函数是唯一的 fetch 入口：`if (!response.ok) throw new Error(\`请求失败：HTTP ${response.status}\`)`，调用方无需再判断 status。
- `TodoApp.tsx` 提供本地 `showError(e: unknown, fallback: string)`，先尝试取 `e.message`，否则回退到中文提示字符串（如 `'加载待办失败'`、`'新增待办失败'`、`'完成待办失败'`）。
- 每个异步操作（refresh/addTodo/finishTodo）都遵循相同的 try/catch/finally 模式：catch 中 `setError`，finally 中 `setLoading(false)`。
- 错误通过带 `role="alert"` 的 `<p className="error">` 暴露给辅助技术。

### 代理层
- `route.ts` 的 `proxy` 函数对 `fetch(target, ...)` 包裹 try/catch，捕获所有网络级异常（DNS 解析失败、连接拒绝等），返回固定 JSON：`{ error: '后端服务不可达' }`，状态码 502。
- 正常路径下原样透传 upstream 的 status 和 body，不做二次包装。

## 4. 约定与约束

- **领域层只抛运行时异常**：`TodoService` 使用 `IllegalArgumentException` 表达参数非法，不定义业务异常类型。这是当前代码的实际做法，而非文档化规范。
- **控制器不吞异常**：`TodoController` 中没有任何 try/catch 或 `@ExceptionHandler`，异常一律上抛给 Spring。
- **前端 HTTP 错误统一包装**：所有对后端的调用必须经过 `lib/api.ts` 的 `request`，禁止在组件内直接使用 `fetch`，从而保证错误形态一致（均为 `Error`）。
- **UI 层 catch 后降级为中文消息**：组件 catch 块总是传入一个中文 fallback 字符串给 `showError`，作为 `e instanceof Error` 判断失败时的后备文案。
- **代理层兜底上游连通性**：只有“后端服务不可达”这一种网络异常被显式处理并映射为 502；其他上游响应（含 4xx/5xx）原样透传。
- **Harness 闸门以退出码判定错误**：`harness/run-all.ps1` 顺序执行 `checks/00-*` 至 `05-*` PowerShell 脚本，任一脚本非零退出即阻断流水线（见 harness 目录下的脚本命名与编排方式）。

## 5. 观察到的缺口

- 后端缺少全局异常处理器，客户端无法获得结构化错误体（JSON），只能得到 Spring Boot 默认 HTML 错误页。
- 没有统一的错误码体系或 `ApiResponse` 包装类型，前后端错误语义靠硬编码字符串传递。
- 前端 `api.ts` 仅区分 `response.ok`，不区分 4xx/5xx，上层无法据此给出差异化提示。
- 测试文件中存在 `mockRejectedValue(new TypeError('fetch failed'))` 与 `new Error('请求失败：HTTP 500')` 等构造，说明测试侧也沿用同样的错误形态假设。