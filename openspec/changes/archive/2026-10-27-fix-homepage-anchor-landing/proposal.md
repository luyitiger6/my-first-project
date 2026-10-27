# Proposal

## Why

从 `/search` 点击分组回链（`/#editor-picks`、`/#hot-posts`、`/#hot-attractions`）后，浏览器滚动发生在三个内容区块仍在加载占位时，数据就绪后目标区块被上方内容顶走。

1440×900 实测：导航后 50ms 三个区块高度只有 173–180px，`#hot-posts` 距视口顶 300px；数据就绪后上方 `editor-picks` 从 180px 长到 1095px，`#hot-posts` 被推到视口下方 1215px，用户看到的是首页中部而不是目标区块。直接访问 `/#hot-posts` 则正确落位（目标距视口顶 0px）。

E2E 当初因此把 search S5 的断言放宽成「hash 正确 + 区块已渲染」，等于用测试迁就缺陷；本次修复要把这条断言收回原意。

## What Changes

- 首页新增客户端锚点落位补偿：带 hash 进入（回链或直接访问）时，等布局稳定后把目标区块滚到视口顶部；布局继续变化时持续校正，稳定或超时即停；用户主动滚动则让位，不再抢滚动条。
- 页尾锚点（`/#hot-attractions`）接受「滚动到文档尽头」：实测滚到底后区块顶部距头部 248px，滚动已无余地，物理上不可再对齐；判据改为「偏差 < 10% 视口高，或已停在 maxScroll 且标题可见」，不为此在页脚后追加空白。这是实施中发现的需求边界，已在 design.md 记录实测数据与取舍。
- 搜索页回链形态不变（仍是 `/#...` 链接）；数据契约、区块加载三态、搜索页 SSR 契约均不变。
- E2E 把 search S5 从「hash + 区块已渲染」收紧为「目标区块在视口内、顶部偏差 < 10% 视口高或已到滚动尽头」，并补首页三个锚点的直接访问用例；同步删掉 `docs/e2e/README.md` 里这条已修好的已知缺陷。
- 不引入全局 `scroll-behavior: smooth`：平滑滚动会与 `prefers-reduced-motion` 降级和既有 E2E 断言冲突，补偿滚动保持瞬时对齐。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `wanderchain-homepage`: 新增 Requirement「锚点落位稳定性」——带 hash 进入首页后目标区块 MUST 最终落在视口顶部附近，用户主动滚动后 MUST 停止自动校正。

## Impact

- `frontend/`（子模块）：`app/page.tsx` 挂载新的客户端组件；新增 `components/home/hash-anchor-restorer.tsx`；不改数据层、不改既有区块组件契约。
- `docs/e2e/`：`search-page.spec.ts` S5 断言收紧；补首页锚点直接访问用例；README 移除该已知缺陷条目。
- 工作区：新增本 change；harness 闸门集合不变。
