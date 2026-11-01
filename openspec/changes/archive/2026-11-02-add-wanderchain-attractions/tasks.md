# Tasks

> 验证口径沿用本仓库一贯做法：后端跑真实 MySQL + Redis，前端跑 `npm run build` 与 `npm run test`，收口以 `harness\run-all.ps1` 退出码为准。前端新增的组件单测与 E2E 按既有 MVP 约定集中到第 7 组，中间各组只保证既有用例不被改坏。

## 1. 表结构、约束与种子数据

- [x] 1.1 在 `backend/src/main/resources/schema.sql` 追加 `attractions` 表：公共八列 + 业务字段 + 三个策展排序列 + `public_id` 唯一键 + 三个排序索引 + 三个策展索引 + `status` / `rating` / `view_count` / `city_slug` / `version` 五个 CHECK；验证：`powershell -File harness\checks\06-schema-check.ps1` 返回 0
- [x] 1.2 按 design D3 在 `schema.sql` 末尾追加 12 条 `published`（覆盖 7 个城市）+ 1 条 `draft` 种子，固定 26 位 `public_id`、`INSERT IGNORE`、正文不超过 300 字符，并同步文件头注释说明该脚本已含种子；验证：连续执行 `06-schema-check.ps1` 两次均返回 0（幂等），且 `docker exec` 查 `SELECT COUNT(*) FROM wanderchain.attractions` 为 13
- [x] 1.3 在 `harness/checks/06-schema-check.ps1` 的 `wanderchain` 期望清单追加 `attractions` 表名、全部新索引名与新 CHECK 名；验证：把某个索引名写错后跑 `06-schema-check.ps1` 会失败，改回后返回 0（证明断言真的生效）
- [x] 1.4 确认种子不污染既有测试：验证 `powershell -File harness\checks\02-test.ps1` 返回 0

## 2. 后端景点读能力

- [x] 2.1 新增 `dao/attraction`：`entity/Attraction.java`（公共八列基类 + 业务列）、`converter/AttractionStatusConverter.java`、`repository/AttractionRepository.java`（按城市 + 排序键查询、按 `public_id` 且未删除单条查询、按策展列查询）；验证：`powershell -File harness\checks\01-compile.ps1` 返回 0
- [x] 2.2 新增 `common/enums/AttractionStatus.java`（`draft` / `published`，`dbValue()` 与 `fromDbValue()` 与 `PostStatus` 同构）与 `common/exception/AttractionErrorEnum.java`（`ATTRACTION_NOT_FOUND` 404、`ATTRACTION_COLLECTION_INVALID` 400，实现 `BaseError`）；验证：`01-compile.ps1` 返回 0
- [x] 2.3 新增 `service/attraction`：`AttractionService` 接口 + `impl/AttractionServiceImpl` + `model/`（列表页与详情页载体）+ `support/AttractionQuery`（城市归一化、`sortBy` / `collection` 白名单、`limit` 默认 20 上限 50 的钳制）；验证：`01-compile.ps1` 返回 0
- [x] 2.4 新增 `web/attraction/dto` 三个 record：`AttractionListItemResponse`、`AttractionListResponse(items, total)`、`AttractionDetailResponse`，字段集合严格等于 specs 中的字段清单且全部 `implements ApiResponse`；验证：`01-compile.ps1` 返回 0，且 `grep` 确认三个 record 无 `@JsonProperty`
- [x] 2.5 新增 `web/attraction/AttractionController`：`GET /api/attractions` 与 `GET /api/attractions/{publicId}`，错误以 `BizException` 抛出；验证：`01-compile.ps1` 返回 0
- [x] 2.6 在 `AuthInterceptor.publicRoutes()` 登记 `/api/attractions` 与 `/api/attractions/*` 的 `GET`；验证：`test` 中未登录请求两个端点返回 200 而非 401
- [x] 2.7 在 `src/test/.../service/attraction/` 补 service 接口测试：城市过滤、三种 `sortBy` 与并列时 `publicId` 升序、`limit` 超上限钳制、榜单只含策展成员且顺序等于策展顺序、`collection` 非法值抛 400 错误码、草稿与已删除不出现、已发布总数不写死；验证：`powershell -File harness\checks\02-test.ps1` 返回 0
- [x] 2.8 在 `src/test/.../web/attraction/` 补 controller 测试：列表成功响应字段集合、榜单成功响应、未知 `publicId` 返回 404 与统一错误体、非法 `collection` 返回 400；验证：`02-test.ps1` 返回 0

## 3. 前端契约与 API 客户端

- [x] 3.1 新增 `frontend/lib/contracts/attractions.ts`：三个 interface 与后端 record 同名同字段，另加 `ATTRACTION_ENDPOINTS` 常量（列表、详情）；验证：`grep` 确认 interface 名与后端 record 名逐个一致
- [x] 3.2 在 `harness/checks/10-contract-check.ps1` 的 `$contractPairs` 追加 attractions 一组（`BackendDirs` 指向 `web/attraction/dto`，`Frontend` 指向 `lib/contracts/attractions.ts`）；验证：`powershell -File harness\checks\10-contract-check.ps1` 返回 0 且摘要出现 attractions 一组
- [x] 3.3 新增 `frontend/lib/attractions/types.ts`（列表项与详情的视图模型）与 `lib/attractions/attractions-api.ts`（同源 `/api` 取数、非 2xx 归一为错误、`/api/attractions/{publicId}` 的 404 表达为可区分的错误）；验证：`cd frontend; npm run test` 中新增的 `attractions-api.test.ts` 全部通过

## 4. 景点列表页与约束型榜单

- [x] 4.1 新增 `frontend/app/attractions/page.tsx`：解析 `city`（复用 `parseCity`），渲染三个榜单区块 + 完整列表，全部客户端取数并复用 `SectionLoading` / `SectionError` / `EmptyState`；验证：`cd frontend; npm run build` 返回 0，`curl http://localhost:3000/attractions` 返回 200
- [x] 4.2 新增榜单区块与景点卡片组件（榜单名固定为 `First time in China` / `No booking needed` / `Open on Mondays`、每榜一句英文说明、卡片展示对应约束徽标、卡片链接到 `/attractions/{publicId}`）；验证：`npm run build` 返回 0，且页面可见文本中无中文字符（`grep` 组件源文件确认无中文界面串）
- [x] 4.3 新增 `attractions` 系列 CSS Module，沿用 `--wc-*` 令牌与既有断点形制；验证：`npm run build` 返回 0
- [x] 4.4 新增 `docs/specs/wanderchain/attractions-list.md`，并把该文件登记进 `harness/checks/08-spec-doc-breakpoints.ps1` 的 `$pairs`；验证：`powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 返回 0
- [x] 4.5 跑一遍前端总闸确认既有用例未被改坏；验证：`powershell -File harness\checks\04-frontend.ps1` 返回 0

## 5. 景点详情页

- [x] 5.1 新增 `frontend/app/attractions/[publicId]/page.tsx` 与事实卡组件：分项展示门票、开放时间、预约要求、支付方式、英文地址、中文地址（带英文用途标注）、公共交通、建议游览时长，缺失项显示英文占位；验证：`npm run build` 返回 0，访问一个存在的 `publicId` 页面渲染九项
- [x] 5.2 详情页展示 `Checked <Mon YYYY>` 形式的核实时间，并在请求 404 时展示英文空态与返回列表入口；验证：访问不存在的 `publicId` 得到空态而非白屏或异常页
- [x] 5.3 新增详情页 CSS Module（主图多档 `srcset` + `sizes`、懒加载、加载失败保持宽高比）；验证：`npm run build` 返回 0，渲染结果中主图同时带 `srcset` 与 `sizes`
- [x] 5.4 新增 `docs/specs/wanderchain/attractions-detail.md` 并登记进 `08-spec-doc-breakpoints.ps1` 的 `$pairs`；验证：`powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 返回 0

## 6. 收口：首页与搜索切换到真实数据源

- [x] 6.1 `components/home/hot-attractions.tsx` 的取数从 `mockRepository.listHotAttractions` 换成 `attractionsApi.listHotAttractions`，卡片改为 `Link` 指向详情页；同步把 `hot-attractions.test.tsx` 的 mock 点换到 api 模块；验证：`cd frontend; npm run test` 中 `hot-attractions.test.tsx` 通过
- [x] 6.2 `components/home/feature-nav.tsx` 的景点攻略入口改为携带当前城市（`all` 时不带参数），`FeatureNav` 增加 `city` prop 并由 `app/page.tsx` 传入；同步更新 `feature-nav.test.tsx`；验证：`npm run test` 中 `feature-nav.test.tsx` 通过
- [x] 6.3 `lib/search/query.ts` 的 `SearchHit` 改为 `key: string` + 可选 `href`，景点分组改由服务端 `await attractionsApi.listAttractions()` 取数、失败时该分组降级缺席；同步更新 `query.test.ts`；验证：`npm run test` 中 `query.test.ts` 通过且搜索页对不存在的 `publicId` 不产出链接
- [x] 6.4 改写 `docs/specs/wanderchain/homepage-u8-hot-attractions.md`（「不包含」与「数据来源」两节）与 `docs/specs/wanderchain/search-page.md`（条目可点、数据源改为后端）；验证：`powershell -File harness\checks\07-doc-consistency.ps1` 返回 0
- [x] 6.5 更新 `AGENTS.md` 的目录地图与命令速查（景点两个端点、`dao/service/web/attraction` 三个包、前端 `lib/attractions` 与 `app/attractions`）；验证：`07-doc-consistency.ps1` 与 `11-conventions-check.ps1` 均返回 0

## 7. 集成验证与补齐

- [x] 7.1 跑总闸并确认退出码为 0；验证：`powershell -File harness\run-all.ps1` 返回 0（已执行：12 道闸门全部 `[PASS]`，`RESULT: ALL CHECKS PASSED`，退出码 0。首次失败两因：①残留的旧 `next start -p 3210` 进程占用 `next-swc.win32-x64-msvc.node` 导致 `npm ci` EPERM，终止进程后 `npm ci` 29s 通过；②新增回归用例时 `vi.spyOn(window, 'scrollTo')` 的参数被推断为 `never`，`next build` 类型检查报 TS2339，显式标定参数类型后 `npm run build` 通过）
- [x] 7.2 三页链路手动走查并留证：首页热门景点 → 详情、`/attractions?city=` 三个榜单 → 详情、`/search?q=` 景点条目 → 详情；验证：三条链路均可点击进入对应详情页，且详情页展示核实时间（已执行：走查脚本 + 8 张全页截图（`.qoder/walk-*.png`）。A 首页 `#hot-attractions` 5 张卡片 → 首张 West Lake 进 `/attractions/01JQATTR000000000000000011`，H1 `West Lake`、`Checked Sep 2026`；B `/attractions?city=hangzhou` 三榜单：first-trip 为空态 `No picks on this shortlist in Hangzhou yet.`（种子数据在杭州无 first-trip 命中，数据驱动非筛选失效）、no-booking / open-monday 各 1 张 West Lake 卡片 → 详情均 `Checked Sep 2026`；C `/search?q=西湖` 命中 2 条（Editor's picks 1 / Attractions 1），景点条目标题可点并进入同一详情页。页面无 404、无错误态，控制台仅匿名访客 `GET /api/auth/me` 401（预期））
- [x] 7.3 按 MVP 口径补齐本轮欠下的前端组件单测与 `docs/e2e/` 用例（榜单渲染、详情事实卡占位、城市透传、搜索景点条目可点）；验证：`npm run test` 与 E2E 脚本均返回 0（已执行：`npm run test` 38 个文件 / 472 条用例全绿、退出码 0；`npx playwright test` 186 passed / 0 failed、退出码 0。过程中拦下的两类红：①上一轮帖子广场图标化后 `homepage-u0` / `homepage-u7` 仍在断言 `N comments · N views` 旧文本——按主 spec「图标化互动统计行」改 E2E 与 U7 单元文档，未改实现；②`search-page` S5 锚点落位竞态——`HashAnchorRestorer` 原以「期望位置未变」判稳定，区块被文档尽头夹住时恒等即收工，文档随后变长不再追；改为以「真的到位」判稳定并记下夹住时的文档高度，补齐 `hash-anchor-restorer.test.tsx` 回归用例（修复前必红））
- [x] 7.4 `openspec validate "add-wanderchain-attractions" --strict` 通过；验证：命令返回 0（已执行，输出 `Change 'add-wanderchain-attractions' is valid`，退出码 0）

## Workflow follow-up

- 第 7 组全部完成后提交：先提交 `backend` 与 `frontend` 子模块，再回工作区提交新增的 gitlink 与工件。
- 归档本次变更（`/opsx:archive`），归档时同步合并三份 delta 进主 specs。
- 归档后直接改写 `openspec/specs/wanderchain-homepage/spec.md` 的 Purpose（原文声称「不依赖任何后端服务」，接真实接口后已不成立）。
- 沿用 `archive/YYYY-MM-DD-add-wanderchain-attractions` 惯例打 annotated TAG。
