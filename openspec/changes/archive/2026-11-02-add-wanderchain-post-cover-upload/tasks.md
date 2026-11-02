# Tasks

## 1. 后端存储与配置

- [x] 1.1 新增 `wanderchain.media` 配置块（存储根目录缺省 `./media`、对外前缀缺省 `http://localhost:3000/api/media`，均可被环境变量覆盖）与对应绑定类，并把 `spring.servlet.multipart.max-file-size` 设为 `5MB`、`max-request-size` 设为 `6MB`（多留 1 MB 给 multipart 边界，否则正好 5 MB 的文件会先被容器拒掉），同时把存储目录加入 `backend/.gitignore`。验证：`mvn -f backend/pom.xml -q -DskipTests compile` 退出码 0，且启动时缺少任一配置项会失败而不是取代码内默认值。
- [x] 1.2 实现存储服务：按文件头部魔数识别 JPEG / PNG / WebP（WebP 需校验 `RIFF` 之后的 `WEBP` 标识），由识别结果决定扩展名，文件名用 26 位 ULID 生成，存储目录不存在时自动创建，并提供一个「地址属于本服务托管前缀才删除」的回收方法（IO 失败只记 WARN）。验证：编译通过；随后 2.1 的上传链路能证明三种格式识别正确、非法内容被拒。

## 2. 后端端点

- [x] 2.1 新增 `POST /api/media` 上传端点与只含 `String` / `long` 字段的响应体，未登录由既有拦截器拒绝，空文件、超过 5 MB、内容非白名单类型统一返回既有 `VALIDATION_FAILED`。验证：起服务后带登录 cookie 上传一张 PNG 得到成功状态与以配置前缀开头的绝对地址；把 `.txt` 改名成 `.png` 并声明 `image/png` 上传得到 `400` 且存储目录无新增文件。
- [x] 2.2 新增 `GET /api/media/{fileName}` 读取端点：先按「26 位大写字母数字 + 白名单扩展名」校验形状，不符直接 `404` 且不拼路径；命中后校验归一化路径仍在存储根目录内；存在时返回 `200`、与文件内容一致的 `Content-Type` 与长缓存头，缺失返回 `404`；并把该路由登记进 `AuthInterceptor.publicRoutes()`。验证：未登录 curl 一个已上传地址得到 `200`；形状不符的标识（如 `/api/media/abc.png`）得到 `404`，`/api/media/..%2F..%2Fpom.xml` 被容器以 `400` 拒于应用层之前（见 design D11）；响应头含 `cache-control` 且含长 `max-age`。
- [x] 2.3 在 `PostServiceImpl.delete` 中接入封面回收：DB 更新之后调用回收方法，仅当封面地址以配置前缀开头才删文件，文件缺失或删除抛错不影响删除结果。验证：删除一个用上传图作封面的帖子后，原封面地址返回 `404`；删除一个封面为外部地址的帖子仍返回成功且本地文件无变化。

## 3. 契约与闸门

- [x] 3.1 新增 `frontend/lib/contracts/media.ts`（上传响应字段镜像 + 端点常量），并在 `harness/checks/10-contract-check.ps1` 的 `$contractPairs` 增加 media 一组。验证：`powershell -File harness\checks\10-contract-check.ps1` 退出码 0，输出列出 3 组受管契约且字段名与类型双向一致。

## 4. 前端上传交互

- [x] 4.1 新增 `frontend/lib/media` 上传客户端（`FormData` 提交、沿用既有错误归一化口径），并在 `app/api/[...path]/route.ts` 的响应头白名单中补 `cache-control` 与 `etag` 透传。验证：`cd frontend; npx tsc --noEmit` 无输出；经前端代理请求一张已上传图片时响应带 `cache-control`。
- [x] 4.2 改造写帖与编辑页封面字段：保留手填地址输入框，新增「Choose image」文件选择与上传，成功后回填并展示 16:9 预览，上传中禁用提交并显式提示，上传失败保留原有地址并显示可读错误。验证：`npm run dev` 后在 `/posts/new` 选择一张图片，地址被回填且出现预览；上传进行中点保存不发请求；上传非法类型时字段保持原值并出现错误提示。

## 5. 文档与真实链路联调

- [x] 5.1 更新 `AGENTS.md`：命令速查补上传与读取端点、目录树补媒体包与前端媒体客户端、已知边界补「换域名需迁移已上传封面地址」「编辑换封面会留孤儿文件」「存储目录不入库」。验证：`powershell -File harness\checks\07-doc-consistency.ps1` 退出码 0。
- [x] 5.2 走一次完整真实链路：登录 → 上传封面 → 发帖（含封面）→ 广场与详情正确显示 → 编辑换一张封面 → 删除帖子 → 原封面地址返回 `404`。验证：浏览器实际操作结果与接口响应记录，任一环节不符即视为未完成。

## Workflow follow-up

- 人工审阅 proposal 与 spec 后放行实施。
- 实施完成后归档 change，并把 `wanderchain-media` 主 spec 同步进真相层。
