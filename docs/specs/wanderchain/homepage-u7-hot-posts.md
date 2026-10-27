# U7 · 热门帖子区块

| 项 | 值 |
|---|---|
| 单元编号 | U7 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 热门帖子区块` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | 带排名的有序列表，上限 10 条，**无图片** |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；卡片只渲染 `titleEn` / `authorEn`，城市只读 `cityNameEn`。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 帖子列表 | 排名 + 标题 + 作者/城市/日期 + 评论与浏览数 |
| 2 | 排名序号 | `01`–`10`，两位补零，`aria-hidden`（顺序由 `<ol>` 承担） |
| 3 | 排序 | 评论数 → 浏览数 → 发布时间 降序，`id` 升序兜底（由 U0 保证） |
| 4 | 只展示已发布 | `status === 'published'`，`draft` / `removed` 排除（由 U0 保证） |
| 5 | 城市过滤 | 当前城市 + 全城通用（`all`） |
| 6 | 上限 10 条 | `HOT_POSTS_LIMIT` |
| 7 | 数字与日期格式化 | `formatCount`（`en-US` 千分位）+ `formatDate`（`MMM D`） |
| 8 | 三态 | 复用 U2 的 `SectionLoading` / `SectionError` / `EmptyState` |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 帖子详情页与跳转 | 未立项（当前列表项不可点） |
| 发帖、评论、点赞 | 未立项 |
| 帖子封面 / 摘要 / 标签 | 当前数据模型无这些字段 |
| 「共 N 条」总数展示 | 当前不展示 |
| 分页 / 加载更多 | 未立项 |
| 按点赞数排序 | 数据模型无 `likeCount` |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 帖子数据 | **Mock 契约**（U0 `mockRepository.listHotPosts`） | 形状 `ListResult<Post>` |
| 当前城市 | **静态**（U2 传入的 `city` prop） | 组件不读 URL |
| 日期与计数格式 | 静态工具函数（`lib/home/format.ts`） | 纯函数，无副作用 |
| 热门帖子接口 | **需要 API（本期未接）** | 本期零网络请求 |

### 1.4 与其他单元的关系

- **依赖**：U0（类型 / 仓储 / 排序 / 格式化）、U2（三态 + Hook）、U5（间接：`city`）
- **被依赖**：U2（挂载）
- **结论**：与 U6 / U8 结构同源，可放在同一批实施；三者互不依赖

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 渲染列表**
- When 数据 `ready` 且非空
- Then 渲染有序列表，条目数 = `items.length` ≤ 10
- And 每条含排名、标题、作者、城市、发布日期、评论数、浏览数

**S2 · 排名序号**
- When 渲染第 1、2、10 条
- Then 排名依次显示 `01`、`02`、`10`（两位补零）
- And 排名元素 `aria-hidden="true"`，屏幕阅读器改由 `<ol>` 语义播报顺序

**S3 · 排序正确**
- When 数据乱序返回
- Then 按 `commentCount` 降 → `viewCount` 降 → `publishedAt` 降 → `id` 升
- And 组件自身不排序

**S4 · 只展示已发布**
- When Mock 中含 `draft` 与 `removed` 帖子
- Then 它们不出现，且不占排名位（排名连续为 01…N）

**S5 · 城市过滤**
- When `city='chengdu'`
- Then 只展示 `Chengdu` 与全城通用的已发布帖子

**S6 · 元信息拼接**
- When 帖子作者 `Traveler Zhou`、城市 `hangzhou`、日期 `2026-10-05`
- Then 元信息行为 `Traveler Zhou · Hangzhou · Oct 5`

**S7 · 计数格式化**
- When 浏览数为 `26000`
- Then 显示 `26,000 views`；评论数始终显示原值（如 `128 comments`）

**S8 · 切换城市重取**
- When `city` 变化
- Then 回到加载态并重新取数，排名从 `01` 重新开始

### 2.2 异常路径

**S9 · 取数失败**
- When 仓储 reject
- Then 展示 `role="alert"` 的 `Trending posts could not load. Please try again later.`
- And 不展示空态，不残留旧列表

**S10 · 空结果**
- When 该城市无帖子
- Then 展示 `Be the first to ask in <city>.`
- And 不展示错误提示

**S11 · 超长标题**
- When 英文标题超过 2 行
- Then 标题换行，排名与计数不被挤压，行高稳定
- And 不截断语义（不用 `line-clamp` 掩盖）

**S12 · 极端数值**
- When `viewCount=0` / `commentCount=0`
- Then 显示 `0 comments · 0 views`，不显示 `NaN` 或空白

**S13 · 超窄屏（320px）**
- When 视口 320px
- Then 排名 + 标题 + 计数纵向堆叠，无横向滚动

**S14 · 快速切换城市**
- When 短时间内多次切换
- Then 只渲染最后一次结果（`useSectionData` 竞态保护），不出现新旧城市混排

---

## 3. 数据结构

### 3.1 组件 Props

```ts
interface HotPostsProps {
  /** 当前城市，来自 U2 的 parseCity 结果；组件不解析 */
  city: CitySlug
}

export function HotPosts({ city }: HotPostsProps): JSX.Element
```

| Prop | 类型 | 必填 | 约束 |
|---|---|---|---|
| `city` | `CitySlug` | 是 | 8 值闭集；不得在组件内二次归一化 |

### 3.2 依赖的数据类型（U0）

```ts
interface Post {
  id: number
  title: string      // 中文标题（内容资产，不渲染）
  titleEn: string    // 英文标题（界面唯一可读标题）
  author: string     // 中文作者名（内容资产，不渲染）
  authorEn: string   // 英文作者名
  city: CitySlug
  status: ContentStatus
  commentCount: number
  viewCount: number
  publishedAt: string
}
```

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `titleEn` | 非空，2–12 个英文单词 | h3，允许换行 |
| `authorEn` | 非空，人名 | 元信息首位，**无前缀** |
| `city` | `CitySlug` | 显示 `cityNameEn`（`all` → `All cities`） |
| `publishedAt` | 合法 ISO | `formatDate` → `MMM D`（`en-US`） |
| `commentCount` | 非负整数 | **原值**展示，不做缩写 |
| `viewCount` | 非负整数 | `formatCount` → `en-US` 千分位 |
| `status` | 闭集 | 不展示；非 `published` 不进入列表 |
| `id` | 唯一正整数 | React key + 排序兜底 |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| eyebrow | `Trending` |
| 标题 | `Trending posts` |
| 区块说明 | `Ranked by comments, views and publish time.` |
| 加载 | `Measuring this week's buzz…`（`role="status"`） |
| 错误 | `Trending posts could not load. Please try again later.`（`role="alert"`） |
| 空态 | `Be the first to ask in {cityNameEn(city)}.` |
| 计数行 | `{commentCount} comments · {formatCount(viewCount)} views` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 条目数 ≤ 10，且等于 `items.length`
- [ ] 每条含排名、标题、作者、城市、日期、评论数、浏览数
- [ ] 排名从 `01` 起两位补零，连续无跳号
- [ ] 元信息格式为 `{authorEn} · {cityNameEn} · {MMM D}`
- [ ] 浏览数按 `en-US` 千分位展示（如 `26,000`）；评论数显示原值

### 4.2 数据规则

- [ ] 排序为评论数 → 浏览数 → 发布时间 降序，`id` 升序兜底
- [ ] `draft` / `removed` 帖子不出现且不占排名
- [ ] 城市过滤包含本城与全城通用
- [ ] 组件自身无排序与过滤逻辑

### 4.3 状态

- [ ] 加载态 `role="status"` 且文案一致
- [ ] 错误态 `role="alert"` 且文案一致，不残留旧列表
- [ ] 空态文案含当前城市名，且不与错误态并存

### 4.4 无障碍与响应式

- [ ] 列表使用 `<ol>`，条目使用 `<li>`
- [ ] 排名元素 `aria-hidden="true"`
- [ ] 320px 下堆叠、无横向滚动、标题换行不截断
- [ ] 极端值 0 正常渲染，不出现 `NaN`

### 4.5 工程

- [ ] `data-section="hot-posts"` 存在
- [ ] 组件不直接 import `mock-data`
- [ ] `hot-posts.test.tsx` 覆盖 S2–S4、S9、S10
- [ ] `npx vitest run components/home/hot-posts.test.tsx` 全绿
- [ ] `npm run build` 通过
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 文件首行 `'use client'`（使用 `useSectionData`）
- 取数：`useSectionData(() => mockRepository.listHotPosts({ city }), [city])`，`deps` 只写 `[city]`
- 列表必须用 `<ol>` / `<li>` 表达顺序语义，**禁止** `<div>` 列表或手动 `role="list"`
- 排名序号用 `String(index + 1).padStart(2, '0')` 生成，不引入格式化库
- 当前无详情页，禁止给条目套 `<Link>` 造死链

### 5.2 Tailwind CSS + shadcn/ui

**⚠ 现状：无 Tailwind、无 shadcn/ui**，样式在 `hot-posts.module.css`（`.list` / `.item` / `.rank` / `.content` / `.title` / `.meta` / `.stats`）。

若引入后：

| 现状 | 目标 |
|---|---|
| `<ol className={styles.list}>` | `divide-y` + `<ol>` 语义保留（**不要**换成 `Table`，帖子不是表格数据） |
| 单条 `<li>` | `grid grid-cols-[auto_1fr_auto] items-center gap-4` |
| `.rank` 序号 | `text-sm tabular-nums text-muted-foreground`（**必须** `tabular-nums` 防数字跳动） |
| 评论 / 浏览计数 | `Badge variant="outline"` 或纯文本，二者择一，同一区块内保持一致 |

约束：`shadcn` 无「有序列表」组件，本单元**不应**为套组件而改变语义结构；引入 Tailwind 后也须保留 `<ol>`。

### 5.3 响应式（mobile-first）

| 断点 | 布局 |
|---|---|
| 默认（320–767px） | 单列：排名 + 标题 + 元信息 + 计数纵向堆叠 |
| `≥768px` | 三栏：排名 `auto` / 内容 `1fr` / 计数 `auto`，单行不换行 |

- 计数列需 `white-space: nowrap`，避免 `128 comments · 26,000 views` 被拆成两行
- 标题列 `min-width: 0`，防长标题撑破三栏
- 数字统一 `font-variant-numeric: tabular-nums`，切换城市时宽度不跳动

### 5.4 图片（next/image）

**本单元无图片**（`Post` 模型无 `coverUrl`）。约束：

- 不得为了视觉丰富而给帖子加封面图：数据契约里没有该字段，加了就是凭空造数据
- 若未来 `Post` 新增 `coverUrl`，须同步改 U0 类型 + Mock 数据 + 本文件，并走 `next/image`（注册域名）

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | 无图片 | 已如此 | 一致 |
| 2 | 排序与状态过滤在仓储 | 已如此 | 一致，组件内无重复逻辑 |
| 3 | `tabular-nums` | 一致：`.rank` 原本已声明，`.stats` 于 2026-10-27 补齐 | 无 |
| 4 | 条目可点击 | 不可点（无详情页） | 与 spec 一致，勿擅自加链接 |
| 5 | Tailwind + shadcn | CSS Modules 手写 | 换栈须保留 `<ol>`/`<li>` 语义 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 组件 | `frontend/components/home/hot-posts.tsx` |
| 样式 | `frontend/components/home/hot-posts.module.css` |
| 数据 | `frontend/lib/home/repository.ts`（`listHotPosts`） |
| 格式化 | `frontend/lib/home/format.ts`（`formatCount` / `formatDate`） |
| 挂载 | `frontend/app/page.tsx` |
| 测试 | `frontend/components/home/hot-posts.test.tsx` |

```powershell
cd frontend
npx vitest run components/home/hot-posts.test.tsx
npm run build
cd ..
powershell -File harness\run-all.ps1
```
