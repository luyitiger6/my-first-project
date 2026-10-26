# Proposal

## Why

首页主视觉目前以约 55 行 JSX 内联在 `app/page.tsx`（47–97 行），是整页唯一没有组件边界的区域，由此产生三个问题：

- **页面被迫承担数据拼装**：`page.tsx` 为了渲染四项概览，必须 import `CITIES` 与三个 `*_LIMIT` 常量，页面职责从「编排区块」扩散成「同时渲染静态文案」。
- **真相层缺席**：`wanderchain-homepage` 的 9 条 Requirement 里没有主视觉，代码存在但规格不存在，属规格滞后；任何后续改动都只能靠读代码推断意图。
- **验收项长期不可能通过**：U2「首页骨架与区块编排」文档中「`page.tsx` 内不再残留 hero 内联 JSX」这条验收项，在当前结构下必然为红。

计划中本条曾标为纯重构（`skip_specs`）。实际核对后不成立：本次要为主视觉引入「概览入参 + 非法整组回退」这一新契约，属于新增可验证行为，因此改为补一条 ADDED Requirement。

## What Changes

- 新增 `components/home/hero.tsx`，作为 Server Component 承接主视觉，导出 `HomeHeroProps`；`stats` 可选，缺省取数据契约常量，非法则整组回退
- 新增 `components/home/hero.module.css`，把 `home.module.css` 中的 hero 相关样式**迁走并从原文件删除**，不留双份
- `app/page.tsx` 改为渲染 `<HomeHero />`，并清掉因此不再需要的 `CITIES`、`EDITOR_PICKS_LIMIT`、`HOT_POSTS_LIMIT`、`HOT_ATTRACTIONS_LIMIT` import，以及 `home.module.css` 中相关类引用
- 新增 `components/home/hero.test.tsx`，覆盖默认概览、非法入参回退、两个站内入口与页内锚点
- 在 `wanderchain-homepage` 增补 Requirement「首页主视觉」
- 同步两份单元规格文档：`homepage-u2-skeleton.md` 的「hero 已抽出」验收项转为已满足，`homepage-hero.md` 的「与现状差异」表按实施结果更新
- **BREAKING**：无。主视觉的 DOM 结构、文案与视觉表现保持不变

## Capabilities

### New Capabilities

无。本次不引入新能力，只把已存在的首页区域纳入既有能力的规格范围。

### Modified Capabilities

- `wanderchain-homepage`：新增 Requirement「首页主视觉」，固定其渲染先后、四项概览的来源与回退规则、两个站内入口与页内锚点的指向、以及不随城市筛选变化的约束。

## Impact

- 代码：`frontend/app/page.tsx`、`frontend/app/home.module.css`；新增 `frontend/components/home/hero.tsx`、`hero.module.css`、`hero.test.tsx`
- 契约：新增 `HomeHeroProps` / `HeroStat` / `HeroStatLabel` 类型；不改动 `lib/home/*`，不改动任何既有组件的 props
- 依赖：不新增任何 npm 依赖，不引入 Tailwind / shadcn/ui（理由见 design.md）
- 验证：`harness\run-all.ps1`，其中 04 前端闸门覆盖 `npm ci → npm run build → npm run test`
- 已知不改：主 spec 的 Purpose 仍写「9 个前端单元」，本次不动 Purpose——归档同步规则要求既有 Purpose 原样保留，避免把文本改动混进结构重构
