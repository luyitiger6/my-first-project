# U2 · 首页骨架与区块编排

| 项 | 值 |
|---|---|
| 单元编号 | U2 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 首页骨架与区块编排` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | 页面装配层 + 区块公共基建。**除 U0 外所有单元的容器** |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；骨架只负责区块顺序与三态展示，不覆盖各单元的英文文案。

### 1.1 包含

| # | 能力 | 落点 |
|---|---|---|
| 1 | 根布局：`<html lang="en">`、跳过导航链接、两个 Provider | `app/layout.tsx` |
| 2 | 站点元数据：标题模板、描述、favicon | `layout.tsx` `metadata` |
| 3 | 首页装配：顶栏 → 首屏 → 五个区块 → 页脚 | `app/page.tsx` |
| 4 | 查询参数解析：`searchParams` → `city` + 单值 query 对象 | `parseCity` + `toQuery` |
| 5 | 区块错误边界：单区块渲染异常只降级自身 | `section-boundary.tsx` |
| 6 | 区块三态展示组件：加载 / 失败 / 空 | `section-state.tsx` |
| 7 | 区块数据加载 Hook：`loading / error / ready` 状态机 + 竞态防护 | `use-section-data.ts` |
| 8 | 区块标题与排序：五个区块的固定顺序与可见标题 | `page.tsx` |
| 9 | 区块锚点：`feature-nav / city-switcher / editor-picks / hot-posts / hot-attractions` | 各组件 `data-section` |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 首屏文案、CTA、统计面板 | **hero**（独立单元） |
| 顶栏导航项与账户区 | `site-header` + U1 |
| 页脚内容 | `site-footer` |
| 五个区块的内部实现 | U3 / U4 / U5 / U6 / U7 / U8 |
| 全局样式 token 定义 | `app/globals.css`（既有资产） |
| 真实数据获取、SSR 数据预取 | 未立项（区块均为客户端异步取 Mock） |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 当前城市 | **静态**（URL `?city=`） | 由 `parseCity` 归一化，缺省 `all` |
| 其余查询参数 | 静态（URL） | `toQuery` 只保留单值参数，数组取首项 |
| 区块内容 | **Mock 契约**（经 U2 Hook 调用 U0 仓储） | 本单元不直接 import `mock-data` |
| 真实首页聚合接口 | **需要 API（本期未接）** | 当前每个区块各自取数，未来可改为一次聚合 |

### 1.4 与其他单元的关系

- **依赖**：U0（类型与默认值）、U1（`AuthProvider`）、U4（`AiAssistantProvider`）
- **被依赖**：U3、U5、U6、U7、U8（全部由本单元挂载）、hero（占用首屏插槽）
- **结论**：U2 必须先于五个区块组件落地，否则插槽与公共三态不存在

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 五区块固定顺序**
- When 访问 `/`
- Then 页面内 `[data-section]` 的出现顺序恒为
  `feature-nav → city-switcher → editor-picks → hot-posts → hot-attractions`
- And 每个区块可见标题依次为 `Where to start` / `Pick a city first` / `Editor's picks` / `Trending posts` / `Popular attractions`

**S2 · 城市参数下发**
- When 访问 `/?city=beijing`
- Then 城市入口的 `Beijing` 为选中态（`aria-pressed="true"`）
- And 三个内容区块收到 `city='beijing'` 并以该城市请求数据

**S3 · 合法城市直达**
- When 访问 `/?city=chengdu&utm=x`
- Then `city='chengdu'`，其余单值参数保留在原 `query` 对象中供切换时沿用

**S4 · 页面框架完整**
- When 访问首页、`/search`、`/community` 或 `/attractions`
- Then 顶栏、页脚、浮动 AI 按钮、跳过导航链接均存在
- And 主内容区带 `id="main-content"`，跳过链接可直达
- And 登录、注册是独立品牌页，只保留跳过链接与主内容锚点，不套站点头尾

**S5 · 区块数据就绪**
- When 区块数据 resolve
- Then 状态由 `loading` 变为 `ready`，携带 `items` 与 `total`
- And 列表渲染，加载提示消失

### 2.2 异常路径

**S6 · 非法城市回落**
- When 访问 `/?city=atlantis`
- Then 城市归一化为 `all`，`All cities` 为选中态
- And 页面不报错、不出现空页面

**S7 · 单区块数据失败**
- When 任取数函数 reject
- Then 该区块展示 `role="alert"` 的错误文案 `<title> could not load. Please try again later.`（`title` 取英文区块名）
- And 其余区块正常渲染（顺序断言仍成立）

**S8 · 单区块渲染期异常**
- When 某区块组件在 render 阶段抛错
- Then `SectionBoundary` 捕获并只降级该区块
- And **不得**导致整页白屏；其余四个区块仍可见

**S9 · 空数据**
- When 区块返回 `{ items: [], total: 0 }`
- Then 展示空态文案，且不展示错误提示
- And 空态与错误态**不得同时出现**

**S10 · 城市切换触发重取**
- When `city` 发生变化
- Then 三个内容区块重新进入 `loading` 并各自重新取数
- And 城市未变化时不得重复取数（`deps` 必须稳定）

**S11 · 组件卸载与竞态**
- When 取数尚未 resolve 时区块被卸载或 `city` 再次变化
- Then 旧请求的结果被丢弃，不对已卸载组件 setState
- And 控制台无 "state update on unmounted component" 警告

**S12 · 数组型查询参数**
- When URL 含重复参数（如 `?city=beijing&city=shanghai`）
- Then `toQuery` 取首值 `beijing`，`parseCity` 同样按首值判定
- And 不因数组类型导致渲染异常

**S13 · 缺少 `searchParams`**
- When `searchParams` 为 `{}` 或 `Promise.resolve({})`
- Then 城市为 `all`，`query` 为空对象，页面正常渲染

---

## 3. 数据结构

### 3.1 类型定义

```ts
// app/page.tsx
type SearchParams = Record<string, string | string[] | undefined>

interface HomePageProps {
  /** Next.js 16：searchParams 为 Promise，必须 await */
  searchParams: Promise<SearchParams>
}

// components/home/section-boundary.tsx
interface SectionBoundaryProps { title: string; children: ReactNode }

// components/home/section-state.tsx
interface SectionLoadingProps { label: string }
interface SectionErrorProps { message: string }
interface EmptyStateProps { message: string }

// components/home/use-section-data.ts
type SectionState<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: T[]; total: number }

function useSectionData<T>(
  load: () => Promise<ListResult<T>>,
  deps: readonly unknown[],
): SectionState<T>
```

### 3.2 组件 Props 约束

| 组件 | Props | 约束 | 违反后果 |
|---|---|---|---|
| `HomePage` | `searchParams: Promise<SearchParams>` | 必须 `await`；不接受普通对象 | Next 16 运行期报错 |
| `SectionBoundary` | `title: string` | 非空，与区块可见标题一致（英文） | 错误文案变成 `undefined could not load…` |
| `SectionBoundary` | `children: ReactNode` | 必须为单个区块组件 | 边界粒度过粗，一处失败连带多区块 |
| `SectionLoading` | `label: string` | 非空英文短文，含省略号 | 空白加载态，屏幕阅读器读不到内容 |
| `SectionError` | `message: string` | 必须包含区块名 + 重试建议 | 用户无法判断哪块坏了 |
| `EmptyState` | `message: string` | 必须含当前城市名或下一步指引 | 空态像故障 |
| `useSectionData` | `load` | **必须内联箭头函数**或稳定引用；不得每次渲染新建依赖 | 无限重取 |
| `useSectionData` | `deps` | 决定重取时机的完整依赖集 | 少写 → 不刷新；多写 → 抖动 |

### 3.3 状态机

| 当前 | 事件 | 下一状态 | 副作用 |
|---|---|---|---|
| `loading` | resolve | `ready` | 写入 `items` / `total` |
| `loading` | reject | `error` | 无 |
| `ready` | `deps` 变化 | `loading` | 先清空旧数据，再取新数据 |
| `error` | `deps` 变化 | `loading` | 重试 |
| 任意 | 组件卸载 | — | 丢弃在途结果（`active = false`） |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 编排

- [ ] `[data-section]` 顺序恒为 feature-nav → city-switcher → editor-picks → hot-posts → hot-attractions
- [ ] 五个区块标题文案与 §2.1 S1 一致
- [ ] 顶栏、页脚、浮动 AI 按钮在首页、`/search` 与两个占位页可见；跳过链接在所有路由可见（英文文案）
- [ ] `/login`、`/register` 不套站点头尾，仅保留跳过链接与 `id="main-content"`
- [ ] 主内容区 `id="main-content"` 存在，跳过链接点击后聚焦到主内容

### 4.2 参数

- [ ] `/?city=beijing` 下 `Beijing` `aria-pressed="true"`
- [ ] `/?city=atlantis` 下 `All cities` 为选中态
- [ ] 重复参数 `?city=beijing&city=shanghai` 取首值，不报错
- [ ] 其余单值参数在切换城市后仍被保留
- [ ] 无 `searchParams` 时城市为 `all`

### 4.3 三态与隔离

- [ ] 加载中展示 `role="status"` 文案
- [ ] 数据失败展示 `role="alert"`，文案含区块标题
- [ ] 单区块失败不影响其余四个区块渲染
- [ ] 单区块 render 期抛错被 `SectionBoundary` 捕获，整页不白屏
- [ ] 空数据只展示空态，不与错误态并存
- [ ] 城市切换触发三个内容区块重新取数；城市不变时不重复取数
- [ ] 卸载后无 setState 警告

### 4.4 工程

- [x] `app/page.tsx` 内不再残留 hero 内联 JSX（已抽为 `<HomeHero />`，2026-10-27 完成）
- [ ] `page.tsx` 不直接 import `mock-data`
- [ ] `app/page.test.tsx` 覆盖 S1、S2、S6、S7
- [ ] `npx vitest run app/page.test.tsx` 全绿
- [ ] `npm run build` 通过（含 RSC / Client 边界检查）
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- `app/page.tsx`、`app/layout.tsx` 为 **Server Component**：不得加 `'use client'`，不得用 `useState` / `useEffect`
- Next.js 16 的 `searchParams` 是 `Promise`，**必须 `await`**；写成同步读取会在构建期报类型错、运行期取到 `undefined`
- `SectionBoundary` 必须是 **class 组件**（`getDerivedStateFromError`）；函数组件无法承担渲染期错误边界
- `section-state.tsx` 为纯展示组件，**不加** `'use client'`（无状态、无事件）
- `use-section-data.ts` 必须带 `'use client'`
- 锚点与顺序由 `data-section` 属性表达，测试以此断言，不依赖 DOM 层级

### 5.2 Tailwind CSS + shadcn/ui

**⚠ 现状：仓库无 Tailwind、无 shadcn/ui**，骨架使用 CSS Modules + `globals.css` 的 `wc-*` 工具类（`.wc-container` / `.wc-section-head` / `.wc-section-title` / `.wc-section-note` / `.wc-eyebrow`）。

若引入后：

| 现状 | 目标 |
|---|---|
| `.wc-container` 最大宽 + 居中 + 左右留白 | Tailwind `mx-auto w-full max-w-6xl px-4 sm:px-6` |
| `wc-container` 包裹的五段 `<div>` | `flex flex-col gap-16 sm:gap-24` |
| 区块头「eyebrow + 标题 + 说明」 | 无 shadcn 对应组件，用 Tailwind 组合；**不要**用 `Card` 包区块 |
| 加载 / 错误 / 空提示 | `Alert`（错误）+ `Skeleton`（加载），空态保留纯文本 |

约束：骨架层不得引入任何 shadcn 组件来「美化」区块标题，避免与各单元自身卡片样式冲突。

### 5.3 响应式（mobile-first）

| 断点 | 区块间距 | 容器内边距 |
|---|---|---|
| 默认（320–767px） | `48px` | `16px` |
| `≥768px` | `80px` | `24px` |
| `≥1024px` | `96px` | `32px` |

- 先写窄屏默认值，再用 `min-width` 覆盖；禁止 `max-width` 反写
- 容器最大宽固定，超出后居中留白，不得全宽拉伸
- 320px 下五区块纵向堆叠，无横向滚动

### 5.4 图片（next/image）

**本单元不渲染任何图片**。约束：

- 骨架层不得为区块加背景图或装饰图
- 若新增首屏以下的大图，须由对应单元实现，并在 `next.config.ts` 注册 `remotePatterns`（见 U6 / U8）

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | hero 为独立单元 | 已抽出为 `components/home/hero.tsx`（2026-10-27），`page.tsx` 仅剩 `<HomeHero />` | 本单元验收项「已抽为 `<HomeHero />`」已满足 |
| 2 | 错误边界只兜 render 期异常 | 已如此；异步失败由 `useSectionData` 处理 | 两套机制并存，勿混用 |
| 3 | 区块锚点用于测试 | 已用 `data-section` | 一致 |
| 4 | Tailwind 骨架 | CSS Modules + `wc-*` | 换栈会改所有区块容器的包装方式 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 页面装配 | `frontend/app/page.tsx` |
| 根布局 | `frontend/app/layout.tsx` |
| 错误边界 | `frontend/components/home/section-boundary.tsx` |
| 三态展示 | `frontend/components/home/section-state.tsx` |
| 数据 Hook | `frontend/components/home/use-section-data.ts` |
| 页面样式 | `frontend/app/home.module.css` |
| 测试 | `frontend/app/page.test.tsx` |

```powershell
cd frontend
npx vitest run app/page.test.tsx
npm run build
cd ..
powershell -File harness\run-all.ps1
```
