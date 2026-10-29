# Proposal

## Why

认证能力已归档并全绿：9 个端点、后端容器装配测试与 326 例前端测试、11 道闸门全 PASS。但认证当初的引入动因是「社区分享帖子/经验」的前置门禁——门禁装好了，被门禁保护的东西还一个都不存在：`openspec/specs/` 下没有 posts 能力，后端 `com.luyi.myfirst` 只有 `auth` 一条业务线，`frontend/app/community/page.tsx` 仍是 18 行占位页。

帖子是这个仓库第一个**读公开、写需登录**的资源。它会把两件至今没被验证过的事摆上台面：三层架构与 DTO 分离能否复制到第二条业务线，以及「同一路径的 GET 公开、POST 受保护」在当前纯路径拦截器下到底能不能表达（结论：不能，见 What Changes）。

## What Changes

- **新增能力 `wanderchain-posts`**：帖子的数据模型 + 发布、编辑、删除、列表、详情五条对外行为，以及「读公开、写需登录」的访问边界。
- **持久化**：`backend/src/main/resources/schema.sql` 增加 `posts` 表（`CREATE TABLE IF NOT EXISTS`，落在既有 `wanderchain` 库）。沿用「手写 DDL + 启动幂等执行」，不引入迁移框架。
- **公共实体基类**：新增 `common/persistence/BaseEntity`（`@MappedSuperclass`），字段照 `docs/db-design-spec.md` §4.1 取全 8 列（`id`、`public_id`、`created_at`、`updated_at`、`deleted_at`、`version`、`created_by`、`updated_by`）。`Post` 是第一个继承者。
- **响应基类型**：把既有 `AuthResponseBody` 的标记接口模式泛化为 `common/web/ApiResponse`，`AuthResponseBody` 保留为其子接口。**不**引入全站响应包装，**不**改动 `AuthResponseGuard` 的作用域（那是另立变更的 Q16）。
- **拦截器口径改造**：`AuthInterceptor` 从「只注册 `/api/auth/**` + 六个排除路径」改为「注册 `/api/**` + 内部方法感知的公开读清单 + 默认拒绝」。这是让「同一路径 GET 公开、POST 需认证」成为可表达事实的唯一低成本路径；纯路径的 `excludePathPatterns` 没有 HTTP 方法维度。
- **错误码**：新增独立固定集合（`PostErrorEnum`）。认证的 7 个错误码**不变**——`wanderchain-auth` 的「统一错误结构」一条明确限定在认证端点范围内。
- **闸门覆盖**：`06-schema-check.ps1` 的断言清单加入 posts 的表名/索引/约束，`10-contract-check.ps1` 的受管清单追加 posts 一对，并新建 `frontend/lib/contracts/posts.ts`。
- **无 BREAKING 变更**：不存在被破坏的既有对外契约；已有 9 个认证端点的路径、状态码、错误码、cookie 行为全部保持原样。

## Capabilities

### New Capabilities

- `wanderchain-posts`: 帖子的持久化模型（含公共审计列与软删除）、对外只用 `publicId` 标识、发布/编辑/删除/列表/详情五条行为，以及写操作需登录、读操作公开的访问边界。

### Modified Capabilities

（无。`wanderchain-auth` 的行为不改变——它的「写请求来源校验」一条本就覆盖「所有可能产生状态变更的请求」，「统一错误结构」一条限定在认证端点；`contract-consistency` 的「受管范围可配置」一条已明文允许只追加清单条目而不改比对逻辑；`database-baseline` 不枚举具体表名。）

## Impact

- **后端新增**：`dao/post/{entity,converter,repository}`、`service/post/{,impl,model}`、`web/post/{,dto}`、`common/persistence/BaseEntity`、`common/web/ApiResponse`、`common/exception/PostErrorEnum`。
- **后端修改**：`config/WebMvcConfig`（拦截器注册口径）、`web/auth/interceptor/AuthInterceptor`（方法感知 + 默认拒绝）、`resources/schema.sql`（新增 posts 表）。
- **前端**：新建 `lib/contracts/posts.ts`（与后端 DTO 逐字镜像，供 `10-contract-check` 比对）。
- **Harness**：`harness/checks/06-schema-check.ps1` 断言清单、`harness/checks/10-contract-check.ps1` 受管清单。
- **数据库**：`wanderchain` 库新增 `posts` 表；`06-schema-check` 会 DROP 并重建该库，故 posts 表必须在 `schema.sql` 里幂等可建。
- **风险**：拦截器注册口径从 `/api/auth/**` 扩到 `/api/**` 会让**每一个** `/api/**` 端点默认进入认证判定。必须逐条验证 9 个认证端点的公开/受保护归属保持不变，否则已归档能力的 70 个 Scenario 会静默失效。
- **不在范围**：前端帖子页面与交互；图片上传与对象存储（`coverImage` 只存 URL 字符串）；评论、点赞；按标签筛选（`tags` 先作为 JSON 元数据存储，`db-design-spec` §8.1 禁止直接对 JSON 做函数过滤）；角色权限（作者/版主/管理员）；全文检索；首页 mock 类型 `frontend/lib/home/types.ts` 中 `Post.id: number` 与真实契约的对齐（属后续前端接线变更）。
