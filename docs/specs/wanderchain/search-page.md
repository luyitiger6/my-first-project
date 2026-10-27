# search-page · 站内搜索结果页单元

| 项 | 值 |
|---|---|
| 单元编号 | `search`（新增单元，不在原 U0–U8 序列内；承接首屏搜索框的提交） |
| 归属能力 | `wanderchain-search`（新能力） |
| 对应主 spec | [openspec/specs/wanderchain-search/spec.md](../../../openspec/specs/wanderchain-search/spec.md)（已归档，5 Requirement / 19 Scenario） |
| 关联单元 | `hero`（提交入口，见 `homepage-hero.md`） |
| 规格层级 | 人读契约（`docs/specs/`，草稿层），行为真相以主 spec 为准 |
| 现状 | 页面 `frontend/app/search/page.tsx`，样式 `frontend/app/search/search.module.css`，检索纯函数 `frontend/lib/search/query.ts` |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；结果标题、城市标与元信息只读英文字段，中文内容字段仍参与检索。

### 1.1 包含

| # | 功能 | 说明 |
|---|---|---|
| 1 | 查询参数解析 | 读 `q`，只取第一个值；缺失或只有空白 → 引导态 |
| 2 | 全量检索 | 直接扫 `lib/home/mock-data.ts` 的三个原始数组，不受首页 `*_LIMIT` 截断 |
| 3 | 发布态过滤 | 帖子与景点只收 `status === 'published'`，草稿与已删除不出现在结果里 |
| 4 | 匹配字段 | 编辑推荐 `title` / `titleEn` / `summary` / `summaryEn` / `editor` / `editorEn` / 城市中英文名；帖子 `title` / `titleEn` / `author` / `authorEn` / 城市中英文名；景点 `name` / `nameEn` / 城市中英文名。城市 slug 不单独参与匹配 |
| 5 | 分组 | 固定顺序 `Editor's picks` → `Posts` → `Attractions`，组内保持数据源顺序，只输出有命中的组 |
| 6 | 结果条目 | 英文标题 + 城市英文名 + 一条英文类型元信息；条目本身**不是**链接 |
| 7 | 分组回链 | 每组末尾回首页对应锚点：`/#editor-picks`、`/#hot-posts`、`/#hot-attractions` |
| 8 | 三态 | 引导态（无关键词）/ 空态（零命中）/ 结果态（有命中） |
| 9 | 站点框架 | 复用 `SiteHeader` / `SiteFooter`，全页唯一 `h1` |
| 10 | 响应式 | desktop-first，单一 `max-width: 720px` 断点做单列收窄 |

### 1.2 不包含

| 排除项 | 归属 | 理由 |
|---|---|---|
| 首屏搜索框本身 | `hero` | 提交在首页，结果在本页 |
| 城市筛选（`?city=`） | U5 `city-switcher` | 搜索结果覆盖全部城市，不继承首页筛选 |
| 搜索建议、历史、热门词 | 未立项 | 本期只做提交即跳转的真检索 |
| 结果条目详情页 | 未立项 | 条目暂不可点击，避免死链 |
| 分页、排序、二次筛选 | 未立项 | 全量数据量小，一屏可呈现 |
| 任何客户端请求 | — | Server Component 同步渲染，零 `fetch` |

---

## 2. 核心场景

> 格式：When（触发）/ Then（可观察结果）/ And（附加约束）

### 2.1 正常路径

**S1 · 引导态**
- When 访问 `/search`，或 `q` 只含空白
- Then 渲染 `Type the name of a city, a post or an attraction to search across everything.` 引导文案与回首页链接
- And 不渲染任何结果分组

**S2 · 三类同时命中**
- When 访问 `/search?q=成都`
- Then 分组顺序为 `Editor's picks` → `Posts` → `Attractions`，每组显示组名与条数
- And 顶部回显 `{N} results for “成都”.`

**S3 · 被首页截断的内容可见**
- When 搜索只出现在首页列表之外的内容（如 `沙面岛`、`回民街`、`后海村`）
- Then 结果中包含该条目
- And 检索不复用 `mockRepository.list*`（它们按首页上限截断）

**S4 · 关键词归一化**
- When 访问 `/search?q=%20%20chengdu%20%20`
- Then 页面回显 `chengdu`，结果与 `q=chengdu` 完全一致
- And 大小写不敏感（`Chengdu` 同样命中）；命中经由城市英文名 `Chengdu`，slug 不单独参与匹配 —— 英文名与 slug 不同形的 `xian` 零命中

**S5 · 分组回链**
- When 用户点击某组末尾的 `See ... on the homepage` 链接
- Then 跳到首页对应区块：`/#editor-picks`、`/#hot-posts`、`/#hot-attractions`
- And 三个区块的 `<section>` 带有对应 `id`

### 2.2 异常路径

**S6 · 零命中**
- When 访问 `/search?q=zzz`
- Then 渲染 `Nothing found for “zzz”.` 空态与回首页入口
- And 不渲染空的结果分组

**S7 · 草稿 / 已删除内容不可搜**
- When 搜索只存在于 `draft` 帖子或 `draft` / `removed` 景点中的文字
- Then 结果为 0 条
- And 不因「首页没显示」而误以为内容不存在

**S8 · 关键词含特殊字符**
- When `q` 含引号、尖括号等字符
- Then 页面按纯文本回显，不解析为 HTML
- And 不抛异常、不 500

**S9 · 超窄屏（320px）**
- When 视口宽度 320px
- Then 结果卡片内边距收窄，组头由「组名 + 条数」横排改为上下两行
- And 页面无横向滚动条

---

## 3. 数据结构

### 3.1 类型定义

```ts
// frontend/lib/search/query.ts
export type SearchKind = 'editor-pick' | 'post' | 'attraction'

export interface SearchHit {
  readonly id: number
  readonly title: string
  readonly city: CitySlug
  readonly cityLabel: string // city 为 all 时显示 `All cities`，否则为 `cityNameEn`
  readonly meta: string // 编辑署名 / 作者与评论数 / 评分与浏览量
}

export interface SearchGroup {
  readonly kind: SearchKind
  readonly heading: string
  readonly count: number
  readonly items: readonly SearchHit[]
  readonly anchorHref: string // /#editor-picks | /#hot-posts | /#hot-attractions
  readonly anchorLabel: string
}

export interface SearchOutcome {
  readonly query: string // 去首尾空白后的关键词，直接用于回显
  readonly total: number
  readonly groups: readonly SearchGroup[] // 只含有命中的组
}

export function searchContent(rawQuery: string): SearchOutcome
```

### 3.2 约束表

| 字段 | 类型 | 约束 | 违反时行为 |
|---|---|---|---|
| `query` | `string` | `rawQuery.trim()`，空串表示未提问 | 页面渲染引导态 |
| `total` | `number` | 等于各组 `items.length` 之和 | 顶部条数与分组不符 |
| `groups` | `SearchGroup[]` | 顺序固定，不含空组 | 出现 `0` 条的空分组 |
| `items` | `SearchHit[]` | 保持数据源顺序，不重排 | 结果顺序不可预期 |
| `anchorHref` | `string` | 必须是三个首页锚点之一 | 回链落到 404 或错位区块 |

### 3.3 页面契约

| 项 | 约定 |
|---|---|
| 渲染类型 | React Server Component，`async function SearchPage({ searchParams })`，不写 `'use client'` |
| 入参 | `searchParams: Promise<Record<string, string \| string[] \| undefined>>`，只取第一个值 |
| 数据来源 | `searchContent()` 一个纯函数；页面不直接读 `mock-data` |
| 状态 | 无 `useState` / `useEffect`；三态由 `query` 与 `total` 推导 |
| 副作用 | 无 `fetch` / `XHR` / `localStorage` |
| 元信息 | 导出 `metadata`（title `Search` + description），全页唯一 `h1` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 结构

- [x] 全页唯一 `h1`，文案 `Search the site`
- [x] 含 `SiteHeader`（`banner`）与 `SiteFooter`（`contentinfo`）
- [x] 每个分组是 `<section aria-labelledby>`，组名为 `h2`
- [x] 结果条目是 `li`，内部不含 `<a>`

### 4.2 交互

- [x] 引导态与空态各有回首页链接，`href="/"`
- [x] 三组回链分别指向 `/#editor-picks`、`/#hot-posts`、`/#hot-attractions`
- [ ] 键盘 Tab 顺序 = 视觉顺序；链接与组头有可见焦点环
- [ ] 回链锚点在首页确实存在对应 `id`

### 4.3 数据

- [x] 无 `q` 或 `q` 只含空白 → 引导态，无分组
- [x] `q=成都` → 三类命中，分组顺序 `Editor's picks` → `Posts` → `Attractions`
- [x] `q=chengdu` 与 `q=成都` 命中同一组结果（城市中文名与英文名都参与匹配）
- [x] `q=沙面岛` → 命中被首页上限截断的景点（中文内容字段仍可搜）
- [x] `draft` / `removed` 内容零命中
- [x] 关键词回显去首尾空白；`xian` 零命中（英文名 `Xi'an`，slug 不参与匹配）

### 4.4 响应式与无障碍

- [ ] 320px 宽下无横向滚动
- [ ] 720px 以下组头改上下排列，内边距收窄
- [ ] 正文与元信息对背景满足对比度 ≥ 4.5:1
- [ ] 空态与引导态不只靠颜色区分（有文本说明）

### 4.5 工程

- [x] 页面为 Server Component，无 `'use client'`
- [x] 打开页面期间零 `fetch`
- [x] `npx vitest run lib/search/query.test.ts app/search/page.test.tsx` 全绿
- [ ] `npm run build` 通过
- [ ] `powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 文件 `frontend/app/search/page.tsx`，`searchParams` 为 `Promise`，必须 `await`
- 不写 `'use client'`：三态在服务端一次算出，首屏即可见
- 复用 `next/link` 的 `<Link>` 做站内跳转；表单提交由首页原生表单完成

### 5.2 样式体系

- CSS Modules + `globals.css` 设计 token（`.wc-container` / `.wc-eyebrow`）；页面复用 `search.module.css`
- 颜色只用 `--wc-*` token，禁止新增十六进制字面量
- 结果条目为纯文本卡片，不引入图片，避免为不可点击的条目加载封面

### 5.3 响应式（desktop-first）

真相源：`frontend/app/search/search.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 内容列 `max-width: 860px`，分组卡片纵向排列，组头「组名 + 条数」横排 |
| `≤ 720px` | 卡片内边距收窄，组头改上下两行 |

- 分组卡片间距 `24px`；卡片内条目以虚线分隔
- 320px 下不得出现横向滚动

### 5.4 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | 存在 `/search` 路由 | 改版前无此路由 | 新增；同时在 08 闸门登记断点配对 |
| 2 | 检索扫原始数组 | 首页仓储按 `*_LIMIT` 截断 | 若复用仓储会漏掉截断内容，属功能缺陷 |
| 3 | 三个首页区块有 `id` | 改版前只有 `data-section` | 本轮补 `id`，供分组回链落地 |
| 4 | 有独立主 spec | 新能力，归档后生成 `openspec/specs/wanderchain-search/spec.md` | 归档前以 delta 形式存在 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 页面 | `frontend/app/search/page.tsx` |
| 样式 | `frontend/app/search/search.module.css` |
| 检索纯函数 | `frontend/lib/search/query.ts` |
| 测试 | `frontend/lib/search/query.test.ts`、`frontend/app/search/page.test.tsx` |
| 提交入口 | `frontend/components/home/hero.tsx`（`<form action="/search" method="get">`） |

```powershell
cd frontend
npx vitest run lib/search/query.test.ts app/search/page.test.tsx
npm run build
cd ..
powershell -File harness\checks\08-spec-doc-breakpoints.ps1
powershell -File harness\run-all.ps1
```
