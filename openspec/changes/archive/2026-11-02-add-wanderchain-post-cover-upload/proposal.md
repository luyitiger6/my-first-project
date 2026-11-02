# Proposal

## Why

wanderchain 的写帖闭环已经能让作者自己发帖、改帖、删帖，但封面图只能填一个外部地址——编辑器里明写着「images are not uploaded here」。这意味着想配一张自己拍的图，得先找第三方图床，站点无法承接真实作者的内容生产。同时「帖子删除后封面图怎么办」这个问题此前被整体推迟，现在有了上传就必须回答，否则每删一帖就在磁盘上留一份无人引用的文件。

本次改动把封面图从「只能外部链接」补成「可上传、可托管、可回收」，让站内内容生产不再依赖第三方图床。

## What Changes

- 新增图片上传端点：登录用户提交一张图片，服务端校验类型与大小后落盘，返回可直接写入帖子封面的绝对地址。
- 新增图片读取端点：以上传返回的地址公开访问图片，带长缓存；地址不可枚举、不可越出存储目录。
- 新增存储配置：存储根目录与对外地址前缀由配置决定，可用环境变量覆盖，默认值写死在 `application.yml`。
- 帖子删除时回收本服务托管的封面文件；外部地址一律不碰，也不发起任何网络请求。
- 写帖与编辑页的封面字段从「只填地址」改为「可上传 + 仍可手填地址」，上传成功即回填并预览。
- 新增前端媒体契约镜像，并把媒体加入 10 号契约闸门的受管配对。
- 同源 API 代理补两条响应头透传（`cache-control`、`etag`），否则图片走代理后拿不到缓存头，翻页会重复下载同一张封面。

## Capabilities

### New Capabilities

- `wanderchain-media`：站内媒体资源的生命周期——上传准入（登录、类型、大小）、服务端生成存储标识、公开读取与缓存、随帖子删除回收托管资源。该能力独立于帖子，后续头像、景点图可直接复用。

### Modified Capabilities

无。既有 `wanderchain-posts` 与 `wanderchain-post-authoring` 对封面地址的要求是「空或 `http(s)` 绝对地址」，上传返回的正是绝对地址，两者不冲突；删除后的资源回收属新能力 `wanderchain-media` 的行为，不改写既有条款。

## Impact

- **后端**：新增 `web/media`（控制器 + DTO）、`service/media`（存储服务 + 类型判定 + 失败语义），新增 `wanderchain.media` 配置块与 `spring.servlet.multipart` 限制；`AuthInterceptor` 的公开路由表新增一条读取路由；`PostServiceImpl.delete` 增加回收调用。不新增数据表、不改 `posts` 表结构（`cover_image` 仍是 `VARCHAR(512)` 存绝对地址）。
- **前端**：新增 `lib/media`（上传客户端）、`lib/contracts/media.ts` 镜像、编辑器封面字段改造；`app/api/[...path]/route.ts` 补响应头透传。
- **闸门**：`harness/checks/10-contract-check.ps1` 的 `$contractPairs` 新增 media 一组，否则新 DTO 处于无对账状态。
- **文档**：`AGENTS.md` 的命令速查与目录树补媒体端点与新增包。
- **不涉及**：图片裁剪/压缩/缩略图、多图、对象存储、上传频次限制、内容审核、编辑换封面时的旧图清理（见 design 的待决项）。
