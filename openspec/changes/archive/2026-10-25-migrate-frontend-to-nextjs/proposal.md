# Proposal

## Why

后端保留 Spring Boot 以承接企业级领域复杂度与既有 Java 资产，但前端继续使用 Vue 3 与团队「全员熟悉 React」的技能结构不匹配：组件写法、测试工具与生态资料都要额外转换，AI 生成的 React 代码也无法直接复用。项目预期运营 3–5 年，前端需要一套与团队技能、AI 语料密度和长期维护节奏都对齐的框架，因此把前端替换为 Next.js，后端与 API 契约保持不变。

## What Changes

- 将 `frontend/` 从 Vue 3 + Vite + TypeScript 替换为 **Next.js 16 App Router + React 19 + TypeScript**，保留现有 Todo 功能对等：列表、新增、完成。
- Next.js 仅承担 UI 与同源转发，不承载领域逻辑；后端仍为唯一的 Todo API 提供方，接口路径与响应结构不变。
- 前端测试从 Vue Test Utils 切换为 **Vitest + React Testing Library + jsdom**，覆盖与原有三条组件测试等价的行为。
- 新增 `app/api/[...path]/route.ts` 同源代理：浏览器对 `/api/*` 的请求由 Next.js 运行期转发至 `BACKEND_URL`（默认 `http://localhost:8989`），开发与生产共用同一实现；修改后端地址只需重启前端进程，不必重新构建或更换镜像。反向代理降级为可选部署前置，后端不改 CORS。
- 新增多阶段 `Dockerfile` 与 `.dockerignore`，使用 Next.js `output: 'standalone'` 产出可独立运行的容器镜像，`BACKEND_URL` 以运行期环境变量注入（`docker run -e` 可覆盖）；Vercel 作为可选部署通道，不作为唯一路径。
- **BREAKING**：删除 `frontend/` 下的 Vue 入口、SFC、Vite 配置与 Vue 测试；`package.json` 脚本与依赖整体替换，`package-lock.json` 重新生成，前端产物目录由 `dist/` 变为 `.next/`。
- 更新 Harness：
  - `04-frontend.ps1` 保持「依赖安装 → 生产构建 → 测试」三步，构建命令改为 Next.js，失败语义不变。
  - `03-static-guard.ps1` 把同一组红线扩展到前端 `*.ts` / `*.tsx`：禁止 `TODO/FIXME/XXX` 占位、禁止 `it.skip` / `describe.skip` / `xit` / `xdescribe` 等跳过测试写法；`System.out` 规则仍只针对 Java。
- 退役 `frontend-template` 能力（其 Purpose 与构建产物要求均绑定 Vue 3），新能力 `frontend-nextjs` 承接 Next.js 前端的完整行为约定。
- 同步父仓库文档（`AGENTS.md`、`README.md`）、子模块 `frontend/README.md`，以及 `docs/specs/todo-module-spec.md` 中失效的 `App.vue` / `api.ts` 路径引用。
- 前端改动全部发生在 `frontend` 子模块内；提交并推送子模块后，父仓库更新 gitlink，后端子模块与 `.gitmodules` 不变。

## Capabilities

### New Capabilities

- `frontend-nextjs`: Next.js App Router 前端的独立构建、Todo 界面行为、运行期可切换的同源 API 代理、自动化测试、Harness 验收闸门与前端静态红线。

### Modified Capabilities

- `frontend-template`: 退役 Vue 3 前端能力，移除其全部 5 条 requirement；由 `frontend-nextjs` 承接并扩展前端行为约定。

## Impact

- **代码**：`frontend/` 子模块整体重构（`app/`、`components/`、`lib/`、`app/api/[...path]/route.ts` 及其测试、配置、Dockerfile）；`harness/checks/03-static-guard.ps1`、`harness/checks/04-frontend.ps1`；父仓库文档与 `docs/specs/todo-module-spec.md` 路径引用。
- **依赖**：前端新增 `next@16.4.3`、`react@19.3.1`、`react-dom@19.3.1`、`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`、`@vitejs/plugin-react`；移除 `vue`、`vue-tsc`、`@vue/*`、`@vitejs/plugin-vue`。
- **API**：无变化。`GET /api/todos`、`POST /api/todos`、`POST /api/todos/{id}/complete` 的路径、请求体与响应结构保持原样。
- **部署**：前端从静态产物改为 Node 运行时（Next.js standalone）；后端地址为运行期配置，切换后端不需重建产物；Docker 为默认交付形态，Vercel 为可选。
- **子模块**：`frontend` 仓库产生新提交并推送后，父仓库更新 gitlink；`backend` 与 `.gitmodules` 不动。
- **不在范围**：后端代码与接口、认证授权、数据库、UI 设计体系、ESLint 接入、性能优化、Vercel 专属功能。
