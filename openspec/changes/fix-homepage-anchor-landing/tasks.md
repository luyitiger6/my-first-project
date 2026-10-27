# Tasks

## 1. 首页锚点补偿

- [x] 1.1 新增 `frontend/components/home/hash-anchor-restorer.tsx`：无 hash 时直接返回；有 hash 时按吸顶头部实际高度把目标区块对齐到头部下沿
- [x] 1.2 用 `ResizeObserver` 跟随布局变化反复对齐，连续稳定或 3s 超时后退出；监听 `wheel` / `touchstart` / 方向类 `keydown`，用户一动手就停止校正
- [x] 1.3 在 `frontend/app/page.tsx` 挂载该组件，区块组件、数据层、加载三态保持不变
- [x] 1.4 为「对齐偏移计算」抽出纯函数并补 jsdom 单测：有 hash 对齐、无 hash 不滚动、头部高度变化时偏移跟随

## 2. E2E 收回断言

- [x] 2.1 `docs/e2e/search-page.spec.ts` S5 从「hash + 区块已渲染」收紧为「目标区块进入视口、顶部偏差小于视口高度 10% 或已滚到文档尽头」
- [x] 2.2 新增首页锚点用例：`/#editor-picks`、`/#hot-posts`、`/#hot-attractions` 直接访问都落位（含页尾例外），且无 hash 时不自动滚动
- [x] 2.3 删除 `docs/e2e/README.md` 的「已知产品缺陷」条目与对应排除说明
- [x] 2.4 在 `docs/specs/wanderchain/search-page.md` 的 S5 补落位判据，使测试与单元文档重新对齐
- [x] 2.5 将页尾锚点的实测数据与例外判据写回 delta spec、design 与 proposal

## 3. 验收

- [x] 3.1 `npm run test`（frontend vitest）与 `npm run test:e2e` 全绿
- [x] 3.2 `powershell -File harness\run-all.ps1` 退出码 0
