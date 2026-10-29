# Tasks

本变更 10 条 Requirement / 30 个 Scenario 全部在 `specs/wanderchain-posts/spec.md`；实现方式见 `design.md` 的 D1–D10。

第 3 组（拦截器口径改造）是唯一会波及已归档能力的改动，独立成组并单列基线比对；它必须先于任何 posts 端点落地。

## 1. 基线取证与表结构

- [ ] 1.1 记录改造前的基线：在 `backend/` 执行 `mvn test`，把 `Tests run:` 计数与退出码写入本任务备注，作为第 3 组逐条比对的唯一基准（验证：命令退出码 0，计数已记录）
- [ ] 1.2 `backend/src/main/resources/schema.sql` 增加 `posts` 建表（照 design D5 的列、索引、约束、外键），验证：`06-schema-check.ps1` 执行后能建出该表且脚本重跑不报错
- [ ] 1.3 `harness/checks/06-schema-check.ps1` 的 `wanderchain` 断言清单加入 `posts` 表名、`uk_posts_public_id`/`idx_posts_feed`/`idx_posts_author` 索引、`fk_posts_author`/`ck_posts_status`/`ck_posts_version` 约束与 `created_at`，验证：跑 `06` 得到 `3 tables in wanderchain` 且 PASSED；再做一次负向验证（临时把某索引名改成不存在，确认退出码 1），随后改回并重跑 PASSED

## 2. 公共基类型与实体

- [ ] 2.1 新增 `common/web/ApiResponse` 空标记接口，并把 `AuthResponseBody` 改为 `extends ApiResponse`，验证：`mvn compile` 通过且既有认证测试全绿（行为不应有任何变化）
- [ ] 2.2 新增 `common/persistence/BaseEntity`（`@MappedSuperclass`，`protected` 字段 + `protected` 无参构造，8 列照 `db-design-spec` §4.1），验证：`mvn compile` 通过，且 `Account`/`AuthSession` 未被改动（`git diff` 中无这两个文件）
- [ ] 2.3 新增 `dao/post/entity/Post`（继承 `BaseEntity`，业务列 `authorId`/`title`/`content`/`coverImage`/`tags`/`status`/`publishedAt`）、`PostStatus` 枚举与 `PostStatusConverter`，验证：仓储测试覆盖「保存后按 `public_id` 可查」「软删除后按 `public_id` 查不到」，两条都绿
- [ ] 2.4 新增 `dao/post/repository/PostRepository`，含按 `public_id` 查未删除、按作者查、以及 keyset 条件（`(published_at, id) < (:publishedAt, :id)`）的查询，验证：集成测试造 5 条同秒发布的帖子，断言两页游标翻页不重复不遗漏

## 3. 拦截器口径改造（波及已归档能力，独立成组）

- [ ] 3.1 `config/WebMvcConfig` 把认证拦截器注册从 `/api/auth/**` 改为 `/api/**` 且去掉 `excludePathPatterns`；`AuthInterceptor` 内部改为 design D3 的公开路由表 + 默认拒绝，验证：`mvn test` 中既有认证测试全绿
- [ ] 3.2 公开分支实现「尽力解析令牌」（成功写 attribute、失败静默），使读端点能识别作者，验证：新增用例「公开读带无效令牌仍 200」与「受保护路径带无效令牌仍 401」两条都绿
- [ ] 3.3 新增参数化用例逐行钉住 design D4 的九宫格（6 个公开 + 3 个需登录），验证：该用例覆盖全部 9 个端点且每条断言的方法/归属与 D4 表一致
- [ ] 3.4 全量 `mvn test` 与 1.1 记录的基线逐条比对，验证：退出码 0，且 `Tests run:` 计数不小于基线、无既有用例被删改

## 4. 服务层

- [ ] 4.1 新增 `common/exception/PostErrorEnum`（只含 `POST_FORBIDDEN`/`POST_NOT_FOUND`，另三个复用 `AuthErrorEnum`），验证：单测断言 5 个错误码的状态码映射，并断言 `AuthErrorEnum` 的 7 个码数量未变
- [ ] 4.2 新增 `service/post/PostService` 与实现，含发布、编辑、删除三条写路径：作者取自登录身份、非作者 `403`、目标不存在或已删除 `404` 且先于作者判定、删除为软删除，验证：单测覆盖 spec R2 的 3 个与 R3 的 4 个 Scenario
- [ ] 4.3 实现详情查询：已发布对所有人可见、草稿仅作者可见、他人读草稿得 `404` 而非 `403`、已删除对所有人 `404`，验证：单测覆盖 spec R5 的 4 个 Scenario
- [ ] 4.4 实现列表查询：只含 `published`、游标分页、`limit` 默认 20 上限 50、非法游标 `400`，验证：单测覆盖 spec R4 的 4 个 Scenario，含「新增帖子时翻页不重不漏」
- [ ] 4.5 实现入参校验（标题 trim 后 1–120 字符、正文 ≤ 65535 字节、封面为空或 `http(s)` 绝对地址、标签 ≤ 10 个且每个 1–32 字符并去重），验证：单测覆盖边界值 0/120/121 字符、65535/65536 字节、11 个标签、含重复标签四类，且失败时不写库

## 5. Web 层与 DTO

- [ ] 5.1 新增 `web/post/PostController` 五个端点与 `dto` 三件套（`PostResponse`/`PostSummaryResponse` 实现 `ApiResponse`、`PostCreateRequest`/`PostUpdateRequest`），验证：MockMvc 断言五个端点的状态码与响应体骨架，`PostResponse` 的类型声明中的 `implements` 已生效
- [ ] 5.2 字段白名单测试：收集列表项与详情的全部字段名，与白名单双向差集为空，并断言不含内部主键、`deletedAt`、`version`、`createdBy`、`updatedBy`，验证：该用例在故意多写一个字段时会失败（先临时加字段确认红，再删掉）
- [ ] 5.3 来源校验先于认证：跨站且无令牌的写请求返回 `403` 与 `CROSS_SITE_REJECTED`（不是 `401`），同源写请求正常进入业务，验证：MockMvc 覆盖 spec R7 的 2 个 Scenario
- [ ] 5.4 更新 `AGENTS.md` §6 的 backend 目录树与 §7 命令速查（新增 `dao/post`、`service/post`、`web/post`、`common/persistence`），验证：`07-doc-consistency.ps1` 退出码 0

## 6. 契约闸门与前端契约文件

- [ ] 6.1 新建 `frontend/lib/contracts/posts.ts`，接口名与字段类型与后端 `web/post/dto` 逐字镜像（camelCase、两侧字段名集合相等），验证：`npx tsc --noEmit` 通过
- [ ] 6.2 `harness/checks/10-contract-check.ps1` 的 `$contractPairs` 追加 posts 一对，验证：跑 `10` 输出含 posts 且 PASSED；再做一次负向验证（临时改前端一个字段名，确认退出码 1），随后改回并重跑 PASSED

## 7. 集成验收

- [ ] 7.1 逐条 Requirement 对照：为 10 条 Requirement / 30 个 Scenario 逐项标注对应测试或闸门的位置，验证：产出映射清单且无遗漏项，无「仅口头覆盖」
- [ ] 7.2 一键验收：`powershell -File harness\run-all.ps1`，验证：退出码 0，11 道闸门全 PASS

## Workflow follow-up

- 在 `backend` 子模块内提交并推送，再回工作区提交新的 gitlink（AGENTS.md 第 6 条硬规则）。
- 归档：先同步 delta 到 `openspec/specs/wanderchain-posts/spec.md`，再 `/opsx:archive`，最后为归档提交补打 archive tag。
- t10（`docs/db-design-spec.md` 里 5 处 `06-flyway` → `06-schema-check` 的文档漂移）仍挂起，等它真正拦路时再处理。
