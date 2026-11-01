# U8 · 热门景点区块

| 项 | 值 |
|---|---|
| 单元编号 | U8 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 热门景点区块` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | 带 1:1 封面与评分的卡片网格，上限 5 条 |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；卡片只渲染 `nameEn`，城市只读 `cityNameEn`。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 景点卡片网格 | 1:1 封面 + 名称 + 城市与评分 + 浏览量 |
| 2 | 排序 | 按后端 `sortBy=hot` 的返回顺序渲染，组件不重排 |
| 3 | 只展示已发布 | 由后端保证（只返回 `published`、未删除、已核实的景点），组件不做状态过滤 |
| 4 | 城市过滤 | 当前城市 + 全城通用（`all`）；过滤条件交给后端查询参数 |
| 5 | 上限 5 条 | `attractionsApi.listHotAttractions` 固定传 `limit=5` |
| 6 | 评分展示 | 有评分时固定一位小数（`toFixed(1)`）；`null` 显示 `Not rated yet` |
| 7 | 浏览数格式化 | `formatCount`（`en-US` 千分位） |
| 8 | 三态 | 复用 U2 的 `SectionLoading` / `SectionError` / `EmptyState` |
| 9 | 封面图 | 固定 1:1，走 `next/image` + 自定义 loader 按响应式档位出图，懒加载，`alt="<name> cover"`；`coverUrl` 为空时渲染 1:1 占位块 |
| 10 | 卡片跳转 | 整卡 `<Link>` 到 `/attractions/{publicId}`，`publicId` 直接用作 React key |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 收藏、打卡、路线规划 | 未立项 |
| 评分交互（打分 / 评论） | 未立项，评分只读 |
| 景点标签、开放时间、门票 | 本区块不展示；详情页有，见 `attractions-detail.md` |
| 「共 N 条」总数展示 | 当前不展示（接口返回了 `total`，本区块不消费） |
| 分页 / 地图 | 未立项 |
| 详情页排版与内容 | `attractions-detail.md`（本区块只负责跳转） |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 景点数据 | **后端 API**（`attractionsApi.listHotAttractions`） | `GET /api/attractions?sortBy=hot&limit=5`（带城市时追加 `city=<slug>`），经同源 `/api` 代理转发；返回 `AttractionPage` |
| 当前城市 | **静态**（U2 传入的 `city` prop） | 组件不读 URL；`all` 是页面语义，不拼进查询参数 |
| 封面图 | 静态 URL（`images.unsplash.com`） | 由后端种子数据给出，1:1 展示；渲染前经自定义 loader 把宽度档位写进 `w` 参数；空串渲染占位块 |
| 失败与空页 | 组件内三态 | 接口失败 → `role="alert"`；返回 0 条 → 空态文案 |

### 1.4 与其他单元的关系

- **依赖**：U0（城市名与 `formatCount`）、U2（三态 + `useSectionData`）、`lib/attractions` 客户端（取数与字段搬运）
- **被依赖**：U2（挂载）、`attractions-detail`（卡片的跳转目标）
- **结论**：与 U6 同为「封面卡片网格」，但比例不同（4:3 vs 1:1）且多了评分字段；两者**不得**共用同一卡片组件，除非同时参数化比例与字段

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 渲染景点卡片**
- When 数据 `ready` 且非空
- Then 渲染卡片网格，数量 = `items.length` ≤ 5
- And 每张卡含封面、名称、城市 + 评分、浏览量

**S2 · 排序正确**
- When 后端按 `sortBy=hot` 返回一页
- Then 组件按返回顺序渲染
- And 组件自身不排序（首页不重排后端结果）

**S3 · 只展示已发布**
- Given 库中存在 `draft` / 已删除 / 未核实的景点
- Then 接口不会返回它们，本区块因此不出现它们
- And 组件内没有状态过滤逻辑（过滤职责在后端）

**S4 · 城市过滤**
- When `city='xian'`
- Then 请求带 `city=xian`，只展示该城市的已发布景点
- And `city='all'` 时不带 `city` 参数，展示全部城市

**S5 · 评分展示**
- When `rating = 4.25`
- Then 显示 `Rating 4.3`（`toFixed(1)` 四舍五入）
- And 评分只读，不可点击
- And `rating === null` 时显示 `Not rated yet`，不写成 `0.0`

**S6 · 浏览数格式化**
- When `viewCount = 38000`
- Then 显示 `38,000 views`；`viewCount = 860` 时显示 `860 views`

**S7 · 元信息拼接**
- When 景点在 `hangzhou`、评分 4.6
- Then 元信息行为 `Hangzhou · Rating 4.6`

**S8 · 切换城市重取**
- When `city` 变化
- Then 回到加载态并重新取数

### 2.2 异常路径

**S9 · 取数失败**
- When 仓储 reject
- Then 展示 `role="alert"` 的 `Popular attractions could not load. Please try again later.`
- And 不展示空态、不残留旧卡片

**S10 · 空结果**
- When 该城市无景点
- Then 展示 `Browse attractions in <city>.`

**S11 · 图片加载失败**
- When 封面 URL 失效
- Then 保留 1:1 占位，`alt="<name> cover"` 可读，布局不塌陷

**S12 · 评分边界**
- When `rating = 0` / `5` / `4.95` / `null`
- Then 分别显示 `0.0` / `5.0` / `5.0` / `Not rated yet`，不出现空值或 `NaN`

**S13 · 超窄屏（320px）**
- When 视口 320px
- Then 单列，封面保持 1:1，无横向滚动

**S14 · 快速切换城市**
- When 短时间内多次切换
- Then 只渲染最后一次结果，不出现新旧城市混排

**S15 · 跳转详情页**
- When 点击任意卡片
- Then 进入 `/attractions/{publicId}`
- And 整卡是一处链接（图片、名称、元信息都在同一个 `<a>` 里），不是只有标题可点

---

## 3. 数据结构

### 3.1 组件 Props

```ts
interface HotAttractionsProps {
  /** 当前城市，来自 U2 的 parseCity 结果；组件不解析 */
  city: CitySlug
}

export function HotAttractions({ city }: HotAttractionsProps): JSX.Element
```

| Prop | 类型 | 必填 | 约束 |
|---|---|---|---|
| `city` | `CitySlug` | 是 | 8 值闭集；不得在组件内二次归一化 |

### 3.2 依赖的数据类型

```ts
// frontend/lib/attractions/types.ts（字段与后端 DTO 同形，10 号闸门双向比对）
interface AttractionSummary {
  publicId: string       // ULID，用作 React key 与详情页路径
  nameEn: string         // 英文名称（界面唯一可读名称）
  nameCn: string         // 中文名称（内容资产，不渲染）
  city: string           // 城市 slug；后端 CHECK 保证落在白名单内
  coverUrl: string       // 后端 null 归一成空串
  rating: number | null  // null = 未知评分
  viewCount: number
  publishedAt: string
  freeEntry: boolean
  bookingRequired: boolean
  openOnMonday: boolean
}
```

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `nameEn` | 非空，1–6 个英文单词 | h3，允许换行 |
| `city` | 白名单 slug | `cityNameEn`（`all` → `All cities`）；白名单外原样展示 |
| `coverUrl` | 绝对 URL 或空串 | 1:1，`loading="lazy"`，`alt="<name> cover"`，经自定义 loader 按档位改写 `w`；空串渲染占位块 |
| `rating` | 0–5 的数字或 `null` | 有值时 `toFixed(1)` 前缀 `Rating `；`null` 为 `Not rated yet` |
| `viewCount` | 非负整数 | `formatCount` → `en-US` 千分位，后缀 ` views` |
| `publishedAt` | 合法 ISO | 不展示（排序由后端完成） |
| `publicId` | 26 位 ULID | React key；详情页路径 `/attractions/{publicId}` |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| eyebrow | `Places` |
| 标题 | `Popular attractions` |
| 区块说明 | `Ranked by views and publish time.` |
| 加载 | `Gathering attraction data…`（`role="status"`） |
| 错误 | `Popular attractions could not load. Please try again later.`（`role="alert"`） |
| 空态 | `Browse attractions in {cityNameEn(city)}.` |
| 元信息 | `{cityNameEn(city)} · Rating {rating.toFixed(1)}`；无评分时为 `{cityNameEn(city)} · Not rated yet` |
| 浏览量 | `{formatCount(viewCount)} views` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 卡片数 ≤ 5 且等于 `items.length`
- [ ] 每张卡含封面、名称、城市 + 评分、浏览量
- [ ] 元信息格式为 `{cityNameEn} · Rating 4.6`；无评分时为 `{cityNameEn} · Not rated yet`
- [ ] 评分固定一位小数；`4.25 → 4.3`、`5 → 5.0`、`null → Not rated yet`
- [ ] 浏览数按 `en-US` 千分位展示（如 `38,000 views`）
- [ ] 整卡是一个链接，指向 `/attractions/{publicId}`

### 4.2 数据规则

- [ ] 排序与城市过滤由后端完成，组件按返回顺序渲染、不重排
- [ ] `draft` / 已删除 / 未核实景点不会出现（由后端保证，组件无过滤逻辑）
- [ ] `city='all'` 时不拼 `city` 参数
- [ ] 取数走 `attractionsApi.listHotAttractions`，不直接读 `mock-data`

### 4.3 状态

- [ ] 加载态 `role="status"` 且文案一致
- [ ] 错误态 `role="alert"` 且文案一致，不残留旧卡片
- [ ] 空态文案含当前城市名，且不与错误态并存

### 4.4 图片与响应式

- [ ] 封面为 1:1；`alt="<名称>封面"`
- [ ] 封面走 `next/image`，带多档 `srcset`；`sizes` 为 `(max-width: 480px) calc(100vw - 64px), (max-width: 720px) calc(50vw - 40px), (max-width: 1080px) calc(33.33vw - 38px), (min-width: 1160px) 204px, calc(20vw - 29px)`
- [ ] 封面 `loading="lazy"` + `decoding="async"`
- [ ] `.cover` 含 `height: auto`（防 `aspect-ratio` 被宽高属性顶死）
- [ ] 图片失败时占位不塌陷
- [ ] 320px 视口无横向滚动；> 1080px 五列、≤ 1080px 三列、≤ 720px 两列、≤ 480px 单列

### 4.5 工程

- [ ] `data-section="hot-attractions"` 存在
- [ ] 组件不直接 import `mock-data` / `mockRepository`
- [ ] `hot-attractions.test.tsx` 覆盖 S1、S4、S5、S9、S10、S15
- [ ] `npx vitest run components/home/hot-attractions.test.tsx` 全绿
- [ ] `npm run build` 通过
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 文件首行 `'use client'`（使用 `useSectionData`）
- 取数：`useSectionData(() => attractionsApi.listHotAttractions({ city }), [city])`
- 评分无值时在渲染处写 `Not rated yet`，**不得**在数据层把 `null` 归一成 0
- 卡片整卡包一层 `<Link href={`/attractions/${publicId}`}>`；详情页已存在（见 `attractions-detail.md`），不得退回不可点

### 5.2 Tailwind CSS + shadcn/ui

**⚠ 现状：无 Tailwind、无 shadcn/ui**，样式在 `hot-attractions.module.css`（`.grid` / `.card` / `.cover` / `.body` / `.name` / `.meta` / `.views`）。

若引入后：

| 现状 | 目标 |
|---|---|
| `<ul className={styles.grid}>` + `<li className={styles.card}>` | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5` + `Card` |
| `.cover` 的 1:1 | `relative aspect-square w-full overflow-hidden` + `Image fill` |
| 评分文本 | `Badge`（只读展示），**不要**用 `Rating` 之类可交互组件 |
| 浏览量 | 纯文本，与 U7 保持同一套数字样式（`tabular-nums`） |

约束：U6 与 U8 卡片结构相似但比例与字段不同，**禁止**为了复用而把两者塞进一个万能卡组件；如需复用，须显式参数化 `aspect` 与 `metaRender`，并在两处验收清单里同时更新。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/home/hot-attractions.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 视口 | 列数 |
|---|---|
| `> 1080px` | 5 |
| `≤ 1080px` | 3 |
| `≤ 720px` | 2 |
| `≤ 480px` | 1 |

- 实现是 desktop-first：默认五列，用累进的 `max-width` 逐级收窄；间距恒为 `16px`，不随断点变化
- 与 U6 的列数断点不同（U6 以 900px 为界，本单元以 1080px 为界）。**不要**为「统一」而改动本单元的断点，除非两处同时验收
- 卡片 `min-width: 0`，防长名称撑破网格
- 封面容器 `aspect-ratio: 1 / 1` + `overflow: hidden` + `object-fit: cover`

### 5.4 图片（next/image）

**现状：已接入 `next/image` + 自定义 loader**（`frontend/lib/image-loader.ts`，与 U6 共用同一份实现）。loader 把档位宽度写进图片来源的 `w` 参数，请求直连图片 CDN，不经过 `/_next/image`，因此**不需要** `images.remotePatterns`。

约束：

- 封面必须带 `sizes` 与多档 `srcset`；`sizes` 按双层 `.wc-container` 的真实内容宽推导，见 §4.4
- 首屏以下保持 `loading="lazy"`，不得加 `priority`
- `alt` 必须为 `<name> cover`；封面承载内容语义，不可置空
- **历史坑**：`width`/`height` 属性 + CSS `aspect-ratio` 并存时，必须保留 `.cover { height: auto }`，否则 600×600 属性会把容器高度顶死，1:1 比例失效

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | `next/image` + 按档位出图 | 已接入（`lib/image-loader.ts` + `images.loader = 'custom'`） | 已解决 |
| 2 | 域名注册 | 不适用 | 自定义 loader 直连 CDN，不经过 `/_next/image` |
| 3 | 默认五列、`≤ 1080px` 三列、`≤ 720px` 两列 | 与 `hot-attractions.module.css` 一致 | 已核对；与 U6（以 900px 为界）不同，勿盲目统一 |
| 4 | 卡片可点击 | 已接入：整卡跳 `/attractions/{publicId}` | 与详情页单元同时生效 |
| 5 | 评分只读 | 纯文本，无交互；新增 `null → Not rated yet` | 一致 |
| 6 | 数据来自后端 | 已从 Mock 仓储切到 `attractionsApi.listHotAttractions` | 首页不再零网络请求 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 组件 | `frontend/components/home/hot-attractions.tsx` |
| 样式 | `frontend/components/home/hot-attractions.module.css` |
| 数据 | `frontend/lib/attractions/attractions-api.ts`（`listHotAttractions`） |
| 格式化 | `frontend/lib/home/format.ts`（`formatCount`） |
| 挂载 | `frontend/app/page.tsx` |
| 测试 | `frontend/components/home/hot-attractions.test.tsx` |

```powershell
cd frontend
npx vitest run components/home/hot-attractions.test.tsx
npm run build
cd ..
powershell -File harness\run-all.ps1
```
