# Design

## Context

`AiAssistantProvider` 是一个 `'use client'` 组件，用 Context 提供 `isOpen` / `open` / `close`，面板条件渲染在 overlay 内。现状（157 行）：

- 已有 `role="dialog"`、`aria-modal="true"`、`aria-labelledby`
- 打开时 `closeButtonRef.current?.focus()`，关闭时把焦点还给 `restoreFocusRef` 记录的触发元素
- `keydown` 监听**只处理 `Escape`**，没有 `Tab` 分支
- overlay 为 `position: fixed; inset: 0; z-index: 60`，`.panel` 为 `width: min(420px, 100%)`，**无 `max-height`**
- 测试环境为 vitest + jsdom，6 个既有用例全部走 `fireEvent`，没有焦点断言

约束：仓库不用 Tailwind、不用组件库、不新增依赖；`04-frontend.ps1` 跑的是 `npm ci → build → test`，所以每个 Scenario 都必须能在 jsdom 里断言，否则护栏会变成只在人脑里成立的规矩。

## Goals / Non-Goals

**Goals**：让 `aria-modal="true"` 的声明与键盘行为一致；把已实现但未记录的焦点行为写进规格；滚动锁不破坏超长面板的可用性。

**Non-Goals**：不实现真正的对话能力；不改视觉设计；不处理移动端滚动穿透的浏览器差异；不做焦点管理的通用抽象（只有一个模态，不为单例造框架）。

## Decisions

### D1 手写 Tab 循环，不用原生 `<dialog>` + `showModal()`

原生 dialog 在浏览器里免费提供焦点陷阱、滚动锁与 top layer，是最省事的方案。但 jsdom 至今未完整实现 `showModal()`，一旦改用，本次 6 个 Scenario 里至少 4 个无法在 `npm run test` 中断言，只能靠人工点检 —— 这与"完成判定只看退出码"直接冲突。

被否：`<dialog>` + `showModal()`（测试不可覆盖）、Radix UI `Dialog`（引入依赖，与仓库无组件库的现状冲突，且为一个组件引入整套 primitive 不划算）。

### D2 不用 `inert` 包住页面容器

`inert` 语义上最干净：把背景标为 inert，浏览器自动拒绝聚焦。但需要为整棵页面树加一层 wrapper（`AiAssistantProvider` 的 `children` 就是整个应用），改动面远大于收益；且 jsdom 中 `inert` 不参与可聚焦性计算，断言会假绿。

### D3 可聚焦元素运行期查询，不写死 ref 列表

面板当前只有"关闭"与"知道了"两个按钮，写死两个 ref 最省事。但真接上对话能力后必然新增输入框与发送按钮，写死的 ref 列表会静默漏掉新控件，表现为"Tab 卡在旧元素上"——这种 bug 不会被任何现有测试发现。

选择器采用通行集合：

```
a[href], button:not([disabled]), input:not([disabled]),
select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])
```

### D4 滚动锁写 `document.body.style.overflow`，并保存原值

不新建 CSS 状态类：类名方案需要 JS 与 CSS 两处同步，多一处就多一个漂移点（同类问题在 tabular-nums 那次已经出现过）。

必须保存并**原样**恢复打开前的值 —— 原值是空字符串时要恢复成空字符串，不能写成 `'auto'` 或 `'revert'`，否则会覆盖调用方可能已有的 `overflow` 声明。恢复动作要放在同一个 `useEffect` 的 cleanup 里，保证关闭与组件卸载两条路径都覆盖。

### D5 滚动锁必须配套 `.panel` 的 `max-height` 与内部滚动

这是滚动锁的直接副作用：`body` 被锁住后，`.overlay` 虽然是 `inset: 0` 但自身不滚动，内容超高的面板会被裁在视口外且无法滚动到。因此 `.panel` 需要：

```css
max-height: calc(100vh - 48px);
max-height: calc(100dvh - 48px);
overflow-y: auto;
```

两行 `max-height` 是有意的降级顺序：不支持 `dvh` 的浏览器用 `vh`，支持的用 `dvh` 以避免移动端地址栏收放时的跳变。`48px` 对应 `.overlay` 上下各 24px 的 padding。

### D6 规格用 ADDED 而非 MODIFIED

焦点约束是新增关注点，既有「AI 助手入口」需求的文字无需改动。MODIFIED 要求把整个 requirement 块（含 4 个既有 Scenario）完整复制过来再改，复制失真风险高于收益；而 ADDED 只追加，不触碰已验收的 4 个 Scenario。

## Risks / Trade-offs

- **R1 移动端滚动穿透**：iOS Safari 上 `body { overflow: hidden }` 在部分版本仍允许背景跟手滚动。本次不处理（属浏览器兼容专项），记为已知边界并写进 `docs/specs` 的差异段。
- **R2 触发元素先于关闭被移除**：若打开面板的按钮在关闭前从 DOM 消失（例如路由切换），`target.focus()` 会静默失败，焦点落到 `body`。不额外处理 —— 加保护代码等于为一个不可测的边界增加分支。
- **R3 手写陷阱的覆盖范围**：只处理 `Tab` / `Shift+Tab`。屏幕阅读器的虚拟光标与 `F6` 不经过 Tab 序列，不受影响；不需要额外处理。
- **R4 焦点查询的性能**：每次按键都 `querySelectorAll` 一次。面板内元素数量是个位数，代价可忽略；不做缓存以避免"缓存了旧节点"这类更难查的问题。

## Migration

无数据与配置迁移。行为变化仅限面板打开期间的键盘与滚动，对既有调用方零接口变化（`useAiAssistant` 的 `isOpen` / `open` / `close` 签名不变）。
