# Design

## Context

- 帖子封面的落库形态已经固定：`posts.cover_image VARCHAR(512)` 存**绝对地址**，`PostInputRules.normalizeCoverImage` 只接受空值或 `http(s)` 绝对地址，前端 `lib/posts/post-input.ts` 是同口径镜像。本次不改变这条契约，上传端点要做的是产出一个本来就合法的地址。
- 后端 `/api/**` 全量受 `AuthInterceptor` 保护，公开与否由 `AuthInterceptor.publicRoutes()` 这张代码内表决定（按「路径 + 方法」登记）。新增的读取端点必须在这张表里登记，否则图片请求会要求登录。
- 前端所有 API 调用都走 `app/api/[...path]/route.ts` 同源代理（逐段 `encodeURIComponent` 拼接），响应侧只透传 `content-type`、`retry-after`、`set-cookie` 三类头。图片经代理后若拿不到缓存头，每次渲染都会重新下载。
- 运行期依赖目前只有 `8806` 的 MySQL 与 `6606` 的 Redis。机器上虽有 MinIO（`8000/8001`），但它是 green-note 那套实例，跨项目共用会带来污染与凭据耦合。
- Spring Boot 的 multipart 默认单文件上限是 1 MB，不显式抬高的话 2 MB 的正常照片会被容器层直接拒掉，且错误形态不是统一的业务错误体。

## Goals / Non-Goals

**Goals:**

- 封面图的上传、落盘、读取、随帖回收形成闭环，全部在一台机器上可跑，不引入新中间件。
- 存储实现可替换：换对象存储时只需要替换一个存储类，控制器与业务侧不变。
- 上传与读取的错误语义和既有链路一致：参数类问题 `400`、未登录 `401`、缺失 `404`，不新增错误码体系。

**Non-Goals:**

- 图片裁剪、压缩、缩略图、格式转换、按内容去重、多图、内容审核、上传配额与频次限制。
- 存量外部封面地址的迁移或本地化。
- 编辑帖子换封面时清理旧图：本次只做「删帖即删图」，编辑替换留下的孤儿文件是已知缺口，随后续「个人内容中心」或定时清理一并处理。

## Decisions

**D1 本地磁盘而不是对象存储。** 零新增依赖、零新增容器、零新增运行期外部依赖，而这条链路上要练的东西（multipart 解析、类型判定、路径越界防护、文件回收）与存储介质无关。被否：复用现有 MinIO（那是 green-note 的实例，跨项目污染且要共享凭据）；为本项目新起 MinIO（多一个容器、多一道连通性闸门、仓库还要新增 compose 文件，收益与成本不匹配）。

**D2 上传返回绝对地址，不改既有封面校验。** 对外前缀由配置 `wanderchain.media.public-base-url` 给出，默认指向前端同源地址（`http://localhost:3000/api/media`），图片因此与页面同源，不需要额外 CORS 也不需要浏览器直连后端端口。代价是地址里烘焙了主机名，换域名后历史地址失效——这一点登记在风险里；要彻底解决得把封面改成相对路径，那需要 MODIFIED 既有帖子能力，不在本次范围。

**D3 图片类型按魔数判定，扩展名由内容决定。** 只读文件头部若干字节比对签名：JPEG `FF D8 FF`、PNG `89 50 4E 47 0D 0A 1A 0A`、WebP `RIFF` + 第 8–12 字节 `WEBP`（只判 `RIFF` 会把 AVI 放进来）。客户端文件名与 `Content-Type` 一律不采信。被否：只查声明的 `Content-Type`（可任意伪造）；用 `ImageIO` 解码（WebP 需要额外依赖，且解码大图有内存与 CPU 代价）。

**D4 存储标识 = 26 位 ULID + 由魔数决定的扩展名。** 读取时先按 `^[0-9A-Z]{26}\.(jpg|png|webp)$` 匹配，形状不符直接 `404` 且不拼路径；命中后用 `root.resolve(name).normalize()` 再判一次是否仍在 `root` 之内（双保险，防止大小写与编码差异绕过）。不采信客户端文件名的任何部分。

**D5 multipart 上限在配置层与服务层各设一道。** `spring.servlet.multipart.max-file-size` 与 `max-request-size` 设为 `5MB`，让容器层放行到业务层；业务层再判一次字节数，超限时抛既有的 `VALIDATION_FAILED`，保证返回的是统一错误体而不是容器默认的异常页面。

**D6 删帖回收在 DB 更新之后、事务内 best-effort 执行。** `PostServiceImpl.delete` 在 `saveAndFlush` 之后调用存储服务的回收方法；该方法只在封面地址以配置前缀开头时才删文件，`IOException` 只记 `WARN` 不抛出。被否：注册到事务提交后回调（多一层时序复杂度，MVP 不值得）；删除失败即回滚 DB（会让删帖因为磁盘问题失败，直接违反 spec 里「文件缺失或删除失败不得让删除请求失败」）。

**D7 端点形状：`POST /api/media` 受保护、`GET /api/media/{fileName}` 公开。** 读取路由必须登记进 `AuthInterceptor.publicRoutes()`，与既有「全站默认保护 + 代码内公开清单」的机制保持一致；上传不登记，默认即受保护，不需要额外注解。

**D8 前端只改封面字段的交互，不改数据形状。** 新增 `lib/media` 上传客户端，编辑器封面区在原 `type="url"` 输入框旁加一个「Choose image」文件按钮与预览图；上传成功回填 `coverImage`，`PostDraftInput` 结构不变，`reviewPostInput` 的口径一行不改。

**D9 媒体契约进 10 号闸门。** 新增 `frontend/lib/contracts/media.ts` 镜像 `MediaUploadResponse`，并在 `$contractPairs` 增加一组。注意该闸门对映射表外的类型（嵌套类型、集合泛型）是 fail-closed 判红，所以响应 DTO 只使用 `String` 与 `long`。

**D10 代理补两条响应头透传。** `app/api/[...path]/route.ts` 的响应头白名单增加 `cache-control` 与 `etag`。不透传 `content-length`：流式响应下长度头与实际字节一旦不一致反而会造成截断。

**D11 编码路径分隔符的拒绝发生在容器层，spec 按容器口径写。** 初稿把「请求 `/api/media/..%2F..%2Fpom.xml` 得到 `404`」写成验收断言，实施时实测为 `400`：Tomcat 的 `allowEncodedSlash` 默认为 `false`，含 `%2F` 的 URI 在 CoyoteAdapter 阶段即被判非法，请求到不了任何过滤器与控制器，应用层没有任何机会回复 `404`。被否：打开 `allowEncodedSlash` 换取断言通过——那是为了一条断言的措辞放松全局 URI 校验，代价方向错误。定稿改为把两种拒绝分开写：形状不符的标识由应用层回 `404`，含编码分隔符的 URI 由容器以 `4xx` 拒绝，两者共同的真实约束是「不读取存储根目录之外的任何文件」，这条才是需要守住的东西。

## Risks / Trade-offs

- [地址烘焙主机名] 换域名或换端口后历史封面地址失效 → 前缀是单点配置，改完只影响新上传；把「换域名要迁移封面」写进 `AGENTS.md` 的已知边界。
- [磁盘无总量约束] 登录用户可反复上传把盘写满 → 单文件 5 MB 上限 + 登录门槛，配额与频次限制登记为后续项。
- [代理会把整个上传体读进内存] `request.arrayBuffer()` 在 5 MB 内可接受 → 上限就是防线，超过后不再扩。
- [回收失败留孤儿] 文件删除抛错时只记日志，磁盘上会留下无人引用的文件 → 本次接受，后续定时清理兜底。
- [存储目录进工作区] 文件落在后端仓库内会污染 `git status` → 目录加入 `backend/.gitignore`。
- [删帖与删文件不同步] DB 已提交但删文件前进程崩溃 → 结果是孤儿文件而不是坏链接，方向安全。

## Open Questions

| 级别 | 问题 | 影响任务 | 默认倾向 |
|---|---|---|---|
| 一般 | 存储根目录缺省路径放哪 | 1.1 | `./media`（相对后端工作目录），并加入 `.gitignore` |
| 一般 | 是否需要上传频次限制 | 2.1 | 不做：登录门槛 + 5 MB 上限对当前规模足够 |
| 一般 | 封面预览是否需要固定宽高比占位 | 5.2 | 固定 16:9 容器 + `object-fit: cover`，避免图片加载时页面抖动 |
