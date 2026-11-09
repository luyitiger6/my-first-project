# Design

## Context

见 `proposal.md` 的 Why。约束来自三处：

- `backend/src/main/resources/schema.sql` 是 wanderchain 当前的表真相（`accounts` / `posts` / `post_comments` / `post_votes` / `post_bookmarks` / `attractions` / `attraction_comments` 等），不是 `docs/db-design-spec.md` 里描述的 `ai_chat_gate` 四表。新表沿用 `schema.sql` 的公共列与索引命名。
- 实体风格：业务表继承 `BaseEntity`（公共八列），外键列只存内部 `Long` id、不用 `@ManyToOne`，无 setter，静态工厂 `create(...)`。
- 游标风格：`FeedCursor` 用 Base64 URL + 自描述段，非法游标归 `VALIDATION_FAILED`；`PostInputRules` 用 `codePointCount` 计长、失败归 `VALIDATION_FAILED`。

## Goals / Non-Goals

**Goals:**

- 两张新表承载会话与消息，`06-schema-check.ps1` 能断言到唯一键、外键、CHECK。
- 会话唯一性由数据库唯一键兜住，并发重复发起不产生第二条。
- 未读状态单调、幂等：重复标记已读不改变结果。
- 前端新增两个页面与一个顶栏入口；实时性由单条 SSE 通道提供，不引入 WebSocket 或轮询。

**Non-Goals:**

- 不建群聊模型：表里只有两个参与者列，不预留 N 人扩展位。
- 不做消息编辑/撤回/物理删除：`dm_messages` 是追加型，不建 `updated_at` / `deleted_at`。
- 不做已删除账号的会话清理：对方注销后其会话仍可读，列表不崩溃即可。
- 不做 WebSocket 与多副本推送广播：SSE 订阅表在单实例内存，扩副本前必须补 Redis pub/sub。

## Decisions

### D1 会话表用「参与者对归一化 + 唯一键」

`dm_conversations` 存 `participant_low_id` / `participant_high_id`，插入前把两个内部 id 升序排列，唯一键 `(participant_low_id, participant_high_id)` 兜住并发重复创建；`CHECK (participant_low_id < participant_high_id)` 让未归一化的写入在库层直接失败。

- **备选 A**：`dm_participants(conversation_id, account_id)` 子表。支持 N 人会话，但会话列表要多一层 JOIN，且一对一场景下唯一性要靠应用层查重 + 事务，并发下仍需重试。
- **备选 B**：`pair_key` 字符串列（`min:max`）。等价于 A 的两列，但多一列派生数据，且 ULID 与本表内部 id 混用容易写错。
- **选择理由**：一对一只有一个唯一性维度，一个唯一键就能把它变成数据库约束，而不是应用层约定。

### D2 未读用「计数列 + 已读位置重算」

会话表两侧各两列：`low_unread_count` / `high_unread_count` 存当前未读数，`low_last_read_message_id` / `high_last_read_message_id` 存该侧已读到的最后一条消息内部 id。

三条路径：

- **发消息**：插入消息与「对方计数 +1、摘要更新、message_count +1」在同一事务，用 `SET x = x + 1` 原子增量。
- **标记已读**：不盲清零，按已读位置重算——`unread = COUNT(消息 WHERE sender <> 我 AND id > 我读到的那条)`，同时推进已读位置。
- **列表读取**：直接读计数列，零聚合。

- **备选 A**：只存已读时间戳，列表时聚合。每次列表都要 JOIN 聚合；且时间戳在同一毫秒会漏消息。
- **备选 B**：只存计数列，已读时直接清零。已读与新消息并发时会把没看到的那条抹掉——这是唯一真正会丢的路径。
- **选择理由**：计数让读路径零成本；「按位置重算」让清零变成可核对的结果而不是盲写；已读位置用消息 id 而非时间戳，消除同毫秒歧义。

丢的防线：

| 故障场景 | 结果 | 防线 |
|---|---|---|
| 消息写入成功、计数失败 | 不丢 | 同一事务，一起回滚 |
| 并发 +1 | 不丢 | `x = x + 1` 由数据库串行化 |
| 已读与新消息竞争 | 不丢 | 按已读位置重算，不盲清零 |
| 进程崩在两语句之间 | 不丢 | 同一事务 |
| 有人直接改库 | 会偏 | `backend/tools/` 留一条对账 SQL，按消息表 + 已读位置重算回写 |

`last_read_message_id` 是逻辑引用，不建外键——`dm_messages` 已引用 `dm_conversations`，反向再加外键会形成循环依赖。

### D3 会话列表查询用 `low = ? OR high = ?`，两个索引各自覆盖

```sql
WHERE (participant_low_id = ? OR participant_high_id = ?) AND deleted_at IS NULL
ORDER BY last_message_at DESC, id DESC
LIMIT ?
```

配套两个索引：`idx_dm_conversations_low (participant_low_id, deleted_at, last_message_at DESC, id DESC)` 与 `high` 同构。MySQL 8 用 index merge union 合并。

`last_message_at` 在**建会话时就填为创建时刻**，所以「尚无消息的会话按其创建时间参与同一排序」（spec）不需要 `COALESCE`，也不会因函数包裹而退化为 filesort。这个值只用于排序；对外的最后消息时间仍取最后一条消息的 `created_at`，没消息时是 `null`。

- **备选**：`UNION ALL` 两次查询再排序。索引利用更确定，但 SQL 与 Java 拼接都翻倍。
- **选择理由**：单用户会话量级在数十到数百，OR 的代价可忽略；真到索引合并退化时，再改 `dm_participants` 表，而不是现在就为一个未验证的瓶颈加结构。

### D4 游标 = 单段 `id` 的 Base64 URL 编码

消息按内部自增 `id` 倒序分页，游标只编码 `id` 一段，Base64 URL 无填充；解码失败归 `VALIDATION_FAILED`。

- **备选 A**：`(createdAt, id)` 两段（初版方案）。那就必须为 `(conversation_id, created_at, id)` 再建一条索引；而同一会话内 `id` 已经严格单调，`created_at` 只是它的冗余投影。
- **备选 B**：直接暴露内部 `id`。违反「不向外部暴露自增主键」，且调用方会把它当 offset 拼。
- **选择理由**：`idx_dm_messages_conv (conversation_id, id)` 一条索引同时服务排序与游标条件；单段游标也少一类「段数不匹配」的非法输入。

### D5 正文 `VARCHAR(2000)`，长度按 Unicode 码点，不 trim

`DmInputRules.requireContent` 照 `PostInputRules` 的写法：`isBlank()` 拒绝，`codePointCount(0, length)` 判 1–2000，原文入库。

- **备选**：`MEDIUMTEXT` + 65535 字节。私信是即时对话，2000 字符远够；与 `post_comments.content` 的列定义保持一致。
- **备选**：trim 后入库。会静默改用户输入，且 spec 只要求「去除首尾空白后不为空」，不要求改变存储值。
- **选择理由**：`VARCHAR(2000)` 在 MySQL 是按字符计，与 `codePointCount` 语义一致；emoji 不会被按字节截断。

### D6 会话列表内嵌对方名片，后端一次装配

会话列表 DTO 每项含 `peer: { publicId, displayName, avatarUrl }`，由服务层用 `accounts` 表装配。

- **备选**：前端拿会话列表后再调 `/api/profiles?publicIds=`。两次往返，且 50 个 ULID 拼进 query 接近 URL 长度上限。
- **选择理由**：字段只有三个，装配成本低于一次网络往返；字段含义与 `wanderchain-profile` 的名片一致，不新造概念。

代价：同一组字段在 profile 与 dm 两处 DTO 各有一份，靠 10 号契约闸门与后端 record 对齐。

### D7 新消息用 SSE 推送，不用轮询也不用 WebSocket

进入会话页后建立 `GET /api/dm/conversations/{publicId}/stream` 的 `EventSource` 连接；服务端在消息落库后向该会话的订阅者推送一条事件，前端追加到列表并按 `publicId` 去重。断线由 `EventSource` 自动重连，重连成功后重拉一次首页补齐中断期间的消息。

- **备选 A**：10 秒轮询。对方回复最多延迟 10 秒，聊天场景可感知，体感等同「他没回」。
- **备选 B**：WebSocket。双向能力在首版用不上（发送是普通 POST），却要额外的握手期鉴权、心跳与重连状态机；成套项目才值得。
- **选择理由**：SSE 是单向推送、走普通 HTTP、鉴权沿用现有 cookie 拦截器、零新依赖（`SseEmitter` 在 spring-webmvc 内）；`EventSource` 自带重连与 `Last-Event-ID`。

可行性已验证：`frontend/app/api/[...path]/route.ts` 用 `new Response(upstream.body)` 流式转发，并刻意不透传 `content-length`，SSE 不会被代理缓冲。

限制：订阅表放在单实例内存里，**多副本部署需要 Redis pub/sub 广播，本次不做**（当前 K8s 为 1 副本）。

### D8 错误码只新增三个码

`DmErrorEnum` 放 `DM_SELF_CONVERSATION`（400）、`DM_PEER_NOT_FOUND`（404）与 `DM_CONVERSATION_NOT_FOUND`（404）。

| 场景 | 错误码 |
|---|---|
| 向自己发起会话 | `DM_SELF_CONVERSATION`（400） |
| 发起会话时对方不存在或已注销 | `DM_PEER_NOT_FOUND`（404） |
| 会话不存在，或请求者不是参与者 | `DM_CONVERSATION_NOT_FOUND`（404） |
| 正文为空 / 超长 / 游标非法 | `AuthErrorEnum.VALIDATION_FAILED`（400） |
| 未登录 | 拦截器统一返回 `UNAUTHENTICATED`（401） |

- **理由**：`PostErrorEnum` 的注释写明「同一错误码存在两个真源迟早会状态码漂移」，所以这里只放私信域真正必需的码，其余复用认证侧。
- **「不存在」与「非参与者」共用一个码**：spec 要求非参与者得到 404 且不暴露会话是否存在；拆成两个码反而把这个信息泄漏回去。
- **执行偏差**：初版设计写「对方不存在复用 `ProfileErrorEnum.PROFILE_NOT_FOUND`」，但该枚举在本分支并不存在——资料域对查不到的人是静默省略，从不报错。发起会话必须区分「对方不存在」，故自建 `DM_PEER_NOT_FOUND`。
- **不放进 `AuthErrorEnum`**：那等于给已归档的认证契约扩固定集合，`PostErrorEnumTest` 已经在钉住它是七个。

### D9 顶栏总未读走独立轻量端点

`GET /api/dm/unread-count` 返回 `{ "count": n }`，需要登录。

- **备选**：前端拉 `GET /api/dm/conversations?limit=50` 自行求和。顶栏在每个页面都渲染，为拿一个数字拉 50 条会话 + 名片不合理。
- **选择理由**：响应体只有一个整数，命中两侧索引后是一条聚合查询。

### D10 表结构

```sql
CREATE TABLE IF NOT EXISTS dm_conversations (
  id                  BIGINT      NOT NULL AUTO_INCREMENT,
  public_id           CHAR(26)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- 两个参与者按 accounts.id 升序归一化，low < high 由 CHECK 保证
  participant_low_id  BIGINT      NOT NULL,
  participant_high_id BIGINT      NOT NULL,
  last_message_at     DATETIME(3) NULL,
  message_count       INT         NOT NULL DEFAULT 0,
  -- 两侧未读计数：发消息时对对方 +1，标记已读时按已读位置重算
  low_unread_count    INT         NOT NULL DEFAULT 0,
  high_unread_count   INT         NOT NULL DEFAULT 0,
  -- 两侧已读位置：写到该侧已读的最后一条消息内部 id，逻辑引用不建外键
  low_last_read_message_id  BIGINT NULL,
  high_last_read_message_id BIGINT NULL,
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at          DATETIME(3) NULL,
  version             INT         NOT NULL DEFAULT 0,
  created_by          BIGINT      NULL,
  updated_by          BIGINT      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_dm_conversations_public_id (public_id),
  UNIQUE KEY uk_dm_conversations_pair (participant_low_id, participant_high_id),
  KEY idx_dm_conversations_low (participant_low_id, deleted_at, last_message_at DESC, id DESC),
  KEY idx_dm_conversations_high (participant_high_id, deleted_at, last_message_at DESC, id DESC),
  CONSTRAINT fk_dm_conversations_low FOREIGN KEY (participant_low_id) REFERENCES accounts (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_dm_conversations_high FOREIGN KEY (participant_high_id) REFERENCES accounts (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_dm_conversations_pair CHECK (participant_low_id < participant_high_id),
  CONSTRAINT ck_dm_conversations_message_count CHECK (message_count >= 0),
  CONSTRAINT ck_dm_conversations_low_unread CHECK (low_unread_count >= 0),
  CONSTRAINT ck_dm_conversations_high_unread CHECK (high_unread_count >= 0),
  CONSTRAINT ck_dm_conversations_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dm_messages (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  public_id       CHAR(26)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  conversation_id BIGINT        NOT NULL,
  sender_id       BIGINT        NOT NULL,
  content         VARCHAR(2000) NOT NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_dm_messages_public_id (public_id),
  KEY idx_dm_messages_conv (conversation_id, id),
  CONSTRAINT fk_dm_messages_conversation FOREIGN KEY (conversation_id) REFERENCES dm_conversations (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_dm_messages_sender FOREIGN KEY (sender_id) REFERENCES accounts (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

`dm_messages` 按追加型模板（`docs/db-design-spec.md` §4.2）只有 `id` / `public_id` / `created_at`，不继承 `BaseEntity`——消息不可编辑、不可删除，多出的三列没有写入方。

### D11 发送消息的事务边界

同一事务内：插入 `dm_messages` → 更新 `dm_conversations` 的 `last_message_at = 新消息 created_at`、`message_count = message_count + 1`、对方一侧的 `unread_count = unread_count + 1`。三处计数都用 `SET x = x + 1` 的批量更新，不读出来加一再写回。

`created_at` 由库侧默认值填充，插入后 Hibernate 用 `@Generated(INSERT)` 读回，因此摘要写入用的就是落库后的真实时间。

标记已读是另一条事务：按已读位置重算未读数并推进 `last_read_message_id`，不触碰 `message_count` 与 `last_message_at`。

推送在事务提交之后发出——先落库再推送，避免「推到了但回滚了」。

## 契约

类型写中性名（`string` / `number` / `boolean` / `Array<X>` / 另一个 record 名），供 `10-contract-check.ps1` 与后端 record、前端 interface 三方比对。

SSE 端点（`/stream`）不在表内：它的响应是 `text/event-stream`，没有 JSON 形状可比对。

| 接口 | 字段 | 类型 |
|---|---|---|
| DmPeerResponse | publicId | string |
| DmPeerResponse | displayName | string |
| DmPeerResponse | avatarUrl | string |
| DmConversationResponse | publicId | string |
| DmConversationResponse | peer | DmPeerResponse |
| DmConversationResponse | messageCount | number |
| DmConversationResponse | unreadCount | number |
| DmConversationResponse | lastMessagePreview | string |
| DmConversationResponse | lastMessageAt | string |
| DmConversationResponse | createdAt | string |
| DmConversationListResponse | items | Array<DmConversationResponse> |
| DmMessageResponse | publicId | string |
| DmMessageResponse | senderPublicId | string |
| DmMessageResponse | content | string |
| DmMessageResponse | createdAt | string |
| DmMessageListResponse | items | Array<DmMessageResponse> |
| DmMessageListResponse | nextCursor | string |
| CreateConversationRequest | peerPublicId | string |
| SendMessageRequest | content | string |
| DmUnreadCountResponse | count | number |

`lastMessagePreview` / `lastMessageAt` / `nextCursor` 在后端可空，前端按 `string | null` 声明：10 号闸门会把 `| null` 归一成 `string` 再比。

## Risks / Trade-offs

- **[OR 查询的 index merge 可能退化为全表扫]**：会话数上千后逐个 `EXPLAIN` 检查；退化就改 `dm_participants` 表，`dm_conversations` 保留不动。
- **[SSE 订阅表在单实例内存]**：多副本部署时同一会话的两个用户可能连到不同 Pod，互相收不到推送。当前 1 副本不受影响；扩副本前必须补 Redis pub/sub，这是本次明确不做的事。
- **[SSE 长连接占用]**：每个打开的会话页一条连接。Spring MVC 的 `SseEmitter` 是异步的，不占请求线程，但受 Tomcat 最大连接数约束；需要在实现时设置超时与清理，避免断开的连接堆积。
- **[计数列会因人为改库而偏移]**：`backend/tools/RecountDmUnread.sql` 是修复入口，不在请求路径上自动跑；若长期偏移未被发现，未读数会持续不对。**不做顺带校验**：`GET /api/dm/unread-count` 在每个页面都渲染，让它顺带全量重算就把轻量端点变成了重查询，违背 D9 的初衷。对账是运维动作，不是请求路径的一部分。
- **[`06-schema-check.ps1` 会重建 schema]**：本地账号数据会被清空（`docs/harness-backlog.md` §2.8）。开发前先备份 `accounts`，或改用「只建新表」的手工 SQL 联调，最后一次再跑闸门。
- **[D6 的字段重复]**：`peer` 与 profile 名片是两份 DTO，字段漂移靠 10 号闸门与前端契约文件拦住。

## Migration Plan

1. `schema.sql` 追加两张新表（`CREATE TABLE IF NOT EXISTS`，不改既有表）。
2. `06-schema-check.ps1` 的断言清单加入 `dm_conversations` / `dm_messages` 与它们的唯一键、CHECK。
3. 本地联调前先导出 `accounts` / `posts` 数据；闸门跑完再回灌（或使用独立测试库）。
4. 回滚：两张新表无其它表依赖，删表即可；后端代码回退到上一提交。

## Open Questions

- 用户页的「发私信」入口待 `add-user-detail-page` 归档后另补（见 proposal 的「不在本次范围」），不影响本次表结构与接口。
