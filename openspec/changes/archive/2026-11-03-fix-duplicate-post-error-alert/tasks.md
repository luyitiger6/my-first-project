# Tasks

## 1. 详情页提示收敛

- [x] 1.1 在 `frontend/components/posts/post-detail.tsx` 中让统计区的详情读取错误在校准失败提示存在时不再渲染：提出 `mutationFailed`（`mutation` 处于 `error` 或 `uncertain`）作为唯一判定，统计区错误只在 `!mutationFailed` 时以 `role="alert"` 呈现；验证：手动构造「写成功 + 校准 500」时 `#main-content [role="alert"]` 只有一个出口，且文案为「Submitted, but refresh failed…」
- [x] 1.2 核对既有引用点未被改坏：`Statistics pending refresh.` 待刷新标记与 `Refresh server data` 入口保留，`view.mutation` 提示区的 `role` 判定改用同一变量；验证：`cd frontend; npx tsc --noEmit` 退出码 0

## 2. 验证

- [x] 2.1 跑受影响的端到端用例：`npx playwright test post-interactions.spec.ts`；验证：「写成功但校准失败时提示不要重复提交，并锁住互动」由红转绿，同文件其余用例不回归
- [x] 2.2 跑全量端到端套件：`npx playwright test`；验证：206 passed / 0 failed，退出码 0

## Workflow follow-up

- 归档本 change，把 delta 合入 `openspec/specs/wanderchain-post-interactions-frontend/spec.md`。
