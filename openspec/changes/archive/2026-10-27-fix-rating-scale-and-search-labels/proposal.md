# Proposal

## Why

首页景点卡片与检索结果展示 `Rating 8.8` 这类数值，而 `docs/specs/wanderchain/homepage-u0-contract-mock.md` 的字段不变量明确写「`rating` 0–5，一位小数」，`homepage-u8-hot-attractions.md` 的边界场景也以 `0` / `5` / `4.95` 设计。真相层从未约束评分的取值域，越界数据因此长期无人拦截，也没有任何用例守它。

检索能力的三个分组标题同理：界面实际渲染 `Editor's picks` / `Posts` / `Attractions`，主规格却只用中文类别名描述，读者要跨到 `wanderchain-homepage` 才能确认实际文案。

## What Changes

- 把 9 条景点 Mock 数据的 `rating` 从 10 分制换算为 0–5 一位小数（**BREAKING**：首页与检索页可见评分值变化，如 `9.6` → `4.8`、`8.8` → `4.4`）
- `wanderchain-homepage` 新增「景点评分取值域」条款：`rating` 取值 0–5 且最多一位小数，界面按 `toFixed(1)` 展示
- `wanderchain-search` 新增「分组标题与回链文案」条款：钉死三个分组标题与三条回链文案的英文原串
- `lib/home/data-integrity.test.ts` 增加评分取值域守卫，越界即用例失败
- 不动：排序规则、条数上限、三态、检索匹配与分组顺序、双语字段结构、URL 契约

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `wanderchain-homepage`: 新增「景点评分取值域」条款，约束评分范围与展示口径
- `wanderchain-search`: 新增「分组标题与回链文案」条款，钉死英文分组标题与回链文案

## Impact

- 代码：`frontend/lib/home/mock-data.ts`（9 个评分值）、`frontend/lib/home/data-integrity.test.ts`（新增守卫）
- 数据：仅前端 Mock 数据，无后端、无数据库迁移
- 规格：归档时向 `openspec/specs/wanderchain-homepage/spec.md` 与 `openspec/specs/wanderchain-search/spec.md` 各追加一条 Requirement
- 文档：`homepage-u0-contract-mock.md`（0–5 不变量）、`homepage-u8-hot-attractions.md`（0/5/4.95 边界）、`search-page.md`（英文分组标题）三份单元文档已按目标状态书写，本轮无需改动
- 测试影响：现有 190 条用例无一条断言具体评分值，改数据不打破既有断言；新增守卫后用例总数上升
