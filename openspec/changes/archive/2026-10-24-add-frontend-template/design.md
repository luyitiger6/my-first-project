# Design

## Context

仓库已定型为「后端自包含 + 前端独立构建链」的全栈脚手架模板（change 1 已把后端迁入 `backend/`，服务端口 8989，包名 `com.luyi.myfirst`）。本 change 是探索阶段定下的三环拆分中的第二环：前端模板 + 它的验收闸门；第三环（scaffold 改名脚本）留给后续 change。

## Goals / Non-Goals

- Goals：frontend/ 能构建、能联通后端 Todo API、能被 harness 第 4 道闸门验收
- Non-Goals：路由/状态管理（单页用不上）；生产部署代理方案；scaffold 复制改名脚本（change 3）

## Decisions

**D1：脚手架用 create-vite（vue-ts 模板）生成后精简，不纯手写**

- 理由：tsconfig、vite 配置与官方模板保持一致，避免手写漏配；生成后删除示例组件与样式，改造成 Todo 应用。

**D2：不引入 vue-router 与 pinia**

- 理由：单页 Todo 用不上；符合本仓库「业务极简、复制者按需自加」的哲学。
- 备选：预装 router/pinia —— 否决：给模板加未经验证负担，与「红线由真实事故驱动」同理。

**D3：开发代理配置在 vite.config.ts 的 `server.proxy`，目标 `http://localhost:8989`**

- 理由：dev 模式联通后端；生产构建产物不含代理（部署时反代由部署方决定，模板不做假设）。

**D4：04-frontend.ps1 三步：`npm ci` → `npm run build` → `npm run test`**

- 理由：`npm ci` 按 lock 精确安装保证可重复；build 验证类型与打包；test 验证行为。任一步非 0 即 `exit 1`，遵循 harness 约定（无交互、独立退出码）。
- 注意：`npm ci` 每次会清空 node_modules 重装，比 `npm install` 慢但结果确定——护栏哲学选确定。

**D5：组件测试用 vitest + @vue/test-utils + jsdom，mock api 模块**

- 理由：单测不依赖后端进程，保持 Harness 可重复性；api.ts 单独薄封装，组件测试 mock 它。

**D6：package.json 声明 caret 版本范围，package-lock.json 入库钉死实际版本**

- 理由：复制者 `npm ci` 可复现同一依赖树；升级由人显式发起。

**D7：run-all.ps1 不修改，04-frontend.ps1 按文件名排序自动接入**

- 理由：验证 AGENTS.md §8「加新闸门不改总控」的约定本身成立。

## Risks / Trade-offs

- npm registry 不可达会让 04 闸门失败（尤其内网环境）→ README 前置环境标注 registry 配置点；lock 入库后依赖树可审计。
- create-vite 模板随上游版本变化 → 以生成当日 latest stable 为准，lock 入库后固化。
- `npm ci` 每次清空重装导致验收时间变长 → 可接受：确定性优先，且后端三道闸门同样每次真实构建。

## Migration Plan

1. 以当前 HEAD 为回滚基线（记录 hash，与 change 1 同一约定）
2. create-vite 生成 frontend/（vue-ts），删除示例残留
3. 实现 api.ts、App.vue、main.ts（Todo 应用）与 vite 代理
4. 实现 App.spec.ts 测试，npm install 生成 lock
5. 编写 04-frontend.ps1 并单独验证
6. .gitignore、AGENTS.md、README.md 同步
7. `powershell -File harness\run-all.ps1` 四闸门全绿
8. 联通冒烟：起后端 8989 + `npm run dev`，访问前端页面验证代理链路
