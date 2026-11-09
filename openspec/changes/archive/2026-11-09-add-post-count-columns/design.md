# Design

## Context

见 `proposal.md` 的 Why。本 change 只落地存储结构与闸门，以下三条现状决定实现方式：

1. `backend/src/main/resources/schema.sql` 用 `spring.sql.init.mode=always` 幂等执行，`CREATE TABLE IF NOT EXISTS` 不会给已存在的表补列。文件头部已有先例注释（`accounts` 补三列），本次沿用同一约定。
2. `harness/checks/06-schema-check.ps1` 的 `$expectations['wanderchain']` 只声明 5 张表、18 个索引名、17 个约束名、1 个生成列名；`Generated` 是纯列名集合（`-notcontains` 判定），无法区分「同一列名出现在哪张表」。
3. `posts` 的四个排序查询都在 JPQL 里用相关子查询聚合，读取侧还有逐帖三次 count 的 N+1；两条路径都依赖同一组计数口径（未删除评论、有效赞成票、未删除收藏）。

## Goals / Non-Goals

**Goals:**

- `posts` 具备三个默认 0、非负、可被索引的冗余计数列，且本 change 合入后服务行为零变化。
- `database-baseline` 把 wanderchain 八张表的结构要点变成可断言的真相，闸门缺项即红。
- 生成列断言按「表+列」组合落地，堵住同名列互相掩盖的漏洞。

**Non-Goals:**

- 不写实体字段、不改仓储查询、不切读取路径——留给 `sync-interaction-counts`。
- 不做数据回填：本阶段无生产数据，计数列默认 0 即为正确初值。
- 不逐列镜像列类型与长度：`schema.sql` 是唯一真源，规格只固定结构要点。
- 不升级闸门去断言索引的列顺序与 `DESC` 方向：现有闸门按名称断言，形状由规格与评审保证。

## Decisions

### D1：三个计数列一起加，不只加排序需要的两个

排序只用 `up_vote_count` 与 `comment_count`，但响应里的三个计数（含 `bookmark_count`）目前都靠逐帖实时 count 得到。若只加两列，change 2 仍要为 `bookmark_count` 保留一次 count 查询，读取路径的 N+1 只能消掉三分之二。三列一次补齐，`sync-interaction-counts` 才能把读取侧的全部 count 查询删干净。

放弃的备选：按需增量加列——每次都要改表并让闸门再补一轮断言，累计成本更高。

### D2：两条排序索引与 `idx_posts_feed` 同构

排序查询的过滤条件固定为 `status = ? and deleted_at is null`，游标键为 `(score, publishedAt, id)` 字典序。索引形状取 `(status, deleted_at, 计数列 DESC, id DESC)`：等值列在前可直接命中，排序列与 id 兜底列全部 DESC 时无需 filesort，MySQL 8 原生支持降序索引。`publishedAt` 不在索引内，是因为计数相同时的兜底排序只作用于极小的同分窗口，回表代价可接受；把它塞进索引会让索引键过宽。

放弃的备选：单列索引 `(up_vote_count DESC)`——等值过滤不满足，优化器只能全表扫描后排序。

### D3：拆成「结构 change + 行为 change」两个 change

本 change 加列、加索引、补闸门，计数列无人读写，默认 0；排序与响应仍走旧查询。合并后线上行为完全不变，可独立回滚（删索引、删列）。`sync-interaction-counts` 才引入行为变化（实体映射、排序切列、写侧增减）。这样每次合并的风险面都可单独评估，也符合 14 号闸门的粒度限制。

### D4：生成列断言改为「表.列」组合

现有 `Generated = @('active_email')` 按列名全局匹配。`post_votes.active_account_id` 与 `post_bookmarks.active_account_id` 同名，若把两者简单追加进数组，任一存在就会让断言通过。改为 `@('accounts.active_email', 'post_votes.active_account_id', 'post_bookmarks.active_account_id')`，断言时把查询结果拼成 `表名.列名` 再比较。

放弃的备选：给生成列起不同名字——列名是结构的一部分，为闸门改列名是本末倒置。

### D5：闸门只断言结构要点，不镜像列类型

按已拍板口径，闸门断言表集合、具名唯一键/索引/外键/CHECK、`表.列` 生成列、`created_at`、`posts` 三个计数列的**存在性**（列名与默认值通过 `information_schema.columns` 断言存在即可，不比对长度/字符集）。列类型与长度由 `schema.sql` 单一真源保证，规格也不复制列类型表。

放弃的备选：逐列镜像列类型——每次无害的长度调整都要同步改规格与闸门，维护成本高于收益。

### D6：计数列 CHECK 命名沿用 `ck_<表>_<列>` 风格

新增 `ck_posts_up_vote_count`、`ck_posts_comment_count`、`ck_posts_bookmark_count`，与既有 `ck_attractions_view_count` 一致；索引沿用 `idx_posts_<语义>`。命名可被闸门直接断言，也保持 `docs/db-design-spec.md` 的命名约定。

### D7：`attraction_comments` 纳入基线但不赋予消费方

该表与 `post_comments` 逐列同形，本期只建表。纳入基线是为了让「表被改坏」可被发现；不建实体/仓储/端点，避免提前产出无人使用的代码。

## Risks / Trade-offs

- [本地库未补列导致 change 2 启动失败] → 本 change 在 `schema.sql` 头部注释补充「posts 新增三计数列」的 ALTER/重建提示；change 2 的 tasks 首项包含本地库准备，先 ALTER 或重建再跑测试。
- [索引写放大] → 每次投票、评论、收藏写入都会更新 `posts` 行与两条索引；当前数据规模可忽略，change 2 实施后用真实链路观察。
- [计数列与互动表漂移] → 本 change 不写计数，无漂移；change 2 必须用同事务原子增量，并在设计里明确禁止读改写。
- [闸门只断言名称，形状可能悄悄漂移] → 规格写明形状；后续若出现回归，再把「列顺序/DESC」升级为闸门断言（记为 Open Question）。
- [06 闸门依赖既有 MySQL 8806] → 与既有行为一致，无新增依赖；数据库不可达时闸门失败属于设计行为。

## Migration Plan

1. `schema.sql` 的 `posts` 建表语句加三个计数列、三条具名 CHECK、两条排序索引，并更新文件头注释。
2. `06-schema-check.ps1` 的 wanderchain 期望清单补三张表、九个索引、十一个约束、两个生成列（改为 `表.列`），并加三项计数列存在性断言。
3. 顺序执行：`powershell -File harness\checks\06-schema-check.ps1`（重建 wanderchain 并验证幂等）→ `openspec validate add-post-count-columns`。
4. 回滚策略：删两条索引与三列即可回到现状；本 change 不在应用代码中引用这些列，回滚不需要改代码。

## Open Questions

| 问题 | 现状 |
|---|---|
| 06 闸门是否升级为断言索引的列顺序与 `DESC` 方向 | 本 change 不升级；若后续出现「索引名对但形状错」的回归，再单开 change 加断言 |
| 计数列的默认值是否应在闸门内做 DML 断言（插入后为 0、负数被拒） | 06 目前只做结构断言；两条 Scenario 由 `sync-interaction-counts` 的测试覆盖 |
