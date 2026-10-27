# U0 · 契约与 Mock 数据层

| 项 | 值 |
|---|---|
| 单元编号 | U0 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 契约与 Mock 数据层` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | 纯 TypeScript，**无 UI**。U2/U5/U6/U7/U8 全部以本单元为地基 |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；数据层同时保留中英文字段，界面只读英文字段。

### 1.1 包含

| # | 能力 | 落点 |
|---|---|---|
| 1 | 领域类型：城市、内容状态、三类内容实体、查询与列表结果 | `lib/home/types.ts` |
| 2 | 8 项城市表（`all` + 7 城）与默认值 | `lib/home/cities.ts` |
| 3 | 城市入参归一化：缺失 / 非法 / 数组 → `all` | `parseCity` |
| 4 | 城市 slug → 中文名 / 英文名 | `cityName` / `cityNameEn` |
| 5 | 列表上限常量：6 / 10 / 5 | `lib/home/repository.ts` |
| 6 | 仓储接口 `HomeRepository` 与 Mock 实现 | `mockRepository` |
| 7 | 城市过滤、排序、截断 + 总数统计 | 仓储内部 |
| 8 | Mock 数据集（精选 / 帖子 / 景点），含 `draft` 与脏数据 | `lib/home/mock-data.ts` |
| 9 | 数字与日期格式化 | `lib/home/format.ts` |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 任何真实网络请求、fetch、环境变量化 baseURL | 未立项 |
| 服务端数据库、持久化、缓存 | backend，未接入 |
| 分页游标 / 无限滚动 / 排序参数下发 | 未立项 |
| 组件的加载 / 错误 / 空三态渲染 | U2 |
| 城市切换的交互与 URL 改写 | U5 |
| 认证相关类型 | U1（`lib/auth/`） |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 城市表 | **静态**（编译期常量） | 8 项硬编码，不随城市切换变化 |
| 三类内容数据 | **Mock 契约**（内存数组） | 未来换真实 API 时只替换 `HomeRepository` 实现 |
| 真实 HTTP 接口 | **需要 API（本期未接）** | 三个列表接口待立项；本单元零网络请求 |
| 图片地址 | 静态字符串 | `https://images.unsplash.com/<photo-id>?...`，由私有 `cover()` 生成 |

### 1.4 与其他单元的关系

- **被依赖（全部）**：U2 骨架、U5 城市入口、U6 编辑推荐、U7 热门帖子、U8 热门景点
- **依赖**：无。本单元是整条链的最底层
- **结论**：U0 未冻结前，其他单元不得开工

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 城市入参归一化**
- When 传入 `'beijing'`
- Then 返回 `'beijing'`
- And 传入 `undefined`、`''`、`'atlantis'` 时一律返回 `'all'`

**S2 · 数组入参**
- When 传入 `['shanghai', 'beijing']`
- Then 取第一个元素判定，返回 `'shanghai'`
- And 空数组 `[]` 返回 `'all'`

**S3 · 城市过滤含通用内容**
- When 查询城市为 `beijing`
- Then 返回 `city === 'beijing'` 与 `city === 'all'` 两类内容
- And 查询城市为 `all` 时返回全部城市内容

**S4 · 三类内容的排序**
- When 调用 `listEditorPicks`
- Then 按 `sortOrder` 升序，并列按 `id` 升序
- When 调用 `listHotPosts`
- Then 按 `commentCount` → `viewCount` → `publishedAt` → `id` 依次降/升序（评论、浏览、时间降序，id 升序兜底）
- When 调用 `listHotAttractions`
- Then 按 `viewCount` → `publishedAt` → `id` 排序

**S5 · 截断与总数分离**
- When 匹配结果超过上限
- Then `items` 只含前 `limit` 条，`total` 仍等于**截断前**的匹配总数
- And 三个上限分别为 `EDITOR_PICKS_LIMIT=6`、`HOT_POSTS_LIMIT=10`、`HOT_ATTRACTIONS_LIMIT=5`

**S6 · 格式化**
- When `formatCount(20000)` → `'20,000'`；`formatCount(12345)` → `'12,345'`；`formatCount(999)` → `'999'`
- When `formatDate('2026-10-05T00:00:00Z')`
- Then 输出 `'Oct 5'`（`en-US` 口径，时区固定 `Asia/Shanghai`，不含年份）

### 2.2 异常路径

**S7 · 非法城市不抛错**
- When 传入 `'atlantis'` / `''` / `undefined`
- Then 静默回落 `'all'`，不抛异常、不打印错误

**S8 · 城市表无此 slug**
- When `cityName('unknown' as CitySlug)` 遇到未收录项
- Then 返回 `'全部'`（中文名兜底），不返回 `undefined`；`cityNameEn` 的兜底为 `'All cities'`

**S9 · 空结果**
- When 某城市无任何匹配内容
- Then 返回 `{ items: [], total: 0 }`，不是 `null`、不抛错

**S10 · 未发布内容被排除**
- When Mock 数据中存在 `status: 'draft'` 或 `'removed'` 的帖子 / 景点
- Then `listHotPosts` / `listHotAttractions` 结果中**不含**它们，且不计入 `total`
- And `listEditorPicks` 不做状态过滤（`EditorPick` 无 `status` 字段）

**S11 · 时间字段异常**
- When 某条 `publishedAt` 不是合法 ISO 字符串
- Then 排序不抛错（`Number.isNaN` 参与比较时按 0 处理），`formatDate` 对 Invalid Date 抛出 `RangeError`，视为数据缺陷，须由 Mock 数据修订而非代码兜底
- And 该条必须在 `mock-data.ts` 中修正，不允许在生产数据中留空

---

## 3. 数据结构

### 3.1 类型定义

```ts
export type CitySlug =
  | 'all' | 'beijing' | 'shanghai' | 'guangzhou'
  | 'chengdu' | 'xian' | 'hangzhou' | 'sanya'

export type ContentStatus = 'published' | 'draft' | 'removed'

export interface EditorPick {
  id: number; title: string; summary: string
  city: CitySlug; coverUrl: string; editor: string; sortOrder: number
}

export interface Post {
  id: number; title: string; author: string; city: CitySlug
  status: ContentStatus; commentCount: number; viewCount: number; publishedAt: string
}

export interface Attraction {
  id: number; name: string; city: CitySlug; coverUrl: string
  rating: number; viewCount: number; status: ContentStatus; publishedAt: string
}

export interface ListQuery { city: CitySlug }

export interface ListResult<T> { items: T[]; total: number }

export interface HomeRepository {
  listEditorPicks(query: ListQuery): Promise<ListResult<EditorPick>>
  listHotPosts(query: ListQuery): Promise<ListResult<Post>>
  listHotAttractions(query: ListQuery): Promise<ListResult<Attraction>>
}
```

### 3.2 字段约束

| 字段 | 类型 | 约束 | 违反后果 |
|---|---|---|---|
| `CitySlug` | 字符串联合 | 闭集 8 值，`'all'` 表示不限 | 编译期拒绝 |
| `ContentStatus` | 字符串联合 | 闭集 3 值 | 编译期拒绝 |
| `id` | `number` | 同类型内唯一、正整数 | 排序兜底失效，`key` 冲突 |
| `city` | `CitySlug` | 单值，不允许多城市 | 过滤失效 |
| `coverUrl` | `string` | 完整 URL，含协议；当前仅 `images.unsplash.com` | 图片裂图 |
| `sortOrder` | `number` | 可为负；越小越靠前 | 排序结果与预期相反 |
| `commentCount` / `viewCount` | `number` | 非负整数 | 展示出现负数或小数 |
| `rating` | `number` | 0–5，一位小数 | 展示 `toFixed(1)` 后越界 |
| `publishedAt` | `string` | 合法 ISO 8601 | 排序退化、日期显示 `NaN` |
| `ListResult.total` | `number` | **截断前**总数，`>= items.length` | 前端「共 N 条」判断错误 |

### 3.3 函数契约

| 函数 | 签名 | 契约 |
|---|---|---|
| `isCitySlug` | `(value: string) => value is CitySlug` | 纯类型守卫，不做 trim / 大小写归一 |
| `parseCity` | `(value: string \| string[] \| undefined) => CitySlug` | 数组取首元素；缺失或非法 → `DEFAULT_CITY` |
| `cityName` | `(slug: CitySlug) => string` | 未收录 → `'全部'` |
| `cityNameEn` | `(slug: CitySlug) => string` | 未收录 → `'All cities'`；界面只用这一个 |
| `mockRepository.*` | 见 3.1 | 均为 `async`，**同步 resolve**；永不 reject，除非 Mock 数据被破坏 |
| `formatCount` | `(value: number) => string` | `en-US` 千分位，不缩写成「万」 |
| `formatDate` | `(iso: string) => string` | `en-US` 的 `MMM D`，时区固定 `Asia/Shanghai`，不含年份 |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 类型与常量

- [ ] `CitySlug` 恰为 8 个值，且 `CITIES` 顺序为 `all`、`beijing`、`shanghai`、`guangzhou`、`chengdu`、`xian`、`hangzhou`、`sanya`（界面英文名依次 All cities → Beijing → Shanghai → Guangzhou → Chengdu → Xi'an → Hangzhou → Sanya）
- [ ] `ContentStatus` 恰为 `published` / `draft` / `removed`
- [ ] 三个上限常量分别为 6 / 10 / 5
- [ ] `HomeRepository` 三个方法签名与 3.1 一致，组件不直接引用 `mock-data`

### 4.2 行为

- [ ] `parseCity` 对 `undefined` / `''` / `'atlantis'` / `[]` 均返回 `'all'`
- [ ] `parseCity(['shanghai','beijing'])` 返回 `'shanghai'`
- [ ] 城市查询同时命中「本城」与「全城通用（`all`）」两类内容
- [ ] 三类排序与 S4 逐项一致，含并列时的 id 兜底
- [ ] `total` 为截断前总数，`items.length <= limit`
- [ ] `draft` / `removed` 的帖子与景点不出现且不计入 `total`
- [ ] 空结果返回 `{ items: [], total: 0 }`
- [ ] `formatCount(20000) === '20,000'`、`formatCount(12345) === '12,345'`、`formatCount(999) === '999'`
- [ ] `formatDate` 输出形如 `'Oct 5'`

### 4.3 工程

- [ ] 全模块零网络请求（`grep -r "fetch(" lib/home` 无结果）
- [ ] 无 `any`，无 `as unknown as`
- [ ] `cities.test.ts` + `repository.test.ts` 覆盖 S1–S11
- [ ] `npx vitest run lib/home` 全绿
- [ ] `npm run build` 通过
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 本单元为**纯 TypeScript 模块**，不导出任何 React 组件，不含 `'use client'`
- 必须可同时在 Server Component（`page.tsx`）与 Client Component（三个内容区块）中安全 import
- 禁止在模块顶层访问 `window` / `document` / `localStorage`
- 全部导出为具名导出（`export const` / `export function`），不用 `export default`

### 5.2 Tailwind CSS + shadcn/ui

**不适用**。本单元无样式、无 JSX。约束顺延为一条：本单元不得引入任何 CSS 文件或 className 常量，避免数据层与展示层耦合。

### 5.3 响应式（mobile-first）

**不适用**。本单元不产出布局。唯一相关约定：返回的 `items` 顺序即为展示顺序，组件不得再次排序。

### 5.4 图片（next/image）

本单元只产出 `coverUrl` 字符串，不渲染图片。约束：

- 必须是含协议的绝对 URL
- 当前唯一来源 `https://images.unsplash.com`；若新增域名，必须同步在 `next.config.ts` 的 `images.remotePatterns` 注册（详见 U6 / U8）
- 不得输出 data URI 或本地相对路径

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | `total` 为截断前总数 | 已实现（`paginate` 先计数后截断） | 一致 |
| 2 | 三层过滤（城市 + 状态 + 排序） | 已实现，精选不筛状态 | 一致 |
| 3 | 图片域名集中注册 | `next.config.ts` **无 `images` 段** | 换 `next/image` 时必须补 |
| 4 | 无真实 API | Mock 内存数组，`async` 同步 resolve | 换真实接口时组件不动，只换实现 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 类型 | `frontend/lib/home/types.ts` |
| 城市 | `frontend/lib/home/cities.ts` |
| 数据 | `frontend/lib/home/mock-data.ts` |
| 仓储 | `frontend/lib/home/repository.ts` |
| 格式化 | `frontend/lib/home/format.ts` |
| 测试 | `cities.test.ts`、`repository.test.ts` |

```powershell
cd frontend
npx vitest run lib/home
npm run build
cd ..
powershell -File harness\run-all.ps1
```
