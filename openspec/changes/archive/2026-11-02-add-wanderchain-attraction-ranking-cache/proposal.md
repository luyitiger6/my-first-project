# Proposal

## Why

景点列表与三个策展榜单是当前唯一的公开只读热点：每来一次请求就穿到 MySQL 走一遍排序 / 计数，没有任何中间层。真实的性能收益很小（种子只有 12 条可见景点），本期要的不是收益，而是把「读缓存怎么加才不破坏既有语义」这件事在仓库里落成一套可复用的样板：键怎么按业务命名、失效靠什么、缓存挂了怎么办、并发未命中的一瞬间怎么不打穿数据库。

## What Changes

- 在 `service/attraction/support/` 新增读缓存支撑件 `RankingCache`，对外只暴露两个业务入口：一个给排序榜单（`hot` / `rating` / `new`），一个给策展榜单（`first-trip` / `no-booking` / `open-monday`）。
- 键按业务分成两族，共享 `wc:` 前缀（与登录限流、邮箱码、图形码同一规范，前缀是共享 Redis 实例上唯一的隔离层）：
  - 排序榜单：`wc:attraction:ranking:{sortBy}:{city|all}:{limit}`
  - 策展榜单：`wc:attraction:collection:{collection}:{city|all}:{limit}`
- `AttractionServiceImpl.list()` 改为走缓存取整页结果（`items` + `total` 一起缓存），缓存未命中时才执行原有的库查询，查询完成后回写。
- 失效只靠 TTL（方案 A）：过期时间默认 5 分钟，写在 `application.yml` 的 `wanderchain.attraction-cache.ttl`，可用环境变量覆盖；不实现「清除排行榜缓存」方法——景点当前没有任何写入口，清缓存没有触发点，等出现写入口时再加。
- 解决击穿：同一键并发未命中时，只有一个请求回源数据库，其余请求在有限的等待预算内取缓存，取不到才各自回源（且不回写），保证请求不被锁拖死。
- Redis 不可用、序列化失败、缓存内容损坏一律降级：记录 WARN、直接查库，响应结构与状态码不变。
- 新增景点评论表 `attraction_comments`：库里只有帖子评论 `post_comments`，没有景点评论，因此新建一张同形状的表，并把它登记进建表闸门的断言清单。本期只建表，不写实体、仓储与端点。
- 新增一次性造数脚本，给景点与景点评论各灌入千条量级数据，用来在真实数据量下观察缓存行为；脚本自带清理开关，不改动 `schema.sql` 里的种子。

非目标：不新增 / 不修改任何后端端点与响应字段，不改前端任何代码，不引入新依赖，不动 `list()` 上的事务注解；景点评论本期只有表与演示数据，没有读写端点。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `wanderchain-attractions`: 列表与榜单从「每次请求读库」变为「TTL 内读缓存」，因此新增三条行为约束——可见陈旧窗口的上界、缓存不可用时的可读性不变、并发未命中不得把库压跨；同时补一条「不同参数组合不得串数据」的约束。

## Impact

- 后端：`service/attraction/support/RankingCache.java`（新增）、`service/attraction/impl/AttractionServiceImpl.java`（`list()` 接入缓存）、`config/AttractionCacheProperties.java`（新增）、`src/main/resources/application.yml`（新增 `wanderchain.attraction-cache` 三项）。
- 依赖：复用既有 `spring-boot-starter-data-redis` 与 Boot 提供的 `ObjectMapper`，不新增依赖。
- 配置：新增 `wanderchain.attraction-cache.{ttl,lock-ttl,wait-timeout}`，缺项启动即失败（与 `wanderchain.media` 同一口径，代码内不给默认值）。
- 运行期：新增对 `127.0.0.1:6606` db 3 的读依赖——但只在读路径上，且未命中 / 故障时行为与今天完全一致。
- 数据库：`backend/src/main/resources/schema.sql` 新增 `attraction_comments`；`harness/checks/06-schema-check.ps1` 的表 / 索引 / 约束 / `created_at` 四组断言清单同步登记（不登记的话闸门对新表永久失明）。
- 脚本：`scripts/seed-demo-data.ps1`（新增，一次性，带 `-Cleanup`）。
- 前端与契约（`10-contract-check`）不受影响；`07-doc-consistency` 会检查文档清单是否同步。
- 造数脚本与演示数据仅为本地观察服务，不属于产品代码。
