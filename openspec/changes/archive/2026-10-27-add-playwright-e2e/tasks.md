# Tasks

## 1. 工程脚手架

- [x] 1.1 工作区根新建 `package.json` / `package-lock.json`，安装 `@playwright/test`，提供 `test:e2e` 脚本（`node scripts/e2e-run.mjs`）
- [x] 1.2 新建 `playwright.config.ts`：`testDir: docs/e2e`、单测 `timeout: 30_000`、`screenshot: 'only-on-failure'`、`trace: 'retain-on-failure'`、桌面 1440×900、`channel: 'chrome'`、`webServer` 指向 `frontend` dev server
- [x] 1.3 新建 `scripts/e2e-run.mjs`：3000–3010 端口探测；空端口启动独立 dev server，本项目实例则复用，异己占用则后移；通过 `E2E_PORT` / `E2E_BASE_URL` 注入配置
- [x] 1.4 新建 `docs/e2e/support/fixtures.ts`（失败自动全页截图）与 `helpers.ts`（导航、横向滚动、网格列数、加载态观察、会话注入等公共断言）
- [x] 1.5 `.gitignore` 增加 `docs/e2e/test-results/`、`docs/e2e/playwright-report/`、`docs/e2e/screenshots/`

## 2. 场景文件（每个可观察 When/Then 一个独立 test，开头注释带场景编号）

- [x] 2.1 `homepage-hero.spec.ts`（S1–S10）
- [x] 2.2 `homepage-u0-contract-mock.spec.ts`（S1–S8、S10 的浏览器可观察代理断言）
- [x] 2.3 `homepage-u1-mock-auth.spec.ts`（S1–S16）
- [x] 2.4 `homepage-u2-skeleton.spec.ts`（S1–S6、S10–S13）
- [x] 2.5 `homepage-u3-feature-nav.spec.ts`（S1–S5、S7–S10）
- [x] 2.6 `homepage-u4-ai-assistant.spec.ts`（S1–S8、S10–S12、S14–S17）
- [x] 2.7 `homepage-u5-city-switcher.spec.ts`（S1–S12）
- [x] 2.8 `homepage-u6-editor-picks.spec.ts`（S1–S5、S8–S11）
- [x] 2.9 `homepage-u7-hot-posts.spec.ts`（S1–S8、S11、S13、S14）
- [x] 2.10 `homepage-u8-hot-attractions.spec.ts`（S1–S8、S11、S13、S14）
- [x] 2.11 `search-page.spec.ts`（S1–S9）

## 3. 覆盖率登记

- [x] 3.1 `docs/e2e/README.md` 写明运行方式、端口策略、视口、截图位置，以及「浏览器不可触发 / 由 Vitest 覆盖」的场景清单与原因

## 4. 验收

- [x] 4.1 `npm run test:e2e` 退出码 0：全部用例通过，无 skip、无注释断言、无固定等待（`waitForTimeout`）
- [x] 4.2 `cd frontend; npm run test` 退出码 0，既有 283 例不受影响
- [x] 4.3 `powershell -File harness\checks\04-frontend.ps1` 退出码 0
- [x] 4.4 `powershell -File harness\run-all.ps1` 退出码 0（九道闸门无回归）

## Workflow follow-up

- 验收通过后运行 `/opsx:archive` 归档本变更。
