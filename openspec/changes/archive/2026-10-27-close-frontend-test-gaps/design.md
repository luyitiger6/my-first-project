# Design

## Context

本次是测试补齐与文档对齐，外部行为不变。设计约束来自三处：

- 主规格 `openspec/specs/wanderchain-homepage/` 声明界面为英文，单元文档中的中文文案不能反过来约束实现。
- 前端测试跑在 jsdom 上，没有布局引擎与真实图片加载，布局类场景不可在此层验证。
- `08-spec-doc-breakpoints.ps1` 要求文档响应式小节与 CSS 的 `max-width` 集合完全相等。

## Goals / Non-Goals

**Goals:**

- 审计 Action Items 中 P0、P1、P2、P4 与 P3-22 全部落地，且每条都有可复查的断言或闸门证据。
- 新用例按「归属层」放置：纯函数进 `lib/*`，组件交互进 `components/*`，页面编排进 `app/*`。
- 不改变生产代码行为；若断言暴露实现与规格冲突，按规格修实现而不是放宽断言。

**Non-Goals:**

- 不引入真实浏览器测试基建。
- 不为布局、图片加载失败、动效偏好写 jsdom 伪断言。

## Decisions

### 1. 排序与截断用 mock 数据源验证，不用真实 Mock 数据自证

现有 `repository.test.ts` 中景点排序断言依赖「id 顺序恰好与 viewCount 降序重合」，上限断言用常量与常量自比，属代理断言。新建 `repository.sorting.test.ts`，用 `vi.mock('./mock-data')` 注入乱序、并列、超限数据，直接验证：

- 三级排序键（评论/浏览/时间降序 + id 升序）与两个并列分支；
- 字面上限 6 / 10 / 5；
- `total` 为截断前匹配总数，`draft` / `removed` 不计入。

**备选**：导出比较函数单测——被否，会把内部实现固化成公开 API。

### 2. `SectionBoundary` 用真实 render 期抛错验证

用一个在 render 阶段抛 `Error` 的子组件触发 React 错误边界，断言只降级该区块、文案为 `<title> could not load. Please try again later.`，并在用例内临时静音 `console.error`（React 对边界捕获会打印错误日志），结束后恢复。

### 3. 无 `document` 场景只验证 `open()` 的安全分支

在已渲染的 Provider 上临时把 `document` 置为 `undefined`，调用 `open()` 后立即恢复，断言不抛 `ReferenceError`，再 flush 状态收尾。真实 SSR 首屏另用 `react-dom/server.renderToStaticMarkup` 验证首帧无遮罩。

**备选**：把 `open` 内部的环境判断抽成导出函数——被否，为测试扩大公开面。

### 4. 断点闸门扩充采用「文档跟实现」

U3/U5/U7 的文档写的是 mobile-first 目标断点（768/1024），实现是 desktop-first 的 `max-width`（900/640）。本次让文档描述实际 CSS 并补「真相源」声明，再把三对登记进 08 配对表；不改 CSS，避免视觉回归。

**备选**：把 CSS 改成 mobile-first——被否，超出测试补齐范围且会改变渲染结果。

### 5. 文档漂移以主规格与代码为准

- U0 §3.1 补双语字段（`titleEn`/`summaryEn`/`editorEn`/`nameEn`），与 `lib/home/types.ts` 一致。
- U6 §4.3 的 `alt` 改为 `alt="<titleEn> cover"`，与实现和英文界面约束一致。
- U4 §4.4 的覆盖声明在用例补齐后改为 S1–S17。

## Risks / Trade-offs

- 新增用例锁定文案字面值，未来改文案会同时失败：这是预期，文案属规格。
- `SectionBoundary` 用例依赖 React 错误边界行为；React 版本升级时需复核。
- 08 配对表扩充后，U3/U5/U7 的响应式小节不能再出现其它 px 断点，否则闸门立即变红。
