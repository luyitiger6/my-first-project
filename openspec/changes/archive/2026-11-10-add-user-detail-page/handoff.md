# 交接单 — add-user-detail-page

> 性质：验收结论，不是提交、不是归档。只有全绿时才存在本文件。
> 结论：**可交接**（可进入 ⑤ 归档）。

- 日期：2026-11-10
- 分支：`feat/user-detail-page-20261109`（工作区 `4822ee3` / backend `3076185` / frontend `8ea8574`，均已并入最新 `main`）
- 验收命令：`npx openspec validate "add-user-detail-page" --strict` → valid（EXIT=0）；
  `powershell -File harness\run-all.ps1` → `RESULT: ALL CHECKS PASSED`（EXIT=0，207s）

---

## Stage 1 — Spec 合规（spec-reviewer）

**范围**：19 条 Scenario，单能力 `wanderchain-user-page`
（`specs/wanderchain-user-page/spec.md`）

**结论**：对 **17** / 错 **0** / 警告 **2** → 不触发退回，可进入 Stage 2。

| Requirement | 条数 | 对 | 错 | 警告 |
|---|---|---|---|---|
| 公开用户资料的字段口径 | 3 | 3 | 0 | 0 |
| 公开用户资料的未找到口径 | 3 | 3 | 0 | 0 |
| 用户页帖子列表的范围 | 4 | 4 | 0 | 0 |
| 用户页帖子列表的分页 | 3 | 2 | 0 | 1 |
| 用户页的入口与四态 | 6 | 5 | 0 | 1 |
| **合计** | **19** | **17** | **0** | **2** |

**警告（不阻塞，转「可后置」）**：

- **W1 · 条数钳制无本列表独立用例**：实现与规格一致（`normalizeLimit`：null 或 `<1` → 20、`>50` → 50），
  现有用例 `PostServiceTest.limitIsCappedAtFifty` 只打广场 feed 且只测上限；「`<1` → 默认 20」分支全后端无测试。
  不阻塞理由：复用同一常量口径、无分支分叉，补用例不改变行为。
- **W2 · 资料（非 404）读取失败 + 重试无对应用例**：代码路径完整（`SectionError` + Retry 触发重发），
  404 短路与列表失败重试都有用例，缺的只是资料失败的断言。不阻塞理由：属证据缺口而非实现缺口。

**Requirement 级观察（W3，不计入 19 行）**：Req4「游标 MUST 只在该列表内有效」未被强制——游标只带排序维度
（`FeedCursor`），广场 `publishedAt` 游标塞进用户页列表会被接受（仅比对 `sortBy`）。结果仍按作者过滤、不泄漏数据；
建议后续把 `authorId` 编进游标，或在规格里把「不属于该列表」明确为「排序维度不匹配」。

**反向对账**：实现 → 规格 5 条增强（昵称空值兜底、空简介占位、公开资料恒走真接口、复合索引、列表项本地拼名片），
均为合理增强、无副作用，无「错」级超纲实现。

---

## Stage 2 — 代码质量（test-agent）

### 场景映射

| 层 | 文件 | 覆盖 |
|---|---|---|
| 服务层·资料 | `backend/.../service/profile/ProfileServiceImplTest.java` | 四字段、空值默认、已注销 404、不存在 404 |
| 端点·资料 | `backend/.../web/profile/PublicProfileControllerTest.java` | 游客 200 五字段、未填写留空、三种 404 响应体逐字相同 |
| 服务层·帖子 | `backend/.../service/post/PostServiceTest.java` | 作者过滤、空列表、未知/注销 404、游标翻页、非法游标 |
| 仓储层 | `backend/.../dao/post/repository/PostRepositoryTest.java` | 作者过滤、草稿不出现、软删除不出现、同毫秒游标稳定 |
| 端点·帖子 | `backend/.../web/profile/UserPostsControllerTest.java` | 200 三态码、未知作者 404、非法游标 400 |
| 前端契约 | `frontend/lib/contracts/{profile,posts}.ts` + `10-contract-check.ps1` | `PublicProfileResponse` ↔ 契约双向一致 |
| 前端取数 | `frontend/lib/profile/profile-api.test.ts` / `frontend/lib/posts/posts-api.test.ts` | 200 映射、404 归一化、网络错误、游标透传 |
| 前端卡片 | `frontend/components/posts/post-card.test.tsx` | 昵称链接 href、pending/missing 不生成链接、不渲染 26 位标识 |
| 前端页面 | `frontend/app/users/[publicId]/user-page-content.test.tsx` | 骨架、404 仅不存在、列表失败独立重试、空列表、正常态、昵称兜底 |

### 执行结果

| 项目 | 命令 | 结果 |
|---|---|---|
| 后端全量 | `mvn -B test`（含在 02 号闸门） | ALL PASS |
| 前端全量 | `npm run test`（含在 04 号闸门） | 53 文件 / 601 用例全绿 |
| E2E 回归 | `npm run test:e2e -- post-feed post-interactions` | 21 例：18 通过 / 3 失败 |

**3 条 E2E 失败的归因（关键）**：把 frontend 切到 `main`（`c317afa`）用同一命令逐条复跑，结果完全一致
（post-feed 2 例作者区停在骨架、post-interactions 1 例 375px 横向溢出 37px），**均为 main 既有问题**，
与本 change 无关；已登记 `docs/harness-backlog.md` 2.13，另开 `fix/` 分支处理。
本 change 的 19 条 Scenario 均有单元/组件/端点到端到用例，无缺口。

---

## Harness 总闸门

`powershell -File harness\run-all.ps1` → **16/16 PASSED，EXIT=0（207s）**

| 闸门 | 结果 |
|---|---|
| 02-test | 后端全量测试全绿（含容器装配契约测试） |
| 04-frontend | `npm ci` → `next build` → vitest 601 用例全绿（48.1s） |
| 06-schema-check | 两库 DROP/CREATE 后断言 10 表、索引与生成列口径（含 `idx_posts_author_published`） |
| 08-spec-doc-breakpoints | `docs/specs/wanderchain/user-page.md` 与 `user-page.module.css` 断点一致 |
| 10-contract-check | 用户页组 `PublicProfileResponse` 双向一致；dm 组同时受管 |
| 13-spec-evidence | 归档后 24 个能力的 Scenario 全部登记（本 change 19 条） |
| 14-change-scope | 能力 1 / tasks 18 / scenarios 19，均在阈值内 |
| 15-test-weakening | 无用例或断言减少 |
| 其余 8 道 | 全 PASS |

---

## 本次验收中的环境处置（复核时需知）

1. **数据库备份与恢复**：跑 `run-all` 前用 `mysqldump --databases wanderchain ai_chat_gate` 备份到
   `%TEMP%\wc-backup-ud-20261110.sql`；06 号闸门会 DROP/CREATE 两库，跑完已回灌并核对：
   accounts 2 / posts 2 / attractions 13 / dm_conversations 1 / dm_messages 7 / auth_sessions 39。
2. **04 号首轮假红**：第一轮 `run-all` 在 04 失败（`app/posts/page.test.tsx` 的 `waitFor` 1s 超时，
   expected 2 calls / received 1）；单文件与全量单独跑均通过，属并行负载下的时间敏感假红，未改测试代码。
   第二轮 16/16 全绿。
3. **dev server**：跑 04 前停掉占用 3000 的 node 进程（`next-swc` 原生模块会被 `npm ci` 删）；跑完按
   backlog 2.7 的规矩用「输出重定向到 `%TEMP%\wc-3000.log`」的方式重启，`Ready` 且 `/` 200。
4. **宿主 mysql 客户端路径**：`mysqldump` / `mysql` 不在 PATH，实际用
   `C:\Program Files\MySQL\MySQL Server 8.4\bin\`；连接串参数用长格式（`--host=` / `--password=`），
   短格式 `-h127.0.0.1` 会被 PowerShell 拆成 `-h127`。

---

## 遗留（不阻塞交接）

- W1 / W2：补两处断言（见 Stage 1），另开 `fix/` 分支。
- W3：游标是否绑定作者，需在规格或实现一侧收口。
- `design.md` 缺「## 契约」表：10 号闸门取不到即跳过三方比对（不失败）。建议补 `PublicProfileResponse`
  的契约表，让「契约先行」对该组也生效。
- backlog 2.13：三条 main 既有 E2E 失败，另开 `fix/` 分支。

---

## 归档操作清单（⑤ 阶段执行，机械操作）

1. **合入规格**：`openspec archive add-user-detail-page --yes`（把 delta 合入
   `openspec/specs/wanderchain-user-page/spec.md`，change 移入 `archive/2026-11-10-add-user-detail-page/`）。
2. **登记证据**：在 `docs/spec-evidence.json` 新增能力 `wanderchain-user-page`。
   19 条键名必须逐字取自下表（键名 = `Requirement 标题 / Scenario 标题`）。

| Requirement | Scenario | 证据 ref（kind = test） |
|---|---|---|
| 公开用户资料的字段口径 | 游客读取用户资料 | `backend/src/test/java/com/luyi/myfirst/web/profile/PublicProfileControllerTest.java` |
| 公开用户资料的字段口径 | 响应不含内部字段 | `backend/src/test/java/com/luyi/myfirst/web/profile/PublicProfileControllerTest.java` |
| 公开用户资料的字段口径 | 资料未填写时返回空值 | `backend/src/test/java/com/luyi/myfirst/service/profile/ProfileServiceImplTest.java` |
| 公开用户资料的未找到口径 | 不存在的标识 | `backend/src/test/java/com/luyi/myfirst/web/profile/PublicProfileControllerTest.java` |
| 公开用户资料的未找到口径 | 已注销的用户 | `backend/src/test/java/com/luyi/myfirst/service/profile/ProfileServiceImplTest.java` |
| 公开用户资料的未找到口径 | 形状不合的标识 | `backend/src/test/java/com/luyi/myfirst/web/profile/PublicProfileControllerTest.java` |
| 用户页帖子列表的范围 | 只返回该用户的已发布帖子 | `backend/src/test/java/com/luyi/myfirst/service/post/PostServiceTest.java` |
| 用户页帖子列表的范围 | 已删除帖子不出现 | `backend/src/test/java/com/luyi/myfirst/dao/post/repository/PostRepositoryTest.java` |
| 用户页帖子列表的范围 | 用户没有任何已发布帖子 | `backend/src/test/java/com/luyi/myfirst/service/post/PostServiceTest.java` |
| 用户页帖子列表的范围 | 未知用户得 404 | `backend/src/test/java/com/luyi/myfirst/web/profile/UserPostsControllerTest.java` |
| 用户页帖子列表的分页 | 游标继续下一页 | `backend/src/test/java/com/luyi/myfirst/service/post/PostServiceTest.java` |
| 用户页帖子列表的分页 | 非法游标 | `backend/src/test/java/com/luyi/myfirst/web/profile/UserPostsControllerTest.java` |
| 用户页帖子列表的分页 | 条数钳制 | `backend/src/test/java/com/luyi/myfirst/service/post/PostServiceTest.java` |
| 用户页的入口与四态 | 从帖子卡片进入用户页 | `frontend/components/posts/post-card.test.tsx` |
| 用户页的入口与四态 | 游客可访问 | `backend/src/test/java/com/luyi/myfirst/web/profile/PublicProfileControllerTest.java` |
| 用户页的入口与四态 | 名片未就绪时不生成入口 | `frontend/components/posts/post-card.test.tsx` |
| 用户页的入口与四态 | 用户不存在 | `frontend/app/users/[publicId]/user-page-content.test.tsx` |
| 用户页的入口与四态 | 读取失败可重试 | `frontend/app/users/[publicId]/user-page-content.test.tsx` |
| 用户页的入口与四态 | 用户没有已发布帖子 | `frontend/app/users/[publicId]/user-page-content.test.tsx` |

   能力级 `sources` 登记四条：

   ```json
   [
     { "kind": "gate", "ref": "harness/checks/10-contract-check.ps1" },
     { "kind": "gate", "ref": "harness/checks/08-spec-doc-breakpoints.ps1" },
     { "kind": "test", "ref": "frontend/lib/profile/profile-api.test.ts" },
     { "kind": "test", "ref": "frontend/lib/posts/posts-api.test.ts" }
   ]
   ```

3. **验证**：`powershell -File harness\checks\13-spec-evidence-check.ps1` 与 `07-doc-consistency.ps1`
   退出码均为 0 才算归档完成。

---

## 结论

**可交接。** Stage 1 无「错」（19 条：17 对 / 2 警告），Stage 2 场景映射无缺口、E2E 的 3 条失败已证为 main
既有问题并登记待修，Harness 16 道闸门全通过，数据库已恢复到跑前状态。满足 AGENTS.md §4 进入 ⑤ 归档的条件。
