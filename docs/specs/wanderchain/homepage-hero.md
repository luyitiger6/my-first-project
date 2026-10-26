# homepage-hero · 首页首屏单元

| 项 | 值 |
|---|---|
| 单元编号 | `hero`（新增单元，不在原 U0–U8 序列内；落地建议插在 U2 骨架之后、内容区块之前） |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | **暂无**。主 spec 9 个 Requirement 中无 hero，当前由「首页骨架与区块编排」涵盖 |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。要成为行为真相，须另立 change 补 `### Requirement:` |
| 现状 | 首屏 JSX 内联在 `frontend/app/page.tsx` 第 47–97 行，样式在 `app/home.module.css` 的 `.hero` 系列 |

---

## 1. 模块边界

### 1.1 包含

| # | 功能 | 说明 |
|---|---|---|
| 1 | 眉标（eyebrow） | 固定文案 `wanderchain · 城市旅行指南`，非标题语义 |
| 2 | 主标题（h1） | 全页唯一 h1，文案「把想去的地方，走成一条能出发的路线。」 |
| 3 | 导语段落（lead） | 说明「七座城市，三种入口」与「内容来自本地 Mock 契约」 |
| 4 | 主 CTA | `进入旅游社区` → `/community` |
| 5 | 次 CTA | `查看景点攻略` → `/attractions` |
| 6 | 文本锚点 | `按城市逛 →` → `#cities`（原地滚动，不换路由） |
| 7 | 城市提示行 | 固定文案「当前城市会影响下方三类内容的范围。」 |
| 8 | 右侧统计面板 | 标题「本期一览」+ 四项数字：城市入口 / 编辑推荐 / 热门帖子 / 热门景点 |
| 9 | 语义与无障碍 | `section[aria-labelledby="hero-title"]`、`aside[aria-labelledby="hero-aside-title"]`、键盘可达、焦点可见 |
| 10 | 响应式布局 | mobile-first：窄屏单列堆叠，≥768px 双列（文案左、统计右） |

### 1.2 不包含

| 排除项 | 归属 | 理由 |
|---|---|---|
| 顶部导航栏、logo、账户入口 | `site-header` / U1 | 属站点框架，hero 之下 |
| 页脚 | `site-footer` | 同上 |
| 城市切换的交互与状态 | U5 `city-switcher` | hero 只提供 `#cities` 锚点，不读也不写 `?city=` |
| 搜索框、表单提交、联想下拉 | 未立项 | 本期产品无搜索能力 |
| 轮播、自动播放、背景视频、滚动视差 | 未立项 | 首屏不引入持续动效 |
| 背景大图 / 视觉插图资源 | 未立项 | 当前为纯文字版式；如后续新增，见 5.4 |
| 任何数据请求（Mock 或真实 API） | — | 四项数字全部由编译期常量推导，零网络 |
| 加载态 / 错误态 / 空态 | — | 静态区块无异步数据，不需要区块三态 |
| 登录态展示（头像、昵称） | U1 `account-menu` | 职责隔离 |

---

## 2. 核心场景

> 格式：When（触发）/ Then（可观察结果）/ And（附加约束）

### 2.1 正常路径

**S1 · 首屏渲染**
- When 访问 `/`
- Then 页面出现且仅出现 1 个 `h1`，文案为「把想去的地方，走成一条能出发的路线。」
- And 眉标、导语、城市提示行文本与 §1.1 一致

**S2 · 三个入口可用**
- When 用户点击主 CTA / 次 CTA / 文本锚点
- Then 分别跳转 `/community`、`/attractions`、滚动到 `id="cities"` 的元素
- And 锚点跳转不改变 URL 路径，不触发整页刷新

**S3 · 统计面板数据正确**
- When 未传入 `stats`
- Then 面板渲染四项，顺序为 城市入口 → 编辑推荐 → 热门帖子 → 热门景点
- And 四项数值分别等于 `CITIES.length`、`EDITOR_PICKS_LIMIT`、`HOT_POSTS_LIMIT`、`HOT_ATTRACTIONS_LIMIT`

**S4 · 调用方覆盖统计**
- When 传入合法的 `stats`（恰好 4 项、label 合法、value 为非负整数）
- Then 面板按传入顺序与数值渲染
- And 组件不修改传入数组（不排序、不 push）

**S5 · 城市上下文透传（不改 hero 结构）**
- When 访问 `/?city=beijing`
- Then hero 的文案、CTA、统计数字与无参数时完全一致
- And 当前城市仅由下方城市入口与内容区块体现，hero 不重复展示

### 2.2 异常路径

**S6 · `stats` 非法**
- When 传入 `[]`、3 项、5 项，或某项 `value` 为负数 / 非整数 / `NaN`
- Then 整组回退默认四项目，页面不报错、不抛异常
- And 不输出 `console.error`（测试环境无噪音）

**S7 · 锚点目标缺失**
- When `#cities` 对应元素因下方区块渲染失败而消失
- Then 点击文本锚点不报错、不跳转错误页（浏览器按无目标处理）
- And 主 CTA 与次 CTA 仍正常工作，属于可接受的局部降级

**S8 · 超窄屏（320px）**
- When 视口宽度 320px
- Then 单列堆叠：眉标 → 标题 → 导语 → 三个入口 → 提示行 → 统计面板
- And 标题按 `clamp(38px, 6vw, 62px)` 缩到下限并自然换行，不截断、不省略
- And 页面无横向滚动条（`scrollWidth <= clientWidth`）

**S9 · 无客户端 JS / 慢网络**
- When 首屏 HTML 已到达但客户端 JS 尚未执行（或禁用）
- Then 眉标、标题、导语、三个入口、统计面板全部可见且可点击
- And 组件不依赖 `useEffect` 才出现内容

**S10 · 系统偏好减少动效**
- When `prefers-reduced-motion: reduce`
- Then 组件内无位移 / 缩放 / 自动播放类过渡
- And 唯一允许的是颜色与透明度的 ≤150ms 变化

---

## 3. 数据结构

### 3.1 类型定义

```ts
// frontend/components/home/hero.tsx（新增）
export type HeroStatLabel = '城市入口' | '编辑推荐' | '热门帖子' | '热门景点'

export interface HeroStat {
  /** 展示用中文标签，必须是 HeroStatLabel 之一 */
  readonly label: HeroStatLabel
  /** 非负整数，0 合法；不显示小数与千分位 */
  readonly value: number
}

export interface HomeHeroProps {
  /**
   * 覆盖右侧统计面板。
   * 缺省：由 CITIES.length 与三个 *_LIMIT 常量推导，顺序固定。
   * 校验：必须恰好 4 项、严格按 S1 顺序、每项 value 为非负整数；任一不满足 → 整组回退默认。
   */
  readonly stats?: readonly HeroStat[]
}
```

### 3.2 约束表

| 字段 | 类型 | 必填 | 约束 | 违反时行为 |
|---|---|---|---|---|
| `stats` | `readonly HeroStat[]` | 否 | 长度 = 4，顺序固定，元素只读 | 整组回退默认值 |
| `stats[i].label` | `HeroStatLabel` | 是 | 四字或三字中文标签，闭集 | 整组回退默认值 |
| `stats[i].value` | `number` | 是 | `Number.isInteger(v) && v >= 0` | 整组回退默认值 |

### 3.3 组件契约

| 项 | 约定 |
|---|---|
| 组件签名 | `export function HomeHero(props: HomeHeroProps)`，默认导出不提供 |
| 渲染类型 | React Server Component，文件内**不得**出现 `'use client'` |
| 内部状态 | 无 `useState` / `useReducer` / `useEffect` |
| 副作用 | 无：不发请求、不读 `localStorage`、不读 `window` |
| 默认值来源 | `CITIES`（`lib/home/cities.ts`）、`EDITOR_PICKS_LIMIT` / `HOT_POSTS_LIMIT` / `HOT_ATTRACTIONS_LIMIT`（`lib/home/repository.ts`） |
| 不接收 | `city`、`query`、任何列表数据 —— 城市语义由 U5 与内容区块承担 |

> 默认值与现有的 `page.tsx` 内联实现逐项一致，抽取不得改变首屏可见内容。

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 结构

- [ ] 首屏存在且仅存在 1 个 `h1`，`id="hero-title"`，文案与 §1.1 一致
- [ ] 眉标、导语、城市提示行三段文本与 §1.1 逐字一致
- [ ] 统计面板为 `aside`，`aria-labelledby="hero-aside-title"`，标题为「本期一览」
- [x] 统计面板四项顺序为 城市入口 → 编辑推荐 → 热门帖子 → 热门景点

### 4.2 交互

- [x] 主 CTA `href="/community"`，次 CTA `href="/attractions"`
- [x] 文本锚点 `href="#cities"`，且页面中存在 `id="cities"` 元素
- [ ] 键盘 Tab 顺序 = 视觉顺序；所有可交互元素有可见焦点环
- [ ] 点击任一入口不出现控制台报错

### 4.3 数据

- [x] 默认四项数值分别等于 `CITIES.length`、`EDITOR_PICKS_LIMIT`、`HOT_POSTS_LIMIT`、`HOT_ATTRACTIONS_LIMIT`
- [x] 传入合法 `stats` 时按传入值渲染，且传入数组未被修改
- [x] 传入 `[]` / 3 项 / 5 项 / 含负数或小数时回退默认四项，无异常、无 `console.error`

### 4.4 响应式与无障碍

- [ ] 320px 宽下无横向滚动（`document.documentElement.scrollWidth <= clientWidth`）
- [ ] ≥768px 呈现双列（文案左、统计右），窄屏为单列堆叠
- [ ] 标题在 320px 下完整换行、不截断、不出现省略号
- [ ] `prefers-reduced-motion: reduce` 下无位移类过渡

### 4.5 工程

- [x] 组件文件内无 `'use client'`、无 `useState` / `useEffect`
- [x] `page.tsx` 中 hero 内联 JSX 已移除，改为 `<HomeHero />`，页面可见内容不变
- [x] hero 专属样式迁入 `hero.module.css`；`home.module.css` 中不再有 `.hero` 系列类
- [x] 新增 `components/home/hero.test.tsx`，覆盖 S1–S4、S6
- [x] `npx vitest run components/home/hero.test.tsx app/page.test.tsx` 全绿
- [ ] `npm run build` 通过（TypeScript 类型检查 + RSC 边界检查）
- [ ] 无 `TODO` / `FIXME` / `.skip`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- Next.js `16.4.3`、React `19.3.1`，App Router，文件放 `frontend/components/home/hero.tsx`
- 默认 **Server Component**：不加 `'use client'`；不得使用 `useRouter`、`usePathname`、`useState`
- 跳转一律用 `next/link` 的 `<Link>`；纯页内锚点可用原生 `<a href="#cities">`
- 不引入 `dynamic()`、`Suspense` 或任何异步数据获取；组件保持同步纯函数

### 5.2 Tailwind CSS + shadcn/ui

**⚠ 现状：仓库未安装 Tailwind 与 shadcn/ui**（`package.json` 依赖仅 `next` / `react` / `react-dom`；样式为 CSS Modules + `globals.css` 设计 token）。本节是**目标约束**，不是当前事实。

若按本节落地，前置条件（另立 change，不得在本单元内夹带）：

1. `package.json` 增 `tailwindcss` / `postcss` / `autoprefixer`，新增 `postcss.config.mjs`
2. `globals.css` 顶部加 `@import "tailwindcss"`，并把现有 `--wc-*` token 映射到 Tailwind 主题变量
3. `components.json` + `npx shadcn@latest init`，按需 `add button`
4. `04-frontend.ps1` 的 `npm ci → build → test` 三步链需重新验证一遍

目标写法（引入后）：

- 布局与间距用 Tailwind 工具类，不再新增 CSS Module
- 两个 CTA 用 shadcn `Button`，配合 `asChild` 包裹 `Link`，禁止手写 `<button>` + `onClick` 导航
- 颜色只能用 `globals.css` 的 `--wc-*` token 或其 Tailwind 映射，禁止出现十六进制字面量

**过渡期约定**：Tailwind 未引入前，本单元沿用 CSS Modules + `wc-*` 工具类（`.wc-container` / `.wc-eyebrow` / `.wc-button`）。**同一组件内不得混用两套方案**。

### 5.3 响应式（mobile-first）

| 断点 | 布局 |
|---|---|
| 默认（320–767px） | 单列：眉标 → 标题 → 导语 → 入口 → 提示行 → 统计面板 |
| `≥768px` | 双列 grid：文案 `1.35fr` / 统计 `1fr`，列间距 `clamp(28px, 5vw, 64px)` |
| `≥1024px` | 维持双列，仅增大留白，不新增第三列 |

- CSS 一律先写默认（窄屏）再写 `min-width` 断点，禁止 `max-width` 反写
- 标题 `clamp(38px, 6vw, 62px)`；导语 `max-width: 46ch`；标题 `max-width: 18ch`
- 首屏纵向留白 `padding-block: clamp(48px, 8vw, 92px) clamp(24px, 4vw, 44px)`
- 320px 下不得出现横向滚动；长文案必须 `overflow-wrap: break-word`

### 5.4 图片优化（next/image）

**现状：hero 无任何图片，`next/image` 在仓库中零使用。**

- 若本单元后续新增视觉图（背景图、插画、logo 位），**必须**用 `next/image`，禁止 `<img>` 与 CSS `background-image` 承载内容图
- 首屏图必须带 `priority`；其余 `loading="lazy"`
- `sizes` 必填，且与 5.3 的断点一致（例：`sizes="(min-width: 768px) 60vw, 100vw"`）
- 远程图需先在 `next.config.ts` 注册域名：

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.wanderchain.dev' }],
  },
}
```

- 静态装饰图（纯视觉、无信息）应设为 `alt=""` + `aria-hidden`，不占用无障碍朗读

### 5.5 与现状的差异（落地前必须知道）

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | Tailwind + shadcn/ui | 未安装，用 CSS Modules | 直接照做会与现有 8 个组件样式体系割裂 |
| 2 | `next/image` | 零使用，hero 无图 | 当前无适用对象；本条为未来约束 |
| 3 | hero 是独立单元 | 已抽出为 `components/home/hero.tsx` + `hero.module.css`（2026-10-27） | 一致；`page.tsx` 仅剩 `<HomeHero />` |
| 4 | 有 Requirement 作为真相 | change `extract-home-hero` 已补 ADDED「首页主视觉」，待归档后进入主 spec | 归档前真相仍以 delta 形式存在，本文档不直接改写主 spec |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 组件 | `frontend/components/home/hero.tsx`（新增） |
| 样式 | `frontend/components/home/hero.module.css`（新增，从 `app/home.module.css` 迁出 `.hero*`） |
| 挂载点 | `frontend/app/page.tsx` 第 47–97 行替换为 `<HomeHero />` |
| 默认值 | `frontend/lib/home/cities.ts`、`frontend/lib/home/repository.ts` |
| 测试 | `frontend/components/home/hero.test.tsx`（新增）+ `frontend/app/page.test.tsx`（回归） |

```powershell
cd frontend
npx vitest run components/home/hero.test.tsx app/page.test.tsx
npm run build
cd ..
powershell -File harness\run-all.ps1
```
