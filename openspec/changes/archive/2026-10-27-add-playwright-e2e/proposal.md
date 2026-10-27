# Proposal

## Why

`docs/specs/wanderchain/` 下 11 份单元文档共 137 条 When/Then 场景，目前只有 Vitest + jsdom 覆盖。jsdom 不渲染真实布局、不执行浏览器导航与 `localStorage` 会话恢复，也验证不了 320px 断点、图片失败占位与真实焦点行为；`docs/spec-coverage-audit.md` 已把「真实浏览器测试缺失」列为已知边界。本次按用户要求，用 Playwright 把 SPEC 场景落到真实浏览器。

## What Changes

- **工作区根新增独立 Playwright 工程**：`package.json`、`playwright.config.ts`、`scripts/e2e-run.mjs`（端口探测 runner）与 `docs/e2e/support/` 公共夹具。测试文件位于 `docs/e2e/`，因此依赖必须装在工作区根，不能装进 `frontend/` 子模块。
- **11 个场景文件**：按单元文档拆分为 `homepage-hero`、`homepage-u0`–`homepage-u8`、`search-page`；每个可由浏览器观察的 When/Then 对应一个独立 `test()`，测试名与开头注释携带场景编号；文件内 `beforeEach` 统一导航。
- **运行约束**：测试 URL 从 `3000` 起探测到 `3010`——端口为空则在该端口启动 `frontend` dev server；该端口已是本项目实例则直接复用；被其他进程占用则后移。单测超时 30s，失败自动截图（`screenshot: 'only-on-failure'` + 逐用例命名的全页截图夹具）。桌面 1440×900；移动端 375×667，SPEC 明确写 320px 的场景使用 320×667。
- **诚实排除**：mock reject、render 期崩溃、注入空数据、Provider 外调用、无 `window` 环境等真实浏览器无法触发的场景，不由 E2E 伪造绿灯；统一在 `docs/e2e/README.md` 登记为「由 Vitest 覆盖」并写明原因。
- **运行方式**：`npm run test:e2e`。Playwright 优先使用本机 Chrome（`channel: 'chrome'`），避免 GitHub 不可达时浏览器二进制下载失败。

无 **BREAKING** 变更：前端生产代码零改动，既有 Vitest 283 例与 harness 闸门不变。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- 无。E2E 只是既有 SPEC 的验收手段补充，不改变主规格已声明行为；`.openspec.yaml` 声明 `skip_specs: true`。

## Non-Goals

- 不替代 Vitest，也不删除既有单元测试。
- 不把 E2E 接入 `harness/run-all.ps1`：真实浏览器执行时间长，且会与 06-flyway 的 MySQL 前置耦合；E2E 作为独立命令执行。
- 不测试后端、真实认证或真实 API。
- 不改 `frontend/` 子模块，因此不产生 gitlink 变更。

## Impact

- 新增：`package.json`、`package-lock.json`、`playwright.config.ts`、`scripts/e2e-run.mjs`、`docs/e2e/**`。
- 修改：`.gitignore`（忽略 Playwright 产物与截图）。
- 前端子模块零改动。
