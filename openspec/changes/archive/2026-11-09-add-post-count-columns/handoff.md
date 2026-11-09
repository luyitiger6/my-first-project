# 交接单：add-post-count-columns

- 结论：**可交接**
- 日期：2026-11-09
- 说明：本 change 在完整验收前已归档（为让 13 号闸门能按主规格逐条核验），验收对象为归档时的同一份代码与规格，归档未改动实现。

## Stage 1 · Spec 合规

15 条 Scenario 逐条对账：**对 15 / 错 0 / 警告 1**。

对账依据是 `harness/checks/06-schema-check.ps1` 的断言清单（第 48–86 行：Tables / Indexes / Constraints / Generated / CreatedAt / ColumnDefaults）与 `backend/src/main/resources/schema.sql`。

| Scenario | 结论 | 依据 |
|---|---|---|
| wanderchain 表集合基线 / 八张表齐全 | 对 | 06 断言 `accounts…attraction_comments` 八张表存在 |
| wanderchain 表集合基线 / 占位表缺失被拦截 | 对 | 缺表即 `Fail "missing table"`，非 0 退出 |
| 对外标识与软删除唯一性基线 / 对外标识重复被拒绝 | 对 | 06 断言 `uk_accounts_public_id`、`uk_posts_public_id` 等唯一键存在 |
| 对外标识与软删除唯一性基线 / 注销后同邮箱可重新注册 | 对 | 06 断言 `uk_accounts_active_email` 与生成列 `accounts.active_email` |
| 对外标识与软删除唯一性基线 / 取消投票后可重新投票 | 对 | 06 断言 `uk_post_votes_active` 与生成列 `post_votes.active_account_id` |
| 关联与取值约束基线 / 引用不存在的帖子被拒绝 | 对 | 06 断言 `fk_post_comments_post` 等具名外键 |
| 关联与取值约束基线 / 非法状态被拒绝 | 对 | 06 断言 `ck_posts_status` |
| 关联与取值约束基线 / 排序索引存在 | 对 | 06 断言 `idx_posts_feed`、`idx_posts_author`、三个景点榜单索引等全清单 |
| 帖子互动计数列的存储形态 / 计数列默认零 | 对 | 06 `ColumnDefaults` 逐列断言 `posts.*_count = '0'` |
| 帖子互动计数列的存储形态 / 负计数被拒绝 | 对 | 06 断言 `ck_posts_up_vote_count` / `ck_posts_comment_count` / `ck_posts_bookmark_count` |
| 帖子互动计数列的存储形态 / 计数排序索引存在 | **警告** | 06 只断言 `idx_posts_up_vote_count`、`idx_posts_comment_count` 存在，不解析列顺序 |
| 建表闸门断言 wanderchain 结构要点 / 缺表或改名即失败 | 对 | 06 对每类结构缺失均 `Fail` 并非 0 退出 |
| 建表闸门断言 wanderchain 结构要点 / 同名生成列不互相掩盖 | 对 | 06 用「表.列」组合键断言，`post_votes` 与 `post_bookmarks` 各自独立 |
| 建表闸门断言 wanderchain 结构要点 / 新增计数列被断言 | 对 | 三列同时进入 Constraints 与 ColumnDefaults |
| 建表闸门断言 wanderchain 结构要点 / 不逐列镜像列类型 | 对 | 06 只查表/索引/约束/生成列/created_at/默认值，不查类型与长度 |

### 警告（不阻塞，转「可后置」）

「计数排序索引存在」要求列顺序为 `(status, deleted_at, 计数列 DESC, id DESC)`，06 闸门只断言索引名存在。

不阻塞理由：列顺序的真源是 `schema.sql`，索引名与列定义在同一处相邻声明，改名或删列会同时被 06 拦住；列顺序写错只影响排序性能，不改变任何对外行为，也不违反本 change 的任何其他 Scenario。

## Stage 2 · 代码质量

| 项 | 结果 |
|---|---|
| 后端全量单元测试 | 422 用例，Failures 0 / Errors 0（`02-test` 闸门） |
| 前端单测 | 45 文件 / 534 用例全绿（`04-frontend` 闸门） |
| 总 Harness | `powershell -File harness\run-all.ps1` → `RESULT: ALL CHECKS PASSED`，退出码 0（16 个闸门全 PASS） |
| 证据账本 | `13-spec-evidence-check` PASSED：22 个能力，verified 75 / deferred 1 / historicallyCovered 538 |

Scenario 与用例映射已登记在 `docs/spec-evidence.json` 的 `database-baseline` 能力下，15 条全部 `verified`，ref 指向 `harness/checks/06-schema-check.ps1`。

## 已知不在本单范围

- 建表闸门不解析索引列顺序（见警告），如需机械保证，另开 `fix/index-column-order-check`。
