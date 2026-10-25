# Tasks

## 1. 前端骨架与构建链替换

- [x] 1.1 删除 Vue 入口与配置（`src/`、`index.html`、`vite.config.ts`、`tsconfig.app.json`、`tsconfig.node.json` 及 Vue 测试），验证：`Get-ChildItem frontend -Recurse -Filter *.vue` 无结果，`npm ls vue` 报 empty
- [x] 1.2 重写 `package.json`：脚本为 `dev: next dev`、`build: next build`、`start: next start`、`test: vitest run`；依赖 `next@16.4.3`、`react@19.3.1`、`react-dom@19.3.1`，开发依赖 `vitest`、`jsdom`、`@vitejs/plugin-react`、`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`、`@types/react`、`@types/react-dom`、`typescript`；声明 `engines.node >= 20.9.0`；删除 `package-lock.json` 后 `npm install` 重新生成，验证：`npm ci` 退出码 0，`npm ls next react` 显示 16.4.x / 19.3.x
- [x] 1.3 建立 App Router 骨架：`app/layout.tsx`、`app/page.tsx`、`app/globals.css`、`next.config.ts`（`output: 'standalone'`）、`tsconfig.json`、`next-env.d.ts`，`.gitignore` 增加 `.next` 并保留 `node_modules`，验证：`npm run build` 退出码 0 且 `.next/standalone/server.js` 存在
- [x] 1.4 重写 `frontend/README.md`，写清 Node 版本要求、`npm ci` / `npm run dev` / `npm run build` / `npm run test` 命令与目录结构，验证：README 中每条命令按写法可执行并以退出码 0 结束

## 2. Todo 界面与 API 封装

- [x] 2.1 新建 `lib/api.ts`：`Todo` 类型与 `getTodos` / `createTodo` / `completeTodo`，基址 `/api/todos`，失败时抛出含状态码的错误，验证：`npm run build` 类型检查通过，且三个函数签名在测试中被 mock 后无类型报错
- [x] 2.2 新建 `components/TodoApp.tsx`（`'use client'`），复刻列表展示、新增、完成、加载中、错误提示与空态，完成按钮仅在未完成项出现，验证：组件在 `app/page.tsx` 中被渲染，`npm run build` 退出码 0
- [x] 2.3 配置测试链：`vitest.config.ts`（`@vitejs/plugin-react`、`environment: 'jsdom'`、`setupFiles: vitest.setup.ts`）、`vitest.setup.ts` 引入 `@testing-library/jest-dom/vitest`，验证：`npm run test` 在无测试文件时不报配置错误
- [x] 2.4 编写 `components/TodoApp.test.tsx`，用 `vi.mock('../lib/api')` 覆盖四条行为：列表渲染、提交新增、点击完成、请求失败展示错误且保留已有列表；断言方式与 Vue 版三条用例逐条对齐，验证：`npm run test` 退出码 0 且四条用例全部通过
- [x] 2.5 在 `app/page.tsx` 挂载 `TodoApp` 并设置页面标题与语言，验证：`npm run build && npm run start` 后访问 `http://localhost:3000/` 返回 200 且页面包含「待办事项」

## 3. 同源 API 代理（运行期可切换）

- [x] 3.1 新增 `app/api/[...path]/route.ts`：每请求读取 `process.env.BACKEND_URL`（默认 `http://localhost:8989`），await `params` 后将路径分段逐个编码拼到 `<BACKEND_URL>/api/` 之后，透传 method、请求体与 `content-type`，以 `cache: 'no-store'` 请求上游，流式回传状态码与 `content-type`，网络层失败返回 502；固定 `runtime = 'nodejs'` 与 `dynamic = 'force-dynamic'`，验证：`npm run build` 退出码 0 且构建输出包含 `/api/[...path]` 动态路由
- [x] 3.2 新增 `app/api/[...path]/route.test.ts`（顶部 `// @vitest-environment node`，mock 全局 `fetch`），覆盖：默认地址拼接、同一进程内改 `BACKEND_URL` 后新请求走新地址、POST 方法与请求体透传、上游非 2xx 状态码透传、`fetch` 以 `cache: 'no-store'` 调用、`fetch` 抛错返回 502，验证：`npm run test` 退出码 0 且代理用例全部通过
- [x] 3.3 冒烟验证同源代理：后端在 8989 运行时执行 `npm run dev`，请求 `http://localhost:3000/api/todos`，响应与直连同源；再把 `BACKEND_URL` 指向另一端口并重启 dev，验证：不重新构建即可切到新地址
- [x] 3.4 在 `frontend/README.md` 写清 `BACKEND_URL` 为运行期配置、修改后需重启进程、反向代理为可选前置、后端不改 CORS，验证：文档变量名与 `route.ts`、Dockerfile 一致且命令可照抄执行

## 4. 容器化交付

- [x] 4.1 新增多阶段 `frontend/Dockerfile`（deps → builder → runner）与 `frontend/.dockerignore`：runner 以非 root 用户运行 `node server.js`，复制 `.next/standalone`、`.next/static`、`public`，`BACKEND_URL` 以运行期 `ENV` 给出默认值且可被 `docker run -e` 覆盖，验证：Docker 可用时 `docker build -t todo-frontend frontend` 退出码 0；不可用时记录未验证，并在发布流水线补验
- [x] 4.2 在 `frontend/README.md` 增补镜像构建与运行命令（含 `-e BACKEND_URL=...` 与端口映射），验证：文档命令与 Dockerfile 中 `ENV`/`EXPOSE` 名称一致，且按文档执行 `docker run` 后首页返回 200

## 5. Harness 静态红线与前端闸门

- [x] 5.1 扩展 `harness/checks/03-static-guard.ps1`：新增 `frontend/**/*.ts|*.tsx` 扫描，排除 `node_modules`、`.next`、`dist`；前端仅应用占位标记（`TODO|FIXME|XXX`）与跳过写法（`it.skip`/`describe.skip`/`test.skip`/`xit`/`xdescribe`），Java 规则不变，验证：`powershell -File harness\checks\03-static-guard.ps1` 退出码 0 且输出同时包含 Java 与前端扫描文件数
- [x] 5.2 红线自证：临时在 `frontend/components/TodoApp.tsx` 写入 `// TODO` 并在测试中写入 `it.skip`，验证：03 闸门退出码 1 并列出两处位置；删除临时内容后恢复退出码 0
- [x] 5.3 更新 `harness/checks/04-frontend.ps1` 头部注释与失败提示为 Next.js 语义，保持三步结构不变，验证：`powershell -File harness\checks\04-frontend.ps1` 退出码 0 且依次输出 `npm ci`、`npm run build`、`npm run test`

## 6. 父仓库文档与集成验收

- [x] 6.1 更新父仓库文档：`AGENTS.md` §6/§7（Vue 3 + Vite → Next.js App Router、前端端口 3000、目录清单）、`README.md`（框架描述、启动端口、Node 版本）、`docs/specs/todo-module-spec.md`（`App.vue` → `components/TodoApp.tsx`、`src/api.ts` → `lib/api.ts`），验证：在上述三个文件中 grep 无 `Vue`、`@vue`、`5173`、`App.vue`、`src/api.ts` 残留
- [x] 6.2 运行 `powershell -File harness\run-all.ps1`，验证：退出码 0 且六道闸门全部输出通过
- [x] 6.3 经人工确认后提交并推送 `frontend` 子模块，父仓库 `git add frontend` 更新 gitlink，与 harness 及文档改动一并提交，验证：`git submodule status` 中 frontend 条目无 `+` 前缀，且再次运行 `run-all.ps1` 退出码 0

## Workflow follow-up

- 人工审阅 `proposal.md`、两份 delta spec 与 `design.md`，确认方向后再进入实施。
- 实施与验收全部完成后，执行 `/opsx:archive` 归档本变更，确认 `openspec/specs/frontend-template/` 被移除、`openspec/specs/frontend-nextjs/spec.md` 成为新真相。
