# Proposal

## Why

`docs/spec-coverage-audit.md` 对 193 条 When/Then 场景做了逐条审计：前端 wanderchain 宽松覆盖 79.5%，但仍有 2 个系统性盲区（加载态 `role="status"` 全仓零断言、`SectionBoundary` 无测试文件）、13 条低成本测试遗漏、4 条断言强度不足（代理断言与常量自比），以及 3 处文档与实现漂移。这些缺口的共同点是「闸门全绿也发现不了」：组件行为正确但无人证明，文档声称覆盖却没有对应用例。

## What Changes

- **P0 系统性盲区**：新增 `use-section-data.test.ts`（loading → ready → error 三态、deps 稳定性、卸载丢弃）、`section-boundary.test.tsx`（render 期异常只降级自身）、`section-state.test.tsx`（三态组件的 role 契约）；三个内容区块补 `role="status"` 加载文案断言。
- **P1 测试遗漏 13 条**：U7-S5 城市过滤双层缺口、U0-S8 城市名兜底、U0-S9 空结果契约、U1-S9/S11 用户名与邮箱不存在分支、U4-S6/S10/S11/S12/S13/S14 面板交互与容错、U5-S8/S11 非法城市与连续切换、U7-S14/U8-S14 竞态、Search-S8 特殊字符转义、U3-S1/S4/S10 卡片语义与幂等。
- **P2 断言强度**：用 `vi.mock('./mock-data')` 构造乱序/并列/超限数据，验证三个仓储的真实排序键与字面上限（6/10/5）及 `total` 为截断前总数；U5-S10 改用 `URLSearchParams` 断言排除重复 `city`；U1-S11 补邮箱不存在分支。
- **P4 文档漂移**：U0 §3.1 类型定义补 `titleEn`/`summaryEn`/`editorEn`/`nameEn`；U6 §4.3 的 `alt` 文案改为英文口径；U4 §4.4 覆盖声明改为 S1–S17 并勾选已覆盖项。
- **P3-22 闸门配对扩充**：U3/U5/U7 的 §5.3 响应式小节改写为与 CSS 一致的 desktop-first 断点并补「真相源」声明，`08-spec-doc-breakpoints.ps1` 配对表新增三对。

无 **BREAKING** 变更：生产代码行为不变，本次只增加测试、校正文档与扩展现有闸门的校验范围。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- 无。测试与文档对齐不改变主规格已声明行为，`.openspec.yaml` 声明 `skip_specs: true`。

## Non-Goals

- 不引入 Playwright 等真实浏览器测试基建：320px 布局、图片加载失败占位、`prefers-reduced-motion`、无 JS 首屏四条继续作为审计报告中的已知边界。
- 不处理 `todo-module-spec.md` / `db-design-spec.md` 的后端缺口（审计 P5）。
- 不修改任何组件、仓储、路由或样式的运行时行为。

## Impact

- 测试：`frontend/components/home/` 下新增 3 个测试文件、6 个既有测试文件补用例；`frontend/lib/home/`、`frontend/lib/auth/`、`frontend/app/` 下测试文件补用例。
- 闸门：`harness/checks/08-spec-doc-breakpoints.ps1` 配对表 4 → 7。
- 文档：`docs/specs/wanderchain/homepage-u0-contract-mock.md`、`homepage-u3-feature-nav.md`、`homepage-u4-ai-assistant.md`、`homepage-u5-city-switcher.md`、`homepage-u6-editor-picks.md`、`homepage-u7-hot-posts.md`。
- 前端生产代码零改动。
