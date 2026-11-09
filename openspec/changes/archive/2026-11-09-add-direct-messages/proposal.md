# Proposal

## Why

wanderchain 目前只有公开的帖子与景点两条链路，用户之间没有点对点的沟通渠道：看到感兴趣的作者，只能回到帖子下留言，无法私下联系。私信补上这条缺失的路径，也是消息中心的前置——评论、点赞、收藏、私信四类提醒里，只有私信需要先有会话模型，没有它，消息中心最重要的一类内容无从聚合。

## What Changes

- 新增一对一文本私信：登录用户可向另一位用户发起会话，双方在会话内收发文本消息。
- 新增会话列表：按最后消息时间倒序展示我参与的会话，含对方昵称与头像、最后一条消息摘要与时间、未读数。
- 新增未读与已读：对方发来的消息计为未读；进入会话并显式标记已读后按已读位置重算；顶栏展示总未读数。
- 新增新消息实时推送：进入会话后建立 SSE 连接，对方的新消息在落库后推送到双方页面，断线自动重连并补齐。
- 会话唯一性：同一对用户只存在一条会话，重复发起返回既有会话，不重复创建。
- **不做**：WebSocket 与多实例推送广播（SSE 订阅表只在单实例内存，1 副本部署够用）、图片/文件/语音、群聊、撤回/编辑、拉黑/举报、消息全文搜索。
- **不在本次范围**：用户页的「发私信」按钮。`wanderchain-user-page` 能力目前只存在于未归档的 `add-user-detail-page` 中，本次改动会与其 delta 冲突。首版启动会话的入口是 `/messages` 页的新建表单，支持粘贴用户页地址或直接填对方标识；用户页入口待 `add-user-detail-page` 归档后另补。

## Capabilities

### New Capabilities

- `wanderchain-direct-messages`: 一对一文本私信的会话与消息读写——会话按参与者对唯一、六种读写行为（会话列表 / 发起会话 / 消息分页 / 发送消息 / 标记已读 / 未读总数）、会话内新消息推送、参与者鉴权、未读计数、文本长度与空白校验、游标分页。

### Modified Capabilities

（无。本次不修改任何既有能力的规格行为。）

## Impact

- **数据库**：`wanderchain` 库新增 `dm_conversations`、`dm_messages` 两张表，`06-schema-check.ps1` 的断言清单同步。该闸门会重建 schema，联调前需先备份本地账号数据（见 `docs/harness-backlog.md` §2.8）。
- **后端**：新增 `dao/dm`、`service/dm`、`web/dm` 三层与 `DmErrorEnum`；七个端点 `GET/POST /api/dm/conversations`、`GET/POST /api/dm/conversations/{publicId}/messages`、`POST /api/dm/conversations/{publicId}/read`、`GET /api/dm/unread-count`、`GET /api/dm/conversations/{publicId}/stream`（SSE），全部需要登录。
- **前端**：新增 `/messages` 会话列表与 `/messages/[publicId]` 会话页；顶栏新增消息入口与未读角标；新建 `lib/dm/` 客户端与 `components/dm/` 组件。
- **契约**：新增 `frontend/lib/contracts/dm.ts`，纳入 `10-contract-check.ps1` 的 `$contractPairs` 受管清单。
- **文档闸门**：新增 `docs/specs/wanderchain/messages.md` 单元文档，登记进 `08-spec-doc-breakpoints.ps1`。
- **复用**：会话列表内嵌的对方昵称与头像由后端用 `accounts` 表一次装配（design D6），字段口径与 `wanderchain-profile` 的公开名片一致；不新增资料端点，也不让前端为每个会话多打一次名片接口。
