# Proposal

## Why

产品的原始理念（`ChinaMate-MVP产品大纲.md` §0.1、`P0模块MVP规格说明.md` §0.3-3）是给「第一次来中国、以英语为主、行前准备不足」的独立旅行者用的问题解决型社区，语言约定写得很硬：**UI 英文优先，内容实体同时保留中英文，不做 i18n 框架**。

当前实现与这条理念完全相反：`app/layout.tsx` 写死 `lang="zh-CN"`；全部界面文案是中文；城市白名单只有中文名与中文 tagline；Mock 内容（6 条编辑推荐 / 14 帖 / 9 景）全是中文；`lib/home/format.ts` 用 `toLocaleString('zh-CN')` 与「X 月 X 日」。海外用户打开站点看到的是一个中文站：读不懂界面，也搜不到东西——`/search` 只把城市中文名放进匹配串，输入 `chengdu` 必定零命中。

本次把语言层一次性对齐理念：界面英文化、数据双语化、搜索接受中英文。这是「适配国外用户」的全部前置条件，不涉及新增功能模块。

## What Changes

- **BREAKING**：界面文案由中文改为英文单语。`layout.tsx` 的 `lang` 改为 `en`，title / description / openGraph 全部英文；**不引入 i18n 框架、不做语言切换、不建 locale 路由**——这是产品规格的明确约定，不是向难度妥协。
- 城市白名单保留现有 8 项（`all` + 7 城），每项新增 `nameEn` 与 `taglineEn`；界面展示英文字段。
- Mock 内容双语化：编辑推荐补 `titleEn` / `summaryEn` / `editorEn`，帖子补 `titleEn` / `authorEn`，景点补 `nameEn`；中文字段保留原位作为第二真相，任一字段不得只留一种语言。
- `/search` 匹配字段由「城市中文名」扩展为「城市中文名与英文名」；内容字段同时匹配中英文字段。
- 空态与引导态文案按 P0 规格 AC-1.6 / AC-1.8 对齐英文（`Be the first to ask` / `Browse attractions`）。
- `formatCount` / `formatDate` 改为英文口径（`en-US` 千分位与英文月份），不再输出「1.2 万」「9 月 30 日」。
- 同步 `docs/specs/wanderchain/` 下涉及中文界面文案的单元文档，以及 30–40 处中文测试断言。

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `wanderchain-homepage`: 新增「英文界面与双语内容字段」一条 Requirement，作为本能力的语言基线——它统摄其余条款中出现的界面元素中文名称（「旅游社区」「景点攻略」「北京入口」），说明那些只是规格叙述，实际界面以英文呈现。旧条款不逐条退役。
- `wanderchain-search`: 退役「匹配字段与分组」，新增「匹配字段与分组（中英文）」。必须走 REMOVED + ADDED 而非 MODIFIED：原条款含一条 Scenario「城市 slug 不作为匹配依据」，而城市英文名 `Chengdu` 与 slug `chengdu` 同形，新行为下该 Scenario 必然被推翻，而 MODIFIED 不允许丢弃既有 Scenario。

## Impact

- 代码：`app/layout.tsx`、`app/page.tsx`、`app/search/page.tsx`、`app/login/page.tsx`、`app/register/page.tsx`、`app/community/page.tsx`、`app/attractions/page.tsx`；`components/home/*`、`components/site/*`、`components/auth/*`；`lib/home/{types,cities,mock-data,format}.ts`、`lib/search/query.ts`。
- 测试：`app/page.test.tsx`、`app/search/page.test.tsx`、`components/**/*.test.tsx`、`lib/search/query.test.ts` 中的中文断言全部改为英文。
- 依赖与配置：不新增 npm 依赖；`next.config.ts` 不变（不启用内置 i18n）；后端与数据库不变。
- 文档与闸门：`docs/specs/wanderchain/` 单元文档涉及的文案章节改写；`08-spec-doc-breakpoints.ps1` 配对表不动（文件不迁移）；`AGENTS.md` 闸门清单不动。
- 规格：`wanderchain-homepage` 归档时新增 1 条 Requirement；`wanderchain-search` 退役 1 条、新增 1 条（总数不变）。
- **明确不做**：AI 拍照理解 / 菜单 OCR / 多模态（留到移动端 change）；Tailwind + shadcn 迁移；`/attractions/[id]`、`/guides/[id]`、`/ai` RAG、`/api/v1` 化；`wanderchain` → `ChinaMate` 品牌改名（另立 change）。
