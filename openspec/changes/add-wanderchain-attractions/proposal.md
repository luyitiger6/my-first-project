# Proposal

## Why

WanderChina 面向境外用户，景点是这类用户落地后第一件要决策的事：能不能预约、收不收外卡、周一开不开、地址怎么给司机看。而现状是首页热门景点只有 9 条 Mock、9 个字段，卡片不可点，`/attractions` 只是一个指向占位页的硬编码链接——字段装不下这个问题，页面也不存在。

所以本次不是"再加一个内容模块"，而是把景点从"首页的一块展示"升级为一条可读的独立能力：有真实后端、有列表与榜单、有可进入的详情页。同时它会推翻两条已归档条款（搜索页景点条目不可点、首页热门景点数据源为 Mock），这两处必须随本次变更一起改写，否则规格与实现会长期打架。

## What Changes

- 新增景点后端域：`attractions` 表（含面向境外用户的决策字段与核实时间）、`GET /api/attractions`（列表，`sortBy` 兼作榜单）、`GET /api/attractions/{publicId}`（详情），三者均为公开只读。
- 新增 `/attractions` 页面：景点列表 + **约束型榜单**（人工策展 2~3 个，如「第一次来中国」「无需预约」「周一也开门」），每个榜单附一句编辑说明，避免退化成筛选器。
- 新增 `/attractions/[publicId]` 详情页：事实卡（门票/开放时间/预约要求/支付方式/地址中英双写/交通/建议时长/核实时间）+ 短正文。
- 首页热门景点区块改为调用真实接口，不再读本地 Mock 仓储；卡片变为可点击并进入详情页。
- 首页景点攻略入口带上当前城市（`/attractions?city=`），修掉现在硬编码 `/attractions` 导致跨页丢城市的问题。
- 搜索页的景点分组数据源也改为后端接口，否则搜索库与景点库会长期不一致；编辑推荐与帖子仍读本地数据。
- **BREAKING**：搜索页景点条目由「不是链接元素」改为可点击并指向 `/attractions/{publicId}`，景点条目标识由数字 `id` 改为 `publicId`。
- **BREAKING**：搜索页「零网络请求」收窄为「浏览器端零网络请求」，服务端允许读取景点数据源；数据源不可达时景点分组降级缺席。
- **BREAKING**：首页热门景点区块的场景前提由「Mock 数据中」改为「接口返回中」。
- 本次不做：城市攻略页（独立 change）、景点与帖子关联（登记触发条件，本轮零结构关联）、收藏/打卡/评分写入/地图/分页、门票交易与库存。

## Capabilities

### New Capabilities

- `wanderchain-attractions`: 景点攻略的公开只读能力——景点列表与约束型榜单、景点详情、以及面向境外用户决策的字段口径（预约要求、支付方式、开放时间、中英双地址、交通、建议时长、核实时间）。

### Modified Capabilities

- `wanderchain-search`: 景点条目从「MUST NOT 渲染为指向不存在详情页的链接」改为可点击指向景点详情页；景点条目标识由数字 `id` 改为 `publicId`，「不构成死链」场景随之改写；「零请求」条款收窄为浏览器端零请求，并新增数据源失败时的降级场景。
- `wanderchain-homepage`: 热门景点区块的数据源由本地 Mock 改为后端接口，两个场景的「Mock 数据中」前提随接口口径改写，卡片改为可点击进入详情页；功能导航栏的景点攻略入口改为透传当前城市。

## Impact

- **backend**：`schema.sql` 新增 `attractions` 表与索引；新增 `dao/attraction`、`service/attraction`、`web/attraction`；`AuthInterceptor` 公开路由新增 `/api/attractions` 与 `/api/attractions/*` 的 `GET`。
- **frontend**：新增 `lib/contracts/attractions.ts`（与后端 record 同名同字段）、`lib/attractions/`（接口客户端与类型）、`app/attractions/`（列表页与详情页）；`lib/home/repository.ts` 的热门景点实现改为走接口；`lib/search/query.ts` 的 `SearchHit` 与景点条目渲染改为 publicId + 链接，搜索页改为服务端读取景点接口；`components/home/feature-nav.tsx` 不再硬编码 `/attractions`。
- **harness**：`10-contract-check.ps1` 的 `$contractPairs` 追加 attractions 一组；`06-schema-check.ps1` 复用 `schema.sql`，无需改脚本。
- **docs**：`docs/specs/wanderchain/homepage-u8-hot-attractions.md` 的「不包含」与「数据来源」两节需改写；新增景点列表页与详情页的单元文档，断点声明需能被 `08-spec-doc-breakpoints.ps1` 比对。
- **openspec**：本次产生 1 个新能力与 2 份 delta，归档时合并进 `openspec/specs/`。
