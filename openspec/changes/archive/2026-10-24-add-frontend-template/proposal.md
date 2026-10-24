# Proposal

## Why

仓库已有后端骨架（`backend/` + 三道闸门），但作为「全栈脚手架模板」缺前端半边：复制者拿到的模板只有 API，没有界面、没有前端构建链，前后端联通性无从证明。本次变更补齐 Vue 3 前端模板，让模板成为真正的全栈起点。

## What Changes

- 新增 `frontend/` 目录：Vue 3 + Vite + TypeScript 前端模板
- 提供 Todo 最小应用界面：列表展示、新增、完成待办，联通后端全部 API（GET /api/todos、POST /api/todos、POST /api/todos/{id}/complete）
- 开发代理：dev 模式下前端发往 `/api` 的请求转发至 `http://localhost:8989`
- 新增前端测试链：vitest 组件测试，覆盖界面行为
- 新增 harness 第 4 道闸门 `04-frontend.ps1`（npm ci → build → test），接入 `run-all.ps1` 统一验收
- 前端依赖版本由 `package-lock.json` 钉死并入库，复制者可 `npm ci` 复现
- 文档同步：AGENTS.md 目录地图与命令速查、README.md 目录说明与快速开始

## Capabilities

### New Capabilities

- `frontend-template`: 前端模板的构建能力、Todo 界面行为、开发代理联通与前端验收闸门

### Modified Capabilities

（无：现有 `openspec/specs/` 为空，本 change 是首个产生 spec delta 的变更）

## Impact

- 新增目录：`frontend/`（Vue 3 + TS 源码、vite 配置、测试、package.json、package-lock.json）
- 新增护栏：`harness/checks/04-frontend.ps1`；`run-all.ps1` 按文件名排序自动接入，无需修改
- 依赖：运行时 `vue`；开发期 `vite`、`@vitejs/plugin-vue`、`typescript`、`vue-tsc`、`vitest`、`@vue/test-utils`、`jsdom`
- 忽略规则：`.gitignore` 增补 `node_modules/` 与前端构建产物目录
- 文档：`AGENTS.md` §6 目录地图、§7 命令速查；`README.md` 目录说明、快速开始
- 环境：Node.js 20.19+（README 前置环境已声明）；npm registry 需可达
