# 景点详情页

| 项 | 值 |
|---|---|
| 单元编号 | 景点详情（`/attractions/{publicId}`） |
| 归属能力 | `wanderchain-attractions` |
| 对应主 spec | `### Requirement: 景点详情页事实卡与缺失占位`、`### Requirement: 核实时间可见` 等 — [spec.md](../../../openspec/changes/add-wanderchain-attractions/specs/wanderchain-attractions/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以 delta spec 为准 |
| 单元性质 | 以 `publicId` 为唯一输入的只读页；客户端取一次详情，四种终态互斥渲染 |

---

## 1. 模块边界

界面语言：英文单语；唯一允许的中文字符是中文地址字段本身，它必须带一句英文用途标注。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 路由参数 | 路径段 `params.publicId` 原样交给取数层，不在页面里校验格式 |
| 2 | 标题区 | eyebrow `Attractions · Guide`、`h1` 用 `nameEn`、城市 + 评分 + 浏览数一行、核实时间一行 |
| 3 | 主图 | 3:2 容器；有封面走 `next/image`，无封面走同比例占位块 |
| 4 | 摘要 | `summaryEn` 有值才渲染，不占位 |
| 5 | 事实卡 | 门票、开放时间、预约、支付、英文地址、中文地址、交通、建议游览时长共八项 |
| 6 | 缺失占位 | 任一项为 `null` 时显示 `Not confirmed yet.`，不留空、不中断整页 |
| 7 | 中文地址用途 | 中文地址下方固定一行 `Show this to a taxi driver.` |
| 8 | 核实时间 | `Checked <Mon YYYY>`，例如 `Checked Aug 2026` |
| 9 | 正文 | `contentEn` 有值才渲染；无正文时不出现空标题 |
| 10 | 四态 | `loading` / `ready` / `not-found` / `error` 互斥；错误态可重试，空态给返回入口 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 城市参数 | 详情展示景点自身的城市，不读 `?city=` |
| 浏览次数自增 | 接口是只读的，本轮不做计数上报 |
| 收藏、打卡、评论、分享 | 未立项 |
| 相关景点推荐 | 未立项 |
| 服务端渲染正文 | 客户端取数（design D6 的已知代价：无 SEO） |
| 中文界面 | 只允许中文地址一项 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 详情 | **真实接口** `GET /api/attractions/{publicId}` | 经 `attractionsApi.detail`，同源 `/api` 代理 |
| 404 | 接口 404 或错误码 `ATTRACTION_NOT_FOUND` | 由 `isAttractionNotFound` 归一，渲染空态而非报错 |
| 封面图 | 接口返回的 `coverUrl` | 经 `lib/image-loader.ts` 出图，不经过 `/_next/image` |

### 1.4 与其他单元的关系

- **依赖**：`lib/contracts/attractions.ts`、`lib/attractions/{types,attractions-api}.ts`、U2 的 `SectionLoading` / `SectionError`、`cityNameEn`、`formatCount`、`formatMonth`
- **被依赖**：列表页卡片链接、后续首页热门景点与搜索页景点条目
- **结论**：卡片与详情头图是两套比例（4:3 与 3:2），不复用同一个图片组件；`AttractionFacts` 只服务本页

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 分项齐全**
- When 打开一条字段完整的景点详情
- Then 事实卡按「门票 → 开放时间 → 预约 → 支付 → 英文地址 → 中文地址 → 交通 → 建议游览时长」顺序出现八项，每项都有值

**S2 · 中文地址用途**
- When 详情页展示中文地址
- Then 该条目下方出现 `Show this to a taxi driver.`，页面其余文案仍为英文

**S3 · 核实时间**
- When 打开任一已发布景点
- Then 标题区出现 `Checked Sep 2026` 形式的文案，`<time datetime>` 为 `verifiedAt` 的日期部分

**S4 · 元信息口径**
- When `city=hangzhou`、`rating=4.9`、`viewCount=16700`
- Then 显示 `Hangzhou · Rating 4.9 · 16,700 views`
- And `rating=null` 时该段为 `Hangzhou · Not rated yet · 16,700 views`

**S5 · 主图出图**
- When 有 `coverUrl`
- Then 渲染 `<img>`，同时带多档 `srcset`、`sizes="(max-width: 720px) calc(100vw - 48px), 880px"`、`loading="lazy"`、`decoding="async"`，宽高为 1200×800

**S6 · 无封面**
- When `coverUrl` 为空串
- Then 渲染 3:2 占位块（`role="img"` + 英文 `aria-label`），正文位置不跳动

**S7 · 正文可选**
- When `contentEn` 有值
- Then 渲染 `The guide` 小节；为空时不出现该小节标题

### 2.2 异常路径

**S8 · 加载中**
- When 请求尚未返回
- Then 只显示 `Loading this attraction…`（`role="status"`），不显示空态或错误态

**S9 · 不存在**
- When 打开一个格式正确但不存在的 `publicId`
- Then `h1` 为 `Attraction not found`，说明为 `This attraction is not published, or it has been taken down. Browse the shortlists instead.`，并提供指向 `/attractions` 的 `Browse all attractions` 按钮
- And 页面不白屏、不出现框架错误页

**S10 · 接口失败**
- When 接口返回 5xx 或网络不可达
- Then `h1` 为 `This attraction could not load`，错误文案来自 `describeAttractionsError`（`role="alert"`），并提供 `Retry loading this attraction`

**S11 · 重试成功**
- When 点击重试且接口恢复
- Then 直接进入 `ready` 态，旧错误文案消失

**S12 · 快速切页**
- When 在首个请求返回前离开本页或切到另一个 `publicId`
- Then 旧请求被 abort，它的失败不写进当前页面状态

**S13 · 字段缺失**
- When `ticketInfoEn` 为 `null`
- Then 门票一项显示 `Not confirmed yet.`，其余七项照常展示

**S14 · 超窄屏（320px）**
- When 视口 320px
- Then 事实卡单列、无横向滚动

---

## 3. 数据结构

### 3.1 组件 Props

```ts
// app/attractions/[publicId]/page.tsx（async server component）
interface AttractionDetailPageProps {
  params: Promise<{ publicId: string }>
}

// components/attractions/attraction-detail.tsx（client）
interface AttractionDetailProps {
  publicId: string
}

// components/attractions/attraction-facts.tsx
interface AttractionFactsProps {
  detail: AttractionDetail   // 只读八项事实，不接收单独字段
}
```

### 3.2 依赖的数据类型

```ts
// lib/attractions/types.ts（详情 = 列表项 11 字段 + 详情 11 字段）
interface AttractionDetail extends AttractionSummary {
  summaryEn: string | null
  contentEn: string | null
  ticketInfoEn: string | null
  openingHoursEn: string | null
  bookingInfoEn: string | null
  paymentInfoEn: string | null
  addressEn: string | null
  addressCn: string | null
  transitEn: string | null
  suggestedDurationEn: string | null
  verifiedAt: string    // 列表中不出现，只在详情出现
}

// 取数状态：四个终态互斥，取消不算状态
type AttractionDetailState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: AttractionDetail; error: null }
  | { status: 'not-found'; data: null; error: null }
  | { status: 'error'; data: null; error: string }
```

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `nameEn` | 非空 | `h1`；`nameCn` 不上屏（界面英文） |
| `city` | 城市 slug | `cityNameEn`，白名单外原样显示 |
| `rating` | `0–5` 或 `null` | `Rating {x.x}` / `Not rated yet` |
| `viewCount` | 非负整数 | `formatCount` + ` views` |
| `verifiedAt` | ISO 串 | `Checked {formatMonth}`，只到月 |
| `summaryEn` / `contentEn` | 可空 | 为空则整块不渲染 |
| 八项事实字段 | 可空 | 为空则显示 `Not confirmed yet.` |
| `addressCn` | 可空 | 唯一允许的中文；附英文用途标注 |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| eyebrow | `Attractions · Guide` |
| 返回入口（顶部） | `← Back to all attractions` |
| 核实时间 | `Checked {Mon YYYY}` |
| 事实卡标题 | `What to know before you go` |
| 八项标签 | `Tickets` / `Opening hours` / `Booking` / `Payment` / `Address` / `Address in Chinese` / `Getting there` / `Suggested visit` |
| 缺失占位 | `Not confirmed yet.` |
| 中文地址标注 | `Show this to a taxi driver.` |
| 正文标题 | `The guide` |
| 免责说明 | `Details were checked in person. Prices, hours and booking rules change — re-check the official site before you travel.` |
| 加载 | `Loading this attraction…` |
| 不存在 | `Attraction not found` + `This attraction is not published, or it has been taken down. Browse the shortlists instead.` + `Browse all attractions` |
| 失败 | `This attraction could not load` + `Retry loading this attraction` |
| 无封面 | `{nameEn} has no cover image`（仅 `aria-label`） |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 事实卡固定八项且顺序稳定
- [ ] 每项缺失时显示 `Not confirmed yet.`，八项不会同时消失
- [ ] 中文地址下方有 `Show this to a taxi driver.`
- [ ] 标题区出现 `Checked <Mon YYYY>`
- [ ] 页面可见文本除中文地址外不含中文字符

### 4.2 数据规则

- [ ] 页面只请求 `GET /api/attractions/{publicId}`，不请求列表
- [ ] 城市来自景点自身字段，不读 `?city=`
- [ ] 404 与 5xx 走不同终态：前者空态、后者错误态可重试
- [ ] `rating=null` 显示 `Not rated yet`，不显示 `0.0`

### 4.3 状态

- [ ] 四态互斥，任一时刻只有一个可见
- [ ] 加载态 `role="status"`，错误态 `role="alert"`
- [ ] 空态提供返回 `/attractions` 的入口
- [ ] 组件卸载或切换 `publicId` 时旧请求被 abort，不写入已卸载状态

### 4.4 图片与响应式

- [ ] 主图 3:2，`alt="{nameEn} cover"`
- [ ] `srcset` 含多个宽度档位，`sizes` 与容器宽一致
- [ ] `loading="lazy"` + `decoding="async"`
- [ ] 无封面或加载失败时容器保持 3:2，正文不跳动
- [ ] 320px 视口无横向滚动

### 4.5 工程

- [ ] `npm run build` 通过且产物含 `/attractions/[publicId]`
- [ ] 已发布 `publicId` 返回 200；未知 `publicId` 同样 200（空态在客户端）
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- `app/attractions/[publicId]/page.tsx` 是 async server component：只 `await params` 与拼装站点框架
- 取数集中在 `useAttractionDetail(publicId)`：一个 `AbortController` + 一个 `attempt` 计数，重试即换计数
- 取消不写状态：清理函数先置 `active = false` 再 abort，`AbortError` 因此不会被展示成错误态
- `key={publicId}` 挂在客户端组件上，切换景点时组件重挂载，不复用上一条的状态

### 5.2 CSS Modules（无 Tailwind、无 shadcn/ui）

| 文件 | 职责 |
|---|---|
| `frontend/components/attractions/attraction-detail.module.css` | 详情页全部样式：标题区、主图、事实卡、正文；**唯一含 `@media` 的文件** |
| `frontend/app/attractions/attractions.module.css` | 由列表页复用，只提供 `.page` 外壳（无 `@media`） |

约束：颜色、圆角一律取 `--wc-*` 令牌（`--wc-ink`、`--wc-ink-soft`、`--wc-card`、`--wc-line`、`--wc-sand-deep`、`--wc-radius-md`、`--wc-radius-lg`）；`dt` / `dd` 的默认外边距必须清零，否则值会比标签内缩 40px。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/attractions/attraction-detail.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 视口 | 事实卡列数 |
|---|---|
| `> 720px` | 2 |
| `≤ 720px` | 1 |

- 两张卡片一行，间距恒为 `16px`；窄屏收成单列
- 卡片 `word-break: break-word`，长英文地址不撑破容器
- 主图容器 `aspect-ratio: 3 / 2` + `overflow: hidden`，图片 `height: auto`，宽高属性不会把容器顶死

### 5.4 图片（next/image）

- 自定义 loader（`lib/image-loader.ts`）把档位宽度写进图片来源的 `w` 参数，请求直连 CDN
- `sizes="(max-width: 720px) calc(100vw - 48px), 880px"`：容器最大 880px，窄屏等于视口减两侧留白
- 首屏以下保持 `loading="lazy"`，不加 `priority`

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | 景点详情页 | 本轮由占位页新建 | 已解决 |
| 2 | 详情页无 SEO | 客户端取数，服务端只出加载态 | design D6 的已知代价，改 Server Component 属独立 change |
| 3 | 浏览量不增长 | 详情为纯读接口 | 计数上报未立项 |
| 4 | 本单元的前端单测与 E2E | 按 MVP 约定集中到第 7 组补齐 | 当前验证靠 `npm run build` + 浏览器实测 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 路由 | `frontend/app/attractions/[publicId]/page.tsx` |
| 详情组件 | `frontend/components/attractions/attraction-detail.tsx` |
| 取数 Hook | `frontend/components/attractions/use-attraction-detail.ts` |
| 事实卡 | `frontend/components/attractions/attraction-facts.tsx` |
| 样式 | `frontend/components/attractions/attraction-detail.module.css` |
| 时间格式化 | `frontend/lib/home/format.ts`（`formatMonth`） |

```powershell
cd frontend
npm run build
cd ..
powershell -File harness\checks\08-spec-doc-breakpoints.ps1
```

页面可用性（构建后，需后端在 8989 可达）：

```powershell
cd frontend
npm run start -- -p 3210
# GET http://127.0.0.1:3210/attractions/{已发布 publicId} → 200 且渲染八项事实
```
