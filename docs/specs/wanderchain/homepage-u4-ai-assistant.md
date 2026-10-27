# U4 · AI 助手入口

| 项 | 值 |
|---|---|
| 单元编号 | U4 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: AI 助手入口` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | 纯前端占位：只有开关与焦点管理，**零网络请求** |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；触发按钮、面板标题、说明、能力清单与免责声明一律以英文为准。

### 1.1 包含

| # | 能力 | 落点 |
|---|---|---|
| 1 | 全局开关上下文：`isOpen` / `open` / `close` | `AiAssistantProvider` |
| 2 | 上下文读取，Provider 外使用时抛错 | `useAiAssistant` |
| 3 | 两个触发器：顶栏行内、右下角悬浮 | `AiAssistantTrigger variant="header" \| "floating"` |
| 4 | 模态面板：遮罩 + `role="dialog"` + `aria-modal="true"` + Tab 焦点陷阱 | 同文件 |
| 5 | 三种关闭方式：Esc、点遮罩、点关闭按钮 / `Got it` | 同文件 |
| 6 | 焦点管理：打开时聚焦关闭按钮、Tab / Shift+Tab 在面板内循环、关闭后焦点归还触发元素 | `restoreFocusRef` / `panelRef` |
| 7 | 面板内容：`Coming soon` 徽标、标题、说明、三条能力清单、免责说明 | 静态文案 |
| 8 | 触发按钮的无障碍属性：`aria-haspopup="dialog"` + `aria-expanded` | 两个触发器 |
| 9 | 背景滚动锁：打开期间 `body` 不可滚动，关闭或卸载时恢复原值 | 同文件 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 任何真实对话、流式响应、消息历史 | 未立项（需真实 LLM API） |
| 输入框、发送按钮、附件上传 | 未立项 |
| 会话持久化、多轮上下文 | 未立项 |
| 面板内的行程 / 预算等实际功能 | 未立项（仅文案列出） |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 面板全部文案 | **静态**（组件内字面量） | 不取数、不受城市影响 |
| 开关状态 | React 本地状态 | 不持久化，刷新后回到关闭 |
| 对话接口 | **需要 API（本期未接）** | 接入时须新增 U? 单元，不得在本单元内夹带 |

### 1.4 与其他单元的关系

- **依赖**：无（不依赖 U0 数据层）。仅依赖 React 与自身上下文
- **被依赖**：
  - U2 `layout.tsx` —— 包裹全站并挂载 `<AiAssistantTrigger variant="floating" />`
  - U3 功能导航 —— 第三张卡调用 `open()`
  - `SiteHeader` —— 挂载 `<AiAssistantTrigger variant="header" />`
- **结论**：U4 是最早可开工的单元之一，但**必须先于 U3 完成**

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 初始关闭**
- When 页面加载完成
- Then DOM 中不存在 `[role="dialog"]`，两个触发器的 `aria-expanded` 均为 `false`

**S2 · 悬浮按钮打开**
- When 点击右下角悬浮按钮
- Then 面板出现：`role="dialog"`、`aria-modal="true"`、`aria-labelledby="ai-assistant-title"`
- And 两个触发器的 `aria-expanded` 同步变为 `true`
- And URL 不变化、不新增历史记录

**S3 · 顶栏按钮打开**
- When 点击顶栏 `AI assistant`
- Then 打开同一个面板（与 S2 共享状态，不产生第二份实例）

**S4 · Esc 关闭并归还焦点**
- When 面板打开且焦点在面板内，按 `Esc`
- Then 面板关闭并从 DOM 移除
- And 焦点回到**打开前**的元素（悬浮按钮或顶栏按钮或 U3 的 AI 卡）

**S5 · 遮罩点击关闭**
- When 点击面板外的半透明遮罩
- Then 面板关闭，焦点同上归还

**S6 · 面板内点击不关闭**
- When 点击面板内部（标题、说明、能力清单空白处）
- Then 面板保持打开（事件被 `stopPropagation` 拦下）

**S7 · 点按钮关闭**
- When 点击右上角「×」或底部 `Got it`
- Then 面板关闭，焦点归还

**S8 · 打开时自动聚焦**
- When 面板打开
- Then 焦点落在关闭按钮（`aria-label="Close the AI assistant"`）
- And 屏幕阅读器会朗读对话框标题 `AI travel assistant`

**S15 · Tab 在面板内正向循环**
- When 面板打开且焦点在最后一个可聚焦元素（`Got it`）
- Then 按 `Tab` 后焦点回到第一个（关闭按钮）
- And 焦点不跑到遮罩后的页面

**S16 · Shift+Tab 在面板内反向循环**
- When 面板打开且焦点在第一个可聚焦元素（关闭按钮）
- Then 按 `Shift+Tab` 后焦点落到最后一个（`Got it`）

**S17 · 背景滚动锁定与恢复**
- When 面板打开
- Then `document.body.style.overflow` 为 `hidden`，遮罩后的页面不可滚动
- And 面板自身超出视口时面板内部可滚动（`.panel` 的 `max-height` + `overflow-y: auto`）
- And 关闭或组件卸载后，`overflow` 恢复为打开前的原值（原值为空字符串时也恢复为空字符串）

### 2.2 异常路径

**S9 · 上下文缺失**
- When `useAiAssistant()` 在 `AiAssistantProvider` 之外调用
- Then 抛出 `useAiAssistant must be used inside AiAssistantProvider`
- And 不允许返回默认空实现

**S10 · 重复打开**
- When 面板已打开时再次调用 `open()`
- Then 不产生第二个面板、不叠加遮罩，`isOpen` 保持 `true`

**S11 · 关闭后再打开**
- When 关闭后再次打开
- Then 焦点恢复链重新记录，`restoreFocusRef` 指向最新一次触发元素，不残留旧引用

**S12 · 触发元素已从 DOM 移除**
- When 关闭时记录的触发元素已不存在
- Then 焦点归还静默跳过，不抛错

**S13 · 服务端渲染**
- When 在无 `document` 的环境执行 `open()`
- Then `restoreFocusRef` 置 `null`，不抛 `ReferenceError`
- And 面板只在客户端交互后出现，SSR 首屏无遮罩

**S14 · 窄屏悬浮按钮**
- When 视口 320px
- Then 悬浮按钮可点击、`aria-label="Open the AI assistant"` 仍存在
- And 即使隐藏 `AI assistant` 文字，也不能变成无名按钮

---

## 3. 数据结构

### 3.1 类型定义

```ts
interface AiAssistantContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
}

export function useAiAssistant(): AiAssistantContextValue
```

### 3.2 组件 Props

| 组件 | Props | 类型 | 约束 |
|---|---|---|---|
| `AiAssistantProvider` | `children` | `ReactNode` | 必须包裹需要触发器的全部内容；全站只允许一处 |
| `AiAssistantTrigger` | `variant` | `'header' \| 'floating'` | 闭集 2 值；`floating` 由根布局挂载，`header` 由顶栏挂载 |
| `useAiAssistant` | — | — | 必须在 Provider 内；否则抛错 |

### 3.3 触发器契约

| variant | 元素 | 必填属性 | 文案 |
|---|---|---|---|
| `header` | `<button type="button">` | `aria-haspopup="dialog"`、`aria-expanded={isOpen}`、`data-testid="ai-header"` | 图标 + `AI assistant` |
| `floating` | `<button type="button">` | 同上 + `aria-label="Open the AI assistant"`、`data-testid="ai-floating"` | 图标 + `AI assistant`（窄屏仅图标） |

### 3.4 面板契约

| 项 | 值 | 约束 |
|---|---|---|
| 容器 | `<div data-testid="ai-overlay" onClick={close}>` | 遮罩层，点击关闭 |
| 对话框 | `<section role="dialog" aria-modal="true" aria-labelledby="ai-assistant-title">` | 内部点击 `stopPropagation` |
| 标题 | `<h2 id="ai-assistant-title">AI travel assistant</h2>` | id 必须与 `aria-labelledby` 一致；不得用 `h1` |
| 关闭按钮 | `aria-label="Close the AI assistant"` | 打开后作为初始焦点 |
| 能力清单 | 3 个 `<li>` | 纯文案，不可点击 |
| 免责说明 | `This is a front-end placeholder. It sends no requests.` | 必须保留，防止误解 |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 开关

- [ ] 初始无 `[role="dialog"]`，两触发器 `aria-expanded="false"`
- [ ] 顶栏与悬浮两个触发器打开同一个面板
- [ ] 面板打开时两触发器 `aria-expanded` 均为 `true`
- [ ] 重复调用 `open()` 不叠加面板
- [ ] 关闭后 `[role="dialog"]` 从 DOM 移除

### 4.2 关闭方式

- [ ] 按 `Esc` 可关闭
- [ ] 点击遮罩可关闭
- [ ] 点击「×」可关闭
- [ ] 点击 `Got it` 可关闭
- [ ] 点击面板内部不关闭

### 4.3 焦点与无障碍

- [x] 打开后焦点落在关闭按钮
- [x] Tab 在最后一个可聚焦元素上落回第一个
- [x] Shift+Tab 在第一个可聚焦元素上落回最后一个
- [x] 四种关闭路径（Esc / 遮罩 / × / 知道了）焦点都回到打开它的元素
- [x] 打开期间 `body` 不可滚动，关闭或卸载后恢复原值（含原值为空字符串）
- [x] 关闭后焦点回到打开它的元素
- [ ] 触发元素已移除时焦点归还静默跳过
- [ ] 对话框有 `aria-modal="true"` 与正确 `aria-labelledby`
- [ ] 悬浮按钮在窄屏隐藏文字后仍有 `aria-label`
- [ ] 面板内无 `h1`

### 4.4 工程

- [x] 全单元零网络请求（`grep -r "fetch(" components/home/ai-assistant.tsx` 无结果）
- [x] 无 Provider 时 `useAiAssistant` 抛错
- [x] 面板文案与 §3.4 一致（含免责说明）
- [x] `ai-assistant.test.tsx` 覆盖 S1–S9 与 S15–S17
- [x] `npx vitest run components/home/ai-assistant.test.tsx` 全绿
- [x] `npm run build` 通过
- [x] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [x] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 文件首行 `'use client'`（含 `useState` / `useEffect` / 事件）
- `Esc` 监听必须在 `useEffect` 内 `addEventListener`，并在清理函数中 `removeEventListener`
- 焦点处理只能用 ref + `focus()`，不得引入 `react-focus-lock` 等额外依赖（若引入须单独立项）
- 上下文用 `createContext` + `useCallback` + `useMemo`，不引入状态库
- Provider 必须挂在根布局，且 **`{children}` 在面板之前**渲染，保证 `open()` 的调用方是已挂载元素

### 5.2 Tailwind CSS + shadcn/ui

**⚠ 现状：无 Tailwind、无 shadcn/ui**，面板为手写 `overlay` / `panel` CSS Module。

若引入后，本单元是**收益最大**的替换点：

| 现状 | 目标 |
|---|---|
| 手写遮罩 + `role="dialog"` + `stopPropagation` | `Dialog` + `DialogContent`（Radix 自带遮罩与点击外部关闭） |
| 手写 `Esc` 监听 | Radix 内置，可删除自写监听 |
| 手写焦点归还 | Radix 内置 `onCloseAutoFocus` |
| **无焦点陷阱** | **Radix 自带**，补齐当前缺口 |
| 「×」按钮 | `DialogClose` + `Button variant="ghost" size="icon"` |

约束：换用 `Dialog` 后，`aria-expanded` 需改用 `DialogTrigger` 的 `data-state` 或显式保留状态；测试中 `getByTestId('ai-overlay')` 需同步改为 `getByRole('dialog')`。

### 5.3 响应式（mobile-first）

| 断点 | 面板 |
|---|---|
| 默认（320–767px） | 底部抽屉式：贴底、通栏、上圆角，最大高 `85vh` 内部滚动 |
| `≥768px` | 居中卡片：最大宽 `480px`，上下留白 `24px` |

- 悬浮按钮：`≥768px` 显示 `AI assistant` 文字 + 图标；窄屏仅图标（必须保留 `aria-label`）
- 悬浮按钮需避让安全区（`padding-bottom: env(safe-area-inset-bottom)`）
- 面板打开时不得引起页面横向滚动

### 5.4 图片（next/image）

**本单元无位图**。约束：

- 图标（火花）为内联 SVG，`aria-hidden="true" focusable="false"`
- 不得为面板加插图或背景图；若后续需要，走 `next/image` 并注册域名

### 5.5 与现状的差异（含已知缺口）

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | 模态对话框应限制 Tab 在面板内 | **已补**（`harden-ai-assistant-modal`）：手写 Tab / Shift+Tab 循环，运行期查询可聚焦元素 | 一致 |
| 2 | 打开时锁定页面滚动 | **已补**：保存并原样恢复 `body.style.overflow`；`.panel` 配 `max-height` + `overflow-y` 防内容被裁 | 一致 |
| 3 | Tailwind + shadcn | 手写 CSS Module | 换栈后 3 处自写逻辑可删 |
| 4 | 零网络请求 | 已满足，面板文案含免责声明 | 一致 |
| 5 | 焦点归还 | 已实现（`restoreFocusRef`） | 一致 |
| 6 | iOS Safari 滚动穿透 | **未处理**：仅用 `body.style.overflow = 'hidden'` | 真机遮罩后可能仍可触摸滚动；本次不处理，需真机验证 |

> 第 1、2 条已于 `harden-ai-assistant-modal` 中按「自写补齐」路线完成，未引入 shadcn Dialog（理由见该 change 的 design.md）。若后续整体换栈，替换点仍在 §5.2。
>
> `.panel` 的 `max-height` + `overflow-y: auto` 是滚动锁的**配套**，不是可选优化：`body` 锁死后面板自身若超出视口，内容会被裁在视口外且无法滚动。
>
> 第 6 条属已知未处理项：`body { overflow: hidden }` 在 iOS Safari 上可能出现滚动穿透（触摸滚动传递到背景）。本次不处理，需真机验证后再决定是否追加 `touch-action: none` 或 `position: fixed` 方案。

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 组件（Provider / Trigger / 面板） | `frontend/components/home/ai-assistant.tsx` |
| 样式 | `frontend/components/home/ai-assistant.module.css` |
| 挂载（Provider + 悬浮） | `frontend/app/layout.tsx` |
| 挂载（顶栏触发器） | `frontend/components/site/site-header.tsx` |
| 调用方 | `frontend/components/home/feature-nav.tsx`（第三张卡） |
| 测试 | `frontend/components/home/ai-assistant.test.tsx` |

```powershell
cd frontend
npx vitest run components/home/ai-assistant.test.tsx
npm run build
cd ..
powershell -File harness\run-all.ps1
```
