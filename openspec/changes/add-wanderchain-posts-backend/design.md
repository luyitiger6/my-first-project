# Design

## Context

动机见 `proposal.md`。这里只说会约束实现方式的现状事实（均已代码取证）：

- 拦截器按**纯路径**注册：`OriginGuard` order 0 覆盖 `/api/**`，`AuthInterceptor` order 10 只注册在 `/api/auth/**` 并排除 6 个公开路径。`addPathPatterns`/`excludePathPatterns` **没有 HTTP 方法维度**。
- `AuthInterceptor` 只从 cookie 读令牌（`AuthCookie.NAME`），不读 `Authorization` 头；校验通过后把 `VerifiedToken` 放进 request attribute `wanderchain.auth.verified`。
- `AuthResponseGuard`（`ResponseBodyAdvice`）的作用域**硬编码**为 `/api/auth/`，非该前缀原样放行。
- 现有响应 DTO 全部是 `record`，响应用 `implements AuthResponseBody` 标记；Java 的 `record` **不能 `extends` 类**。
- 现有实体是 JPA `class`（非 record）：私有字段 + 具名访问器 + `@Version` + `@Generated(INSERT)` 回读 `created_at`。
- 建表由 `schema.sql` + `spring.sql.init.mode=always` 完成，`ddl-auto=none`；`06-schema-check.ps1` 会 **DROP 并重建** `wanderchain` 库再逐项断言。
- `db-design-spec.md`：§4.1 公共列模板、§6「JSON 只放元数据」、§8.1「JSON 内的稳定查询字段用生成列，不直接对 JSON 做函数过滤」、§12 禁深 offset、§13 禁暴露自增 id。

## Goals / Non-Goals

**Goals:**

- 把帖子做成第二条完整业务线，验证「分层 + DTO 分离」可复制而不只是 auth 的特例。
- 让「同一路径 GET 公开、POST 需登录」成为**可表达、可测试**的事实，而不是靠记性维护的排除清单。
- 让新增的 `posts` 表真正进入 `06-schema-check` 的断言面，而不是「表建出来了但没人管」。

**Non-Goals:**

- 不改动 `AuthResponseGuard` 的作用域（全站响应包装是 proposal 明确排除的 Q16）。
- 不重构 `Account` / `AuthSession` 去继承 `BaseEntity`（会波及已归档能力与 70 个 Scenario）。
- 不引入 Spring Security、不做角色权限、不做图片上传、不做按标签筛选、不做全文检索。

## Decisions

### D1 · `BaseEntity` 放 `common/persistence`，且只让 `Post` 继承

`@MappedSuperclass`，字段照 §4.1 取全 8 列，用 `protected` 字段（子类要能直接映射）+ `protected` 无参构造。访问器沿用现有风格：具名、不带 `get` 前缀。

`Account` / `AuthSession` **本次不重构**。

- **为什么**：现有 `Account` 的字段是 `private` + 具名访问器，且携带 `active_email` 生成列、`token_version` 这类非公共列。把基类抽到它们头上，等于在归档能力的实体上做一等公民改造，回归面覆盖 326 个前端用例与整条认证链路，收益只是「风格统一」。
- **否掉的方案**：①放 `dao/common`——`common/` 才是跨业务的公共设施收口处，`dao/` 是按业务域分包的；②一次性把三个实体都改成继承——风险不成比例。

### D2 · `BaseResponse` 是标记**接口** `ApiResponse`，`AuthResponseBody` 成为其子接口

```
common/web/ApiResponse            (空接口，新的根类型)
        ^
        |
common/web/AuthResponseBody       (既有，改成 extends ApiResponse)
```

`PostResponse` / `PostSummaryResponse` `implements ApiResponse`（**不**实现 `AuthResponseBody`——那是认证专用标记）。

- **为什么**：Java 的 `record` 不能 `extends` 类，而现有 9 个 DTO 全是 record。想保留 record（不可变、零样板）就只能用接口做基类型。
- **否掉的方案**：①把 `BaseResponse` 做成抽象类并让所有 DTO 改成 class——要改 9 个已归档 DTO，且丢失 record 的不可变性；②不建基类型——不满足「Response 有统一基类型」这条要求。
- **必须说清的副作用**：`PostResponse implements ApiResponse` 只是**类型上的归属**，`AuthResponseGuard` 因为路径前缀不符而原样放行，**没有任何运行时守卫在检查帖子响应**。见 Risks 第 2 条。

### D3 · 拦截器改成「注册 `/api/**` + 公开路由表 + 默认拒绝」

```java
registry.addInterceptor(authInterceptor)
        .addPathPatterns("/api/**")
        .order(AuthInterceptor.ORDER);
```

拦截器内部持一张**公开路由表**（路径模式 → 允许的方法集合）：

```
/api/auth/captcha              -> {GET}
/api/auth/register-code        -> {POST}
/api/auth/register             -> {POST}
/api/auth/password-reset-code  -> {POST}
/api/auth/password-reset       -> {POST}
/api/auth/login                -> {POST}
/api/posts                     -> {GET}
/api/posts/*                   -> {GET}
```

判定顺序：

```
1. 命中公开路由表（路径匹配 且 方法在集合里）→ 尽力解析令牌（失败静默）→ 放行
2. 否则 → 解析令牌，失败抛 UNAUTHENTICATED（401）
3. 成功 → 写 VERIFIED_ATTRIBUTE → 放行
```

- **为什么**：`excludePathPatterns` 表达不了「`/api/posts` 的 GET 公开、POST 受保护」。要么改注册机制，要么改 URL 结构。改 URL 结构（`/api/posts/create`）会污染对外契约，且把「REST 语义」换成「记住两个路径」。
- **为什么「默认拒绝」**：新加 `POST /api/posts/{id}/publish` 时忘记登记，结果是 401（显性、测试立刻发现），而不是悄悄公开可写。
- **关键细节——公开分支也要尽力解析令牌**：`GET /api/posts/{id}` 要满足「作者能读自己的草稿，别人得到 404」。如果公开分支直接 `return true`，控制器拿不到身份，草稿对作者也不可见。所以公开分支执行 `verify(token)`：成功则写 attribute，失败不抛。控制器统一用 `@RequestAttribute(required = false)` 取「可能的查看者」。
- **否掉的方案**：①读写拆成不同路径；②引 `spring-boot-starter-security` 并写 `SecurityFilterChain`——与自研拦截器形成两套认证真相，且现有 9 个端点的公开/受保护归属要重新表达一遍。

### D4 · 扩注册范围前，先把既有 9 个端点的归属钉成断言

`/api/auth/**` → `/api/**` 是**破坏面最大的单一改动**：它让每个 `/api/**` 端点默认进入认证判定。若公开路由表漏了一个，已归档能力的 70 个 Scenario 会静默失效（表现为「登录突然 401」）。

因此这一步必须**先于**任何 posts 代码落地，且以测试证明等价：

| 端点 | 方法 | 归属 | 迁移后判定来源 |
|---|---|---|---|
| `/api/auth/captcha` | GET | 公开 | 路由表 |
| `/api/auth/register-code` | POST | 公开 | 路由表 |
| `/api/auth/register` | POST | 公开 | 路由表 |
| `/api/auth/password-reset-code` | POST | 公开 | 路由表 |
| `/api/auth/password-reset` | POST | 公开 | 路由表 |
| `/api/auth/login` | POST | 公开 | 路由表 |
| `/api/auth/logout` | POST | 需登录 | 默认拒绝 |
| `/api/auth/me` | GET | 需登录 | 默认拒绝 |
| `/api/auth/account` | DELETE | 需登录 | 默认拒绝 |

验收方式：先跑 `mvn test` 拿到基线全绿，再改注册口径，再跑一次——两次结果必须一致；另加一条参数化用例逐行断言上表。

### D5 · `posts` 表的 DDL 与它为什么长这样

```sql
CREATE TABLE IF NOT EXISTS posts (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  public_id    CHAR(26)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  author_id    BIGINT      NOT NULL,
  title        VARCHAR(120) NOT NULL,
  content      MEDIUMTEXT  NOT NULL,
  cover_image  VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  tags         JSON        NULL,
  status       VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
  published_at DATETIME(3) NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at   DATETIME(3) NULL,
  version      INT         NOT NULL DEFAULT 0,
  created_by   BIGINT      NULL,
  updated_by   BIGINT      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_posts_public_id (public_id),
  KEY idx_posts_feed (status, deleted_at, published_at DESC, id DESC),
  KEY idx_posts_author (author_id, deleted_at, created_at DESC),
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES accounts (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_posts_status CHECK (status IN ('draft', 'published')),
  CONSTRAINT ck_posts_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

逐条理由：

- **`content` 用 `MEDIUMTEXT`**：§6「大文本用 MEDIUMTEXT」；Markdown 正文是正文，不是 JSON 元数据。
- **`tags` 用 `JSON`**：§6「JSON 只放元数据」——标签是元数据；但 §8.1 同时禁止对 JSON 做函数过滤，所以**本变更不做按标签筛选**，等真要做时再决定加生成列还是开关联表。
- **`published_at` 单独一列**：分页排序键不能复用 `created_at`。先存草稿、三天后发布，用 `created_at` 排序会把新发布的帖子排到老帖前面。发布时写 `published_at`，回到草稿时置空。
- **没有第二把唯一键**：`posts` 没有业务唯一键（同一作者可以发同名帖子）。所以不需要 `accounts` 那种「生成列参与唯一键」的技巧——`public_id` 全局唯一就够。
- **`fk_posts_author` 用 `ON DELETE RESTRICT`**：§7 外键策略。注意账户注销是**软删除**（行仍在，只改 `status` 与 `deleted_at`），所以这条外键**不会**阻止注销，也不会阻止已注销作者的帖子继续被读。
- **`ck_posts_status` 只有两值**：`removed` 不进入词表，「下架」等同软删除（spec 明文）。
- **索引照 §8.1 的形态**：`(等值列…, deleted_at, 排序列 DESC, id DESC)`，与既有的 `(user_id, deleted_at, last_message_at DESC, id DESC)` 同构。

### D6 · 作者取自令牌，对外只出现 `authorPublicId`

- 写入：`VerifiedToken.account().id()` → `posts.author_id`。
- 读取：`posts.author_id` 回查 `accounts.public_id` → 响应里的 `authorPublicId`。
- 请求体里**不存在**作者字段。若调用方硬塞，Jackson 忽略未知字段（默认行为），spec 的「请求体不得指定作者」据此成立。

`created_by` / `updated_by` 两列照 §4.1 保留，但本变更**不写入**（留 NULL）——有了 `author_id` 之后再写一份作者主键没有信息增量，且会产生「两个字段谁为准」的歧义。

### D7 · 错误码：复用三个，只新增两个

```java
public enum PostErrorEnum implements BaseError {
    POST_FORBIDDEN("POST_FORBIDDEN", "无权操作该帖子", HttpStatus.FORBIDDEN),
    POST_NOT_FOUND("POST_NOT_FOUND", "帖子不存在", HttpStatus.NOT_FOUND);
}
```

`UNAUTHENTICATED`、`CROSS_SITE_REJECTED`、`VALIDATION_FAILED` **直接复用 `AuthErrorEnum` 的常量**，不复制一份。

- **为什么**：复制会让同一错误码存在两个真源，迟早出现状态码漂移。而「统一错误结构」这条 Requirement 限定在认证端点，帖子端点自带一份自己的固定集合，两边不互相污染。
- **否掉的方案**：往 `AuthErrorEnum` 里加两个帖子错误码——那需要给已归档能力改固定集合，属无谓的契约变更。

### D8 · 分页用不透明游标，不接受 offset

`GET /api/posts?limit=20&cursor=<opaque>`。服务端把游标解码成 `(published_at, id)` 二元组，查询条件是 `(published_at, id) < (:publishedAt, :id)` 的字典序比较，走 `idx_posts_feed`。非法游标 → `400 VALIDATION_FAILED`。

`limit` 默认 20，上限 50。响应附 `nextCursor`（无更多数据时为 null）。

- **为什么**：§12 明文禁深 offset；`id` 单独做游标不行，因为排序键是 `published_at`。

### D9 · 并发冲突不新增错误码

`@Version` 乐观锁冲突时 Spring 抛 `ObjectOptimisticLockingFailureException`，`GlobalExceptionHandler` 不拦它（只拦 `BizException`），因此落到框架默认 500。

- **为什么**：spec 的错误码固定集合只有 5 个，硬塞一个 409 会把「新增错误码属于契约变更」的规则当摆设。同一作者并发编辑自己同一篇帖子的概率极低，先接受 500 的显性失败，等真出现再用独立变更引入 `POST_CONFLICT`。

### D10 · 入参上限的取值来源

| 字段 | 上限 | 依据 |
|---|---|---|
| `title` | 1–120 字符（trim 后） | 与 `display_name` 的 64 量级对齐，但标题需要容纳中英混排的一句话 |
| `content` | ≤ 65535 字节 | 64 KiB 足以覆盖长攻略；`MEDIUMTEXT` 本身能存 16 MiB，应用层卡住是为了让响应可预期 |
| `tags` | ≤ 10 个，每个 1–32 字符，按键值去重 | 标签是元数据，超量说明建模错了 |
| `cover_image` | 空或 `http(s)` 绝对地址 | 本变更不做上传，只接受外部地址 |

这些是**本变更的裁决**，不是从既有文档推导出来的。审阅时若要改，改 spec 与这里两处，tasks 不受影响。

## Risks / Trade-offs

- **[注册口径从 `/api/auth/**` 扩到 `/api/**` 会让 9 个既有端点默认进入认证判定]** → 先跑 `mvn test` 拿基线，改完再跑一次逐字比对；另加参数化用例钉住 D4 那张归属表。这一步**独立成任务**，不与其他改动混在同一批。
- **[`ApiResponse` 只是类型归属，没有运行时守卫]** → `AuthResponseGuard` 因路径前缀不符放行帖子响应，`PostResponse` 若多写一个字段，没有任何拦截器会发现。本变更用「字段名集合等于白名单」的测试断言兜住；运行时守卫留给 Q16 的独立变更。这条必须写进 Risks 而不是假装已覆盖。
- **[公开分支「尽力解析令牌」放宽了 `AuthInterceptor` 的语义]** → 它此前只有「通过 / 拒绝」两态，现在多了「通过但无身份」。约束是：只有公开路由表命中的路径与方法才走这一支，其余仍然非黑即白。测试要覆盖「公开读带无效令牌仍返回 200」与「受保护路径带无效令牌仍返回 401」两个方向。
- **[`posts` 表新增但闸门断言清单没跟着扩]** → `06-schema-check` 只做「声明的必须存在」的正向断言，多余的表不报错，帖子表会在无人守卫下存在。因此扩断言清单是**本变更的必做项**，不是可选优化。
- **[`06-schema-check` 会 DROP 重建 `wanderchain`]** → 本地开发数据每次验收都会清空；由于尚无存量数据（沿用本项目「空库不做迁移」的口径），这是可接受的代价。
- **[`tags` 用 JSON 放弃了按标签查询]** → 需要按标签筛选时必须改结构（生成列或关联表）。已写进 Non-Goals，避免实现者顺手用 `JSON_CONTAINS` 过滤绕开 §8.1。
- **[`authorPublicId` 需要额外回查账户]** → 列表 N 条就要 N 次查账户。V1 数据量小可接受；若成为瓶颈，再考虑把 `author_public_id` 冗余进 `posts`（牺牲一致性换读性能），不在本变更内做。

## Migration Plan

无存量数据，因此没有数据迁移，只有「按序落地 + 每步可回滚」：

1. `schema.sql` 增加 `posts` 建表 → 本地启动即建表。
2. `06-schema-check.ps1` 断言清单扩充 → 单独跑 `06`，必须看到 posts 的表/索引/约束都在断言集里，且幂等检查通过。
3. 后端代码按 `dao` → `service` → `web` 顺序落地，每层配单测。
4. **拦截器口径改造单独一步**：改 `WebMvcConfig` + `AuthInterceptor`，跑全量 `mvn test`，与第 0 步的基线逐条比对。
5. `10-contract-check.ps1` 受管清单追加 posts 一对 + 新建 `frontend/lib/contracts/posts.ts` → 单独跑 `10`。
6. 最后跑 `harness\run-all.ps1`，退出码 0 才算完成。

**回滚**：代码靠 git 回退；表结构回退只需删掉 `schema.sql` 里的 `CREATE TABLE` 段——`06-schema-check` 每次验收都会 DROP 重建 `wanderchain` 库，无需手工清理残留表。

## Open Questions

- **草稿箱入口**：本变更保证「知道对外标识就能读自己的草稿」，但列表只含 `published`，作者没有「列出我全部草稿」的入口。这属于产品功能缺口，不影响本次 spec、方案与任务拆分；若需要，另立变更增加「我的帖子」查询。
- **帖子响应的运行时出站守卫**：是否把 `AuthResponseGuard` 泛化到全站（Q16），等第二次出现「DTO 忘了白名单」的真实事故再定，符合本项目「红线由真实事故驱动增补」的口径。
- **图片上传**：`cover_image` 目前只接受外部 URL 字符串；改成「上传 + 对象存储 + 存 `file_key`」需要按 §6 的「文件本身进对象存储，数据库只存 file_key/name/mime/size/sha256」重做一列，属独立变更。
