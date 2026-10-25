# Proposal

## Why

本仓库的前端仍是脚手架自带的 Todo 示例界面，与 wanderchain 的旅行平台产品形态无关；而首页所需的后端 API 尚未立项。本期把首页按「纯前端、可独立交付」重建：每个单元自带 Mock 数据作为契约占位，真实 API 后续单独立项接入，前端不必等待后端即可验收。

## What Changes

- 删除 Todo 示例界面与其数据封装（`components/TodoApp.tsx`、`lib/api.ts`、Todo 组件测试），保留通用的 `/api/*` 同源代理及其测试作为基础设施。
- 新增 9 个前端单元，全部以 Mock 仓储为唯一数据源：
  1. 契约与 Mock 数据层（类型、城市白名单、固定排序的假数据、仓储接口）
  2. Mock 认证（注册、登录、当前用户、退出，角色字段）
  3. 首页骨架与区块编排（固定区块顺序、单区块失败隔离、`?city=` 透传）
  4. 功能导航栏（旅游社区 / 景点攻略 / AI 助手 三张入口卡）
  5. AI 助手入口（悬浮按钮 + 顶部入口，打开占位面板，零网络请求）
  6. 城市快速入口（8 个 MVP 城市，写入 URL 并高亮）
  7. 编辑推荐区块（`sort_order` 升序，并列按 `id`）
  8. 热门帖子区块（Top 10，按评论数 → 浏览数 → 发布时间降序）
  9. 热门景点区块（Top 5，按浏览数 → 发布时间降序）
- 重写首页样式体系为按单元自包含的 CSS Modules；更新站点标题与描述为 wanderchain。
- 不新增 npm 依赖，不改动 Harness 脚本，不改动后端与数据库。

## Capabilities

### New Capabilities

- `wanderchain-homepage`: wanderchain 首页的 9 个可独立开发、独立测试、独立交付的前端单元，以及支撑它们的 Mock 数据契约与城市白名单。

### Modified Capabilities

- `frontend-nextjs`: 移除「Todo 界面行为」要求；把「前端测试链可执行」的覆盖面从 Todo 界面改为首页单元，代理转发要求保持不变。

## Impact

- `frontend/`（git 子模块）：`app/page.tsx`、`app/layout.tsx`、`app/globals.css`、`app/login`、`app/register`、`components/**`、`lib/**`、`vitest.config.ts`（仅如需）、测试文件。
- 保留：`app/api/[...path]/route.ts` 与 `app/api/[...path]/route.test.ts`、`next.config.ts`、`Dockerfile`、`package.json` 依赖清单。
- 验收路径：`powershell -File harness\run-all.ps1`（00–06 全部通过；本期不改闸门逻辑）。
- 后续变更：真实首页 API（三个内容接口 + 认证接口）单独立项，届时只替换 Mock 仓储实现与认证提供者。
