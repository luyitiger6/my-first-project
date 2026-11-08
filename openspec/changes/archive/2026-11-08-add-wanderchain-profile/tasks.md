# Tasks

## 1. 后端资料存储与校验

- [x] 1.1 `backend/src/main/resources/schema.sql` 的 `accounts` 追加 `avatar_url VARCHAR(512) NOT NULL DEFAULT ''`、`bio VARCHAR(200) NOT NULL DEFAULT ''`、`interests VARCHAR(128) NOT NULL DEFAULT ''` 三列，并在文件头注释写明「已有本地库需重建或手工 ALTER」。验证：`powershell -File harness\checks\06-schema-check.ps1` 退出码 0（该闸门 drop 重建后全表检查通过，说明加列脚本可执行）。
- [x] 1.2 `dao/auth/entity/Account` 增加三个字段与 `updateProfile(...)`（只改被传入的字段），`dao/auth/repository/AccountRepository` 增加 `findByPublicIdInAndDeletedAtIsNull(Collection<String>)`。验证：新增 `AccountProfileTest` 覆盖「只传简介时其余三项不变」「批量查询排除已软删除行」，`mvn -f backend/pom.xml test -Dtest=AccountProfileTest` 全部通过。
- [x] 1.3 新增 `service/profile/support/InterestCatalog`（标签清单常量）与 `ProfileRules`（昵称 trim 后 1–64、简介 ≤200、头像空或 `http(s)` 绝对地址、标签去重后 ≤5 个且每个 1–16、全部取自清单；按 code point 计长）。验证：`mvn -f backend/pom.xml test -Dtest=ProfileRulesTest` 覆盖空白昵称、64/65 字符、200/201 字符、非 http(s) 地址、清单外标签、第 6 个标签、重复取值、以及「清单非空且任何取值不含半角逗号与首尾空白」。

## 2. 后端服务与端点

- [x] 2.1 新增 `service/profile`：`ProfileService` 接口、`impl/ProfileServiceImpl`、`model/ProfileView`、`model/ProfileCard`，实现本人读取、部分更新、按对外标识批量取名片。验证：`mvn -f backend/pom.xml test -Dtest=ProfileServiceImplTest` 覆盖本人读取、部分更新、批量 1 与 50 个成功、51 个拒绝、未知与已注销标识被省略。
- [x] 2.2 新增 `web/profile/dto` 的五个 record（`ProfileResponse`、`UpdateProfileRequest`、`ProfileCardResponse`、`ProfileCardListResponse`、`InterestListResponse`）与四个「一端点一 Controller」（本人读取、本人更新、名片批量、标签清单），字段集合严格等于 `design.md` 的「## 契约」表。验证：`mvn -f backend/pom.xml -q -DskipTests compile` 通过，且 `web/profile/dto` 下恰有 5 个 `.java` record、没有内部辅助 record。
- [x] 2.3 `web/auth/interceptor/AuthInterceptor.publicRoutes()` 登记 `GET /api/profiles` 与 `GET /api/profile/interests`；`PUT /api/profile` 与 `GET /api/profile` 不登记。验证：`mvn -f backend/pom.xml test -Dtest=AuthInterceptorTest` 覆盖四个「路径 + 方法」组合的公开与拒绝判定。
- [x] 2.4 后端控制器测试：未登录读本人资料 `401`、未登录更新 `401` 且不写入、跨站来源 `403` 且先于认证、合法更新 `200`、`400` 的四种拒绝、批量 51 个 `400`、名片响应恰含三字段。验证：`mvn -f backend/pom.xml test -Dtest=ProfileControllerTest` 全部通过。

## 3. 前端契约与个人中心

- [x] 3.0（用户补充指令）`interaction-agent` 在 `design.md` 新增「## 视觉规范」节：个人中心 `/me`、账户区入口、广场卡片作者区三面的版式与状态视觉，全部引用既有 `--wc-*` 令牌与 `.wc-*` 类，不新增令牌；令牌缺口两条在节末登记（占位填充无专属令牌、品牌底反白字无令牌），待后续统一处理。验证：人审 `design.md` 该节；交互规格与契约表逐字未动。

- [x] 3.1 新增 `frontend/lib/contracts/profile.ts`（五个 interface，与后端 record 同名同字段）与 `frontend/lib/profile/profile-api.ts` + `types.ts`（同源 `/api` 取数、错误归一化、标签清单读取）；在 `harness/checks/10-contract-check.ps1` 的 `$contractPairs` 追加 profile 组。验证：`powershell -File harness\checks\10-contract-check.ps1` 退出码 0，且输出含 profile 组的字段比对摘要。
- [x] 3.2 新增 `frontend/app/me/page.tsx`、`app/me/me-content.tsx`、`app/me/me.module.css`：加载 / 未登录 / 已登录 / 读取失败四态，表单含头像预览与上传、昵称、简介计数、标签复选与保存。验证：`npm --prefix D:\my-first-project\frontend run test -- app/me` 新增用例覆盖「未登录不发 `GET /api/profile`」「保存成功顶栏同步」「`400` 保留输入」。
- [x] 3.3 `frontend/components/auth/account-menu.tsx` 在登录态增加个人中心入口，游客态不出现。验证：`npm --prefix D:\my-first-project\frontend run test -- components/auth/account-menu.test.tsx` 两个身份分支的断言都通过。
- [x] 3.4 新增 `docs/specs/wanderchain/profile.md`（六段结构，声明真相源 `frontend/app/me/me.module.css` 与断点），并在 `harness/checks/08-spec-doc-breakpoints.ps1` 的 `$pairs` 登记该对。验证：`powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 退出码 0 且文档数与登记数一致。

## 4. 广场卡片作者区

- [x] 4.1 新增 `frontend/components/posts/use-author-cards.ts`：按 `authorPublicId` 去重、剔除已缓存、按 ≤50 切块请求、维护 `pending / ready / missing` 三态、失败批次在标识集合变化时重取。验证：新增 `use-author-cards.test.tsx`，`npm --prefix D:\my-first-project\frontend run test -- components/posts` 全部通过。
- [x] 4.2 `frontend/components/posts/post-card.tsx` 作者区改为「头像 + 昵称」三态呈现并整体删除 `<details>/<summary>` 与 `authorPublicId` 切片；`post-list.tsx` 与 `app/posts/posts-content.tsx` 把名片映射透传给卡片。验证：`npm --prefix D:\my-first-project\frontend run test -- components/posts app/posts` 通过，且全仓 `Author ID` 在 `components/posts/post-card.tsx`、`post-list.tsx`、`posts-content.tsx` 中不再出现。
- [x] 4.3 更新 `frontend/components/posts/post-card.test.tsx` 的作者断言；新增 `docs/e2e/support/helpers.ts` 的 `stubProfilesApi` 并改写 `docs/e2e/post-feed.spec.ts` 的作者断言与名片缺失场景。验证：`npm --prefix D:\my-first-project run test:e2e -- docs/e2e/post-feed.spec.ts` 通过（名片加载中不出现 26 位标识、缺失时显示 `Author unavailable`）。
- [x] 4.4 改写 `docs/specs/wanderchain/post-feed.md`：卡片作者区、不含「作者资料 API」、数据来源新增名片端点、文案契约、场景 S4/S12、「替代 delta 场景对应」表。验证：`powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 退出码 0，并逐条核对 delta 的 7 条 Scenario 都有对应验证行。

## 5. 仓库入口文档

- [x] 5.1 `AGENTS.md` 的目录树补 `docs/prd/`（用户模块活 PRD）、`service/profile`、`web/profile` 与四个 profile 端点，§7 命令速查同步；§2 角色输入表把 `docs/prd/wanderchain-user-module.md` 登记为 `interaction-agent` 的必读上游（§5.1 用户故事 + §10 验收标准，这两样 proposal 里没有）、`test-agent` 的可选参考，并补一句「主会话代做某角色的工作时，必须先 Read 该角色的定义文件（`%USERPROFILE%\.qoder\agents\<role>.md`）——派 subagent 代替不了这一步，因为它读到的正文主会话看不到」。验证：`powershell -File harness\checks\07-doc-consistency.ps1` 与 `powershell -File harness\checks\11-conventions-check.ps1` 均退出码 0。
- [x] 5.2 `AGENTS.md` §2 新增「文件归属」表：每个文件只有一个 owner，非 owner 只读，需要修改时只能向 owner 提建议。至少覆盖：`openspec/changes/*/proposal.md` 与 `tasks.md`（主会话）、`specs/**`（spec 本身，改它要回到 ② 重新放行）、`design.md` 的「## 契约」（前后端协商）、「## 交互规格」（`interaction-agent`）、`docs/prd/**`（`product-manager`）、`docs/specs/**`（对应实现方）、`docs/conventions/**`（主会话，11 号闸门校验）、`AGENTS.md`（人类授权的编排改动）、`%USERPROFILE%\.qoder\agents\*.md`（仅人类，主会话只能提议——本条本次由用户明确授权后已执行）。验证：`07-doc-consistency.ps1` 退出码 0；归属表本身无闸门校验，由人工逐行核对上列十一处均被覆盖。

## 6. 联调与完整验收

- [x] 6.1 真实链路自查：注册并登录 → 进入个人中心 → 改昵称、简介、标签并上传头像 → 保存 → 返回广场看到新昵称与头像 → 刷新后仍在，顶栏昵称同步。验证：浏览器实际操作并记录截图路径；仅报告「本次链路已调通」，这一条不证明其它 Scenario。
- [x] 6.2 完整验收（用户需要时集中执行）：`openspec validate "add-wanderchain-profile" --strict` 与 `powershell -File harness\run-all.ps1` 均退出码 0，先过 `spec-reviewer` 逐条对账、再跑 E2E。未执行时明确后置，不得报告「完整验收通过」。
- [x] 6.3（6.1 验收反馈，用户 2026-11-08 拍板）保存成功后的完成信号由「停留本页 + `Profile saved.`」改为「立即跳转广场 `/posts`」，目的地只有广场（用户详细页 `/users/{publicId}` 属阶段 2）。同步四处：`specs/wanderchain-profile/spec.md` 的 Requirement 与「保存成功后跳转广场并同步顶栏」Scenario、`design.md` 2.3 成功分支与文案契约、`docs/specs/wanderchain/profile.md` 的 S5 与证据表、`me-content.tsx`（`router.push('/posts')`，删除 `savedMessage` 状态与提示）。验证：`npx vitest run app/me/me-content.test.tsx` 3 个用例通过（新增「不出现 `Profile saved.` + `router.push('/posts')`」断言）；浏览器实测保存后 URL 由 `/me` 变为 `/posts`、顶栏与卡片作者区同步新昵称、刷新后仍是登录态，截图见 `.qoder/profile-save-redirect-01-before.png` / `-02-after.png` / `-03-after-refresh.png`。

## Workflow follow-up

- 归档时把 `specs/wanderchain-profile/spec.md` 合并为 `openspec/specs/wanderchain-profile/spec.md`，把 post-feed 的 MODIFIED 块替换进主 spec。
- 归档前为新增 Scenario 在 `docs/spec-evidence.json` 登记三类证据之一，否则 `13-spec-evidence-check.ps1` 会在归档后拦下。
- 阶段 2 起点：详情页与评论区的作者区改名片、消息通知、收藏列表（当前「只进不出」）。
- 待办（本次不修，另行开 `fix/` 分支）：登录页 hydration 时序——JS 未就绪时点击提交会触发原生 GET，邮箱密码进入 URL。
- 待办（本次不修，需真机复现）：从 `/posts` 客户端导航回 `/me` 偶发卡在 `Loading your profile…` 骨架态且不发任何 `/api` 请求，reload 后正常；代码层 `AuthProvider.refresh` 只在挂载时执行一次、导航不重挂，暂判为 dev 模式 HMR/fast-refresh 中间态，需在生产构建复现后再定。
