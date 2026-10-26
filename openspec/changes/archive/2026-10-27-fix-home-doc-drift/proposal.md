# Proposal

## Why

`docs/specs/wanderchain/` 的响应式章节与实现 CSS 完全平行：文档统一写 Tailwind 标准断点（`≥768px` / `≥1024px`），实现却自选了 640 / 720 / 760 / 860 / 900 / 1080 六种断点。这套文档是照模板批量生成的，实现是逐个手写的，两套值从未交会。

`optimize-home-images` 已经为此付过一次代价：`sizes` 按"单层容器 + 文档断点"推导，与真实渲染宽度偏差 4–8%，返工后改了 7 个文件。更危险的是 u8 §5.5 第 3 条自称「列数断点 640 起两列 | CSS Module 现状一致」——CSS 实际是 720 起两列。文档给自己盖了"一致"的章，审查时会被直接跳过。

现有 `07-doc-consistency` 只校验 AGENTS.md 的闸门清单与 5 个下线 token，`docs/specs/` 下的单元文档不在任何闸门的校验范围内，因此这类漂移不可能被红灯发现。

## What Changes

- 修正 u6、u8 两份文档中与实现不符的内容：
  - §4 验收清单的断点行（u6 写 `≥768px`/`≥1024px`，实际 900/640；u8 写 `≥640px`/`≥1024px`，实际 1080/720）
  - §5.3 响应式表：改为与实现 CSS 的 `@media` 断点一致，并声明真相源文件；同时修正方向描述（实现是 desktop-first 累进 max-width，不是文档声称的 mobile-first）
  - §5.4 图片现状：从「⚠ 现状：使用原生 `<img>`」改为已接入 `next/image` + 自定义 loader，并说明该方案不依赖 `images.remotePatterns`
  - §5.5 差异表：第 1、2 条（`next/image`、域名注册）已不成立，按现状改写第 3 条的自证句
- 新增 `harness/checks/08-spec-doc-breakpoints.ps1`：对登记在册的「单元文档 ↔ CSS 文件」配对，校验文档声明的断点集合与 CSS 媒体查询断点集合一致
- 更新 `AGENTS.md` 的 `<!-- harness-checks: -->` 标记纳入新闸门，并在闸门说明中补一句职责

**范围限定**：本次只对齐 u6 / u8。其余 6 份文档（hero、u1–u5、u7）的漂移性质不同——多是把未实现的布局意图写成既成事实（如 u1 声称 `≥768px` 卡片 420px 居中，而 `auth.module.css` 只有 760 一个断点），需要逐个判断"补实现"还是"降级描述"，另立 change 处理。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。

本 change 为纯文档与工具变更，不改变任何系统可观察行为，`.openspec.yaml` 声明 `skip_specs: true`。

## Impact

- 文档：`docs/specs/wanderchain/homepage-u6-editor-picks.md`、`docs/specs/wanderchain/homepage-u8-hot-attractions.md`
- 闸门：新增 `harness/checks/08-spec-doc-breakpoints.ps1`
- 入口契约：`AGENTS.md`（§6 闸门标记与目录树、§7 命令速查、§9 已知边界）
- 不受影响：业务代码、API、依赖、前端构建产物
