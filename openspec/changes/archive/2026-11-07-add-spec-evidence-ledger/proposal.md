# Proposal

## Why

`openspec/specs/` 现有 19 个能力、538 条 Scenario，是「需求真相」的唯一载体；但这些 Scenario 只被当作文档读，没有任何机制回答「这一条到底验过没有」。

- `openspec validate` 只校验格式：Scenario 写得再漂亮也照样通过。
- `docs/spec-coverage-audit.md` 是 2026-10-27 的一次性人工审计快照，此后新增的每一批 Scenario 都不会进入它的视野，覆盖率数字只会越来越旧。
- AGENTS.md §10.3 明确 MVP 阶段测试后置，所以「没验过」是常态——问题不在于有缺口，而在于缺口不可见、不可统计、随归档不断累积。

结果是一个悖论：仓库越按 SDD 走，规格越多，越无法回答「哪些规格是空的」。再往后每归档一次，欠账就多一批；此时把账本立起来，历史缺口一次性显式登记，此后新增 Scenario 必须带证据或带欠账。

## What Changes

- **新增账本 `docs/spec-evidence.json`**：按能力组织。每个能力声明四样东西——能力级证据来源 `sources`（闸门 / 测试文件 / e2e 用例 / 总闸门与 CI 工作流）、逐条已验证 `verified`、逐条欠账 `deferred`（含 `reason` / `registeredOn` / `unlock`）、历史未逐条评估的 `historicallyCovered` 清单；逐条条目以 `<Requirement 标题> / <Scenario 标题>` 为键。
- **新增闸门 `harness/checks/13-spec-evidence-check.ps1`**：
  - 能力集合与 `openspec/specs/*` 双向一致（多一个、少一个都红）；
  - 所有 `sources` / `verified` 引用必须真实存在且类型合法（fail-closed）；
  - 每个能力的 Scenario 必须被 `verified ∪ deferred ∪ historicallyCovered` 恰好覆盖：漏登记红、指向不存在的标题红、重复登记红；
  - `deferred` 条目必须带 `reason` / `registeredOn`（`YYYY-MM-DD`） / `unlock`；
  - 通过时打印 verified / deferred / historicallyCovered 三组计数。
- **AGENTS.md**：§6 目录树与闸门标记、§7 命令速查补 13 号，§9 已知边界补「账本证明登记齐全，不证明行为正确」。
- **docs/conventions/README.md**：机械守卫补 13 号。

**非目标**：不自动统计覆盖率、不接第三方覆盖率服务、不因欠账数量或登记时间告警；不改既有主规格内容；不要求 538 条历史 Scenario 逐条补证据——那只会逼出伪造证据。

## Capabilities

### New Capabilities

- `spec-evidence`: 每条 Scenario 在账本中要么有可核验证据、要么是显式欠账；新增 Scenario 不登记即红。

### Modified Capabilities

<!-- 无：既有能力的行为不变，本次只新增账本与守护它的闸门。 -->

## Impact

- **文件**：新增 `harness/checks/13-spec-evidence-check.ps1` 与 `docs/spec-evidence.json`；修改 `AGENTS.md`（§6 / §7 / §9 / 闸门标记）与 `docs/conventions/README.md`。
- **CI**：闸门集合由 13 道变为 14 道；`run-all.ps1` 与 workflow 无需修改，07 闸门自动校验标记与新文件的对应关系。
- **风险**：低。首次运行应为绿；此后只有「新增 Scenario 未登记」或「引用失效」才会变红。
