# Proposal

> 产品阶段输入见 `docs/prd/wanderchain-user-module.md`（用户模块三块功能的活文档：澄清五要素、目标衡量、非目标、用户故事、功能清单、信息展示口径、交互流程、异常面、验收标准、优先级、方案取舍、风险、待决项、分期）。本文只承担本次变更的内容与影响面；可验收行为以 `specs/` 的 Scenario 为准，技术方案见 `design.md`。同目录 `prd.md` 是阶段 1 立项时的产品快照，不再同步修订。

## Why

wanderchain 的广场上，作者不是人，是一串标识：帖子卡片渲染的是 `Author ID: 01ARZ3…5FAW`，点开是 26 位完整 ULID（`components/posts/post-card.tsx`）。账户其实早有 `display_name` 列，注册时可填，但它的唯一可见位置是登录者自己的顶栏——内容流里从不出现。

后果是可观测的：读者想记住某位作者只能记住标题，想找「上次写稻城那篇的人」只能翻历史；社区因此只能围绕内容，无法围绕人，后续任何「关注作者」「私信作者」都缺少最基础的前提。本次不是「加一个个人中心页面」，而是把作者从标识变成可识别的人——这也是后续通知（「谁赞了你」需要有主语）与站内信（需要有可对话的对象）的前置。

## What Changes

- 新增 wanderchain 个人资料能力：头像、昵称、个人简介、兴趣标签四项字段的读取与编辑；已登录用户只能编辑自己的资料。
- 新增公开的作者名片读取：按 `publicId` 批量取「昵称 + 头像」，供内容流渲染；游客可读。
- 新增个人中心页面：已登录用户从站点任一页面 ≤2 次点击可达；未登录访问展示登录引导且不发起资料读取（不扩展既有登录回跳白名单）。
- 广场帖子卡片的作者展示由 26 位对外标识改为「昵称 + 头像」；名片尚未返回时显示占位，MUST NOT 回退到标识。
- 昵称编辑沿用既有 `display_name` 列，因此 `/api/auth/me` 的响应字段集合不变，顶栏显示随编辑自动同步；**不改** `wanderchain-posts` 的响应白名单。
- 头像上传复用既有媒体能力的准入口径（登录、5 MB、JPEG/PNG/WebP、公开读取），不新增第二套上传通道。
- **本次不做**：帖子详情页与评论区的作者展示（阶段 2 随通知一起收口，本轮交付后会存在「广场显示昵称、详情显示标识」的已知不一致）；消息通知；站内信；公开用户主页 `/users/{publicId}`；「我的帖子 / 我的收藏」聚合；收藏通知与踩的通知；实时推送；通知设置；扩展登录回跳白名单（既有 `wanderchain-auth-frontend` 只接受 `/posts/{publicId}`，改它要新增第三个能力 delta）。

## Capabilities

### New Capabilities

- `wanderchain-profile`: 个人资料的字段口径与读写边界——头像、昵称、简介、兴趣标签的校验与更新，本人编辑的权限边界，以及面向内容流的公开作者名片批量读取。

### Modified Capabilities

- `wanderchain-post-feed`: 「真实帖子卡片与详情入口」的 Requirement 中，作者展示口径由「作者对外标识」改为「昵称 + 头像」，并新增名片加载中显示占位、名片缺失时不回退到 26 位标识两个 Scenario。

## Impact

- **backend**：`schema.sql` 的 `accounts` 表新增头像地址、简介、兴趣标签三列（昵称沿用 `display_name`）；新增 `service/profile`、`web/profile` 两层与对应 DTO，资料字段挂在 `accounts`，复用 `dao/auth` 的实体与仓储（不新建 `dao/profile`）；`AuthInterceptor.publicRoutes()` 登记名片读取与标签清单的 `GET`。
- **frontend**：新增 `lib/contracts/profile.ts`（与后端 record 同名同字段）、`lib/profile/`（接口客户端与视图模型）、`app/me/`（个人中心）；`components/posts/post-card.tsx` 与 `lib/posts/` 的卡片视图模型改为渲染名片，新增名片批量取数与占位态。
- **harness**：`10-contract-check.ps1` 的 `$contractPairs` 追加 profile 一组；`08-spec-doc-breakpoints.ps1` 的 `$pairs` 登记新增单元文档。`06-schema-check.ps1` 只断言表名、索引、约束、生成列与 `created_at`，不校验列名，因此不改；新列靠它每次 drop 重建生效。
- **docs**：新增个人中心的单元文档与断点声明并登记进 `08-spec-doc-breakpoints.ps1` 的 `$pairs`；`docs/specs/wanderchain/post-feed.md` 的作者展示与「不包含」两节需改写。
- **openspec**：本次产生 1 个新能力与 1 份 delta；归档时合并进 `openspec/specs/`，并为新增 Scenario 在 `docs/spec-evidence.json` 登记证据。
