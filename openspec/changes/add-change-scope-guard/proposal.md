## Why

一次 change 能装多少东西，此前没有任何约束。43 个已归档 change 的实测分布是：任务数平均 16.5、最大 54，Scenario 平均 15.7、最大 91，能力数平均 1.2、最大 5。最大的两个——`add-wanderchain-auth`（54 任务 / 88 场景）与 `add-wanderchain-post-interactions-frontend`（5 能力 / 38 任务 / 91 场景）——把审阅变成通读，人工卡点形同虚设。

第 ② 步审阅是整个工作流里唯一不可省略的人工节点。如果 change 本身可以无限大，这个节点的有效性就取决于审阅者的耐力而不是规格的边界。粒度需要一条机械可判定的上限，并且只对今后生效，不追溯已经归档的历史。

## What Changes

- 新增闸门 `harness/checks/14-change-scope-check.ps1`：对每个在飞 change（`openspec/changes/` 下非 `archive` 目录）统计三项，任一超限即判红
  - 能力数（`specs/` 下含 `spec.md` 的目录路径去重计数）≤ 2
  - 任务数（`tasks.md` 中复选框条目）≤ 30
  - Scenario 数（delta 规格中 `#### Scenario:`）≤ 60
- 超限时必须提供 `scope-exception.md`，含 `Reason` / `RegisteredOn` / `Expires` 三字段，`Expires` 到期即重新判红——例外是一条会失效的欠账，不是永久豁免
- 归档目录中的 change 不参与判定：历史规模是既成事实，追溯只会逼人改写历史
- `AGENTS.md` 与 `docs/conventions/README.md` 接入 14 号闸门

## Capabilities

### New Capabilities

- `change-scope`: 在飞 change 的能力面、任务数与 Scenario 数上限，以及超限时的显式例外与到期失效规则

### Modified Capabilities

无。

## Impact

- `harness/checks/14-change-scope-check.ps1`（新增）
- `openspec/changes/add-change-scope-guard/`（本变更）
- `AGENTS.md`：§6 目录树与闸门标记、§7 命令速查、§9 已知边界
- `docs/conventions/README.md`：机械守卫清单
- 不改动 `frontend/`、`backend/` 与既有闸门；13 号证据账本不受影响（本变更的能力尚未归档，不在 `openspec/specs/` 视野内）
