# Design

## 决策 1：账本用 JSON，不用 YAML 或 Markdown 表格

闸门跑在 Windows PowerShell 5.1 与 Linux PowerShell 7 上，前者没有内置 YAML 解析；Markdown 表格解析要自己写、且对标题里的 `|` 与转义脆弱。`ConvertFrom-Json` 两边都有，账本天然结构化，diff 也可读。代价是人写起来不如 YAML 顺手，但账本由闸门与脚本频繁读取、人工只做增量编辑，这个代价可接受。

## 决策 2：三类分类，而不是「有证据 / 没证据」两类

538 条历史 Scenario 里，能立刻逐条指出证据的是少数。若只允许两类，剩下的大多数只能二选一：伪造证据，或让闸门从第一天就红。因此引入第三类 `historicallyCovered`——「历史上按能力级来源覆盖、尚未逐条评估」。它是可见的事实，不是通过的门票：闸门会把它单独计数并打印。

## 决策 3：能力级 `sources` + 逐条棘轮

证据按能力声明来源（闸门 / 测试文件 / e2e / 总闸门与 CI），避免把 538 条一次性摊成 538 行账。真正的约束来自集合相等：`verified ∪ deferred ∪ historicallyCovered` 必须与该能力的实际标题集合完全相同。于是**新增一条 Scenario 就必须落进 `verified` 或 `deferred`**，否则闸门红——这就是棘轮。把新标题塞进 `historicallyCovered` 在技术上可行，但那是一次显式、可审阅的 diff，且会计入打印出的计数，不会静默发生。

## 决策 4：键取 `<Requirement> / <Scenario>`，不用单独的 Scenario 标题

初版闸门用 Scenario 标题做键，第一次运行就报出 3 处冲突：`wanderchain-auth-frontend` 有两条同名 Scenario 分属不同 Requirement，`wanderchain-homepage` 同理。标题在同一能力内并不唯一，而改标题会动既有主规格（越权）。所以键改用「Requirement 标题 / Scenario 标题」，既保证唯一，又让账本能看出条目属于哪条要求。

## 决策 5：证据类型限定为四类且必须存在

`gate` / `test` / `e2e` / `runner` 都可以机械核实文件是否存在；`manual` 不能。允许「手动跑过了」这类不可核验的证据，等于给账本开后门。所以手动验证只能以「在某个 e2e/测试文件里留下可重复执行的用例」的形式存在，否则就该登记为欠账。

## 决策 6：不为欠账数量或登记时间判红

欠账是事实，不是失败。按数量判红会逼人删条目，按时间判红会让 CI 在工作日之外随机变红。闸门只保证「登记齐全、引用真实、字段完整」，把欠账多少留给人和报告去看。

## 风险

- 账本与规格脱钩时闸门会红，这是期望行为；但每次归档新增 Scenario 都必须同步改账本，会成为归档流程的一部分。
- `historicallyCovered` 容易被当成「已覆盖」误读，因此闸门输出必须把它与 `verified` 分开计数。
