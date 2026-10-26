# Tasks

## 1. 焦点陷阱

- [x] 1.1 在 `ai-assistant.tsx` 新增可聚焦元素查询函数，选择器为 `a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`，运行期在面板内查询（不缓存结果）
- [x] 1.2 在既有 `onKeyDown` 中增加 `Tab` 分支：焦点在最后一个元素上按 `Tab` 时移到第一个，焦点在第一个元素上按 `Shift+Tab` 时移到最后一个；其余情况不调用 `preventDefault`，交给浏览器默认行为

## 2. 滚动锁与面板滚动

- [x] 2.1 在打开态的 `useEffect` 中保存 `document.body.style.overflow` 的原值并置为 `hidden`，在同一次 effect 的 cleanup 中原样恢复（空字符串也要恢复成空字符串），保证关闭与组件卸载两条路径都被覆盖
- [x] 2.2 `ai-assistant.module.css` 的 `.panel` 增加 `max-height: calc(100vh - 48px)` 与 `max-height: calc(100dvh - 48px)` 两行降级、以及 `overflow-y: auto`；不修改 `.overlay` 与 `.panel` 的其他既有声明

## 3. 焦点归还

- [x] 3.1 复核 `restoreFocusRef` 的既有实现：确认关闭按钮、知道了按钮、`Esc`、点击遮罩四条路径都走同一个 `close()`，因而共用同一套焦点归还逻辑；补充注释说明该行为已由规格约束，不是可随手删除的实现细节

## 4. 测试

- [x] 4.1 新增用例：通过顶部入口与悬浮按钮分别打开面板后，`document.activeElement` 为关闭按钮
- [x] 4.2 新增用例：焦点置于面板内最后一个可聚焦元素后按 `Tab`，焦点回到第一个元素
- [x] 4.3 新增用例：焦点置于第一个可聚焦元素后按 `Shift+Tab`，焦点移动到最后一个元素
- [x] 4.4 新增用例：关闭按钮、知道了按钮、`Esc`、点击遮罩四种关闭方式后，焦点均回到打开面板的触发元素
- [x] 4.5 新增用例：先把 `document.body.style.overflow` 设为非空值（如 `scroll`）作为原值，打开面板后为 `hidden`，关闭后恢复为 `scroll` —— 用非空原值验证恢复逻辑没有把原值改写成 `auto`
- [x] 4.6 运行 `npx vitest run components/home/ai-assistant.test.tsx`，既有 6 个用例与新增用例全部通过
  - 证据：`npx vitest run components/home/ai-assistant.test.tsx` → `12 passed (12)`，`VITEST-EXIT=0`；全量 `harness\run-all.ps1` → `13 test files / 77 tests` 全绿，`8/8 PASS`，`RUNALL-EXIT=0`

## 5. 文档与验收

- [x] 5.1 `docs/specs/wanderchain/homepage-u4-ai-assistant.md`：勾选焦点与滚动相关的验收项；在差异段记录「iOS Safari 滚动穿透未处理」与「`.panel` 使用 `max-height` + 内部滚动作为滚动锁的配套」
- [x] 5.2 `powershell -File harness\run-all.ps1` 退出码为 0
- [x] 5.3 `openspec validate harden-ai-assistant-modal --strict` 通过

> 提交与推送由人决定。改动落在 `frontend/` 子模块内，需先在子模块仓库提交，再回父仓库更新 gitlink。agent 不主动提交。
