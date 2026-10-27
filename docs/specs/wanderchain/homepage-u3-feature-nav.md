# U3 · 功能导航栏

| 项 | 值 |
|---|---|
| 单元编号 | U3 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 功能导航栏` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | 三张入口卡：两个路由跳转 + 一个打开 AI 助手面板 |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；下表与场景中的卡片标题、描述、动作文案一律以英文为准。

### 1.1 包含

| # | 卡片 | 形态 | 跳转 / 动作 |
|---|---|---|---|
| 1 | Travel community | `<Link>` | `/community` |
| 2 | Attraction guides | `<Link>` | `/attractions` |
| 3 | AI assistant | `<button>` | 调用 `useAiAssistant().open()`（不跳路由） |
| 4 | 区块外壳 | `<section data-section="feature-nav" aria-labelledby="feature-nav-title">` | — |
| 5 | 区块标题 | eyebrow `Explore` + h2 `Where to start` + 说明 `Three entrances covering three things: wander, look up, ask.` | — |
| 6 | 三个内联 SVG 图标（人像 / 地图针 / 火花） | `aria-hidden` + `focusable="false"` | 纯装饰 |
| 7 | 色调变体 | `green` / `sand` / `accent` 三套 | 仅视觉区分 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 顶栏导航（`Travel community` / `Attraction guides`） | `site-header` |
| AI 面板本体（遮罩、内容、关闭逻辑） | U4 |
| 社区页 / 景点页的实际内容 | `/community`、`/attractions` 占位页 |
| 卡片数据来自接口 | — | 三张卡为**静态配置**，不取数 |
| 未读角标、统计数字、推荐排序 | 未立项 |
| 图标库依赖（lucide 等） | — | 当前为手写内联 SVG |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 三张卡的标题 / 描述 / 动作文案 | **静态**（模块常量 `LINK_ENTRIES`） | 不随城市或登录态变化 |
| AI 面板开关 | 上下文（`useAiAssistant`） | 无网络请求 |
| 真实入口配置接口 | **需要 API（本期未接）** | 若未来由后台配置，需新增接口；本期零请求 |

### 1.4 与其他单元的关系

- **依赖**：U4 —— 必须能拿到 `useAiAssistant()`；U2 —— 由骨架挂载
- **被依赖**：无
- **结论**：U3 不能早于 U4 开工（否则 `open()` 不存在）；两者可以同一人先后做

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 三张卡渲染**
- When 首页加载
- Then 区块内恰有 3 个可交互单元，顺序为 `Travel community` → `Attraction guides` → `AI assistant`
- And 每张卡都含 图标、标题、描述、动作文案四要素

**S2 · 路由跳转**
- When 点击 `Travel community`
- Then 导航到 `/community`；点击 `Attraction guides` 导航到 `/attractions`
- And 两者均为 `<a href>`，支持中键 / 新标签页打开

**S3 · 打开 AI 面板**
- When 点击 `AI assistant` 卡
- Then 调用 `open()`，面板出现（`role="dialog"`）
- And 当前 URL **不变**，不产生历史记录

**S4 · 区块语义**
- When 屏幕阅读器读取
- Then 区块由 `aria-labelledby="feature-nav-title"` 命名，标题为 h2 `Where to start`
- And 三个图标被跳过（`aria-hidden="true"`），不朗读为图片

**S5 · 键盘操作**
- When 用 Tab 遍历
- Then 焦点依次落在 `Travel community` → `Attraction guides` → `AI assistant`
- And 每张卡有可见焦点环，Enter / Space 均可触发

### 2.2 异常路径

**S6 · 上下文缺失**
- When 组件在 `AiAssistantProvider` 之外渲染
- Then `useAiAssistant()` 抛出 `useAiAssistant must be used inside AiAssistantProvider`
- And 不允许静默失败（禁用按钮或空实现）

**S7 · 路由目标不存在**
- When 点击 `/community` 或 `/attractions` 而对应页面缺失
- Then 落到 404，而非白屏
- And 本单元**不负责**兜底，占位页由 U2 之外的站点框架提供

**S8 · 超窄屏（320px）**
- When 视口 320px
- Then 三张卡单列堆叠，卡片宽度 = 容器宽度，无横向滚动
- And 描述文案换行不截断（不使用 `line-clamp`）

**S9 · 长文案 / 翻译膨胀**
- When 某张卡描述超过两行
- Then 卡片高度由内容撑开，三卡高度无需强制对齐
- And 图标与标题不得被挤压变形

**S10 · 面板已打开时再次点击**
- When 面板已打开，用户再次点击 `AI assistant` 卡
- Then 不产生第二个面板实例（`isOpen` 幂等置 true）
- And 不抛错

---

## 3. 数据结构

### 3.1 组件 Props

```ts
// components/home/feature-nav.tsx
export function FeatureNav(): JSX.Element
```

| 项 | 值 |
|---|---|
| Props | **无**。三张卡为静态配置，刻意不接收 `city` / 登录态 / 数据 |
| 依赖上下文 | `useAiAssistant(): { isOpen: boolean; open: () => void; close: () => void }` |
| 导出 | 具名导出 `FeatureNav` |

### 3.2 内部条目契约

```ts
interface LinkEntry {
  key: string          // 唯一，用作 React key
  href: string         // 站内绝对路径，必须以 / 开头
  title: string        // 卡片标题，2–4 个英文单词
  description: string  // 一句话描述，约 10–16 个英文单词
  action: string       // 动作短语，2–4 个英文单词，展示为 `{action} →`
  tone: 'green' | 'sand'
  Icon: () => JSX.Element  // 内联 SVG，必须 aria-hidden
}
```

| 字段 | 约束 | 违反后果 |
|---|---|---|
| `key` | 唯一、非空 | React key 冲突 |
| `href` | `/community` / `/attractions` 二选一 | 死链 |
| `title` | 非空英文 | 卡片无名 |
| `description` | 非空，单行语义完整 | 文案截断后语义残缺 |
| `tone` | 闭集 2 值 | `styles[tone]` 取到 `undefined` |
| `Icon` | 返回 SVG，根节点含 `aria-hidden="true"` 与 `focusable="false"` | 屏幕阅读器朗读空图 |

### 3.3 与 AI 卡的差异

| 维度 | 前两张卡 | AI 卡 |
|---|---|---|
| 元素 | `<a>` / `<Link>` | `<button type="button">` |
| 行为 | 路由跳转 | 调用 `open()` |
| 键盘 | Enter 触发 | Enter + Space 触发 |
| 可访问性 | 原生链接语义 | 需 `aria-haspopup="dialog"`（由 U4 的触发器承担，本卡为普通按钮） |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 恰有 3 张卡，顺序为 `Travel community` → `Attraction guides` → `AI assistant`
- [ ] 三张卡标题、描述、动作文案与 §1.1 一致（动作文案带 `→`）
- [ ] 区块 eyebrow 为 `Explore`，h2 为 `Where to start`，说明文案一致
- [ ] 三处图标均为内联 SVG 且 `aria-hidden="true" focusable="false"`

### 4.2 交互

- [ ] `Travel community` `href="/community"`，`Attraction guides` `href="/attractions"`
- [ ] 点击 `AI assistant` 后出现 AI 面板，URL 不变化
- [ ] 三个入口 Tab 顺序 = 视觉顺序，焦点环可见
- [ ] AI 卡在面板已打开时重复点击不报错、不叠加面板

### 4.3 异常与响应式

- [ ] 无 `AiAssistantProvider` 时抛出明确错误，不静默降级
- [ ] 320px 下单列堆叠、无横向滚动、文案不截断
- [ ] 描述超过两行时卡片自然增高，图标不变形

### 4.4 工程

- [ ] `data-section="feature-nav"` 存在（U2 顺序断言依赖）
- [ ] 区块内无 `h1`（页面 h1 归 hero）
- [ ] `feature-nav.test.tsx` 覆盖 S1–S3、S6
- [ ] `npx vitest run components/home/feature-nav.test.tsx` 全绿
- [ ] `npm run build` 通过
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 文件首行必须有 `'use client'`（含 `onClick` 与上下文消费）
- 路由跳转必须用 `next/link` 的 `<Link>`；**禁止** `<a href>` 做站内跳转（会整页刷新）
- AI 卡必须是 `<button type="button">`，禁止用 `<div onClick>` 或 `<Link href="#">`
- 图标以内联 SVG 组件实现，不引入图标库依赖
- 不使用 `useRouter`：本单元不主动编程式导航

### 5.2 Tailwind CSS + shadcn/ui

**⚠ 现状：无 Tailwind、无 shadcn/ui**，样式在 `feature-nav.module.css`（`.grid` / `.card` / `.cardLink` / `.icon` / `.cardTitle` / `.cardText` / `.action` + `green` / `sand` / `accent` 变体）。

若引入后：

| 现状 | 目标 |
|---|---|
| `<li className={styles.card}>` | `Card`（`CardHeader` / `CardContent` / `CardFooter` 承载四要素） |
| `<Link className={styles.cardLink}>` | `Card` 内整卡可点：`<Link className="block h-full">` 或 `Button asChild` |
| AI 卡 `<button>` | `Button` variant=`default` + `asChild` 不适用（非链接），直接包 `<button>` |
| `tone` 三变体 | `class-variance-authority` 定义 `tone` 变体，禁止内联 style |

约束：整卡可点击时**不得**在卡内嵌套第二个可交互元素（否则 Tab 停在两层、点击语义冲突）。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/home/feature-nav.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 三列等宽 `grid-template-columns: repeat(3, minmax(0,1fr))`，`gap: 18px` |
| `≤ 900px` | 单列，三卡纵向堆叠，`gap` 仍为 `18px` |

- 实现是 desktop-first：默认三列，用 `max-width` 收窄到单列，不使用 `min-width` 提列
- 卡片作为 grid item 必须 `min-width: 0`，否则长文案撑破网格
- 图标 SVG 固定 22×22（容器 44×44），不随列宽缩放

### 5.4 图片（next/image）

**本单元无位图**。约束：

- 图标一律内联 SVG（矢量、可继承 `currentColor`），**不得**改用 PNG / JPG 图标
- 若未来换成位图插画，必须用 `next/image` 并声明固定宽高，避免布局抖动

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | Tailwind + shadcn Card | CSS Modules 手写卡片 | 换栈需重写整卡可点击的焦点样式 |
| 2 | 无 Props | 已如此 | 一致 |
| 3 | 依赖 U4 上下文 | 已通过 `useAiAssistant` 获取 | 一致；但 U3 与 U4 存在硬依赖 |
| 4 | 图标内联 SVG | 已如此（3 个手写 SVG） | 一致 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 组件 | `frontend/components/home/feature-nav.tsx` |
| 样式 | `frontend/components/home/feature-nav.module.css` |
| 依赖上下文 | `frontend/components/home/ai-assistant.tsx`（`useAiAssistant`） |
| 挂载 | `frontend/app/page.tsx`（嵌入 `<SectionBoundary title="功能入口">`） |
| 目标页 | `frontend/app/community/page.tsx`、`frontend/app/attractions/page.tsx` |
| 测试 | `frontend/components/home/feature-nav.test.tsx` |

```powershell
cd frontend
npx vitest run components/home/feature-nav.test.tsx
npm run build
cd ..
powershell -File harness\run-all.ps1
```
