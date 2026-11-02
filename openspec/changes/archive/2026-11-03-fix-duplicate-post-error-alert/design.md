# Design

## Context

帖子详情页同时维护两条独立的失败状态：

- `view.mutation`：最近一次写入（投票、收藏、评论、删除）的结果提示，写入成功但校准失败时为 `error`，文案「Submitted, but refresh failed. Retry reading server data; do not submit again.」；
- `view.detail`：详情读取状态，校准失败时为 `error`，文案来自 `describePostsError`，对未知错误码落到「Request failed with status <code>. Please try again.」。

两者由同一次校准失败同时置位，页面把它们分别渲染在两个位置，且都带 `role="alert"`。

## Goals

- 同一次失败只由一个业务提示承载，且文案不自相矛盾。
- 不丢失「统计待刷新」这一可操作信息。
- 不动 hook 的状态机与请求时序，改动面控制在渲染层。

## Decisions

### 收敛点在渲染层，不改 `usePostDetail`

`view.detail.status === 'error'` 在「首次加载失败」与「已有数据、校准失败」两种情形下都会出现，二者需要的表现不同（前者要整页错误块，后者只是统计陈旧）。这个区分在渲染层已有现成依据（`post` 是否存在、`mutation` 是否已报错），无需在 hook 里新增状态字段，避免为一次提示收敛改动请求时序。

### 统计区错误让位于校准失败提示

校准失败提示本身已经完整覆盖「读取失败」这一事实，并给出「不要重复提交、只重试读取」的指引；统计区的技术文案既重复又反向指引。因此在校准失败提示存在时，统计区不再渲染该错误。

判定条件是 `mutation.status === 'error' || mutation.status === 'uncertain'`，而不是「`mutation.message` 非空」：写入成功后的 `success` 文案（「Saved. Server data refreshed.」）不影响后续读取失败单独成告警，用 message 非空判断会把这条正常路径也吞掉。

### 保留待刷新标记与重试入口

`Statistics pending refresh.`（`role="status"`）与「Refresh server data」按钮不属于告警出口，也不与「不要重复提交」冲突，保持原样，因此用户仍能感知数据陈旧并主动重读。

## Risks

- 若将来统计区出现与校准失败无关的读取错误，条件渲染会把它藏起来。当前不存在这种组合：`view.detail.error` 只由详情读取产生，而详情读取正是校准动作本身。
- E2E 断言不变，由红转绿即为验证；不新增测试用例，符合当前快速 MVP 口径。
