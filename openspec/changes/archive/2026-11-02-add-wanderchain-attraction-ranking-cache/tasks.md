# Tasks

## 1. 缓存配置与支撑件

- [x] 1.1 新增 `wanderchain.attraction-cache` 配置块（`ttl: 5m`、`lock-ttl: 5s`、`wait-timeout: 1s`，三项均可被环境变量覆盖）与绑定类 `AttractionCacheProperties`（record + `@Validated`，代码内不给默认值），并在 javadoc 写明两项硬约束：`lock-ttl` 必须大于最坏查询耗时，`wait-timeout` 必须小于 `lock-ttl`。验证：`mvn -f backend/pom.xml -q -DskipTests compile` 退出码 0；注释掉任一配置项后启动失败，而不是回落成代码内默认值。
- [x] 1.2 新增 `service/attraction/support/RankingCache.java`：两族键构造（`wc:attraction:ranking:{sortBy}:{city|all}:{limit}` 与 `wc:attraction:collection:{collection}:{city|all}:{limit}`，city 省略时写 `all`）、对外的 `ranking(...)` 与 `collection(...)` 两个业务入口、共用的 `readThrough(key, loader)`（先读缓存；未命中用 `SET NX PX` 抢锁，持锁者回源后回写并释放，未持锁者每 50ms 重读直到 `wait-timeout`，超时则自查且不回写），序列化用注入的 Boot `ObjectMapper`（JSON，含 `BigDecimal` / `Instant`），锁释放用「令牌比较后删除」的 Lua，任何一步异常只 `log.warn` 一行后继续查库。验证：编译通过；5.2 的真实链路能证明命中、回写、过期与降级四条路径都成立。

## 2. 服务层接入

- [x] 2.1 改造 `AttractionServiceImpl.list()`：保留 `AttractionQuery.parse` 在最前、刻意保留 `@Transactional(readOnly = true)` 不动；两条路各自把现有查询封装成 `Supplier<AttractionPage>` 交给 `RankingCache`——`collection != null` 走 `collection(...)`，否则走 `ranking(...)`，缓存键里的 city 取 `query.citySlug()` 的 `null` → `all` 归一。验证：起服务后请求 `/api/attractions?city=beijing&sortBy=hot&limit=5`，`redis-cli -p 6606 -n 3 KEYS "wc:attraction:*"` 能看到对应键；直接 `UPDATE attractions SET view_count = view_count + 100000 WHERE public_id = '<北京某条>'` 后再请求同一参数，响应仍是改动前的数值；等过 TTL 再请求变成改动后的数值。
- [x] 2.2 确认参数不串数据：依次请求 `{city=beijing,sortBy=hot,limit=5}`、`{city=chengdu,sortBy=hot,limit=5}`、`{city=beijing,sortBy=rating,limit=5}`、`{city=beijing,limit=50}`、`{collection=first-trip,city=beijing}`、`{collection=open-monday,city=beijing}`。验证：Redis 中出现 6 个互不相同的键（city / sortBy / collection / limit 各占一个键段）；每个响应的城市、顺序维度、成员集合与请求参数一致，不出现上一请求的内容。

## 3. 击穿与降级

- [x] 3.1 验证并发未命中只回源一次：删除某个热点键，用 8 个并发请求同时打同一组参数，前后各读一次 `SHOW GLOBAL STATUS LIKE 'Com_select'`。验证：差值只等于「一次列表查询 + 一次 count 查询」（约 2，而不是 8×2）；8 个响应内容完全一致；过程中无 5xx。
- [x] 3.2 验证缓存不可用时的降级：用环境变量把 Redis 端口改成不可达的端口另起一个后端实例（不动 6606 上的共享实例）。验证：新实例上 `/api/attractions` 与三个榜单均返回 `200` 且内容与直接查库一致；日志只出现 WARN，不出现启动失败或 5xx；同时确认详情接口不受影响。

## 4. 景点评论表与造数

- [x] 4.1 在 `backend/src/main/resources/schema.sql` 新增 `attraction_comments` 表（列与约束逐项对齐 `post_comments`，只把归属列换成 `attraction_id` 并指向 `attractions.id`；带 `uk_attraction_comments_public_id`、`idx_attraction_comments_attraction (attraction_id, deleted_at, created_at DESC)`、`idx_attraction_comments_parent`、三个 `fk_*` 与 `ck_attraction_comments_version`），并把这四项同时登记进 `harness/checks/06-schema-check.ps1` 的 Tables / Indexes / Constraints / CreatedAt 清单。验证：`powershell -File harness\checks\06-schema-check.ps1` 退出码 0，且摘要里 `wanderchain` 的表数从 4 变成 5；重复执行仍退出码 0（幂等）。
- [x] 4.2 新增一次性造数脚本 `scripts/seed-demo-data.ps1`：景点 1000 条（`public_id` 用 `01BULK` 前缀补足 26 位、城市在七个白名单 slug 内分布、`curated_rank_*` 全部 NULL、浏览数取低位、`published_at` 取早期时间、`verified_at` 非空、`rating` 部分留 NULL）与景点评论 1000 条（`public_id` 用 `01COMM` 前缀，`attraction_id` / `account_id` 取自库里已有行；库里没有景点或账号时打印提示并跳过，不伪造前置），并提供 `-Cleanup` 按前缀精确删除；脚本 MUST NOT 修改 `schema.sql`，MUST NOT 执行 `FLUSHDB` 或对非 `01BULK` / `01COMM` 前缀的行做任何写操作。验证：执行后 `SELECT COUNT(*)` 得到 1000 / 1000；再执行 `-Cleanup` 后两张表的行数回到造数前的值；造数期间三个榜单接口的成员数与顺序与造数前完全一致。
- [x] 4.3 在千条数据下走一遍缓存：请求 `city=all&limit=50` 与某城榜单，记录响应耗时与 Redis 键值；期间直接改库再请求。验证：缓存命中与未命中的结果与 2.1 的结论一致（有效期内不变、过期后变化），键族规则不因数据量放大而改变；记录一次造数前后「同一请求是否触发 select」的对照（用 `Com_select` 差值），仅作观察，不作为验收门槛。

## 5. 文档与真实链路

- [x] 5.1 更新 `AGENTS.md`：命令速查补缓存键族与造数脚本用法，目录树补 `service/attraction/support/RankingCache`、`config/AttractionCacheProperties`、`schema.sql` 新增的 `attraction_comments` 与 `scripts/seed-demo-data.ps1`，已知边界补「列表与榜单存在不超过 TTL 的陈旧窗口（含软删除）」「6606 上的 Redis 与其他项目共享，只认 `wc:` 前缀，不做跨前缀清理」「景点评论本期只有表，没有读写端点」。验证：`powershell -File harness\checks\07-doc-consistency.ps1` 退出码 0。
- [x] 5.2 走一次真实链路：浏览器打开 `/attractions`（切一次城市）→ 三个榜单与列表正常渲染 → 检查 `wc:attraction:*` 键已生成 → 直接改库某景点浏览数 → 5 分钟内刷新页面仍是旧值 → 手动删键或等过期后刷新变成新值 → 用不可达 Redis 端口重启实例后页面仍可读。验证：浏览器实际操作结果与 `redis-cli`、`Com_select` 记录，任一环节不符即视为未完成。

## Workflow follow-up

- 人工审阅 proposal、spec 与 design 后放行实施。
- 实施完成后归档 change，并把 `wanderchain-attractions` 主 spec 同步进真相层。
- 造数脚本产生的数据属本地观察，归档前确认已 `-Cleanup` 或明确保留原因。
