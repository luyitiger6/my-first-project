# Tasks

本清单跟踪已放行变更的实施与最终验收。Q1–Q4 只涉及呈现细节，在指定确认任务处暂停提问并将答案写回 design；需要改变规格、范围或端点的回答必须重新修订工件并审阅，不自行扩大实现。

用户最新放行的快速 MVP 规则（覆盖旧测试时机）：前后端先实现业务、联通真实后端并对齐字段/变量名，只走一次本次受影响的真实操作链路。已完成的 1–4.4、8.1 和 HTTP 联通证据直接复用；登录注册作为现成依赖，未改动且无相关故障时不重测、不重建账户、不重复运行已通过检查。接下来仅确认 5.2–5.4、6.2–6.4 的页面主操作链路；必要构建/类型、契约检查只在相关改动时按需执行。所有前后端单测、自动化集成测试、E2E、测试文档、截图覆盖、边界穷举及全量 Harness 留到以后用户需要时集中处理，不自动在功能调通后启动。4.5、5.5–5.6、6.5–6.6、7、8.2–8.5 均为后置验收，不阻塞 MVP。业务任务按功能实现与主链路结果跟踪，主链路调通不等于所有边界已验；业务 Scenario、权限和错误处理仍须实现，未跑验收项保持未勾选。MVP 调通与完整验收分别汇报，不改 Harness、不加入跳过写法、不伪造测试通过。排障只解决当前业务阻塞，不展开无关底层机制、字节码、二进制或非阻塞细节研究，不为验证工具自身新增工程。

## 1. 后端详情统计与读取可见性

- [x] 1.1 扩展 PostView/PostResponse 及 read/publish/edit 的集中映射，复用有效评论、赞成票、收藏计数；以 PostServiceTest 验证零值、软删除排除和反对票不计入赞成数。
- [x] 1.2 为详情、评论列表和后续个人状态复用帖子域的可读判定，评论 list 接口/控制器传 nullable viewer；以 service/controller 测试验证已发布公开、草稿作者可读、他人草稿/删除/不存在为 404，不改变写端规则。
- [x] 1.3 补 PostControllerTest 的详情统计 JSON、返回字段白名单与创建/编辑返回同形断言；运行 `mvn -f backend/pom.xml -Dtest=PostServiceTest,PostControllerTest test` 返回 0。
- [x] 1.4 在 backend/README.md 更新详情统计、公开读取及草稿附属读取的 API 说明；与本组端点测试响应和 CHANGE delta 逐项比对，不顺手改旧主 spec。

## 2. 后端个人状态与正确回复关系

- [x] 2.1 新增 service 当前令牌账户的互动状态读取与内部 model，复用有效投票/收藏查询；以 PostInteractionServiceTest 验证未互动 null/false、up/down、取消后状态及 A/B 隔离。
- [x] 2.2 新增独立个人状态 Controller 和 PostInteractionStateResponse record，返回 no-store 且不登记为公开；以 PostInteractionControllerTest 验证准确两字段、200/401/404、伪造账户参数无效、未登记 GET 默认拒绝和既有认证归属不变。
- [x] 2.3 修正评论列表父 id → 父 publicId 的批量查询映射，保留软删除父标识而不回显正文；以 service/controller 测试分别验证同页、跨页、父删除、根删除不级联及非法/跨帖回复目标，不能只测创建响应。
- [x] 2.4 补互动 service/controller 的评论默认 20/上限 50/非法游标/倒序继续、UTF-16 边界、取消赞成与反对的不同计数以及来源先于认证回归；运行 `mvn -f backend/pom.xml -Dtest=PostInteractionServiceTest,PostInteractionControllerTest test` 返回 0。
- [x] 2.5 在 backend/README.md 更新个人状态 GET、parentPublicId、认证及取消错误语义说明；逐项与本组 Controller 测试及既有写路径比对，确认无新表、新错误码或深度限制。

## 3. 前端契约、端点层与安全认证回跳

- [x] 3.1 后端 DTO 就绪后镜像 PostResponse 新字段与 PostInteractionStateResponse、登记个人状态路径；运行 `powershell -File harness/checks/10-contract-check.ps1` 返回 0，nullable 和词表由本组端点测试另行验证。
- [x] 3.2 新建 lib/posts/posts-api.ts、帖子域 UI 类型与真实 DTO 适配，收口 feed/detail/comments/投票/收藏等请求与错误；以 Vitest 请求测试验证排序映射、同源路径、方法、请求体、原样 cursor、AbortSignal、no-store、204 空体、业务拒绝及非 JSON/502，不使用 Mock 兜底。
- [x] 3.3 新建安全 return-to 允许列表，登录/注册消费 next 并在互转时保留，处理认证写成功但会话未确认的只读重试；以 AuthForm/AuthProvider 行为测试验证合法回跳、无 next 回首页、恶意编码拒绝、会话确认失败不重发注册及既有验证码/错误分流不回归。
- [x] 3.4 对登录/注册的 useSearchParams 加正确 Suspense 边界；更新 homepage-u1-auth.md 的回跳场景，并为 homepage-u1-auth.spec.ts 增加登录/注册互转、未确认会话和无自动重放的浏览器契约用例，保持原有场景及用户已有修改。
- [x] 3.5 运行 `npm --prefix frontend run test`、`npm --prefix frontend run build` 和 `npm run test:e2e -- docs/e2e/homepage-u1-auth.spec.ts` 返回 0，记录新回跳用例结果；不把桩测试称为真实认证联调。

## 4. 真实帖子广场与详情入口

- [x] 4.1 实施真实卡片前向用户确认 Q1 的 Author ID/标签排版并写回 design；答案只允许在真实字段边界内，确认记录存在才进入 4.2。
- [x] 4.2 将 PostsContent/useInfinitePosts/list 迁往帖子域真实类型与端点，保留三 Tab、URL 与 IO 分页，以 publicId 去重并用请求代次隔离；以 Vitest 验证新旧排序乱序、首载/分页重试、同页重复、到底、空态及连续触发只发一次。
- [x] 4.3 真实卡片展示标题、封面/占位、标签、作者标识、创建时间、三项图标统计和详情链接；以卡片/页面测试验证 publicId 路由、零值、无假摘要姓名、封面失败、首页 View all posts 与 Mock 展示保持独立。
- [x] 4.4 更新 post-feed.md 六段单元文档中的真实数据、卡片、导航、排除及断点，保持既有 CSS 配对；运行 `powershell -File harness/checks/08-spec-doc-breakpoints.ps1` 返回 0，并与替代 delta 场景逐项核对。
- [ ] 4.5 最终集中验收阶段新建 docs/e2e/post-feed.spec.ts，覆盖三排序实际 HTTP 参数、真实 DTO 卡片、IO 分页/错误/重试、迟到响应、首页入口及详情链接目标；运行该文件返回 0，显式输出桌面和窄屏截图并记录场景对应关系。

## 5. 详情状态与投票收藏 UI

- [x] 5.1 实施互动栏前向用户确认 Q2 的文字/图标和窄屏排列并写回 design；确认记录存在才进入 5.2。
- [x] 5.2 新增 app/posts/[publicId] 路由与 post-detail 组件并联通真实详情端点，组织文本正文、封面、标签、作者、统计、加载/404/读取重试及草稿只读；核对 DTO 字段、调用和页面结果，保留直接访问、HTML 不执行、长行、缺图、评论失败不遮正文及身份变化后草稿不可继续显示的行为。页面行为测试在 7.1 集中补齐。
- [x] 5.3 新增个人状态与 mutation 协调 Hook、post-interaction-bar，联通本人状态、up/down/取消及收藏切换端点；核对请求方法、字段与返回值，保持刷新恢复、方向互斥、未互动、guest/loading/未知状态、单 mutation 锁及评论入口登录引导，按钮使用 aria-pressed。Vitest 在 7.1 集中补齐。
- [x] 5.4 实现跨帖子/账户、卸载、写前旧读响应的失效与写后校准；核对状态流转和错误分流，保持迟到隔离、连续点击抑制、401/403/404/400/来源拒绝、网络写结果待确认及“写成功读失败”只重试读取，不做乐观计数或自动重发。deferred 行为测试在 7.1 集中补齐。
- [ ] 5.5 最终集中验收阶段新建 post-detail.md/post-interactions.md 六段单元文档，各自声明 640px 断点真相源，并在 08 登记 post-detail.module.css/post-interaction-bar.module.css 两对；闸门返回 0，文档与本组错误/身份场景一致。
- [ ] 5.6 最终集中验收阶段新建 docs/e2e/post-interactions.spec.ts 的详情/身份/投票/收藏区块，以真实 DTO 格式桩验证合法互动、刷新选中、未找到、服务失败和写后校准失败；运行返回 0，显式输出正文、选中和错误态的桌面/窄屏截图。

## 6. 评论、二级回复与本人删除 UI

- [x] 6.1 实施评论 UI 前向用户确认 Q3 删除确认形态和 Q4 回复输入框位置，写回 design；两项确认记录存在才进入 6.2，不改变两层回复和确认删除的行为约束。
- [x] 6.2 新增 post-comments 并联通真实评论列表，提供倒序游标、加载更多、重试、publicId 去重与父上下文；核对响应字段与列表结果，保持空态、分页中/失败/到底、跨页父、已删除父、历史深层回复不隐藏及最多一级缩进，不改排序分组。组件测试在 7.1 集中补齐。
- [x] 6.3 新增 comment-composer 并联通真实创建端点，提供顶级/根评论回复、目标取消、UTF-16 计长和 Java trim 同口径校验；核对请求体与提交结果，保持合法提交/校准、空白/2000/2001/非 BMP 字符边界、无第三层入口、失败保留输入、重复提交抑制、401 锁定草稿及主动身份切换/离开清除。行为测试在 7.1 集中补齐。
- [x] 6.4 联通本人删除端点，实现只向本人显示删除、明确确认、204 移除与重读、取消/错误保留内容、焦点恢复；核对作者字段、请求及响应处理，保持权限边界、根删除不丢回复、403/404 非成功及校准失败只重试读。组件测试在 7.1 集中补齐。
- [ ] 6.5 最终集中验收阶段新建 post-comments.md/post-comment-composer.md 六段单元文档，在 08 登记对应 CSS 两对并验证 640px 集合一致；文档逐项覆盖创建/回复/删除、父不可用、草稿与身份输入边界。
- [ ] 6.6 最终集中验收阶段在 post-interactions.spec.ts 增加评论/回复/分页/删除及键盘、窄屏、reduced-motion 场景；运行该文件返回 0，显式捕获回复输入、父不可用和删除确认的成功态截图并记录场景对应关系。

## 7. 后置：用户需要时集中测试、文档与跨模块回归

- [ ] 7.1 以后用户需要完整验收时（不在 MVP 联通后自动启动），集中补齐 5.2–5.4、6.2–6.4 的前端单元/行为测试，覆盖各任务保留的内容、身份、错误、竞态及输入边界；集中执行 4.5、5.5–5.6、6.5–6.6 的 E2E 和测试文档任务。对五份 delta 的全部新增/承接 Scenario 建立测试或显式浏览器验收对应清单，登记文件/用例或截图证据；复核 MODIFIED 保留原场景、REMOVED 均有新条款承接，不将未跑项写为通过。
- [ ] 7.2 以后用户需要完整验收时，在已建广场/详情浏览器用例中补跨页面“完成互动返回广场重读统计并保留排序”的集成断言，运行后端完整 `mvn -f backend/pom.xml test`、前端完整 test/build、08/10/11 闸门及完整桩式 `npm run test:e2e`；全部返回 0，确认首页 Mock、认证、搜索等既有场景无回归。

## 8. 已具备真实环境前置与后置完整联调验收

- [x] 8.1 确认真实后端/MySQL/Redis、前端代理允许来源及两个专用已验证测试账户的环境输入；用户已放行缺账户时新增 backend/tools/SeedPostsAccounts.java 与 scripts/seed-posts-accounts.ps1 一次性非 prod 本地初始化器，随机资料只放环境变量，复用测试用图形码签发、开发 Outbox 和真实注册码校验/注册服务，不直写数据库、不改既有用户、不重置存储、不新增 HTTP 读码接口。验证初始化退出码与生产/配置拒绝，再经前端代理正常登录和 /me 确认本人；不把初始化计为注册 UI 验收，日志不得含密码、验证码、cookie 或 JWT。缺服务或初始化失败时报告并暂停，不自动重复创建。
- [ ] 8.2 以后用户需要完整验收时，新增独立 playwright.posts-live.config.ts 与 docs/e2e/post-interactions.live.ts，复用现有 runner/config 但独立匹配与报告；以 `npm run test:e2e -- --config playwright.posts-live.config.ts --list` 验证 live 用例确实被发现，普通桩套件匹配规则不变，缺真实凭据须失败而非跳过。
- [ ] 8.3 以后用户需要完整自动化验收时，用现有真实发帖接口建立本轮专用数据并从真实广场进入详情，在独立账户上下文执行评论/二级回复/本人删除、up/down/取消、收藏/取消、刷新恢复、A/B 隔离和返回广场计数；运行完整 live 命令返回 0，不拦截业务 API，结束仅软删除本轮创建帖子。
- [ ] 8.4 以后用户需要完整验收时，更新 docs/e2e/README.md 的桩/真实运行说明、前置变量名、报告位置、截图场景清单和真实数据清理边界；以两套命令及报告验证说明可复现，区分后端测试、桩浏览器验收和真实 UI 联调证据。
- [ ] 8.5 以后用户需要完整验收时调用 verification-before-completion，运行 `powershell -File harness/run-all.ps1` 返回 0 与 `openspec validate add-wanderchain-post-interactions-frontend --strict` 返回 0；交付完整退出码和真实浏览器证据，不把本 CHANGE 校验代称为全仓 OpenSpec 校验，不无证据勾选。

## 本轮 MVP 页面联通结果

- 复用已实现代码与历史 HTTP 联通证据，Browser 子代理使用现有账户完成真实卡片进入详情、赞成/反对/取消、收藏及刷新保留/取消、根评论/回复、行内确认删除与返回广场保留 `sortBy=latest`。5.2–5.4、6.2–6.4 按本清单的 MVP 实现与主链路口径勾选，不代表边界或自动化验收通过。
- 本轮专用帖子 `01M683DADYNZHWJSHC0SF0BYW7` 创建返回 201，结束软删除返回 204；投票与收藏的选中和统计变化可见，根删除后回复保留、父上下文不可用可见。
- 证据限制：子代理报告评论计数中存在额外评论/回复，后续浏览器上下文已无法回溯其创建记录，来源未核实；不把本次评论计数序列作为单次提交计数或无重复提交的验证证据，也不据此推断应用故障。已有 HTTP 证据保留，该疑点明确保留。
- 本轮未改业务代码，未运行单测、自动化 E2E、完整 Harness 或新增测试文档；所有后置验收条目仍未勾选。

## Workflow follow-up

- 本次 propose 交付工件后停止，等待人工审阅和新的 `/opsx:apply add-wanderchain-post-interactions-frontend` 请求。
- 实施与验收完成后，只有获得用户新授权才归档、提交或推送；归档前核对主 spec 与 delta 的精确承接，不以近似文案代替同步验证。
- 后续若用户授权发布，先在 backend/frontend 子模块精确提交并推送、确认远端可取得，再提交父仓库的工件/文档/新 gitlink；不包含无关残留改动。
