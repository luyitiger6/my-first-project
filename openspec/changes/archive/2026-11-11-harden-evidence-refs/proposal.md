# 加固 Scenario 证据账本的引用精度

## Why

`13-spec-evidence-check.ps1` 目前只校验 `ref` 指向的文件存在、`kind` 合法，**不校验那文件里真有这条测试**。
2026-11-11 复核三条高风险 Scenario 时坐实了这个漏洞：

- `全站写操作来源限流 / 多实例共用同一额度` 引用的 `WriteRateLimitInterceptorTest` 里没有任何跨实例用例，
  只有单实例循环耗尽与「额度桶落在 Redis」的设计事实，账本却记为 verified。
- 三条高风险 Scenario 的引用全部只到文件粒度：删掉整个测试方法、或换一个同名文件，闸门都不会红。

这正是 `docs/harness-backlog.md` §2.15 登记的软肋，本次把它焊上。

## What Changes

1. **引用支持方法锚点**：`ref` 允许写成 `<path>#<anchor>`。
   - 纯标识符锚点按 `\b<anchor>\b` 匹配（Java 方法名）；
   - 其它锚点按子串匹配（TS/vitest 的 `it` 描述文本）。
   - 锚点在该文件中找不到即 FAIL。
2. **高风险场景强制方法锚点**：账本新增顶层 `evidencePolicy.methodAnchorPatterns`。
   - 标题命中这些关键词的场景，其 `test` 引用必须带方法锚点，否则 FAIL。
   - 无 `evidencePolicy` 时闸门行为与现状完全一致（向后兼容）。
   - **不强制证据层级**：初版曾设想对「多实例」要求 `e2e/gate`，实操发现它会误判
     「两个实例共用一个 redis」这种本身就有效的单测；强制高层只会逼人造假，故删除该维度。
3. **补齐存量三条高风险条目**：分别落到具体方法；`多实例共用同一额度` 补一条真双实例共享 Redis 的用例。

## 关键取舍

- **只对高风险场景强制锚点，不全量 136 条**：存量逐条匹配方法名存在错配风险，错配比不配更糟（假证据）。
  先用 3 条高风险验证规则可用，全量推进的触发条件留在 `docs/harness-backlog.md` §5。
- **补测试而不是转 deferred**：`WriteRateLimitInterceptor` 构造注入 `StringRedisTemplate`、实例本身无状态，
  两个实例共用一个 redis 就是「多实例共享额度」的有效验证（约 25 行）；转 deferred 会让规格里明写的 Scenario
  永久缺证据。
- **不引入证据等级标签**：只加「高风险场景必须带方法锚点」这一条离散判据，不建分级体系，
  也不按 kind 排定「哪些算强证据」。

## Impact

| 文件 | 改动 |
|---|---|
| `harness/checks/13-spec-evidence-check.ps1` | 锚点解析与校验；`evidencePolicy` 策略校验 |
| `docs/spec-evidence.json` | 加 `evidencePolicy`；三条高风险条目补锚点与新引用 |
| `backend/.../WriteRateLimitInterceptorTest.java` | 新增 `twoInterceptorsShareTheSameQuota` |

## 不做

- 不改任何业务代码与业务规格（`skip_specs`）。
- 不为「并发」「幂等」强制 e2e/gate：确定性模拟交错与纯逻辑幂等由单测覆盖是有效验证，
  强制更高层只会逼人造假。
