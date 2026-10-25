---
kind: configuration_system
name: 多模块配置系统：Spring Boot YAML + Next.js 环境变量 + OpenSpec 配置 + Harness 编排开关
category: configuration_system
scope:
    - '**'
source_files:
    - backend/src/main/resources/application.yml
    - frontend/app/api/[...path]/route.ts
    - frontend/app/api/[...path]/route.test.ts
    - frontend/lib/api.ts
    - frontend/next.config.ts
    - frontend/package.json
    - openspec/config.yaml
    - harness/run-all.ps1
---

## 概览

本仓库是一个由多个独立子项目组成的顶层工作区，每个子项目自带其运行时配置入口，没有跨项目的统一配置中心。配置按子项目边界划分：

- **后端 (backend)**：Spring Boot 3.5，使用 `application.yml` 单文件配置。
- **前端 (frontend)**：Next.js App Router，通过 `process.env.BACKEND_URL` 在 API Route 层决定后端地址，浏览器侧走 `/api/todos` 同源代理。
- **OpenSpec**：`openspec/config.yaml` 驱动规范生成与操作行为。
- **Harness**：PowerShell 脚本通过退出码控制闸门顺序，本身是“可执行配置”（checks 文件名排序即执行顺序）。

## 关键文件

- `backend/src/main/resources/application.yml` — Spring Boot 唯一应用配置
- `frontend/app/api/[...path]/route.ts` — 读取 `BACKEND_URL` 并清理尾部斜杠
- `frontend/app/api/[...path]/route.test.ts` — 通过 `delete process.env.BACKEND_URL` / 赋值切换后端地址
- `frontend/lib/api.ts` — 浏览器端固定走 `/api/todos`，不感知后端 URL
- `frontend/next.config.ts` — `output: 'standalone'` 容器化产物配置
- `frontend/package.json` — Node `engines.node >= 20.9.0`、scripts 定义
- `openspec/config.yaml` — OpenSpec schema/context 配置
- `harness/run-all.ps1` + `harness/checks/*.ps1` — 闸门执行顺序与失败策略

## 架构与约定

### 后端 (Spring Boot)

`application.yml` 仅声明三件事：`server.port=8989`、`spring.application.name=my-first-project`、根日志级别 `INFO`。注释明确说明“不引入任何外部中间件，保证 mvn test / 启动开箱即用”，并通过 Harness 约定“测试与构建阶段禁止依赖外部服务”。这意味着所有环境差异（数据库、Redis、消息队列等）应通过 Spring Profile 或外部覆盖的 `application-{profile}.yml` 注入，默认 profile 保持零外部依赖。

### 前端 (Next.js)

- 浏览器侧 `lib/api.ts` 硬编码 `BASE_URL = '/api/todos'`，利用 Next.js 内置代理到后端。
- API Route (`app/api/[...path]/route.ts`) 用 `process.env.BACKEND_URL ?? DEFAULT_BACKEND_URL` 解析实际后端地址，并在返回前 `.replace(/\/+$/, '')` 去除尾部斜杠。
- 测试通过直接操作 `process.env.BACKEND_URL` 切换不同后端地址（如 `http://backend-a:9000`），无需 mock fetch。
- `next.config.ts` 设置 `output: 'standalone'`，使构建产物自带 `server.js` 和最小依赖集，适配容器运行。
- Node 版本约束在 `package.json.engines.node` 中要求 `>=20.9.0`。

### OpenSpec

`openspec/config.yaml` 采用 `schema: spec-driven`，并通过 `context` 块强制所有工件使用中文书写，同时保留英文的结构标题和 SHALL/MUST 关键字。该文件是 OpenSpec CLI 的行为配置，不是运行时配置。

### Harness 编排

`harness/run-all.ps1` 以 `Get-ChildItem ... -Filter '*.ps1' | Sort-Object Name` 的顺序动态加载 `checks/` 下的检查脚本，因此**文件名前缀数字即执行顺序**（00 → 05）。每个 check 在独立 PowerShell 进程中执行，通过 `$LASTEXITCODE` 收集结果；任一非零且未开启 `-ContinueOnError` 时立即中断。最终汇总 PASS/FAIL 表格并以 exit 1/0 表达整体状态——这是 CI 和人类审阅的唯一判定依据。

## 约定与约束

- **后端默认无外部依赖**：`application.yml` 注释写明“不引入任何外部中间件，保证 mvn test / 启动开箱即用”，Harness 的 02-test 与 01-compile 也据此假定后端可纯内存运行。
- **前端后端地址通过环境变量注入**：API Route 层读取 `BACKEND_URL`，浏览器侧不暴露该变量（`lib/api.ts` 使用相对路径 `/api/todos`）。
- **测试通过修改 `process.env.BACKEND_URL` 切换后端**：见 `route.test.ts` 中对 `delete process.env.BACKEND_URL` 与赋值的用法，表明该变量是可选的（有 `DEFAULT_BACKEND_URL` 兜底）。
- **Harness 检查顺序由文件名排序决定**：`run-all.ps1` 对 `checks/*.ps1` 按名称排序后依次执行，新增检查需遵循 `NN-*.ps1` 命名约定以插入正确位置。
- **Harness 任一失败即阻断**：脚本文档注释称“这套脚本存在的唯一目的是「拥有否决权」……人类审阅与 CI 都只认退出码，不看日志措辞”，且 `ExitCode -ne 0` 时 `exit 1`。
- **Node 版本下限为 20.9.0**：由 `frontend/package.json` 的 `engines.node` 字段声明。
- **OpenSpec 工件语言为中文**：由 `openspec/config.yaml` 的 `context` 块强制，“All artifacts must be written in chinese”。