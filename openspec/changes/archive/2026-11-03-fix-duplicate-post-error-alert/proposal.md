# Proposal

## Why

帖子详情页在「写入成功、随后校准读取失败」时，同一个失败会渲染成两个 `role="alert"`：互动提示区输出「Submitted, but refresh failed. Retry reading server data; do not submit again.」，统计区同时输出「Request failed with status 500. Please try again.」。后者不仅重复，其「请重试」还与前者「不要再提交」直接矛盾——用户照做会重复写入。两个出口也让 `docs/e2e/post-interactions.spec.ts` 的「写成功但校准失败」用例长期保持红灯，使全量 E2E 无法收敛。

## What Changes

- 详情页在校准失败提示存在时（`mutation` 处于 `error` / `uncertain`），统计区不再把详情读取错误渲染成第二个 `role="alert"`；该错误仅在无校准失败提示时单独呈现。
- 统计区的「Statistics pending refresh.」待刷新标记与「Refresh server data」入口保持不变。
- 规格补一条约束：同一失败只由一个提示出口承载，且不得出现与「不要重复提交」相矛盾的「请重试」指引。

## Capabilities

### New Capabilities

无。本次只修正既有前端互动能力中的一个提示缺陷，不引入新能力。

### Modified Capabilities

- `wanderchain-post-interactions-frontend`: 「写操作去重与服务端校准」Requirement 增加「同一失败只由一个业务提示承载、文案不得自相矛盾」的约束，并据此修订「写成功但校准失败」的 Scenario。

## Impact

- `frontend/components/posts/post-detail.tsx`：详情页提示渲染条件。
- `docs/e2e/post-interactions.spec.ts`：既有断言不改，预期由红灯转绿。
- 不涉及后端代码、API 契约、数据结构、依赖与配置。
