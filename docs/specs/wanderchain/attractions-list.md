# 景点列表页与约束型榜单

| 项 | 值 |
|---|---|
| 单元编号 | 景点列表（`/attractions`） |
| 归属能力 | `wanderchain-attractions` |
| 对应主 spec | `### Requirement: 景点列表页先榜单后列表` 等 — [spec.md](../../../openspec/changes/add-wanderchain-attractions/specs/wanderchain-attractions/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以 delta spec 为准 |
| 单元性质 | 服务端解析城市 + 三个约束型榜单区块 + 完整列表，全部客户端取数 |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；榜单名、说明、徽标、三态文案全部是英文固定串。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 城市归一化 | `parseCity(params.city)`，与首页同一规则：缺失 / 空 / 白名单外一律回落 `all` |
| 2 | 三个约束型榜单区块 | `first-trip` / `no-booking` / `open-monday`，按此顺序渲染 |
| 3 | 榜单名与说明 | 固定英文串来自 `components/attractions/collections.ts`，不随城市或数据变化 |
| 4 | 榜单成员卡片 | 名称 + 城市与评分 + 浏览数 + 三个事实徽标，整卡链到 `/attractions/{publicId}` |
| 5 | 完整列表 | 单个区块、最多 50 条、默认按浏览数降序（后端默认） |
| 6 | 总数说明 | `Showing {items.length} of {total} published attractions.` |
| 7 | 三态 | 每个区块各自取数、各自承担加载 / 失败 / 空态，互不牵连 |
| 8 | 封面图 | 4:3，`next/image` + 自定义 loader 多档 `srcset`，`sizes` 与四列网格一致，懒加载 + 异步解码 |
| 9 | 封面缺失 | `coverUrl` 为 `null` 时渲染同比例占位块，布局不塌陷 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 城市切换控件 | 首页（`CitySwitcher`）；本页只读 `?city=`，不自造第二套控件 |
| 分页 / 无限滚动 | 未立项；超出 50 条只由 `total` 如实说明，不假装还有下一页 |
| 列表内排序切换 UI | 未立项；排序能力留在接口（`sortBy`），页面固定用默认 `hot` |
| 攻略正文 | 详情页 `/attractions/{publicId}` |
| 收藏、打卡、路线 | 未立项 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 榜单区块 | **真实接口** `GET /api/attractions?city=&collection=` | 经 `attractionsApi.listAttractions`，同源 `/api` 代理 |
| 完整列表 | **真实接口** `GET /api/attractions?city=&limit=50` | 同上 |
| 当前城市 | **服务端** `searchParams` → `parseCity` | 组件不读 URL |
| 封面图 | 接口返回的 `coverUrl` | 经 `lib/image-loader.ts` 出图，请求不经过 `/_next/image` |

### 1.4 与其他单元的关系

- **依赖**：`lib/contracts/attractions.ts`（字段契约）、`lib/attractions/*`（视图模型 + 客户端）、U0 的 `cityNameEn` / `formatCount`、U2 的 `SectionLoading` / `SectionError` / `EmptyState` / `useSectionData`
- **被依赖**：站点顶栏「Attraction guides」入口、首页热门景点（后续切到同一客户端）
- **结论**：卡片是**本页专用**组件；与首页 U8 卡片字段口径不同（多了三个事实列、4:3 而非 1:1），不得为了复用把两者塞进一个万能卡组件

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 区块顺序**
- When 访问 `/attractions`
- Then 依次出现 `data-collection="first-trip"`、`"no-booking"`、`"open-monday"`、`data-section="attraction-list"`，四个区块在同一容器内按此顺序

**S2 · 榜单只含策展成员**
- When 后端返回某榜单的成员
- Then 页面按返回顺序逐条渲染，组件自身不排序、不按徽标二次筛选

**S3 · 卡片事实徽标**
- When 成员 `freeEntry=true`、`bookingRequired=false`、`openOnMonday=true`
- Then 卡片显示 `Free entry`、`No booking needed`、`Open on Mondays` 三个徽标
- And 徽标只来自三个事实列，不按所在榜单另造说法

**S4 · 评分缺失**
- When `rating` 为 `null`
- Then 元信息显示 `{City} · Not rated yet`，不显示 `0.0`、`NaN` 或空值
- And `rating=4.25` 时显示 `Rating 4.3`（`toFixed(1)`）

**S5 · 数字口径**
- When `viewCount=12800`
- Then 显示 `12,800 views`（`en-US` 千分位）

**S6 · 城市参数**
- When 访问 `/attractions?city=beijing`
- Then 顶部说明与三个榜单、完整列表都带上北京范围，四个请求都带 `city=beijing`

**S7 · 全城范围**
- When 访问 `/attractions` 或 `/attractions?city=all`
- Then 四个请求都不带 `city` 参数，范围文案为 `across China`

**S8 · 总数说明**
- When 完整列表返回 `items.length=50`、`total=87`
- Then 显示 `Showing 50 of 87 published attractions.`，不显示「还有 37 条可加载」之类页面做不到的承诺

### 2.2 异常路径

**S9 · 单个榜单失败**
- When 某个榜单请求失败
- Then 该区块显示 `{榜单名} could not load. Please try again later.`（`role="alert"`）
- And 其它两个榜单与完整列表照常渲染

**S10 · 完整列表失败**
- When 列表请求失败
- Then 显示 `The attraction list could not load. Please try again later.`，三个榜单不受影响

**S11 · 空榜单**
- When 某榜单在当前城市下没有成员
- Then 显示 `No picks on this shortlist {scope} yet.`，标题与说明照常展示

**S12 · 空列表**
- When 当前城市没有任何已发布景点
- Then 显示 `No published attractions {scope} yet.`，不出现空白区域

**S13 · 非法城市**
- When 访问 `/attractions?city=atlantis`
- Then 按 `all` 展示，页面 200，不报错也不空白

**S14 · 封面缺失或失败**
- When `coverUrl` 为 `null` 或图片请求失败
- Then 容器保持 4:3 与渐变占位，正文位置不跳动

**S15 · 超窄屏（320px）**
- When 视口 320px
- Then 卡片单列，无横向滚动

---

## 3. 数据结构

### 3.1 组件 Props

```ts
// app/attractions/page.tsx（async server component）
interface AttractionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// components/attractions/collection-block.tsx（client）
interface CollectionBlockProps {
  collection: 'first-trip' | 'no-booking' | 'open-monday'
  title: string        // 固定英文榜单名
  blurb: string        // 固定英文说明
  city: CitySlug
}

// components/attractions/attraction-list.tsx（client）
interface AttractionListProps {
  city: CitySlug
}

// components/attractions/attraction-card.tsx（随客户端区块打包）
interface AttractionCardProps {
  attraction: AttractionSummary   // 11 个字段，不含任何详情专属文案
}
```

### 3.2 依赖的数据类型

```ts
// lib/attractions/types.ts
interface AttractionSummary {
  publicId: string
  nameEn: string
  nameCn: string
  city: string
  coverUrl: string         // 由契约的 string | null 归一为空串
  rating: number | null    // 未知评分保持 null，不兜成 0
  viewCount: number
  publishedAt: string
  freeEntry: boolean
  bookingRequired: boolean
  openOnMonday: boolean
}

interface AttractionPage {
  items: AttractionSummary[]
  total: number            // 不受 limit 约束的已发布总数
}
```

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `nameEn` | 非空 | `h3`，界面唯一可读名称；`nameCn` 不上屏 |
| `city` | 城市 slug | `cityNameEn`（白名单外原样显示，不猜中文名） |
| `coverUrl` | 绝对 URL 或空串 | 4:3，`alt="{nameEn} cover"`，空串走占位块 |
| `rating` | `0–5` 或 `null` | `Rating {x.x}` / `Not rated yet` |
| `viewCount` | 非负整数 | `formatCount` + ` views` |
| `publishedAt` | ISO 串 | 本页不展示，仅由后端参与排序 |
| `publicId` | 26 位 | React key + 卡片链接 |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| eyebrow | `Attractions` |
| 页面标题 | `Places worth the trip` |
| 页面说明 | `Three shortlists first, each answering one question that can block a trip: it is your first time in the country, you would rather not book ahead, or the only free day you have is a Monday. Every entry below has been checked {scope} before it was listed.` |
| 榜单名（固定） | `First time in China` / `No booking needed` / `Open on Mondays` |
| 榜单加载 | `Loading this shortlist…` |
| 榜单失败 | `{榜单名} could not load. Please try again later.` |
| 榜单空态 | `No picks on this shortlist {scope} yet.` |
| 列表标题 | `Every published attraction` |
| 列表说明 | `{cityLabel} · sorted by views by default, newest and best rated on request.` |
| 列表加载 | `Gathering attraction data…` |
| 列表失败 | `The attraction list could not load. Please try again later.` |
| 列表空态 | `No published attractions {scope} yet.` |
| 总数行 | `Showing {items.length} of {total} published attractions.` |
| 卡片元信息 | `{cityLabel} · Rating {x.x}` / `{cityLabel} · Not rated yet` |
| 卡片浏览数 | `{formatCount(viewCount)} views` |
| 卡片徽标 | `Free entry` / `Paid entry`；`Booking needed` / `No booking needed`；`Open on Mondays` / `Closed on Mondays` |

`{scope}` 取值：`all` → `across China`，具体城市 → `in {cityNameEn}`；`{cityLabel}`：`all` → `All cities`。

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 三个榜单区块出现在完整列表**之前**，且顺序为 `first-trip` → `no-booking` → `open-monday`
- [ ] 榜单名恰为 `First time in China` / `No booking needed` / `Open on Mondays`，不随城市变化
- [ ] 每榜都有非空英文说明
- [ ] 每张成员卡片含名称、城市 + 评分、浏览数、三个事实徽标
- [ ] 每张卡片链到 `/attractions/{publicId}`
- [ ] 页面可见文本不含中文字符（组件源文件里只允许中文注释）

### 4.2 数据规则

- [ ] 组件内没有排序与筛选逻辑，顺序完全由后端决定
- [ ] 四个取数各自独立：一个失败不影响其余三个
- [ ] `city=all` 与缺省都不向接口传 `city`
- [ ] 完整列表固定 `limit=50`，不自行分页
- [ ] `rating=null` 显示 `Not rated yet`，不显示 `0.0`

### 4.3 状态

- [ ] 加载态 `role="status"`，失败态 `role="alert"`
- [ ] 空榜单、空列表分别展示英文空态，不与错误态并存
- [ ] 失败态不残留上一城市的旧卡片

### 4.4 图片与响应式

- [ ] 卡片封面 4:3，`alt="{nameEn} cover"`
- [ ] 封面带多档 `srcset` 与 `sizes`（`sizes` 与四列网格对应）
- [ ] 封面 `loading="lazy"` + `decoding="async"`
- [ ] `coverUrl` 为空或图片失败时，容器保持 4:3 占位，正文不跳动
- [ ] 320px 视口无横向滚动

### 4.5 工程

- [ ] 城市参数只经 `parseCity` 归一化，页面不自造第二套白名单
- [ ] 页面 `lang` 为 `en`（由根布局保证）
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `npm run build` 通过
- [ ] `GET /attractions` 返回 200（`?city=beijing`、`?city=atlantis` 同样 200）

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- `app/attractions/page.tsx` 是 async server component：只解析 `searchParams` 与拼装区块，不取数据
- 取数全在客户端区块里：`useSectionData(() => attractionsApi.listAttractions({...}), deps)`
- 榜单区块与完整列表**各自**调用 `useSectionData`，靠 `deps` 的 `[city, collection]` / `[city]` 在切换城市时重取
- `searchParams` 可能缺失（直接以组件方式渲染时），按 `?? {}` 兜底，与首页一致

### 5.2 CSS Modules（无 Tailwind、无 shadcn/ui）

| 文件 | 职责 |
|---|---|
| `app/attractions/attractions.module.css` | 页面骨架、标题与导语；**不含任何 `@media`** |
| `components/attractions/attraction-collections.module.css` | 区块头、总数行、卡片网格与全部列数断点 |
| `components/attractions/attraction-card.module.css` | 卡片、封面、徽标；字号用 `clamp()` 缩放，**不含 `@media`** |

约束：颜色、圆角、阴影一律取 `--wc-*` 令牌；断点只在一个文件里出现，避免「文档对 A 文件、实现改了 B 文件」的漂移。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/attractions/attraction-collections.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 视口 | 列数 |
|---|---|
| `> 1080px` | 4 |
| `≤ 1080px` | 3 |
| `≤ 720px` | 2 |
| `≤ 480px` | 1 |

- 默认四列，用累进的 `max-width` 逐级收窄；间距恒为 `16px`
- 卡片 `min-width: 0`，防长名称撑破网格
- 封面 `aspect-ratio: 4 / 3` + `object-fit: cover`，并保留 `height: auto`，否则宽高属性会把容器顶死

### 5.4 图片（next/image）

- 自定义 loader（`lib/image-loader.ts`）把档位宽度写进图片来源的 `w` 参数，请求直连 CDN，不经过 `/_next/image`
- `sizes` 与四列网格一一对应：`(max-width: 480px) calc(100vw - 48px), (max-width: 720px) calc(50vw - 40px), (max-width: 1080px) calc(33.33vw - 40px), calc(25vw - 40px)`
- 首屏以下保持 `loading="lazy"`，不加 `priority`

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | 景点列表页 | 原为 `PlaceholderPage`，本次替换为真实页面 | 已解决 |
| 2 | 榜单与列表各自三态 | 复用 U2 的 `SectionLoading` / `SectionError` / `EmptyState` | 已解决 |
| 3 | 卡片可点 | 详情页在 `/attractions/{publicId}`；本页链接先于详情页落地 | 详情页未上线前该链接会 404，属预期的分阶段状态 |
| 4 | 本单元的前端单测与 E2E | 按 MVP 约定集中到第 7 组补齐 | 当前验证靠 `npm run build` + 真实 200 响应 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 页面 | `frontend/app/attractions/page.tsx` |
| 页面样式 | `frontend/app/attractions/attractions.module.css` |
| 榜单区块 | `frontend/components/attractions/collection-block.tsx` |
| 完整列表 | `frontend/components/attractions/attraction-list.tsx` |
| 卡片 | `frontend/components/attractions/attraction-card.tsx` |
| 区块与网格样式 | `frontend/components/attractions/attraction-collections.module.css` |
| 卡片样式 | `frontend/components/attractions/attraction-card.module.css` |
| 固定文案 | `frontend/components/attractions/collections.ts` |
| 数据客户端 | `frontend/lib/attractions/attractions-api.ts` |
| 视图模型 | `frontend/lib/attractions/types.ts` |

```powershell
cd frontend
npm run build
cd ..
powershell -File harness\checks\08-spec-doc-breakpoints.ps1
powershell -File harness\checks\10-contract-check.ps1
```

页面可用性（构建后）：

```powershell
cd frontend
npm run start -- -p 3210
# 另开一个终端
# GET http://127.0.0.1:3210/attractions → 200
```
