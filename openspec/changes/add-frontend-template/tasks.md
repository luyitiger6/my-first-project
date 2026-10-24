# Tasks

## 1. 脚手架生成

- [ ] 1.1 以当前 HEAD 为回滚基线（验证：`git status` 干净或记录未提交清单，`git log -1` 记录基线 hash）
- [ ] 1.2 用 create-vite 生成 vue-ts 模板到 `frontend/`，删除示例组件与样式残留（验证：`frontend/` 结构存在，`src/` 下无 HelloWorld 等示例文件）

## 2. Todo 界面与代理

- [ ] 2.1 实现 `frontend/src/api.ts`：`getTodos` / `createTodo` / `completeTodo` 三个 fetch 封装，base 路径 `/api/todos`（验证：类型检查通过）
- [ ] 2.2 实现 `frontend/src/App.vue`：列表展示 + 新增输入框 + 完成按钮，状态加载/错误提示（验证：由 3.1 组件测试覆盖）
- [ ] 2.3 精简 `frontend/src/main.ts` 为最小挂载，清理 `index.html` 标题（验证：`npm run dev` 可启动）
- [ ] 2.4 `vite.config.ts` 配置 `server.proxy`：`/api` → `http://localhost:8989`（验证：配置语法正确，`npm run dev` 无报错）

## 3. 测试

- [ ] 3.1 实现 `frontend/src/App.spec.ts`：mock api 模块，覆盖列表渲染、新增提交、完成操作三类行为（验证：`npm run test` 退出码 0，测试全绿）
- [ ] 3.2 `npm install` 生成 `package-lock.json`（验证：lock 文件存在，`npm ci` 可复现安装）

## 4. 前端验收闸门

- [ ] 4.1 编写 `harness/checks/04-frontend.ps1`：切到 `frontend/` 后依次 `npm ci` → `npm run build` → `npm run test`，任一步非 0 即 `exit 1`（验证：单独运行退出码 0）

## 5. 忽略与文档

- [ ] 5.1 `.gitignore` 增补 `node_modules/` 与 `frontend/dist/`（验证：`git status` 不显示 node_modules 与 dist）
- [ ] 5.2 更新 `AGENTS.md`：§6 目录地图加 `frontend/` 与 04 闸门，§7 命令速查加前端命令（`npm run dev` / `npm run build` / `npm run test`）
- [ ] 5.3 更新 `README.md`：目录段加 `frontend/`，快速开始加前端启动步骤，前置环境标注 npm registry 配置点

## 6. 集成验收

- [ ] 6.1 运行 `powershell -File harness\run-all.ps1`，确认四道闸门全部 PASS、退出码 0（验证：输出 `RESULT: ALL CHECKS PASSED` 且 `$LASTEXITCODE` 为 0）
- [ ] 6.2 联通冒烟：启动后端（8989）+ `npm run dev`，HTTP 访问前端 dev 端口返回页面，经代理请求 `/api/todos` 返回 200（验证：两个请求均成功，随后停止进程）

## Workflow follow-up

- 验收通过后按项目流程归档本 change：`/opsx:archive`（specs delta 将合并进 `openspec/specs/frontend-template/`，成为本仓库首个主 spec）
- 提交时机由人决定，AI 不主动 commit
