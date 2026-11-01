# Design

## Context

见 `proposal.md` — Why。这里只记实现前必须钉死的现状与约束。

- **后端已有范式**：`dao/post`（entity / repository / converter）→ `service/post`（接口 + impl + model + support）→ `web/post`（Controller + dto）。响应体统一 `implements ApiResponse`，错误码走 `BaseError`（HTTP 状态码住在错误码里），`AuthInterceptor.publicRoutes()` 精确登记「路径模式 → 方法集合」，默认拒绝。
- **建表只有一份脚本**：`spring.sql.init.schema-locations=classpath:schema.sql`，`ddl-auto=none`，`mode=always`。没有 `data.sql`，也没有迁移框架。
- **06 闸门会 drop 重建 `wanderchain` 库**，再对表名、索引名、约束名、生成列、`created_at` 逐个断言，并把整个 `schema.sql` 作为**单个 `mysql -e` 参数字符串**执行。
- **10 闸门**按 `$contractPairs` 逐组比对：后端 `web/*/dto` 下的每个 record 都必须有一个**同名**前端 interface，字段名与类型双向一致；`List<X>` 只有在 `X` 也是本组扫描到的 record 时才能映射成 `Array<X>`。因此 dto 目录里不能放只服务内部的辅助 record。
- **前端两套通路并存**：首页区块走 `lib/home/repository.ts` 的 Mock 实现（`useSectionData` 已声明「真实 API 接入时组件无需调整」），帖子域已有 `lib/posts/posts-api.ts` 走同源 `/api` 代理的先例。
- **搜索页零依赖**是已归档契约（`wanderchain-search/spec.md`「服务端渲染与零请求」），景点数据迁后端会直接撞上它。

## Goals / Non-Goals

**Goals:**

- 景点读能力在后端成形：一份 DDL、两个公开端点、一组受契约闸门管辖的 DTO。
- 前端两页复用现有骨架（`useSectionData` + `SectionLoading` / `SectionError` / `EmptyState`），不新造加载范式。
- 首页与搜索页切到真实数据源后，spec、单元文档、闸门清单同步改，不留双份真相。

**Non-Goals:**

- 不做写的管理后台：榜单策展靠种子与手工 `UPDATE`。
- 不做游标分页：景点总量小，`limit` 足够；`cursor` 留到需要时再加。
- 不做评分 / 收藏 / 打卡写入、地图、门票交易。
- 不动 posts 域既有契约与错误码。

## Decisions

### D1 两个端点，榜单用独立参数

`GET /api/attractions?city=&sortBy=&collection=&limit=` 与 `GET /api/attractions/{publicId}`，两个 GET 都公开。

`sortBy` 只表达排序（`hot` / `rating` / `new`），`collection` 只表达约束集合（`first-trip` / `no-booking` / `open-monday`）。两者语义不同：一个是对全量排序，一个是取有限策展集合且顺序由人定；塞进同一个参数会让「全量排序」与「有限集合」共用一个分支。

- 替代：`/api/attractions/collections/{key}` 三条路径。否决：多一个路径模式、多一条 `AuthInterceptor` 白名单、多一套 404 语义，收益为零。
- 替代：榜单直接按 boolean 列筛选（`WHERE booking_required = 0`）。否决：这正是探索阶段指出的「退化成筛选器」，榜单必须带人工策展顺序。

### D2 单表 + 三个策展排序列，不建关联表

`attractions` 一表承载全部字段；包榜单用三个可空整数列 `curated_rank_first_trip` / `curated_rank_no_booking` / `curated_rank_open_monday`（`NULL` = 未收录）。

- 替代：`attraction_collections(collection_key, attraction_id, sort_order)` 关联表。否决：本期榜单键固定为 3，换成表只买到「加榜单不改 DDL」，代价是每榜一次 join、一份 CHECK 白名单、一份种子维护；三个可空排序列的查询与索引都更直白。榜单超过 5 个再拆表，届时属于独立 change。

`city_slug` 用 `VARCHAR(32) ascii_bin` + `CHECK` 白名单限定为 7 个城市，**不含 `all`**：`all` 是查询侧语义，不是数据取值。按已确认口径不建城市外键。

索引按仓库既有形态 `(等值列…, deleted_at, 排序列, id)` 建：`idx_attractions_hot`、`idx_attractions_rating`、`idx_attractions_new`、`idx_attractions_curated_*`。

### D3 种子数据写在 `schema.sql` 末尾

用固定 `public_id` + `INSERT IGNORE` 保证幂等，紧随建表语句之后。

- 理由：06 闸门每次 drop 重建 `wanderchain`，种子只有住在建表脚本里才能随重建一起恢复；也避免引入 `data.sql` 与 `spring.sql.init.data-locations` 这第二个真源。
- 代价：`schema.sql` 从纯 DDL 变成 DDL + 种子。文件头注释同步说明这一变化。
- 种子规模：12 条 `published` 覆盖 7 个城市 + 1 条 `draft`（用于验证「只呈现已发布」）。正文每条控制在 300 字符以内。

### D4 DTO 扁平，与 posts 域同构

三个 record：`AttractionListItemResponse`（11 字段）、`AttractionListResponse(items, total)`、`AttractionDetailResponse`（列表项 11 字段 + 详情 11 字段）。前端 `frontend/lib/contracts/attractions.ts` 三个同名 interface。

详情**不嵌套**列表项：`PostResponse` 与 `PostSummaryResponse` 已是扁平且字段重叠的先例，重复换来前端直接取字段、闸门直接比对；嵌套虽省 11 行，但会引入 `summary.` 前缀解构与「嵌套 record 是否在 knownRecords 里」的额外心智负担。

`rating` 用 `BigDecimal`（映射表里 → `number`），`publishedAt` / `verifiedAt` 用 `Instant`（→ `string`），`viewCount` 用 `long`。

### D5 独立错误码枚举

新增 `AttractionErrorEnum`：`ATTRACTION_NOT_FOUND`（404）、`ATTRACTION_COLLECTION_INVALID`（400）。不复用 `PostErrorEnum`——错误码是模块所有物，跨模块借用会在归档后形成隐式耦合，`PostErrorEnum` 头部注释也明确反对反向塞入。

### D6 前端数据通路：独立 API 客户端，Mock 契约层保留

- 新增 `lib/attractions/types.ts`（视图模型）与 `lib/attractions/attractions-api.ts`（同源 `/api` 取数，返回 `ListResult<Attraction>`）。
- `hot-attractions.tsx` 的取数从 `mockRepository.listHotAttractions` 换成 `attractionsApi.listHotAttractions`，`useSectionData` 与其加载/错误/空态原地不动；`hot-attractions.test.tsx` 的 mock 点随之换到 api 模块。
- 新增 `app/attractions/page.tsx`（Server Component 只解析 `city` 与 `searchParams`，内容交给客户端区块）与 `app/attractions/[publicId]/page.tsx`；两页都客户端取数，复用 `SectionLoading` / `SectionError` / `EmptyState`。
- 详情页找不到景点时展示英文空态与返回列表入口，不做重定向。

- 替代：把真实 IO 塞进 `HomeRepository`。否决：`HomeRepository` 是 Mock 契约层的实现，混入真实 IO 会让「用相同响应形状替换 Mock 仓储而组件不改」这条已归档要求失去判断力；`repository.test.ts` / `repository.sorting.test.ts` 也在断言这套 Mock 语义。

### D7 搜索页 `SearchHit` 用 `href` 表达可点性

`id: number` 换成 `key: string`，新增可选 `href?: string`：景点条目给 `href`，编辑推荐与帖子不给。渲染时 `href` 存在则输出 `<Link>`，否则保持 `<p>`。

- 替代：按 `kind` 做 discriminated union。否决：只为一个分组加链接就让三个渲染分支各自带类型，改动面远大于收益。

景点分组的数据源改为服务端 `await attractionsApi.listAttractions()`；失败时该分组 `items` 为空并标记不可用，其余分组照常输出。

### D8 首页入口透传城市

`feature-nav.tsx` 的 `LINK_ENTRIES` 从静态 `href` 改为「接受 `city` 的 href 计算」，`FeatureNav` 新增 `city` prop，由 `page.tsx` 传入。

### D9 文档与闸门同步

- 新增 `docs/specs/wanderchain/attractions-list.md`、`docs/specs/wanderchain/attractions-detail.md`，并登记进 `08-spec-doc-breakpoints.ps1` 的 `$pairs`（否则断点声明无人比对）。
- 改写 `docs/specs/wanderchain/homepage-u8-hot-attractions.md`（「不包含」与「数据来源」两节）与 `search-page.md`（条目可点、数据源）。
- `10-contract-check.ps1` 的 `$contractPairs` 追加 attractions 一组。
- `06-schema-check.ps1` 的 `wanderchain` 期望清单追加 `attractions` 表、新索引名与新 `CHECK` 名——加表不加期望等于这道闸门对新 DDL 视而不见。
- `openspec/specs/wanderchain-homepage/spec.md` 的 Purpose 仍写着「不依赖任何后端服务」，本次归档时需直接改写该文件（delta 不承载 Purpose）。

## Risks / Trade-offs

1. **种子进 `schema.sql` 后，`mvn test` 连的库里恒有 12 条景点** → 任何「总数等于 N」的断言都会随种子变动碎掉。缓解：景点相关测试只断言「返回条目满足给定条件」，不断言绝对总数，并用互不相同的测试 `public_id`。
2. **`schema.sql` 体积逼近 Windows 命令行上限**（06 闸门把整脚本作为单个 `-e` 参数传给 `mysql`，上限约 32k 字符）→ 缓解：种子 13 条、正文 ≤300 字符；若仍超限，拆出 `attractions-seed.sql` 并由 `06` 的 `Invoke-SqlFile` 一并执行（脚本已有该函数）。
3. **搜索页从零依赖变为依赖后端可达** → 缓解：景点分组失败降级缺席、页面仍 200，已写成 delta 场景；编辑推荐与帖子仍读本地数据。
4. **详情与列表两个 record 重复 11 个字段** → 缓解：接受重复，换取与 posts 同构的扁平契约；10 号闸门的双向字段比对正好兜住两侧漂移。
5. **两个页面都客户端取数** → 首屏有空白期，且详情页无服务端 SEO。缓解：复用既有骨架态，视觉上不突兀；SEO 不在本轮目标内，若后续需要，详情页改 Server Component 属于独立 change。
6. **榜单策展没有写入入口** → 成员只能靠种子或手工 `UPDATE`。缓解：本期榜单固定 3 个、成员由内容侧一次性录入；管理后台不在范围内。
