# Tasks

## 1. 检索层（纯函数 + 单测）

- [x] 1.1 新建 `frontend/lib/search/query.ts`：导出 `searchContent(rawQuery)`，返回 `{ query, total, groups }`；关键词 `trim()` + `toLowerCase()`，直接扫描 `lib/home/mock-data.ts` 的三个原始数组，帖子与景点只收 `status === 'published'`，城市名经 `cityName()` 参与匹配但 `city === 'all'` 的内容不把城市名放进 haystack；分组顺序写死为 编辑推荐 → 帖子 → 景点，组内保持数据源顺序，每组附 `anchorHref`（`/#editor-picks`、`/#hot-posts`、`/#hot-attractions`）。验证：`cd frontend; npx vitest run lib/search/query.test.ts` 通过。
- [x] 1.2 新建 `frontend/lib/search/query.test.ts`，逐条覆盖 spec 的「全量检索范围」「匹配字段与分组」：①被首页上限截断的条目可命中（数据里确定的「糖水铺」「回民街」「后海村」各断言一次，并在失败信息里写明数据依赖）；②`draft` 帖子（「在故宫闭馆前的最后半小时」）与 `draft` / `removed` 景点（「未开放的观景台」「已下线的旧景点」）不可命中；③搜「成都」同时命中三类内容；④搜 `chengdu` 零命中；⑤`'  成都  '` 与 `'成都'` 结果一致；⑥一次命中多类时分组顺序固定；⑦组内顺序等于数据源顺序。验证：`cd frontend; npx vitest run lib/search/query.test.ts` 全绿。

## 2. `/search` 页面

- [x] 2.1 新增 `frontend/app/search/page.tsx`：Server Component（不写 `'use client'`），`searchParams: Promise<Record<string, string | string[] | undefined>>` 只取每个键的第一个值，调用 `searchContent()`；渲染 `SiteHeader` / `SiteFooter`，正文三选一——无关键词引导态、零命中空态、有命中按分组渲染；每组展示组名、条数、条目（标题 + 城市中文名 + 一条类型元信息，条目本身不是链接）与回首页锚点；导出 `metadata`，全页唯一 `h1`。验证：`cd frontend; npx vitest run app/search/page.test.tsx` 通过。
- [x] 2.2 新增 `frontend/app/search/search.module.css`：桌面优先，只有一个 `@media (max-width: 720px)` 断点做单列收窄；配色只用 `--wc-*` token，不写字面量十六进制。验证：`cd frontend; npm run build` 通过且产物无 CSS 报错。
- [x] 2.3 给三个首页区块补锚点：在 `components/home/editor-picks.tsx`、`hot-posts.tsx`、`hot-attractions.tsx` 的 `<section>` 上分别加 `id="editor-picks"` / `id="hot-posts"` / `id="hot-attractions"`，保留原有 `data-section` 不动。验证：`cd frontend; npx vitest run app/page.test.tsx` 通过（顺序断言仍走 `data-section`），且三处 `id` 可被 grep 到。
- [x] 2.4 新增 `frontend/app/search/page.test.tsx`（用 `AuthProvider` + `AiAssistantProvider` 包裹，与 `app/page.test.tsx` 同构），覆盖 spec 的「搜索入口与查询参数」「结果展示与空态」「服务端渲染与零请求」：①无 `q` 与 `q` 只含空白都渲染引导态且无结果分组；②命中三类时分组顺序固定；③关键词带首尾空白时页面回显去空白后的值；④零命中渲染空态 + 回首页入口；⑤每组回链 href 指向对应首页锚点；⑥结果条目不是链接元素；⑦打开页面期间零 `fetch`；⑧页面只有一个 `h1` 且含页头页脚。验证：`cd frontend; npx vitest run app/search/page.test.tsx` 全绿。

## 3. 首屏大图与搜索框

- [x] 3.1 重写 `frontend/components/home/hero.tsx`：改为无入参 `HomeHero()`，删除 `HeroStat` / `HeroStatLabel` / `HomeHeroProps` 与全部 `*_LIMIT` 引用；用 `next/image` 的 `fill` 渲染背景大图（复用已有 Unsplash photoId，`sizes="100vw"`、`priority`、`alt=""`，容器 `aria-hidden`），叠一层 `.veil` 遮罩与一层 `.fade` 底部渐变；正文为眉标、`h1`（文案不变）、导语、原生 `<form method="get" action="/search">`（隐藏 `label` + `name="q"` 的 `type="search"` 输入 + 提交按钮）、一行三个文字链接（`/community`、`/attractions`、`#cities`）与一条城市规模提示（数量取 `CITIES` 中非 `all` 的城市数）。文件内不得出现 `'use client'`、`useState`、`useEffect`。验证：`cd frontend; npx vitest run components/home/hero.test.tsx` 通过。
- [x] 3.2 重写 `frontend/components/home/hero.module.css`：实现全宽大图骨架（`position: relative` + `overflow: hidden` + 最小高度）、`.veil` 三段深色渐变、`.fade` 到 `var(--wc-sand)` 的衔接、白字排版、胶囊搜索框（`focus-within` 可见焦点）、文字链接行；断点只用 `@media (max-width: 900px)` 与 `@media (max-width: 600px)`（与 3.5 文档一致）。验证：`cd frontend; npm run build` 通过。
- [x] 3.3 重写 `frontend/components/home/hero.test.tsx`，覆盖 spec「首屏主视觉与站内搜索入口」中六条可自动化的 Scenario：①`h1` 文案不变且区域以它命名；②背景图为 `<img>`、`alt` 为空、`sizes="100vw"`；③搜索表单 `method="get"` + `action="/search"` + 输入 `name="q"` 且必填；④三个文字链接指向 `/community`、`/attractions`、`#cities`；⑤城市规模提示中的数字等于 `CITIES` 中非 `all` 的城市数；⑥渲染期间零 `fetch`。验证：`cd frontend; npx vitest run components/home/hero.test.tsx` 全绿。
- [x] 3.4 改 `frontend/app/page.test.tsx` 的「城市切换不影响主视觉」：不再用 `getAllByRole('listitem')` 读统计（删 stats 后会直接抛错），改为读取 hero 区域内 `h1` 文本与搜索输入框，切换城市后比对两者不变。验证：`cd frontend; npx vitest run app/page.test.tsx` 全绿。
- [x] 3.5 重写 `docs/specs/wanderchain/homepage-hero.md`：删除统计面板与 `stats` 契约的全部表述，改为背景大图、搜索框、文字入口、城市规模提示与无障碍约束；`## 5` 响应式小节写 `真相源：\`frontend/components/home/hero.module.css\`` 并声明 `< 900px` / `< 600px` 两档，与 3.2 的 `@media` 完全一致；「对应主 spec」指向 `### Requirement: 首屏主视觉与站内搜索入口`（归档后存在于主 spec）。验证：`powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 退出码 0（该文档在 4.1 登记后生效）。

## 4. 文档与闸门同步

- [x] 4.1 在 `harness/checks/08-spec-doc-breakpoints.ps1` 的 `$pairs` 中新增两行：`docs/specs/wanderchain/homepage-hero.md` ↔ `frontend/components/home/hero.module.css`、`docs/specs/wanderchain/search-page.md` ↔ `frontend/app/search/search.module.css`。验证：`powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 退出码 0 且输出「4 份单元文档」。
- [x] 4.2 新增 `docs/specs/wanderchain/search-page.md`：单元边界、三态场景、匹配与分组规则、`SearchOutcome` 数据结构、验收清单与验收命令；`## 5` 响应式小节写 `真相源：\`frontend/app/search/search.module.css\`` 并声明 `< 720px`。验证：4.1 的闸门通过，且文档中「对应主 spec」指向 `openspec/specs/wanderchain-search/spec.md`（归档后存在）。
- [x] 4.3 确认 `AGENTS.md` 的 `<!-- harness-checks: ... -->` 标记无需改动（本轮没有新增或删除闸门文件），并确认 `docs/specs/wanderchain/` 下单元文档数为 11（u0–u8 九份 + hero + search-page）。验证：`powershell -File harness\checks\07-doc-consistency.ps1` 退出码 0；目录计数命令输出 11。

## 5. 集成验收

- [x] 5.1 前端整链自检：`cd frontend; npm run build; npm run test` 两步都以退出码 0 结束，且 `lib/search/query.test.ts`、`components/home/hero.test.tsx`、`app/search/page.test.tsx`、`app/page.test.tsx` 均出现在通过列表里。
- [x] 5.2 起本地服务做行为取证：`cd frontend; npm run dev` 后访问 `/` 确认大图 + 搜索框可见、点击「按城市逛」滚到 `#cities`；访问 `/search?q=沙面岛`（含被首页截断的内容）、`/search?q=成都`（三类分组）、`/search?q=zzz`（空态）、`/search`（引导态）四种输入，截图留证后关掉服务。
- [x] 5.3 工作区总闸门：`powershell -File harness\run-all.ps1` 退出码 0（00 子模块、01 编译、02 测试、03 红线、04 前端、05 改名、06 Flyway、07 文档、08 断点全部 PASSED）。
- [x] 5.4 按子模块边界提交：先在 `frontend/` 子模块内提交并推送本轮代码与测试，再回工作区提交 `docs/`、`harness/` 与新的 `frontend` gitlink。验证：`git -C frontend log --oneline -1` 有新提交、`git status` 在工作区只剩预期的自有文件与 gitlink 变动。

## Workflow follow-up

- 人类审阅 proposal / specs / design / tasks 后放行，才可开始 `/opsx:apply`。
- 实施完成后执行 `/opsx:archive`：按 delta 从 `openspec/specs/wanderchain-homepage/spec.md` 移除「首页主视觉」、追加「首屏主视觉与站内搜索入口」，并新建 `openspec/specs/wanderchain-search/spec.md`。
- 归档后按仓库约定给归档提交打 annotated tag，与归档目录名一一对应。
