# Design

## Context

动机见 `proposal.md` 的 Why；行为边界见本 CHANGE 的五份 delta spec。本文件描述拟采用的实现，下面的现状来自代码读取，不代表已实施或已完成运行复现。

- `app/posts/posts-content.tsx` 当前使用首页 `mockRepository.feedPosts`；`lib/home/types.ts` 的 Post 使用数字 `id`、`titleEn/summaryEn/authorEn/coverUrl/publishedAt`。真实 `PostSummaryResponse` 使用字符串 `publicId`、`title/coverImage/authorPublicId/createdAt`，没有摘要、作者显示名、城市或浏览数。
- `use-infinite-posts.ts` 当前绑定 Mock Post；其共享 `activeRef` 会在新 effect 中重新置为 true，不能作为不同请求代次的身份。真实接入要用延迟响应测试验证隔离，不沿用“无需改组件”的旧承诺。
- `PostServiceImpl.read` 已处理草稿可见性，但 `PostView/PostResponse` 缺统计；列表已有三个计数查询，可以复用统计口径。
- `PostInteractionServiceImpl.listComments` 当前父映射的 value 来自回复自身 publicId；创建回复的 parent 校验只保证存在、未删除和同帖，不限制无限深度。修正列表关系，不新增服务端层级限制或历史数据迁移。
- 互动 service 的 `requireExistingPost` 仅检查存在与软删除。评论读取目前缺 viewer 参数；新附属读取须共享详情可见性判定。
- `AuthProvider` 提供 `loading/guest/user`、user 和 refresh；login/register 在写成功后 refresh，但 refresh 会自行捕获读取失败。`AuthForm` 当前无 next，成功固定回 `/`，因此安全回跳还需区分“写已成功但会话未确认”。
- `AuthInterceptor` 明确公开列表、详情和评论 GET，其余默认认证。新个人状态路径的层级不会匹配现有单段详情通配，不扩大通配范围。
- 真实响应 DTO 当前采用 `ApiResponse` 标记；新 DTO 遵循现有代码及出站守卫，不按陈旧文档另建标记体系。`10` 已覆盖 posts DTO，能归一化 nullable string 与字面量 union；空值、词表、运行期行为还须由端点测试验证。
- 样式遵循 CSS Modules、`--wc-*`、desktop-first 与唯一 `wc-container`。现有 `08` 配对是单文档对单 CSS，局部限宽须用 `max-inline-size`。

## Goals / Non-Goals

**Goals:**
- 保持公开内容、个人状态与写入校准分区，但共享帖子/账户上下文的失效规则。
- 契约镜像与 UI 模型分离；真实 DTO 不强转为首页 Mock 模型。
- 复用真实表、现有认证及计数语义，控制必要后端配套的改动面。
- 当前以本次真实页面操作链路调通作为 MVP 交付依据；风险分支的自动化测试与测试文档后置到用户需要时，区分功能可用、已有局部证据与完整验收，不反复验证未受影响的依赖。

**Non-Goals:**
- 不扩展用户资料 API，不给卡片补虚构作者或摘要。
- 不新增状态管理、请求缓存、UI、富文本或样式库；不改数据库结构，不扩张全站鉴权/响应框架。
- 不清理无关历史规格、IDE 自动产物或既有未提交变动；本轮范围外的边界见 proposal。
- 不做科研式深挖：不主动研究无关底层机制、字节码或二进制，不把验证工具自身变成额外工程。排障只到解决当前业务阻塞并确认链路可用为止，非阻塞细节后置。

## Decisions

### D1：帖子域真实契约与视图适配

- 新增 `lib/posts/posts-api.ts` 端点层：feed、detail、comments、createComment、deleteComment、vote、cancelVote、bookmark、cancelBookmark、readMyInteractions。组件不直接 fetch，全部走 `/api` 同源代理，保留默认 cookie 凭据语义。
- 复用平台 fetch、URLSearchParams、AbortController；请求层收口状态码、业务 code、错误体解析及空体 `204`，不假定所有失败均为 JSON，不因非 JSON 上游错误导致未捕获异常。
- `lib/contracts/posts.ts` 仅镜像后端字段并登记路径；新增 `PostInteractionStateResponse`，不在契约层放请求或 UI 派生状态。
- UI 排序类型在帖子域独立定义，保留 `latest/hottest/mostDiscussed` URL 词表，映射到真实 HTTP 词表；列表请求固定 `limit=20`，cursor 原样透传，hasMore 仅由 nextCursor 派生。
- 新增 `lib/posts/types.ts` 和视图适配：保留 publicId、title、coverImage、tags、authorPublicId、createdAt 及统计，不复制双语 Mock 字段。卡片显示标注为 `Author ID` 的真实标识，时间按英文格式并注明来自创建时间，不能冒称真实发布时间字段。
- 修改 Hook/list 的类型依赖，使用 publicId 作为 key/去重标识；纯展示 `PostCardStats` 可复用，详情的按钮组件与首页统计组件保持独立。首页 Mock 仓储不变。
- 详情链接只使用真实 publicId；返回广场链接保存已验证的 UI sortBy，直接进入详情时默认返回 `/posts`；浏览器返回广场也触发新读，不使用持久化旧计数。

备选：把真实 DTO 填充成首页 Mock Post，会制造假摘要/姓名/数字 ID；扩展后端作者资料/摘要会扩大已选范围，因此均不采用。

### D2：一次受保护读取返回本人投票和收藏

新增 `GET /api/posts/{publicId}/interactions/me`，新独立 Controller 放在 `web/post/interaction/`，仅通过 service 接口读取：

| 响应 | Java record 组件 | TypeScript 镜像 |
|---|---|---|
| PostInteractionStateResponse | String voteDirection | `'up' \| 'down' \| null` |
| PostInteractionStateResponse | boolean bookmarked | boolean |
| PostResponse 新增 | long commentCount / upVoteCount / bookmarkCount | number / number / number |

- service 新增当前账户状态查询及内部 model，账户来自 VerifiedToken，不接受 account 参数。
- 复用 VoteRepository、BookmarkRepository 的本人有效记录查询；方向转换为小写 dbValue；不存在本人记录返回 null/false，目标不可见返回 404。
- Controller 从 VERIFIED_ATTRIBUTE 取当前身份，返回独立 record 和 `Cache-Control: no-store`；前端读取也使用 no-store，不进入跨用户缓存。
- 不增加该路由的公开登记，新增默认拒绝测试防止更深 GET 被通配放行。

备选：两个 current 接口增加状态与竞态组合；在公开详情混入私人字段增加缓存/隐私耦合；仅凭写响应或统计猜测个人状态不能恢复刷新，所以采用独立聚合读取。

### D3：详情统计和附属可见性复用

- 扩展 PostView、PostResponse 及其集中映射，使 read/publish/edit 的同一响应形状都包含三项统计。复用现有有效记录计数；新帖为零，反对票不计入 upVoteCount。列表 DTO 不增加个人字段。
- 在帖子域提取内部可读帖子判定，供详情、评论列表、个人状态读取复用，边界仅为存在、软删除、草稿作者。Controller 不依赖 repository，service 不依赖 web。
- 评论 list service 增加 nullable viewer，公开 GET 尽力解析 cookie 后传入，游客仍可读已发布；私有状态先由拦截器认证，再做帖子可见性。
- 本次可见性修正限于读取。既有互动写 API 的权限、来源次序、201/200/204 和 DELETE 403/404 不改；前端草稿只读。若实施发现还需改变写端草稿规则，应暂停并提交规格调整，不顺手扩入。

备选：各 Controller 复制草稿分支会形成多个判定出口；禁止所有草稿读取又会违反作者可读详情的既有能力，两者都不采用。

### D4：回复关系与评论分页

- service 对当前页非空 parentId 批量收集，用 repository 批量取父记录并以父内部 id → 父 publicId 映射，允许取软删除父记录的标识，但不得输出其正文。作者标识同样批量解析；不逐回复增加查询。
- 保留已有创建时间倒序、稳定次序及不透明游标，默认 20、上限 50，不改为按根评论分组分页。
- 前端保留扁平全局倒序列表：顶级无缩进，回复只有一级缩进并附父上下文。父在已加载集合时展示文本上下文和定位入口；否则统一显示上下文不可用提示，不能判定其一定已删除。
- 初次返回回复但父尚未加载时仍显示回复。继续翻页获取父后仅更新上下文，不重排已有条目、不把回复重复搬到父下；历史更深关系同样最多一级缩进。
- 新 UI 只允许选择 parentPublicId=null 的顶级评论作为回复目标；现有服务端没有最大深度限制，本次不改变该契约，也不删除历史深层回复。
- 评论创建或删除成功后重置第一页与 cursor，按 publicId 去重。删除根评论不级联删除回复。分页中断与重试保留同一 cursor。

备选：直接拼嵌套树会丢失跨页父关系并改变排序；新增根分页/回复分页 API 会扩大配套范围，因此保留全局倒序和关系上下文。

### D5：状态机、请求代次和写后校准

- 页面由详情读取、评论分页、个人状态三个状态区组成；每区有 loading/ready/error，详情另有 not-found；个人状态 error 不等于 null/false。
- 请求带帖子与账户上下文键、递增代次，AbortController 用于取消；响应落地必须再次核对键与代次。abort 不是唯一保护，不依赖共享 active 布尔值。
- 身份 loading 期间不启动个人状态或写操作；初始详情待身份解析结束后读取。user/guest 变化时重新读取详情与评论，防止作者草稿在登出后继续展示；若 guest 意外收到 draft，不展示正文，提供统一不可见状态及会话复核入口。
- 每个详情采用一个 mutation 锁，串行执行评论、删除、投票、收藏，关联写与校准未结束时禁用所有写入口并暂停评论翻页。写开始使写前读取失效；写成功再开新读代次，避免统计被旧响应覆盖。
- 不乐观更改选中态或算术加减总数。写成功后投票/收藏刷新详情和本人状态；评论创建/删除刷新详情和评论第一页。请求并行，但各区独立显示校准结果。评论内容前端去空白严格镜像 Java String.trim()（首尾 U+0000–U+0020），计长使用 UTF-16 length，不直接用 JS trim() 的更大空白集合或 UTF-8 字节数。
- 写已成功但刷新失败：提示“已提交，刷新失败”，受影响数据标为待刷新；个人状态读取失败禁用切换，允许只重试读取。旧计数可带待刷新标签保留，不称为最新。评论创建响应成功即可清除已提交输入；删除成功移除已删除条目并等待列表校准。
- 写失败保持最后确认的选中态和当前输入，不自动重发；网络错误不能保证写未发生，提示结果待确认并先读取，不让重试按钮直接重发评论。
- 当前页 401 的输入可暂留内存并锁定原账户归属，清除个人状态，复核 AuthProvider；主动登出/换账户/离开路由清除草稿与回复目标。401 引发的 guest 状态只保留锁定输入，不提供写操作；确认回到同一账户才可解锁，确认成其它账户即清除。草稿只存当前组件内存，不跨登录导航持久化。

备选：每类写互不锁定需要额外处理共享统计的写序；当前单页低频互动采用单锁，代价是短暂阻止并行动作。optimistic update 会混淆 DELETE 错误和反对票计数，因此不采用。

### D6：错误与认证回跳

| 结果 | 页面处理 |
|---|---|
| 401 UNAUTHENTICATED | 清个人状态、复核全局会话、显示带 next 的登录入口；不重放写 |
| 403 POST_FORBIDDEN | 显示权限/状态变化说明，允许重新读，不伪造取消或删除成功 |
| 404 POST_NOT_FOUND | 详情统一未找到；操作失败先复核详情，只有帖子 404 才转全页未找到 |
| 400 VALIDATION_FAILED | 输入错误或游标错误分流，输入保留，非法游标不静默重置为成功 |
| 403 CROSS_SITE_REJECTED | 来源拒绝独立说明，不当成会话过期 |
| 网络、非 JSON、5xx/502 | 区域错误与读取重试；写结果不明时只提供复核，不自动重发 |

- 新增 `lib/auth/return-to.ts`：next 在查询参数解码后只接受规范 `/posts/<有效 ULID>`，用严格允许列表拒绝 query/hash、额外路径段、百分号、反斜杠、`//` 和外部地址。身份仍只由 /me 确认，next 不携带身份或草稿。
- 登录/注册页读取 next 的组件必须置于 Suspense 边界，保留既有 Next prerender 约束；登录和注册互转链接只传校验后的 next。
- AuthForm 用“认证写成功、等待会话、确认成功/失败”分开处理；等待 AuthProvider 提供的真实 user 结果后 replace 合法目标或 `/`。若 /me 未确认，提供 refresh 重试，不再调用注册或登录写接口。必要时让内部 refresh 返回确认结果，保持全局失败仍归 guest 的既有行为。

备选：任意 pathname 或 URL 直传 router.replace 会产生 open redirect；在可读存储保留 token/用户或自动补发草稿违反认证与防重复边界，均不采用。

### D7：组件、样式与依赖

- 路由：`app/posts/[publicId]/page.tsx` 提供页头/页脚及详情入口；详情组件读取 route 参数并组织三状态区，不让请求绕过主布局。
- 组件：`post-detail`、`post-interaction-bar`、`post-comments`、`comment-composer`，MVP 先实现 tsx 与同名 module.css；行为测试留到用户需要时集中处理。状态 Hook 放帖子组件域，请求/类型放 lib/posts。
- 正文使用文本节点和 `white-space: pre-wrap`、`overflow-wrap`；封面空值/失败用占位，维持图像 alt。不使用 dangerouslySetInnerHTML 或额外 HTML 解析器。
- 操作原生 button、明确名称、aria-pressed/aria-busy、role=status/alert、错误描述关联及 focus-visible。删除确认形态待 Q3 确认，两种形态均必须可键盘取消、结束恢复焦点。
- 新详情、互动栏、评论、输入框 CSS 各采用 `640px` max-width 窄屏覆盖；容器仍由全局承担，局部限宽用 max-inline-size。不新增持续装饰动效，沿用 reduced-motion。
- 第三方用途：Next.js（路由、链接、Suspense）、React（状态）、Spring Web/JPA/Jackson（HTTP、事务、有效记录查询与 record 序列化）、Vitest + Testing Library（行为）、Playwright（浏览器）。不新增依赖；确需成熟库时先修订 proposal/design、依赖清单及约定，再经用户审阅。

### D8：增量联通与后置完整验收

当前 MVP：前后端先实现功能、对齐契约并走一次受影响的真实操作链路。已有登录/注册、账户初始化、构建/契约和 HTTP 联通证据直接复用，未改动且无相关故障时不重跑；登录仅作为进入当前业务的必要操作，不扩展成认证重验。只补尚未走通的页面操作，正常结果可见即可报告“MVP 功能已调通”，不把遍历全部 Scenario、补单测/E2E/测试文档或全量 Harness 当成开发前置。业务行为仍按 spec 实现，已发现的故障如实处理或报告；未验证边界与完整验收保持后置，不宣称无缺陷或全量通过。

以下自动化测试、文档、截图覆盖及完整验收安排仅在以后用户需要时执行；不是当前逐任务要求，既有已完成证据保留。

- 后端只扩展 service 对外接口与 Controller 的正常/主要异常测试：PostServiceTest/PostControllerTest 的详情统计；PostInteractionServiceTest/PostInteractionControllerTest 的个人状态、跨页父关系、软删除、可见性、白名单/缓存头/错误码。不为枚举或数据 record 单独凑测试。
- 前端覆盖请求方法/路径/body/204、排序映射、deferred 迟到响应、mutation 去重与校准失败、输入与身份分支；修改旧 Mock fixtures 的广场消费测试，首页 fixtures 不迁移。
- 桩式浏览器验收：新增 `docs/e2e/post-feed.spec.ts`、`post-interactions.spec.ts`，桩真实 DTO 格式而非 Mock Post，用 page.route 构造 401/403/404/400/502、空态、loading、乱序与写后刷新失败，覆盖登录/注册回跳及键盘流程。
- 真实联调：另建 `docs/e2e/post-interactions.live.ts` 与 `playwright.posts-live.config.ts`，新配置复用既有配置但只匹配该 live 文件、报告写独立目录；既有 `**/*.spec.ts` 桩套件不改匹配规则。运行器已原样转交 CLI 参数，真实链路以 `npm run test:e2e -- --config playwright.posts-live.config.ts` 显式运行，作为独立必验项，不使用 test.skip。live 文件不拦截业务 API，需要两个专用、已验证测试账户，由环境提供 `E2E_POSTS_ACCOUNT_A_EMAIL`、`E2E_POSTS_ACCOUNT_A_PASSWORD` 与 B 的对应变量。先用正确凭据在独立浏览器上下文登录，通过既有发帖 API 创建带运行唯一标识的帖子，再执行评论/回复/删除、票向切换/取消、收藏/取消、刷新和 A/B 隔离；结束仅软删除本轮建立的测试帖子。
- 真实用例不新增生产测试端点、不直写其它业务 schema、不重置限流桶、不记录密码/cookie。服务或凭据缺失立即 fail-closed 报前置条件，禁止 skip 或把桩结果称为真实联调通过。若没有测试账户，先取得用户授权；本轮用户已明确允许仅本地初始化两个专用账户。
- 本地初始化限定为 `backend/tools/SeedPostsAccounts.java` 与 `scripts/seed-posts-accounts.ps1`：仅连接本机 8806 的 wanderchain 与 6606 的 db 3，非 prod、无 HTTP 服务的临时 Spring 上下文；启动前检查两组环境变量完整且互不相同。脚本仅在两组凭据全部缺失时生成随机 `example.test` 邮箱及密码，不覆盖已有凭据。复用 `CaptchaServiceImpl.issue(String)` 的测试用签发、真实 `RegisterCodeService`、进程内开发 Outbox 和真实 `RegisterService`，不直接写 repository、摘要或缓存、不绕过校验。成功后凭据仅保留为本机用户环境变量；工具日志只写结果，不写密码、验证码、cookie 或 JWT。初始化不作为真实注册页面证据，之后仍由 3000 同源代理登录、读取 `/me`。工具在生产 profile 或非本地存储配置下必须在写入前拒绝。
- 截图必须显式捕获成功态，失败 auto fixture 不能代替视觉验收：1440×900 与 375×667 的正文/互动/回复、空态、错误态、选中态及删除确认；截图放忽略目录并附报告，逐项记录对应 Scenario。
- 单元文档沿用六段结构：更新 post-feed.md；新增 post-detail.md、post-interactions.md、post-comments.md、post-comment-composer.md，分别配对 post-detail.module.css、post-interaction-bar.module.css、post-comments.module.css、comment-composer.module.css。`08` 表添加四对，各自声明真相源与 ≤640px/>640px；不在一份文档声称校验所有未配对 CSS。
- 用户需要完整验收时集中运行 Maven service/controller 测试、前端 build/test、`08/10/11`、Playwright 桩与真实用例，最后 `harness/run-all.ps1` 必须退出 0 才报告完整验收通过；当前 MVP 不执行这套全量检查。单独校验本 CHANGE；仓库历史 auth-frontend Purpose 警告不在本次修补范围，不能把本 CHANGE 通过称为全量 OpenSpec 通过。

## Risks / Trade-offs

- [真实卡片缺摘要/姓名] → 明确移除旧 Mock 承诺，以真实标识和标签呈现；Q1 只确认排版与标识缩略，不默认增添作者资料接口。
- [评论为全局倒序，父常晚于回复] → 保留回复并显示上下文提示，批量补正确父标识，不承诺完整树或根评论分页。
- [现有取消可能返回 403/404] → 保留端点语义、提示变化、重新读取；不把所有 DELETE 当幂等成功。
- [真实数据排序键在翻页间变化] → 使用服务端不透明游标并按 publicId 去重；不承诺冻结快照或重做游标算法，发现超出既有契约的失败需暂停评估。
- [共享数据源与测试账户] → 本轮授权初始化仅新增两个随机专用账户，后续联通仅创建/软删除带本轮标识的帖子；不删除或修改既有账户、不清空库或 Redis，不触碰 green-note。初始化成功不重复创建；若只成功一个账户，保留本轮凭据并报告部分结果，不自动重跑或清理账户。
- [额外计数/校准读取] → 复用统计口径并串行写；本轮不加入缓存或请求合并框架，后续性能优化另立项。
- [作者草稿在身份变化后泄漏] → 三状态区随身份失效并重新读取，不能只清私人按钮而保留作者正文。
- [老测试只验证创建响应而未验证列表父关系] → 新增同页/跨页/父删除后的列表断言，以实际接口结果验收。

## Migration Plan

1. 人工审阅 proposal 与 delta；新的 apply 请求才授权实施。Q1–Q4 在关联任务开始前确认并写回 design，不自动选择未获确认的呈现细节。
2. 后端先补字段/端点/读取边界，前端契约随后镜像；接口为新增路径和追加统计字段，无 DDL 变更。已完成的测试不重做，后续新增测试按当前 MVP 规则后置。
3. 广场迁至真实帖子域，新增详情与认证回跳；首页 Mock 和普通登录默认行为保持。服务不可达显示真实错误，不用 feature flag 回退到假数据。
4. 当前只走本次尚未确认的真实页面操作链路，主功能调通后继续下一功能；文档配对、前后端自动化测试、Playwright 及总 Harness 等以后用户需要时集中处理。业务实现与完整验收分别跟踪，验收后置不把已调通业务记为未实现，也不提前勾选未跑的验收任务。
5. 回滚时恢复对应前后端已知可配合版本，保留无结构变更的测试/业务表；本 CHANGE 不授权提交推送。以后若用户授权发布，先提交推送子模块并确认远端可取，再更新父 gitlink，不绕过 00 检查。

## Open Questions

这里只保留不改变规格、端点、算法或任务分组的呈现细节，按用户希望的节奏在实施相关任务前确认；不得凭推荐自行拍板。若回答要求改变字段/行为/范围，暂停并走工件修订及重新审阅。

| 编号 | 级别 | 待确认内容 | 候选及推荐倾向 | 确认节点 |
|---|---|---|---|---|
| Q1 | 已确认 | 真实卡片及评论的作者标识、标签排版 | 用户选择短标识 + 可键盘展开完整 Author ID；卡片标签为轻量 outline 胶囊，按接口顺序自然换行，不新增姓名 API 或标签 | 任务 4.1 已确认 |
| Q2 | 已确认 | 详情互动栏的图标/文字组合及窄屏排列 | 用户选择正文下方非悬浮图标加英文操作文字，窄屏自然换行，不遮挡正文 | 任务 5.1 已确认 |
| Q3 | 已确认 | 本人评论删除确认形态 | 用户选择行内二次确认，保留明确确认、键盘取消与焦点恢复 | 任务 6.1 已确认 |
| Q4 | 已确认 | 回复输入框的位置 | 用户选择同一个评论输入框切换回复目标并聚焦，显示目标和取消入口，只允许根评论回复 | 任务 6.1 已确认 |

Q1 落地约束：作者默认标注 `Author ID` 并显示前 6 位/后 4 位缩略，中间省略；使用原生 details/summary 支持键盘展开与收起，完整标识为文本。卡片标签位于标题下方，不截去接口已有标签、不制造跳转或筛选行为；按原顺序显示并自然换行。评论作者沿用同一标识呈现。Q2 已确认：互动栏位于正文下方，使用单色 outline 图标与英文操作名称，窄屏自然换行；不采用悬浮栏或图标无名称的入口。Q3 已确认：本人评论下显示确认删除与取消，支持 Escape 取消；取消或失败恢复删除入口焦点，成功删除后将焦点移到评论区。Q4 已确认：顶级评论与二级回复共用一个输入框，选择根评论后切换回复目标并聚焦，保留取消回复入口，不提供对回复再回复。

环境前置条件（不是待定设计）：真实服务、允许来源以及两个专用测试账户凭据在任务 8.1 实跑前必须具备。缺账户时仅按本轮用户明确放行的本地初始化工具准备两组专用凭据；不降级为 Mock，不替换数据库，不把初始化代称为真实认证或互动验收。

## Implementation Evidence

### 任务 3：取消识别与认证回跳验证

- 取消识别根因：默认 jsdom 的跨执行环境 `DOMException` 不保证满足请求层的 `instanceof Error`；旧判定把 `AbortError` 转为网络错误。原取消用例连续三次失败，Node 环境对照通过；用户确认修正并继续后，改用安全的对象 `name` 判定。
- 影响与回归：fetch 拒绝及成功/失败响应体读取中的取消均原样抛出，不误报网络、HTTP 或 JSON 错误。回归位置为 `frontend/lib/posts/posts-api.test.ts`，包含 DOMException、跨环境结构对象、200/502 响应体取消及其它拒绝值。前轮默认 jsdom 的帖子请求、安全回跳及认证局部测试合计 104 项通过、退出码 0；不是全量前端验收。
- 生产构建：`npm --prefix d:\my-first-project\frontend run build` 输出编译、TypeScript、9/9 静态页面生成成功，`BuildExitCode=0`；登录与注册的 Suspense prerender 边界通过。多 lockfile root 推断仍有 warning，未擅自删除锁文件或改配置。
- 认证浏览器桩：`npm --prefix d:\my-first-project run test:e2e -- docs/e2e/homepage-u1-auth.spec.ts` 输出 `30 passed (53.3s)`，`AuthE2EExitCode=0`。原 A1–A18 保留；A19/A20 验安全导航与互转，A21 八种未知目标被拒，A22/A23 验只重读 /me、不重复认证或互动写入，显式截图附报告。报告为 `docs/e2e/playwright-report/index.html`。
- 验证边界：详情路由尚未实施，目标 `/posts/{publicId}` 此轮实际返回 404；上述回跳用例仅验证导航地址与认证请求，不证明详情正文、本人互动状态或真实认证联调可用。任务 4–8 仍待实施。
- 全量前端初次失败记录：`npm --prefix d:\my-first-project\frontend run test` 输出 `Vitest failed to find the runner`，堆栈在 `vitest.setup.ts:5` 的 beforeEach 注册，另有 worker 在 starting state 异常退出；`FullTestExitCode=1`，33 suites 初始化失败、没有执行业务断言。先暂停，再取得用户“排查并继续”确认。
- 根因与最小化：同一文件 `lib/auth/return-to.test.ts` 以小写盘符 `d:` 启动连续三次退出 1，仅将 prefix 改为文件系统规范盘符 `D:` 后连续三次 28 项通过、退出 0；反向再改小写仍退出 1。Node v24.22.1 满足已装 Vitest 要求，npm ls 确认 Vitest 单一版本，无 NODE_OPTIONS/NODE_PATH 注入，配置和 setup 无改动。Node 分别导入 `file:///D:/.../vitest/dist/chunks/run.BPv-BBRv.js` 与 `file:///d:/...`，实测 `sameRunnerModule=false`、`sameBeforeEach=false`；该模块持有模块级 runner。不同盘符大小写的 ESM URL 形成两个模块身份，使初始化与 hook 注册的 runner 状态分离。
- 修正与全量回归：仅纠正验收命令使用规范绝对路径，不改应用、setup、默认 jsdom、worker 配置、依赖或断言。`npm --prefix D:\my-first-project\frontend run test` 输出 `34 passed (34)`、`414 passed (414)`，`FullTestExitCode=0`。最小回归使用原 return-to 用例及大小写命令对照，不新增或跳过测试。任务 3.5 的三项命令均已取得退出码 0；总 Harness 仍由最终集成任务另验。
- 本轮未运行总 Harness 或本 CHANGE strict validate，不以局部、构建或浏览器桩结果代称最终验收通过。

### 任务 8.1：本地账户初始化与真实 HTTP 前置

- 初始化器位于 `backend/tools/SeedPostsAccounts.java`，由 `scripts/seed-posts-accounts.ps1` 编译及调用，复用已有认证服务；无 HTTP 入口、无 DDL，不修改正在运行的 8989 进程密钥。
- 容器发现的初次预检失败根因：PowerShell 5.1 将原生 Docker 输出直接接到 `Select-Object -First 1`，提前结束管道导致退出码 `-1`，误报 `MYSQL_UNAVAILABLE`。原生管道连续三次复现；先完整接收数组后，三次均为一容器、退出码 0。修正只影响本地包装脚本，不改数据库或认证。
- `powershell -NoProfile -ExecutionPolicy Bypass -File D:\my-first-project\scripts\seed-posts-accounts.ps1 -PreflightOnly` 输出 Maven `BUILD SUCCESS`、Java `preflight=OK writes=0` 与 `SeedPreflightExitCode=0`；预检不持久化随机资料、不创建账户。
- 子进程分别设置 `SPRING_PROFILES_ACTIVE=prod` 和 `SPRING_DATA_REDIS_DATABASE=0`，两次均在 preflight 阶段以退出码 1 拒绝；受控原因分别为 `PROD_REJECTED`、`LOCAL_STORAGE_REJECTED`。检查进程未修改用户级运行配置或存储。
- 默认脚本正式执行一次，输出 A/B 各 `created=OK`、`completed=2` 与 `SeedAccountsExitCode=0`。两组随机凭据仅保留于本机用户环境变量；无密码、验证码、cookie 或 JWT 回显。
- 经 `http://localhost:3000` 同源代理，各账户登录及 `/api/auth/me` 均 200，`status=active` 且 publicId 互异。初始化不算真实注册 HTTP/UI 验收；任务 8.1 前置已具备。

### MVP：有数据的真实 HTTP 互动联通

- 使用两个专用账户经 3000 代理登录，现有发帖接口创建本轮唯一标识帖子。临时 `.qoder/check-posts-http.ps1` 仅运行 HTTP 检查，不是前端单测、Playwright 或浏览器验收；执行后删除临时脚本。
- `powershell -NoProfile -ExecutionPolicy Bypass -File D:\my-first-project\.qoder\check-posts-http.ps1` 最终输出 `PostsHttpExitCode=0`。检查详情公开字段、详情路由 200、本人状态恢复、up→down→取消、重复收藏与取消，验证赞成票/收藏统计及三排序 feed 同步；A/B 的本人状态互不串联。
- 评论检查真实 201/204、Java trim 正文、正确根父标识、limit=1 游标跨页及末页 null；根删除后回复仍可读，统计为 2→1→0。400 非法游标、空白、2001 字符和 1001 个非 BMP 字符均拒绝；2000 字符及 1000 个非 BMP 字符接受，按 UTF-16 计长。
- 验证游客个人状态 401、非本人取消与删除 403、再次取消/删除 404；不把这些 DELETE 拒绝当作幂等成功。成功响应重读确认，不伪造客户端统计。
- 临时检查工具最初把 HTML 页面 200 当 JSON 解析，出现 `ArgumentException`；读取 `/posts` 的非写入对照三次复现，修正为仅 `/api/` 响应解析 JSON。PowerShell 5.1 错误体从响应流读取，不依赖可能为空的 ErrorDetails；这是检查工具问题，未改应用端点。
- 所有本轮生成测试帖子均已通过真实 DELETE 软删除，A/B/游客的详情读取返回 404；最终一轮附属评论读取亦全部 404。未删除账户、清库、清 Redis 或重置限流。
- 验证边界：HTTP 成功不证明浏览器正文渲染、HTML 不执行、草稿身份切换、键盘焦点、连续点击与迟到响应隔离。此处是上一轮记录，5.2–5.4、6.2–6.4 当时仍未勾选，8.3 的完整 live 浏览器命令未执行。按用户最新规则，HTTP 结果直接复用；仅补当前页面主操作链路后报告 MVP 调通，前后端单测、E2E、测试文档、边界穷举及总 Harness 后置到用户需要时，不因此阻塞业务任务。
