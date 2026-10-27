# homepage-hero · 首页首屏单元

| 项 | 值 |
|---|---|
| 单元编号 | `hero`（不在原 U0–U8 序列内，排在 U2 骨架之后、内容区块之前） |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 首屏主视觉与站内搜索入口` — [openspec/specs/wanderchain-homepage/spec.md](../../../openspec/specs/wanderchain-homepage/spec.md)（已归档，12 Requirement / 50 Scenario） |
| 关联能力 | `wanderchain-search`（首屏搜索框的提交目标，见 `search-page.md`） |
| 规格层级 | 人读契约（`docs/specs/`，草稿层），行为真相以主 spec 为准 |
| 现状 | 组件 `frontend/components/home/hero.tsx`，样式 `frontend/components/home/hero.module.css`，由 `app/page.tsx` 以 `<HomeHero />` 挂载 |

---

## 1. 模块边界

### 1.1 包含

| # | 功能 | 说明 |
|---|---|---|
| 1 | 背景大图 | 全宽 `next/image` `fill` + `object-fit: cover`，`sizes="100vw"`、`priority`、`alt=""`，容器 `aria-hidden` |
| 2 | 遮罩层 | `.veil` 竖向 + 横向两段深色渐变，保证叠字对比度 |
| 3 | 底部渐变 | `.fade` 把大图过渡到 `--wc-sand`，与下一屏无缝衔接 |
| 4 | 眉标 | 固定文案 `wanderchain · 城市旅行指南`，颜色改用 `--wc-accent-soft` 以适配深色背景 |
| 5 | 主标题（h1） | 全页唯一 h1，`id="hero-title"`，文案「把想去的地方，走成一条能出发的路线。」 |
| 6 | 导语段落 | 由城市白名单派生的城市数 + 三类内容说明 |
| 7 | 站内搜索框 | 原生 `<form method="get" action="/search">`，输入 `type="search"` `name="q"` 必填，隐藏 `label` |
| 8 | 文字入口行 | `进入旅游社区` → `/community`、`查看景点攻略` → `/attractions`、`按城市逛 →` → `#cities` |
| 9 | 城市规模提示 | 「当前覆盖 N 座城市，每周由编辑重新走一遍。」N = 城市白名单中除 `all` 之外的数量 |
| 10 | 语义与无障碍 | `section[aria-labelledby="hero-title"]`、表单 `role="search"`、焦点可见、配色只用 `--wc-*` token |
| 11 | 响应式 | desktop-first：默认宽屏左对齐叠字，窄屏收窄留白、搜索框改纵向 |

### 1.2 不包含

| 排除项 | 归属 | 理由 |
|---|---|---|
| 顶部导航栏、logo、账户入口 | `site-header` / U1 | 站点框架，hero 之上 |
| 页脚 | `site-footer` | 同上 |
| 检索本身（匹配、分组、空态） | `wanderchain-search` | hero 只负责提交，不承载结果 |
| 城市切换的交互与状态 | U5 `city-switcher` | hero 只提供 `#cities` 锚点，不读也不写 `?city=` |
| 轮播、自动播放、背景视频、滚动视差 | 未立项 | 首屏不引入持续动效 |
| 统计面板 / 任何列表上限数值 | 已退役 | 由首屏改版删除，理由见 delta 的 REMOVED 段 |
| 任何数据请求（Mock 或真实 API） | — | 全部为编译期静态渲染，零网络 |
| 加载态 / 错误态 / 空态 | — | 静态区块无异步数据，不需要区块三态 |
| 登录态展示（头像、昵称） | U1 `account-menu` | 职责隔离 |

---

## 2. 核心场景

> 格式：When（触发）/ Then（可观察结果）/ And（附加约束）

### 2.1 正常路径

**S1 · 首屏渲染**
- When 访问 `/`
- Then 页面出现且仅出现 1 个 `h1`，文案为「把想去的地方，走成一条能出发的路线。」
- And 眉标、导语、城市规模提示文本与 §1.1 一致

**S2 · 背景大图出图**
- When 首屏渲染
- Then 背景图为 `<img>`，`alt` 为空、`sizes="100vw"`，带 `priority` 提示
- And 图片由自定义 loader 按宽度档位直接向 CDN 取图，不经过 `/_next/image`

**S3 · 搜索框提交**
- When 用户输入关键词并提交（回车或点击「搜索」）
- Then 浏览器以 GET 方式跳到 `/search?q=<关键词>`
- And 输入为空时被 `required` 拦在浏览器端，不产生空查询请求

**S4 · 文字入口**
- When 用户点击三个文字入口之一
- Then 分别跳转 `/community`、`/attractions`、滚动到 `id="cities"` 的元素
- And 锚点跳转不改变 URL 路径，不触发整页刷新

**S5 · 城市规模提示**
- When 城市白名单增减一座城市
- Then 提示中的数字随之变化，无需改动 hero 代码
- And 数字不含 `all`（筛选项不是城市）

**S6 · 城市切换不影响主视觉**
- When 访问 `/?city=beijing`
- Then 首屏文案、搜索框、文字入口、城市规模提示与无参数时完全一致
- And 城市语义只由下方城市入口与内容区块体现

### 2.2 异常路径

**S7 · 锚点目标缺失**
- When `#cities` 对应元素因下方区块渲染失败而消失
- Then 点击文字锚点不报错、不跳转错误页（浏览器按无目标处理）
- And 另两个文字入口仍正常工作，属于可接受的局部降级

**S8 · 超窄屏（320px）**
- When 视口宽度 320px
- Then 搜索框改为纵向（输入在上、按钮在下，按钮满宽）
- And 标题按 `clamp(36px, 5.6vw, 64px)` 缩到下限并自然换行，不截断、不省略
- And 页面无横向滚动条（`scrollWidth <= clientWidth`）

**S9 · 无客户端 JS / 慢网络**
- When 首屏 HTML 已到达但客户端 JS 尚未执行（或禁用）
- Then 眉标、标题、导语、搜索框、文字入口、城市规模提示全部可见
- And 表单可直接提交，不依赖 `useEffect` 才出现内容

**S10 · 系统偏好减少动效**
- When `prefers-reduced-motion: reduce`
- Then 组件内无位移 / 缩放 / 自动播放类过渡
- And 唯一允许的是颜色与透明度的 ≤150ms 变化

---

## 3. 数据结构

### 3.1 静态常量

```ts
// frontend/components/home/hero.tsx
const HERO_IMAGE = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?...'

/** 城市规模只从白名单派生：all 是筛选项，不是一座城市 */
const CITY_COUNT = CITIES.filter((city) => city.slug !== 'all').length
```

### 3.2 约束表

| 项 | 约束 | 违反时行为 |
|---|---|---|
| `CITY_COUNT` | 由 `CITIES` 派生，不得硬编码 | 城市白名单变更后提示数字失真 |
| 搜索参数名 | 固定 `q`，与 `/search` 页读取的键一致 | 检索页读不到关键词，恒为引导态 |
| 表单方法 | 固定 `method="get"` | 关键词进不了 URL，结果页无法被分享或刷新 |
| 背景图 `alt` | 空字符串 + 容器 `aria-hidden` | 装饰图被读屏播报，成为噪音 |

### 3.3 组件契约

| 项 | 约定 |
|---|---|
| 组件签名 | `export function HomeHero()`，无入参；不导出 `HeroStat` / `HomeHeroProps` |
| 渲染类型 | React Server Component，文件内**不得**出现 `'use client'` |
| 内部状态 | 无 `useState` / `useReducer` / `useEffect` |
| 副作用 | 无：不发请求、不读 `localStorage`、不读 `window` |
| 数据来源 | 仅 `CITIES`（`lib/home/cities.ts`）与两个常量 |
| 不接收 | `city`、`query`、`stats`、任何列表数据 |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 结构

- [x] 首屏存在且仅存在 1 个 `h1`，`id="hero-title"`，文案与 §1.1 一致
- [x] 区域以 `h1` 命名（`aria-labelledby="hero-title"`）
- [x] 背景图为 `<img>`，`alt=""`，`sizes="100vw"`
- [x] 页面不再出现「本期一览」统计面板，区域内无 `listitem`

### 4.2 交互

- [x] 搜索表单 `method="get"` + `action="/search"`，输入 `name="q"` 且 `required`
- [x] 文字入口 `href` 分别为 `/community`、`/attractions`、`#cities`
- [ ] 键盘 Tab 顺序 = 视觉顺序；输入框与按钮均有可见焦点环（`focus-within`）
- [ ] 点击任一入口不出现控制台报错

### 4.3 数据

- [x] 城市规模提示中的数字等于 `CITIES` 中非 `all` 的城市数
- [x] 组件不引用 `EDITOR_PICKS_LIMIT` / `HOT_POSTS_LIMIT` / `HOT_ATTRACTIONS_LIMIT`
- [x] 渲染期间零 `fetch`

### 4.4 响应式与无障碍

- [ ] 320px 宽下无横向滚动（`document.documentElement.scrollWidth <= clientWidth`）
- [ ] 900px 以下留白收窄、标题换行宽度放宽；600px 以下搜索框改纵向
- [ ] 白字压在遮罩上满足对比度（正文 ≥ 4.5:1，大标题 ≥ 3:1）
- [ ] `prefers-reduced-motion: reduce` 下无位移类过渡

### 4.5 工程

- [x] 组件文件内无 `'use client'`、无 `useState` / `useEffect`
- [x] 断点只使用 `max-width: 900px` 与 `max-width: 600px`，与 §5.3 一致
- [x] `npx vitest run components/home/hero.test.tsx app/page.test.tsx` 全绿
- [ ] `npm run build` 通过（TypeScript 类型检查 + RSC 边界检查）
- [ ] 无 `TODO` / `FIXME` / `.skip`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- Next.js `16` App Router，文件放 `frontend/components/home/hero.tsx`
- 默认 **Server Component**：不加 `'use client'`；不得使用 `useRouter`、`usePathname`、`useState`
- 站内跳转用 `next/link` 的 `<Link>`；纯页内锚点用原生 `<a href="#cities">`
- 搜索框是原生表单，靠浏览器导航完成跳转，不引入客户端状态或 `router.push`

### 5.2 样式体系

- CSS Modules + `globals.css` 设计 token（`.wc-container` / `.wc-eyebrow` / `.wc-button`）
- 颜色只用 `--wc-*` token；渐变允许 `rgba()` 透明度写法，禁止新增十六进制字面量
- 叠字必须在定位元素之上：`.inner` 显式 `position: relative`，否则会被遮罩盖住

### 5.3 响应式（desktop-first）

真相源：`frontend/components/home/hero.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 全宽大图 + 左对齐叠字，正文列 `max-width: 760px`，搜索框横排 |
| `≤ 900px` | 最小高度下调，标题换行宽度放宽，正文列取消宽度限制 |
| `≤ 600px` | 搜索框改纵向、按钮满宽，胶囊圆角降级为卡片圆角 |

- 标题 `clamp(36px, 5.6vw, 64px)`；导语 `max-width: 48ch`
- 首屏纵向留白 `padding-block: clamp(72px, 12vw, 132px) clamp(56px, 9vw, 104px)`
- 320px 下不得出现横向滚动

### 5.4 图片（next/image）

- 背景图用 `next/image` 的 `fill`，容器负责定位；禁止 CSS `background-image` 承载内容图
- `sizes="100vw"` + `priority`：首屏 LCP 元素优先加载
- 走 `next.config.ts` 的自定义 loader（`images.loader: 'custom'`），请求直达 Unsplash，故不需要 `remotePatterns`，也不产生 `/_next/image` 请求
- 纯装饰图 `alt=""` + 容器 `aria-hidden`，不占用读屏朗读

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | 首屏有背景大图 | 改版前为纯文字版式，无图 | 本轮新增；首次引入 LCP 图片，需关注加载体积 |
| 2 | 首屏有搜索框 | 改版前无搜索能力 | 与 `wanderchain-search` 同批落地，首个版本即真检索 |
| 3 | 无统计面板 | 改版前为四项 `*_LIMIT` 派生数字 | 删除属 BREAKING：`HeroStat` / `HomeHeroProps` 不再导出 |
| 4 | 有 Requirement 作为真相 | delta 为 REMOVED + ADDED（校验器不允许 MODIFIED 丢场景） | 归档后主 spec 中该 Requirement 改名为「首屏主视觉与站内搜索入口」 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 组件 | `frontend/components/home/hero.tsx` |
| 样式 | `frontend/components/home/hero.module.css` |
| 挂载点 | `frontend/app/page.tsx` 的 `<HomeHero />` |
| 常量来源 | `frontend/lib/home/cities.ts` |
| 提交目标 | `frontend/app/search/page.tsx`（见 `search-page.md`） |
| 测试 | `frontend/components/home/hero.test.tsx` + `frontend/app/page.test.tsx`（回归） |

```powershell
cd frontend
npx vitest run components/home/hero.test.tsx app/page.test.tsx
npm run build
cd ..
powershell -File harness\checks\08-spec-doc-breakpoints.ps1
powershell -File harness\run-all.ps1
```
