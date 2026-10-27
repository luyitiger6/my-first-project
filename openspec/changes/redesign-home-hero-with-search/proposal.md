# Proposal

## Why

当前首页首屏是「左文案 + 右四项统计」的报纸式排版，视觉上更像项目档案页而不是旅行站点首页：没有主视觉，也没有任何检索入口。访客想知道「有没有人写过沙面岛」，只能靠滚动五个区块肉眼找，而首页为了让内容有节奏，帖子只展示前 10 条、景点只展示前 5 个——被截断的内容在界面上完全不可达。

这一次把首屏换成「全宽大图 + 叠字 + 搜索框」，并新增 `/search` 真检索：搜索扫全量 Mock 数据，不受首页列表上限约束。它是首页的第一块招牌，也是唯一一条能穿透首页截断的内容通路。

## What Changes

- **BREAKING**：`HomeHero` 改为无入参组件，删除 `stats` / `HomeHero` 的 `HeroStat`、`HeroStatLabel`、`HomeHeroProps` 契约。四个 `*_LIMIT` 派生数字从首屏移除，调用方无法再覆盖。
- 首屏改为全宽大图骨架：`next/image` 背景图（`fill` + `priority` + 自定义 loader 出档）+ 深色遮罩 + 底部渐变融入 `--wc-sand`，标题、导语、搜索框叠在图上。
- 首屏原有的两个按钮入口与「按城市逛」锚点降级为搜索框下方一行文字链接，目标地址不变（`/community`、`/attractions`、`#cities`）。
- 首屏新增原生 `<form method="get" action="/search">` 搜索框，参数名 `q`；不引入客户端状态，hero 仍为 Server Component 且零网络请求。
- 首屏保留一条城市规模提示，数值由城市白名单中非 `all` 的城市数派生，不再硬编码「七座城市」。
- 新增 `/search` 页面与检索层：查询参数 `q`，全量扫描编辑推荐、帖子、景点，按 编辑推荐 → 帖子 → 景点 分组展示；命中字段覆盖标题/摘要/作者/编辑名与所属城市的**中文名**，忽略大小写与首尾空白。
- 搜索结果条目不可点击（详情页尚未存在），每组末尾给回首页对应区块的锚点链接；空查询展示引导态，零命中展示空态。
- 文档与闸门同步：重写 `docs/specs/wanderchain/homepage-hero.md`、新增 `docs/specs/wanderchain/search-page.md`，并把这两份文档登记进 `08-spec-doc-breakpoints.ps1` 的配对表。

## Capabilities

### New Capabilities

- `wanderchain-search`: 站内检索能力 `/search`——查询参数解析、全量扫描范围与状态过滤、匹配字段与分组顺序、结果展示与空态、零客户端依赖约束。

### Modified Capabilities

- `wanderchain-homepage`: 退役「首页主视觉」一条 Requirement（其「四项数据概览」与两条相关 Scenario 随统计面板一并消失），并由新增的「首屏主视觉与站内搜索入口」承接首屏全部行为：大图、标题、导语、搜索框、文字入口、城市规模提示与零请求约束。

## Impact

- 代码：`frontend/components/home/hero.tsx`、`hero.module.css`、`hero.test.tsx`、`frontend/app/page.test.tsx` 改写；新增 `frontend/app/search/page.tsx`、`frontend/app/search/search.module.css`、`frontend/app/search/page.test.tsx`、`frontend/lib/search/query.ts`、`frontend/lib/search/query.test.ts`。
- 依赖与配置：不新增 npm 依赖，不改 `next.config.ts`（自定义 loader 与 `output: 'standalone'` 保持不变），不改后端与数据库。
- 文档与闸门：`docs/specs/wanderchain/homepage-hero.md` 重写、`docs/specs/wanderchain/search-page.md` 新增、`harness/checks/08-spec-doc-breakpoints.ps1` 配对表加两行；`AGENTS.md` 闸门清单不变（没有新增闸门文件）。
- 规格：主 spec `openspec/specs/wanderchain-homepage/spec.md` 归档时退役 1 条、新增 1 条 Requirement（Requirement 总数不变），新能力 `openspec/specs/wanderchain-search/spec.md` 归档时新建。
