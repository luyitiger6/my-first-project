# Design

## Context

当前 `frontend/` 是 Vue 3 + Vite + TypeScript 单体页面：`src/main.ts` 挂载 `App.vue`，`src/api.ts` 以 `/api/todos` 为基址封装三个调用，`vite.config.ts` 同时承担开发代理与 Vitest 的 jsdom 环境，测试用 Vue Test Utils。Harness 侧 `04-frontend.ps1` 是 `npm ci → npm run build → npm run test` 三步，`03-static-guard.ps1` 只扫 `backend/src/**/*.java`。

约束来自三层：前端是独立 git 子模块（父仓库只持有 gitlink）；后端固定 Spring Boot 且端口 8989，接口路径不变；完成判定只看 `harness\run-all.ps1` 退出码。动机见 `proposal.md - Why`，行为契约见 `specs/frontend-nextjs/spec.md`。

## Goals / Non-Goals

**Goals:**

- 用 Next.js App Router 重建 Todo 界面，行为与现有 Vue 版对等，且不把领域逻辑搬进前端。
- 让 `npm ci → npm run build → npm run test` 三条命令在新框架下语义不变，04 闸门结构零改动。
- 生产交付形态同时支持容器（standalone）与平台托管，浏览器侧始终同源访问 `/api`，后端地址运行期可切换、不需重建产物。
- 把「跳过测试」「占位标记」两类伪造绿灯从 Java 扩展到前端源码。

**Non-Goals:**

- 不引入 Server Actions、Route Handler 代理层、SSR 数据预取或缓存策略；Todo 数据仍在客户端拉取。
- 不改后端接口、不加 CORS 配置、不动 `backend` 子模块与 `.gitmodules`。
- 不接入 ESLint、Prettier、UI 组件库、状态管理库、认证与数据库。
- 不在 Harness 内执行 `docker build`（见 Risks）。

## Decisions

### D1：App Router + 单一客户端组件，数据拉取留在浏览器

`app/page.tsx` 作为服务端组件只做布局与元信息，`components/TodoApp.tsx` 标记 `'use client'`，用 `useEffect` + `useState` 复刻现有 `onMounted(refresh)` 的加载、新增、完成与错误提示行为。

- 理由：现有行为是「页面加载后请求后端」，改为服务端预取会引入缓存与失效语义，也让测试必须模拟服务端上下文。保持客户端拉取可让 RTL 测试与 Vue 版三条用例一一对应。
- 备选：Server Component 直接 `fetch` 后端。被否——需要处理 `revalidate`、请求去重与错误边界，收益仅是首屏数据，却把后端可用性绑进前端构建/渲染路径。
- 备选：Server Actions 承担新增与完成。被否——会把写操作语义搬进 Next 运行时，与「Next 只做 UI 与转发」的边界冲突。

### D2：同源转发用 Route Handler 代理，后端地址运行期生效

`app/api/[...path]/route.ts` 作为 catch-all Route Handler 承接 `/api/*`：每个请求读取 `process.env.BACKEND_URL`（缺省 `http://localhost:8989`），把路径分段逐个 `encodeURIComponent` 后拼到 `<BACKEND_URL>/api/` 之后，携带查询串与原始 method、请求体、`content-type` 转发，`cache: 'no-store'`，再以 `upstream.body` 流式回传状态码与 `content-type`；网络层失败映射为 502。

- 理由：换后端只需改环境变量并重启进程，不必重建产物或替换镜像；开发与生产共用同一段转发代码，「开发能通、生产不通」的差异消失；后端仍不开 CORS。
- 实现约束：固定 `runtime = 'nodejs'` 与 `dynamic = 'force-dynamic'`；Next 16 的 `params` 是 Promise，必须 await；只允许拼到配置的 origin，路径逐段编码，无法穿出到其他主机。
- 备选：`next.config.ts` 的 `rewrites`。被否——配置在构建期求值，后端地址会被固化进产物，切换后端必须重建，与本决策直接冲突。
- 备选：只靠部署侧反向代理。被否——本期无法在前端仓库内自证转发行为，且把配置责任外部化；反向代理保留为可选前置（多实例、统一入口场景）。
- 备选：后端开 CORS 直连。被否——与「后端不变」冲突，且把跨域策略变成长期运维负担。
- 代价：前端进程多承担一跳转发，后端不可达时表现为 502 而非网络错误；代理本身要用测试锁住透传与失败映射。

### D3：测试用 Vitest + React Testing Library，不用 next/jest

`vitest.config.ts` 使用 `@vitejs/plugin-react`（automatic JSX runtime）+ `environment: 'jsdom'` + `setupFiles` 引入 `@testing-library/jest-dom/vitest`；测试文件与被测组件同目录（`components/TodoApp.test.tsx`），`vi.mock('../lib/api')` 隔离网络。代理测试文件顶部用 `// @vitest-environment node` 覆盖默认 jsdom：默认环境缺 Web `Request`/`Response`，且代理断言不需要 DOM。

- 理由：仓库已有 Vitest 5 与 jsdom 29，`npm run test` 语义不变；`@vitejs/plugin-react` 提供 React 19 的 JSX 转换，无需 Babel 链。
- 备选：`next/jest` + Jest。被否——多一套 transform 与配置、启动更慢，且会把 Next 的 SWC mock 机制带进本不需要它的组件测试。
- 备选：Playwright 端到端。被否——需要同时拉起前后端，破坏「测试不依赖后端进程」，属于后续独立闸门。

### D4：`npm run build` 就是 `next build`，类型检查随构建执行

Next 16 的 `next build` 默认执行 TypeScript 类型检查，因此不再需要 `vue-tsc -b` 这类独立类型检查步骤，04 闸门的 build 步骤仍是一次命令。

- 理由：保持三步闸门与「构建即含类型检查」的双重语义，避免闸门里出现第四条命令。
- 备选：`tsc --noEmit && next build`。被否——重复检查，且 `next build` 已在类型错误时非 0 退出。
- 备选：`next build --no-lint`。不需要：Next 16 构建不再内置 ESLint，本变更也未接入 ESLint。

### D5：静态红线按语言分流，扫描范围排除产物目录

`03-static-guard.ps1` 在现有 Java 扫描之外增加前端扫描：收集 `frontend/**/*.ts`、`frontend/**/*.tsx`，排除 `node_modules`、`.next`、`dist`；对前端只应用「占位标记」与「跳过测试」两类规则（`TODO|FIXME|XXX`、`it.skip`/`describe.skip`/`test.skip`/`xit`/`xdescribe`），`System.out` 与 `@Disabled` 规则仍只作用于 Java。

- 理由：`@Disabled` 与 `System.out` 在前端没有对应物，硬套会误伤；`.next` 是生成目录，扫它会把框架产物误判为违规。
- 备选：新增独立的 `06-frontend-guard.ps1`。被否——同一类「伪造绿灯」拆到两个闸门，会让「红线在哪查」变成两份真相。

### D6：容器交付用多阶段 Dockerfile + standalone，但不进 Harness

`next.config.ts` 设置 `output: 'standalone'`；`Dockerfile` 分 `deps`（`npm ci`）→ `builder`（`next build`）→ `runner`（`node server.js`，非 root 用户，复制 `.next/standalone`、`.next/static`、`public`），以 `ENV BACKEND_URL` 提供运行期默认值，可被 `docker run -e` 覆盖；`.dockerignore` 排除 `node_modules`、`.next`、`.git`。

- 理由：standalone 产物自带最小 `node_modules` 与 `server.js`，镜像小且不依赖宿主机 npm。
- 备选：`next start` + 全量 `node_modules`。被否——镜像体积与启动依赖都不必要地大。
- 备选：`output: 'export'` 静态导出。被否——静态产物无法承载 Route Handler 代理，也没有 standalone 服务入口，与 spec 的代理要求直接冲突。

### D7：能力交接用「退役 + 新建」，不动既有主 spec 的 Purpose

`openspec/specs/frontend-template/spec.md` 的 Purpose 绑定 Vue 3，OpenSpec 归档同步不会改写既有主 spec 的 Purpose，因此本变更对该能力的 5 条 requirement 全部 REMOVED（每条带 Reason/Migration），新能力 `frontend-nextjs` 自带 Purpose 承接；`.openspec.yaml` 已设 `retire_capabilities: true`，允许归档时删除清空后的主 spec。

- 理由：把 Vue 描述改成 Next.js 会让能力身份与历史审计记录失真；退役 + 新建保留「何时、为何换掉 Vue」的可追溯性。
- 备选：MODIFIED 全部 5 条 requirement。被否——主 spec 的 Purpose 仍是「Vue 3 工程」，归档后会出现标题与内容自相矛盾。

### D8：子模块先行，父仓库收口

改动分两处落地：`frontend/` 子模块内完成代码、测试、配置、Dockerfile；父仓库内改 `harness/checks/03-static-guard.ps1`、`04-frontend.ps1` 的注释口径与文档。顺序是先跑通子模块内的 `npm ci/build/test`，再在父仓库跑 `harness\run-all.ps1`，全绿后提交并推送子模块，父仓库更新 gitlink 后再跑一次总闸门。

- 理由：父仓库的 04 闸门直接在工作树里执行 `frontend/` 的命令，子模块未提交时也能验证；但 gitlink 指向必须落在已推送的提交上，否则父仓库 clone 会拿到悬空引用。
- 备选：先改父仓库文档再改子模块。被否——文档会短暂描述不存在的目录结构，且闸门在中间态必然失败。

## Risks / Trade-offs

- **代理层成为链路单点** → 后端不可达时前端返回 502，而非浏览器网络错误。缓解：界面沿用错误提示，502 语义写入 README，失败映射由单测覆盖。
- **多一跳转发增加延迟与前端进程压力** → 高并发下 Node 服务承压。缓解：只透传必要头、流式回传不缓冲整包；若成为瓶颈，再把转发下沉到边缘反向代理（D2 备选路径）。
- **路径拼接不当可被用于跨主机访问** → 代理变 SSRF 跳板。缓解：只允许拼到配置的 origin，路径逐段 `encodeURIComponent`，不接收客户端传入的绝对 URL。
- **Route Handler 只能跑 Node runtime** → 无法静态导出或用 Edge 运行时。缓解：`output: 'export'` 本就不在方案内，部署形态确定为 Node 服务。
- **本地/CI Node 版本不足**（Next 16 要求 `>=20.9.0`）→ `npm run build` 直接失败。缓解：`package.json` 声明 `engines`，README 前置环境写明，04 闸门会以非 0 退出暴露。
- **TypeScript 6.0 与 Next 16 类型定义可能不兼容** → `next build` 类型检查报错。缓解：先按现有 `~6.0.3` 试跑；若冲突则在实现阶段降到 Next 支持的 5.x 并在 `tasks.md` 记录，不改闸门结构。
- **容器镜像未经 Harness 验证** → Dockerfile 可能随代码演进而失效而无人拦截。缓解：04 覆盖 standalone 产物与服务入口；镜像构建放在发布流水线，若后续频繁变更再评估新增 `06-container` 闸门（需 Docker 可用，属 AGENTS.md §9 的外部依赖边界）。
- **RTL + jsdom 与浏览器行为有差异** → 表单提交、异步状态更新在测试里需 `user-event` + `findBy*`，写不好会得到假绿。缓解：三条用例断言与 Vue 版逐条对齐，静态红线禁止 `.skip`。
- **删除 Vue 文件属破坏性变更** → 旧分支若仍在开发会冲突。缓解：`proposal.md` 已标 BREAKING；回滚以 gitlink 指回 `1286f5a` 为准，前端仓库历史不重写。
- **静态红线误报** → 生成目录或依赖中的 `TODO` 造成假红。缓解：扫描范围显式排除 `node_modules`、`.next`、`dist`，并在实现后跑一次空跑确认扫描文件数合理。

## Migration Plan

1. 在 `frontend/` 子模块内建立 Next.js 骨架（`app/`、`components/`、`lib/`、`app/api/[...path]/route.ts`、配置、测试、Dockerfile），删除 Vue 入口、SFC、`vite.config.ts`、Vue tsconfig 与 Vue 测试，重生成 `package-lock.json`。
2. 子模块内跑 `npm ci`、`npm run build`、`npm run test`，三条均 0。
3. 父仓库改 `03-static-guard.ps1`（前端 TS/TSX 规则 + 排除目录）与 `04-frontend.ps1` 注释，更新 `AGENTS.md`、`README.md`、`docs/specs/todo-module-spec.md` 的框架与路径描述。
4. 父仓库跑 `harness\run-all.ps1`，退出码 0。
5. 提交并推送 `frontend` 子模块 → 父仓库 `git add frontend` 更新 gitlink，连同 harness 与文档一起提交 → 再跑一次总闸门确认。
6. 回滚策略：父仓库把 gitlink 指回替换前的 `frontend` 提交（`1286f5a`），同时 `git checkout` 还原 harness 与文档改动；前端仓库保留 Next.js 提交历史，便于二次尝试。

