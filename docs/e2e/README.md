# docs/e2e · wanderchain E2E 说明

把 `docs/specs/wanderchain/` 下 10 份 SPEC 的 When/Then 场景落成 Playwright 用例，
外加首页锚点落位（`fix-homepage-anchor-landing` 变更）的补充场景：
每个 Scenario（或 Scenario 下的 And 分支）对应一个独立 `test()`，测试标题与注释里标注场景编号。

- 测试文件：`docs/e2e/<spec 名>.spec.ts`
- 共 12 个文件、156 条用例
- 除首页锚点补偿组件（`frontend/components/home/hash-anchor-restorer.tsx`）外，E2E 建设不改动前端生产代码；测试依赖只装在**工作区根** `package.json`

## 如何运行

```powershell
# 工作区根目录
npm run test:e2e            # 自动挑端口、启动 next dev、跑全量
npm run test:e2e -- docs/e2e/homepage-hero.spec.ts   # 只跑单个文件
npm run test:e2e:report     # 打开 HTML 报告
```

首次运行前安装根依赖：`npm install`（根目录）。

### 端口策略

`scripts/e2e-run.mjs` 从 `3000` 起逐个探测到 `3010`，命中空闲端口后以
`E2E_PORT` / `E2E_BASE_URL` 传给 Playwright，并复用它启动的 `next dev`。
本机 3000 常被其他服务占用，日志会出现 `using http://localhost:3001` 属正常。

| 环境变量 | 作用 |
|---|---|
| `E2E_PORT` | 指定端口，跳过探测 |
| `E2E_BASE_URL` | 指定完整基址（优先于 `E2E_PORT`） |
| `E2E_USE_EXISTING=1` | 不启动 webServer，直接打已有实例 |
| `E2E_CHANNEL` | Playwright 浏览器通道，默认 `chrome`（用本机 Chrome，避免下载二进制） |

webServer 用 `next dev` 而不是 `next start`：E2E 不在 harness 的十一道闸门内，`dev` 配上
`reuseExistingServer` 可以复用已经跑着的开发服务，省掉每次一轮生产构建；
生产构建能不能过由 `04-frontend` 闸门负责，不在这里重复。

## 约定

- **视口**：桌面 `1440×900`；移动端 `375×667`；SPEC 明确写 320px 的断点用 `320×667` 复验。
  （需求里的「移动端 3775×667」按 `375×667` 笔误处理。）
- **超时**：单条用例 30s；`expect` 10s；`actionTimeout` 10s；`navigationTimeout` 20s。
- **串行**：`workers: 1`、`retries: 0`。用例之间共享同一 dev server，串行避免城市切换与路由桩互相干扰。
- **导航**：每个 describe 用 `test.beforeEach` 统一调 `gotoHome` / `gotoSearch` / `gotoPath`；
  异步就绪一律交给 Playwright 的自动重试断言，不用裸 `waitForTimeout` 代替等待。
  只有「验证不会发生某事」的负向场景（如快速切换不导航）才用短超时 `waitForURL(..., { timeout: 700 })`。
- **失败截图**：`docs/e2e/support/fixtures.ts` 的 auto fixture 在失败时输出全页截图到
  `docs/e2e/screenshots/<spec>/<test>.png` 并挂到 HTML 报告；
  Playwright 自身还会写 `docs/e2e/test-results/**` 的即时截图与 trace。
  以上目录都在 `.gitignore` 中，不入库。

## 文件与来源

| 测试文件 | 来源 SPEC | 用例数 |
|---|---|---|
| `homepage-hero.spec.ts` | `homepage-hero.md` | 17 |
| `homepage-u0-contract-mock.spec.ts` | `homepage-u0-contract-mock.md` | 16 |
| `homepage-u1-auth.spec.ts` | `homepage-u1-auth.md` | 18 |
| `homepage-u2-skeleton.spec.ts` | `homepage-u2-skeleton.md` | 16 |
| `homepage-u3-feature-nav.spec.ts` | `homepage-u3-feature-nav.md` | 9 |
| `homepage-u4-ai-assistant.spec.ts` | `homepage-u4-ai-assistant.md` | 17 |
| `homepage-u5-city-switcher.spec.ts` | `homepage-u5-city-switcher.md` | 13 |
| `homepage-u6-editor-picks.spec.ts` | `homepage-u6-editor-picks.md` | 10 |
| `homepage-u7-hot-posts.spec.ts` | `homepage-u7-hot-posts.md` | 11 |
| `homepage-u8-hot-attractions.spec.ts` | `homepage-u8-hot-attractions.md` | 11 |
| `search-page.spec.ts` | `search-page.md` | 13 |
| `homepage-anchors.spec.ts` | `fix-homepage-anchor-landing` 的 `wanderchain-homepage` delta | 5 |

`homepage-anchors.spec.ts` 覆盖锚点落位稳定性的首页侧场景（直接带锚点访问、用户主动滚动让位、
无锚点不自动滚动）；回链场景由 `search-page.spec.ts` 的 S5 覆盖。

## 诚实排除清单

下列场景在浏览器端**不可构造**（首页数据层是本地 Mock，无网络可拦截），
未写断言或以「可观察代理」代替；对应分支由 `frontend/` 的 vitest 单测覆盖。
README 记录在这里，避免把「没测」误读成「已通过」。

认证是唯一例外：`/api/auth/*` 走网络，`homepage-u1-auth.spec.ts` 用 `page.route` 全量桩掉，
因此后端返回什么状态码都能构造。桩掉而不是打真实后端有两个理由——
这条链路不该依赖 MySQL 与 Redis，反复失败登录也会把本地那个共享的限流桶踩满。

| 场景 | 原因 / 替代做法 |
|---|---|
| hero S7 | SPEC 自述该 Scenario 不作验收 |
| U0 S9 / S11 | 空结果与时间异常需直接构造仓储输入，浏览器不可注入 |
| U1 A4「渲染期不发认证请求」 | 浏览器里无法观察「未发生」，改用原始 HTML（`page.request.get`）断言首帧只有加载占位 |
| U1 令牌 cookie 的属性 | `HttpOnly` cookie 在 JS 里读不到，属性由后端 `AuthCookieTest` 负责；前端侧只断言可读存储为空白 |
| U2 S7 / S8 | 仓储 reject / render 抛错需替换数据层，浏览器不可注入 |
| U2 S9 · 空态分支 | 每个城市至少有一条 `city=all` 的精选，构造不出 `items: []`；改为断言广州只回退全城精选且无错误态 |
| U3 S6 / S7 / S10 | Provider 缺失、404 路由、遮罩下重复点击均不可达 |
| U4 S9 / S10 / S12 | 上下文缺失、遮罩下重复打开、触发元素被移除均不可达 |
| U6 S6 / S7 · 空态分支 | 同 U2 S9：广州有 `city=all` 精选；改为断言无错误态 + 仅回退全城精选 |
| U7 S9 / S10 / S12 | 仓储 reject、无空城市、无零值数据 |
| U8 S9 / S10 / S12 | 同上 |
| U2 S7 / U6 S6 | 图片加载失败用 `page.route(..., abort)` 真实触发，已覆盖 |
