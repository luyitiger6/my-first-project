# Proposal

## Why

AI 助手面板已经声明 `aria-modal="true"` 与 `role="dialog"`，向辅助技术宣告「这是一个模态对话框，背景不可交互」。但组件里的键盘处理只判断 `Escape`：

- 面板打开后按 `Tab` 会离开面板、进入背后页面里的链接与按钮 —— 键盘用户被带到被遮罩盖住的内容上
- 屏幕阅读器被告知「背景不可交互」，键盘却可以操作背景 —— 两类用户拿到的体验互相矛盾

这比「没有模态语义」更糟：没有声明时，用户至少能预期这是个普通浮层；声明了却做不到，等于给出错误的操作预期。

同时，overlay 只是 `position: fixed; inset: 0` 盖住视图，底层 `body` 没有锁定滚动，面板打开时背景页面仍可滚动。

现状还有一处规格缺口：打开时把焦点移入面板、关闭后把焦点还给触发元素这两个行为**代码里已经实现**（`restoreFocusRef` / `closeButtonRef.focus()`），但主 spec 的「AI 助手入口」需求只写了打开、关闭与零网络请求，从未把焦点行为写成契约。实现存在而真相层缺席，正是下一次重构最容易悄悄弄丢的那部分。

## What Changes

1. **焦点陷阱**：面板打开期间，`Tab` 与 `Shift+Tab` 在面板内的可聚焦元素之间循环，不逃逸到背景。
2. **焦点归还**：把「打开时焦点移入面板、关闭后焦点回到打开它的触发元素」从既有实现提升为规格契约。
3. **背景滚动锁**：面板打开期间锁定 `body` 滚动，关闭或卸载时恢复原值（不能覆盖调用方原有的 `overflow` 设置）。
4. **面板内部滚动**：滚动锁会让超长面板无法被看到尾部，因此面板需要 `max-height` 与自身纵向滚动作为配套。
5. **测试补齐**：新增焦点移入、Tab 正向循环、Shift+Tab 反向循环、关闭归还焦点、滚动锁生效与恢复五类断言。

**明确不做**（避免范围蔓延）：

- 不引入 Radix UI、Headless UI 等第三方焦点管理库
- 不改用原生 `<dialog>` + `showModal()` —— jsdom 对 `showModal` 支持不完整，会让上述断言无法在现有测试环境内成立
- 不使用 `inert` 挂在页面容器上 —— 需要为整棵页面树包一层 wrapper，且 jsdom 对 `inert` 的可聚焦语义支持不完整
- 不改视觉样式，除 `max-height` 与面板内部滚动外不动 `.panel` / `.overlay` 的任何既有声明

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `wanderchain-homepage`: 新增「AI 助手面板的模态约束」需求（ADDED），把焦点移入、焦点不逃逸、焦点归还、背景滚动锁四项写成可验收的 Scenario；不修改既有「AI 助手入口」需求的任何文字

## Impact

- **代码**：`frontend/components/home/ai-assistant.tsx`、`frontend/components/home/ai-assistant.module.css`、`frontend/components/home/ai-assistant.test.tsx`
- **规格**：`openspec/specs/wanderchain-homepage/spec.md` 追加 1 个 Requirement（9 → 10 之后变 11），既有内容不动
- **人读文档**：`docs/specs/wanderchain/homepage-u4-ai-assistant.md` 同步验收项
- **无**：后端、API、依赖、构建配置、harness 闸门均不变；`package.json` 不新增任何依赖
