# Design

## Context

`AttractionServiceImpl.list()` 是唯一的读热点入口：先 `AttractionQuery.parse` 归一化四维参数，再分两条路——`collection != null` 走策展（全量取回后截断，`total` 取截断前长度），否则走排序分页（`PageRequest.of(0, limit)` + 单独 count）。仓储层每条查询自带三条可见性条件（`status='published'`、`deleted_at IS NULL`、`verified_at IS NOT NULL`）。`read()` 用主键查询，单独一条路。

缓存基础设施已经就位：`StringRedisTemplate` 连 127.0.0.1:6606 的 db 3，既有五处键统一 `wc:` 前缀（`LoginThrottle`、`EmailQuotaGuard`、`EmailCodeFlow`、`CaptchaServiceImpl`）。配置沿用 `@ConfigurationProperties` record + `@Validated` + 代码内不给默认值（`AuthProperties`、`MediaProperties` 同规格）。JDK 17，Spring Boot 3.5.5。

## Goals / Non-Goals

**Goals：**

- 让「读缓存」这件事成为仓库里可复用的样板：键规则、失效契约、降级口径、防击穿手法一次讲清楚。
- 缓存命中 / 未命中 / 故障三种情况下，响应结构与状态码与今天完全一致。
- 缓存作为协作件落在 `service/attraction/support/`，不侵入 controller 与契约层。

**Non-Goals：**

- 不追求性能数字。种子只有 12 条可见景点，缓存带来的差别在本地不可测。
- 不缓存详情读取，不做多级缓存（本地 + 远端），不做预热、不做命中率指标。
- 不引入 Spring Cache 抽象（`@Cacheable`），沿用既有 `StringRedisTemplate` 直连风格。

## Decisions

### D1 键按业务分两族，全参数入键

```
排序榜单  wc:attraction:ranking:{hot|rating|new}:{city|all}:{limit}
策展榜单  wc:attraction:collection:{first-trip|no-booking|open-monday}:{city|all}:{limit}
```

两族分开是因为它们是两种业务形状：一族按数值排序，一族是人工策展顺序，二者的参数白名单与语义都不同，共用一个 `{type}` 段会让「这个键到底代表什么」在排障时无从判断。

`city` 与 `limit` 必须入键：真实调用里有 `{city, sortBy:'hot', limit:5}`、`{sortBy:'hot', limit:50}`、`{city, collection}`、`{city, limit:50}` 四种组合，缺任一维度就会出现「北京的热门 5 条」被「全城的热门 50 条」覆盖。

`wc:` 前缀保留：6606 上的 Redis 被多个项目共用，db index 不承担隔离职责，前缀是唯一的隔离层。

被否方案：用户最初给的 `spot:ranking:{type}` —— 少 city、少 limit、缺前缀，三条都会直接产出错数据或污染共享实例。被否方案：参数取哈希做键 —— 排障时无法从键反推请求，且哈希碰撞会静默串数据。

### D2 只缓存整页结果（`items` + `total`），不缓存单条

`total` 的口径在两条路上不同：排序列表是 count 查询的结果，策展榜单是截断前成员数。两者必须与 `items` 同源同刻，否则会出现「这一页 3 条但总数写着 4」这种前端翻页算不出来的组合。只缓存 `items` 等于 count 那趟查询照样跑，省不下任何东西。

### D3 失效只靠 TTL（方案 A），不实现「清除排行榜缓存」

景点当前没有任何写入口：仓储层没有 `save` / `update` / `delete` 调用点，数据只来自 `schema.sql` 种子。为一个不存在的触发点写 `clearRankingCache()`，结果是死代码——静态闸门不拦，但每次读这个类都要多问一句「谁调它」。

键族规则一旦定下，未来加写入口时补清除只是「按前缀扫删」一件事，成本不随推迟增加。TTL 默认 5 分钟，写在配置里。

### D4 击穿用 Redis 互斥 + 有限等待，而非进程内单飞

```
GET key            → 命中直接返回
SET lock NX PX     → 抢到：查库 → SET key TTL → 释放锁 → 返回
                   → 未抢到：每 50ms 重试 GET key，最多等到 wait-timeout(1s)
                                → 等到就返回
                                → 等不到就自己查库（不回写）后返回
```

选择 Redis 锁而不是进程内 `ConcurrentHashMap<key, CompletableFuture>`：后者只对单进程成立，且异常路径需要手工清理条目，容易泄漏；前者在将来的多实例下同样有效，而且这份代码本来就已经依赖 Redis。

未抢到锁的请求在等待预算内取不到结果时**自己查库且不回写**：回写必须由持锁者独占，否则等待者会互相覆盖，锁就白抢了。"宁可多查一次库，也不让请求挂住"是本项目的可用性优先口径。

被否方案：`@Cacheable(sync = true)` —— 只保证单进程、需要引入 cache 抽象与序列化配置，与既有直连风格不一致。被否方案：不设等待预算、一直等锁 —— 持锁者卡死会把所有请求一起拖死。

### D5 锁释放用「比较后删除」，不用裸 `DEL`

锁 TTL（5s）可能先于业务完成而到期并被他人抢到，裸 `DEL` 会删掉别人的锁，等于把互斥放开了。释放脚本 `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`，令牌用 `UUID`。仓库里已有 `DefaultRedisScript` 的用法先例（`LoginThrottle` 的 INCR+PEXPIRE）。

### D6 序列化用 Boot 提供的 `ObjectMapper`，格式为 JSON

`AttractionSummary` 含 `BigDecimal` 与 `Instant`，必须走带 `JavaTimeModule` 的 mapper——仓库里 `StringListJsonConverter` 自建的 `new ObjectMapper()` 没有注册该模块，不能复用。JSON 而非 JDK 序列化：可直接 `redis-cli GET` 看内容，类加字段也不会让旧值变成不可读的二进制。

反序列化失败按 D8 处理：WARN + 删键 + 查库。

### D7 `list()` 的事务注解保持不动

缓存判断留在 `@Transactional(readOnly = true)` 之内。代价是读 Redis 之前就占住一个只读连接；本项目单机、连接池 10、查询毫秒级，可接受。去掉注解让缓存判断落在事务外确实更省连接，但那是另一种改造（要在同一方法里管理「先缓存后事务」的边界），本期不动。

### D8 降级口径与既有 `deleteIfOwned` 一致：WARN 后继续

缓存读、写、锁、反序列化任何一步抛异常，一律 `log.warn` 一行（键 + 异常类名，不打堆栈噪声）后走数据库。缓存故障 MUST 表现为「慢一点」，MUST NOT 表现为「500」。这条与媒体删除失败的口径一致：副作用失败只告警，不回滚主流程。

### D9 落位 `service/attraction/support/RankingCache.java`，两个业务入口

它不是 controller 调用的业务能力，是服务层内部的协作件，因此按仓库约定收进 `support/`、不带 `Service` 后缀（与 `LoginThrottle`、`EmailQuotaGuard`、`CodeHasher` 同规格）。对外两个方法分别对应两种业务：

- `ranking(AttractionSortBy sortBy, String citySlug, int limit, Supplier<AttractionPage> loader)`
- `collection(AttractionCollection collection, String citySlug, int limit, Supplier<AttractionPage> loader)`

两者共用私有 `readThrough(String key, Supplier<AttractionPage> loader)`。用户口头要求的名字是 `RankingCacheService`，落地取 `RankingCache` 以匹配目录语义——名字差异在这里显式交代，不留给读代码的人猜。

### D10 配置三项，代码内无默认值

```yaml
wanderchain:
  attraction-cache:
    ttl: ${WANDERCHAIN_ATTRACTION_CACHE_TTL:5m}
    lock-ttl: ${WANDERCHAIN_ATTRACTION_CACHE_LOCK_TTL:5s}
    wait-timeout: ${WANDERCHAIN_ATTRACTION_CACHE_WAIT_TIMEOUT:1s}
```

`AttractionCacheProperties` 为 record + `@Validated`，缺项启动即失败。约束关系写进 javadoc 并作为任务里的核对点：`lock-ttl` 必须大于最坏查询耗时，`wait-timeout` 必须小于 `lock-ttl`（否则等待者比锁活得久，纯属白等）。

### D11 造数脚本进 `scripts/`，不进 `schema.sql`

`schema.sql` 是版本控制的真相，12 条种子被现有断言依赖（例如三个榜单各 4 名成员、hot 榜首是既有条目）。千条演示数据只服务于本地观察，因此：

- 独立脚本，带 `-Cleanup` 开关，按 `public_id` 前缀精确回滚；
- 景点 `public_id` 前缀 `01BULK`、评论 `01COMM`，各补足 26 位；
- 景点 `curated_rank_*` 全部为 NULL → 三个策展榜单完全不受影响；
- 浏览数取低位、`published_at` 取早期时间 → `hot` / `new` 榜首仍是既有种子；
- 城市只能用 `ck_attractions_city_slug` 白名单里的七个 slug —— 这也是回滚不能靠「城市标记」而必须靠 public_id 前缀的原因。

### D12 景点评论表本期只建表，不接端点

用户要的是**景点**评论，而库里只有帖子评论 `post_comments`，没有对应的表。新建 `attraction_comments`，形状与 `post_comments` 逐列对齐：同一个仓库里不该出现两套不同的评论表设计，将来真要接评论功能时，实体 / 仓储 / 服务可以直接照搬帖子评论那套分层。只有归属列不同：`post_id` → `attraction_id`，外键指向 `attractions.id`。

本期不写实体、不写仓储、不写端点：没有消费方的表不提前产出代码。代价是这张表暂时只承载演示数据。

建表闸门是显式清单：`06-schema-check.ps1` 的 `$expectations[$authDb]` 里 Tables / Indexes / Constraints / CreatedAt 四组都是硬编码的，新表不登记就不会被断言（漏登记也不报错，只会让闸门对新表永久失明）。因此 DDL 与闸门清单必须成对修改，这是本变更里唯一的“两处必须同时改”的点。

## Risks / Trade-offs

- **[造数破坏既有断言基数]** 现有 e2e / 单测里有「12 条可见景点」「每榜 4 名成员」这类断言 → 缓解：策展列留 NULL 保住榜单断言；基数类断言在造数期间会失真，因此本轮不跑 e2e（按 AGENTS §10.3 后置），并在执行造数前说明影响面；脚本 `-Cleanup` 可随时回到干净状态。
- **[5 分钟陈旧窗口]** 库内改动不会立刻生效，包括软删除 → 缓解：spec 已把窗口写进可见性口径（MODIFIED「只呈现已发布景点」），观察期间要立即看变化就手动删键。
- **[缓存判断仍在事务内]** 命中路径也会占一个只读连接 → 缓解：单机 + 连接池 10 + 查询毫秒级，本期接受；后续要优化另立变更。
- **[共享 Redis 被误清]** db 3 上还有别的项目的键 → 缓解：所有操作只涉及 `wc:attraction:*`；任务里明确禁止 `FLUSHDB` / `KEYS` 通配删除。
- **[锁与等待的配置联动]** 两项配置互相约束，配反会让防击穿失效或让请求白等 → 缓解：javadoc 写明约束，任务里逐项核对 `lock-ttl > 最坏查询` 且 `wait-timeout < lock-ttl`。
- **[只建表不接端点的表会变死表]** `attraction_comments` 本期没有消费方，只有演示数据 → 缓解：数据全部带 `01COMM` 前缀，`-Cleanup` 可整体回落；真要接评论功能时照搬 `post_comments` 的分层而不是重新设计。
- **[DDL 与闸门清单漏改一侧]** 只改 `schema.sql` 不改 `06` 闸门，新表不被断言且闸门仍绿，护栏出现空洞 → 缓解：4.1 把两者放进同一个任务、用「表数从 4 变 5」作为完成证据。

## Migration Plan

无破坏性变更，无表结构改动。上线即为「读路径多一层缓存」，失败自动回落到今天的路径。回滚方式：撤掉 `list()` 里的缓存分支，旧查询逻辑作为 loader 原样保留在同一方法内，删除只需改一处。
