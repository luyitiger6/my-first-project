# 交接单 — add-direct-messages

> 性质：验收结论，不是提交、不是归档。只有全绿时才存在本文件。
> 结论：**可交接**（可进入 ⑤ 归档，待用户确认后执行 `/opsx:archive`）。

- 日期：2026-11-09
- 分支：`feat/direct-messages-20261109`（工作区 / backend / frontend 三仓库同分支，均未推送）
- 执行方式：主会话按角色定义串行代做 Stage 0~2；Stage 1 由 `spec-reviewer` 独立对账
- 验收命令：`openspec validate "add-direct-messages" --strict` → valid（EXIT=0）；
  `powershell -File harness\run-all.ps1` → `RESULT: ALL CHECKS PASSED`（EXIT=0）

---

## Stage 1 — Spec 合规（spec-reviewer）

**范围**：30 条 Scenario，单能力 `wanderchain-direct-messages`
（`specs/wanderchain-direct-messages/spec.md`）

**结论**：对 **28** / 错 **0** / 警告 **2** → 不触发退回，可进入 Stage 2。

| 观察面 | Scenario |
|---|---|
| 会话创建与列表 | 首次发起创建会话 / 重复发起返回同一会话 / 不能向自己发起 / 对方不存在 / 只返回本人参与的会话 / 按最近活跃时间倒序 / 每项含对方名片与未读数 / 没有会话时返回空列表 |
| 参与边界 | 非参与者不能读取消息 / 非参与者不能发送消息 / 非参与者不能标记已读 / 未登录被拒绝 |
| 消息读 | 首页返回最新消息 / 游标翻页不重复 / 没有更多消息 |
| 发送校验 | 空正文被拒绝 / 纯空白被拒绝 / 超长被拒绝 / 边界长度被接受 |
| 发送与摘要 | 发送成功 / 摘要与排序同步更新 |
| 未读 | 收到消息后未读增加 / 标记已读后归零 / 自己的消息不计未读 / 已读与新消息并发时不丢 / 总未读数端点返回各会话之和 |
| 实时推送 | 对方发消息后实时出现 / 断线恢复后补齐消息 / 推送只发给会话参与者 / 未打开会话时不建立推送 |

**两条警告**（不阻塞，转「可后置」）：

- **W1 · 已读与新消息并发时不丢**：`markRead` 先 `findMaxId` 再按该消息 id 置已读；若另一条恰在
  `findMaxId` 与更新之间落库，会被一并算作已读。窗口极窄，丢的是「一次未读提醒」而不是消息本身；
  现有单测绕过了 `service.markRead` 的该路径。不阻塞理由：消息不丢、E2E 已在真实并发下跑通，
  真正的修复需要换写法（更新时取 max 或行锁），属于独立的 `fix/` 事项。
- **W2 · 对方发消息后实时出现**：「2 秒内到达」是运行时指标，静态对账不可证；已由
  `docs/e2e/messages.spec.ts` 的双向 SSE 延迟断言（`≤ 2000ms`）支撑。

**反向对账**（实现 → 规格，6 条）未发现不该存在的功能；其中「会话页在台时对方新消息触发静默
`markRead`」原未写入任务清单，已补记到 `tasks.md` 6.2 偏差。

---

## Stage 2 — 代码质量（test-agent）

### 场景映射

| 层 | 文件 | 覆盖 |
|---|---|---|
| 服务层 | `backend/src/test/java/com/luyi/myfirst/service/dm/DmServiceImplTest.java` | 会话复用、自我会话、参与边界、未读增减与清零、摘要与排序、游标、并发已读 |
| 支撑件 | `service/dm/support/DmCursorTest` / `DmInputRulesTest` / `DmErrorEnumTest` | 游标编解码、正文 8–2000 规则、错误码映射 |
| 端点 | `backend/src/test/java/com/luyi/myfirst/web/dm/DmControllerTest.java`（9 例） | 六个端点契约、非参与者 404、未登录 401、SSE 进入异步模式 |
| SSE | `backend/src/test/java/com/luyi/myfirst/web/dm/DmEventBrokerTest.java`（5 例） | 事务提交后推送、断连清理、按会话隔离 |
| 前端客户端 | `frontend/lib/dm/dm-api.test.ts` / `dm-api.mock.test.ts` / `dm-input.test.ts` | 六个端点 + `stream`、四类错误归一化、Mock 开关 |
| 前端页面 | `frontend/app/messages/messages-content.test.tsx` / `app/messages/[publicId]/conversation.test.tsx` | 列表空态/渲染/新建跳转、发送追加、推送去重、断线补齐、进入即已读、列表页不建流 |
| 顶栏 | `frontend/components/site/message-badge.test.tsx` | 已登录显示未读角标 / 未登录隐藏 |
| 真实链路 | `docs/e2e/messages.spec.ts`（5 例，唯一不打桩） | 用户面 S1~S10：建会话、发送、未读与清零、双上下文实时、游客拦截 |

### 执行结果

| 项目 | 命令 | 结果 |
|---|---|---|
| 后端全量 | `mvn -B test`（02 号闸门内） | 448 tests，0 failures |
| 私信端点与推送 | `mvn -B test -Dtest=DmControllerTest,DmEventBrokerTest` | 14 通过（9 + 5） |
| 前端私信页面 | `npx vitest run app/messages` | 10 passed |
| E2E | `npm run test:e2e -- docs/e2e/messages.spec.ts` | 5/5 通过（11.8s），双向 SSE 均 ≤ 2000ms |

截图：`docs/e2e/screenshots/messages/01-new-conversation.png` ~ `05-realtime-two-way.png`。

---

## Harness 总闸门

`powershell -File harness\run-all.ps1` → **16/16 PASSED，EXIT=0**

| 闸门 | 结果 |
|---|---|
| 02-test | 448 tests，0 failures（含容器装配契约测试） |
| 04-frontend | `npm ci` → `next build` → vitest 全绿（53.9 s） |
| 06-schema-check | 两库 DROP/CREATE 后断言 dm 两表 6 索引 / 9 约束 / 四列齐全 |
| 08-spec-doc-breakpoints | `docs/specs/wanderchain/messages.md` 与 `messages.module.css` 断点一致（16 份文档） |
| 10-contract-check | dm 六个端点契约双向一致；change「## 契约」三方比对通过 |
| 14-change-scope | 能力 1 / tasks 26 / scenarios 30，均在阈值内 |
| 15-test-weakening | 无用例或断言减少 |
| 其余 9 道 | 全 PASS |

---

## 本次验收中的环境处置（复核时需知）

1. **数据库备份与恢复**：跑 `run-all` 前用 `mysqldump --databases wanderchain ai_chat_gate` 备份到
   `%TEMP%\wc-backup-20261109-173042.sql`；06 号闸门会 DROP/CREATE 两库，跑完已用该 dump 恢复并核对：
   accounts 2 / posts 2 / attractions 13 / dm_conversations 1 / dm_messages 7 / auth_sessions 38，
   两库 10 + 4 张表。**不存在「账户被闸门清掉」的遗留**（与上一份交接单的环境处置不同）。
2. **两处测试隔离修复（首轮 02-test 红，未改产品代码）**，根因与修法见 `tasks.md` 8.2 偏差：
   ① Redis 账户失败计数键 `wc:login:fail:acct:{自增 id}` 在 06 重建库、id 被回收后残留；
   ② `PostServiceTest.keysetPagingDoesNotRepeatOrSkip` 假设空库，dev 库实有 2 篇已发布帖。
3. **前后端已重启到本次代码**：8989（`mvn spring-boot:run`，日志 `%TEMP%\wc-8989.log`）、
   3000（`next dev`，`NEXT_PUBLIC_DM_MOCK=0`）。恢复后冒烟：login 200 / `dm/unread-count` 200 /
   `dm/conversations` 200 / `attractions` 200 / 首页 200。
4. **凭据作用域提醒**：`E2E_POSTS_ACCOUNT_*` 以 **User 作用域**为准；长期运行的 shell 会持有旧值，
   复核时用 `[Environment]::GetEnvironmentVariable(name,'User')` 读取，否则会出现「密码明明对却 401」。

---

## 遗留（不阻塞交接）

- W1：建议另开 `fix/` 分支处理 `markRead` 的取 max 时机（更新语句内取 max 或对会话行加锁）。
  W2 已由 E2E 断言覆盖，无需动作。
- `tasks.md` Workflow follow-up：归档后另补用户页「发私信」入口（避免与未归档的
  `wanderchain-user-page` delta 冲突）；消息中心（评论 / 点赞 / 收藏提醒聚合）作为下一个 change。
- 归档前动作（⑤ 阶段）：把 `specs/wanderchain-direct-messages/spec.md` 合入
  `openspec/specs/wanderchain-direct-messages/`，并在 `docs/spec-evidence.json` 为 30 条 Scenario
  登记证据，否则 13 号闸门会在归档后拦下。逐条键名与证据见下节清单。

---

## 归档操作清单（⑤ 阶段执行，机械操作）

1. **合入规格**：`/opsx:archive add-direct-messages`（或手工把 `specs/wanderchain-direct-messages/spec.md`
   复制为 `openspec/specs/wanderchain-direct-messages/spec.md`，再把 change 目录移入
   `archive/2026-11-09-add-direct-messages/`）。
2. **登记证据**：在 `docs/spec-evidence.json` 新增能力 `wanderchain-direct-messages`。
   30 条键名必须逐字取自下表（键名 = `Requirement 标题 / Scenario 标题`，差一字即被 13 号闸门
   判「账本指向不存在的 Scenario」）。
   注意：账本条目与主规格必须**同一次改动**落地——只有账本没有主规格会被判「账本残留能力」。

| Requirement 标题 | Scenario 标题（逐字） | 证据 ref（kind = test / e2e） |
|---|---|---|
| 会话按参与者对唯一 | 首次发起创建会话 / 重复发起返回同一会话 / 不能向自己发起 / 对方不存在 | `backend/src/test/java/com/luyi/myfirst/service/dm/DmServiceImplTest.java` |
| 会话列表只含本人参与的会话 | 只返回本人参与的会话 / 按最近活跃时间倒序 / 每项含对方名片与未读数 / 没有会话时返回空列表 | `backend/src/test/java/com/luyi/myfirst/service/dm/DmServiceImplTest.java` |
| 会话读写仅限参与者 | 非参与者不能读取消息 / 非参与者不能发送消息 / 非参与者不能标记已读 / 未登录被拒绝 | `backend/src/test/java/com/luyi/myfirst/web/dm/DmControllerTest.java` |
| 消息游标分页 | 首页返回最新消息 / 游标翻页不重复 / 没有更多消息 | `backend/src/test/java/com/luyi/myfirst/service/dm/support/DmCursorTest.java` |
| 文本消息校验 | 空正文被拒绝 / 纯空白被拒绝 / 超长被拒绝 / 边界长度被接受 | `backend/src/test/java/com/luyi/myfirst/service/dm/support/DmInputRulesTest.java` |
| 发送消息并更新会话摘要 | 发送成功 / 摘要与排序同步更新 | `backend/src/test/java/com/luyi/myfirst/service/dm/DmServiceImplTest.java` |
| 未读计数与已读标记 | 收到消息后未读增加 / 标记已读后归零 / 自己的消息不计未读 / 已读与新消息并发时不丢 / 总未读数端点返回各会话之和 | `backend/src/test/java/com/luyi/myfirst/service/dm/DmServiceImplTest.java` |
| 会话内新消息实时推送 | 对方发消息后实时出现 / 断线恢复后补齐消息 / 推送只发给会话参与者 / 未打开会话时不建立推送 | `backend/src/test/java/com/luyi/myfirst/web/dm/DmEventBrokerTest.java` + `docs/e2e/messages.spec.ts` |

   写法示例（`verified` 的值是 ref 数组）：

   ```json
   "会话按参与者对唯一 / 首次发起创建会话": [
     { "kind": "test", "ref": "backend/src/test/java/com/luyi/myfirst/service/dm/DmServiceImplTest.java" }
   ]
   ```

   能力级 `sources` 建议按既有惯例登记三条：
   `{"kind":"gate","ref":"harness/checks/10-contract-check.ps1"}`、
   `{"kind":"test","ref":"frontend/lib/dm/dm-api.test.ts"}`、
   `{"kind":"e2e","ref":"docs/e2e/messages.spec.ts"}`。
3. **验证**：`powershell -File harness\checks\13-spec-evidence-check.ps1` 与 `07-doc-consistency.ps1`
   退出码均为 0 才算归档完成。

---

## 收尾补正（2026-11-09 第二轮审计新增）

交接单初稿与全量 16 道闸门之间，工作区又做了三处纯文档修正，均不触产品代码：

1. `docs/db-design-spec.md` 引用的 `harness-backlog.md §2.8` 原不存在（断链）。已在 backlog 新增
   2.7（共享 Redis 长 TTL 计数键 × 06 重建库自增 id 复用）与 2.8（06 号重建 schema 会清空本地数据），
   并给 2.5 补上「已随本 change 就地修复」的状态；§1 基线同步为 16 道闸门与 2026-11-09 耗时。
   同时把 `docs/loop-engineering-audit.md`（两处）与 backlog §2.1 中残留的「15 道闸门 / 15 个脚本」
   同步为 16。
2. `AGENTS.md` 目录地图补齐 `dao/dm/`、`service/dm/`、`web/dm/`、`app/messages/`、`lib/dm/`、
   `components/site` 的消息角标、`schema.sql` 的 dm 两表与 `docs/specs/wanderchain/` 的 20 份文档描述，
   命令速查新增「私信接口」一行。
3. `.gitignore` 补根级 `test-results/` 与 `playwright-report/`（Playwright 在配置未生效时会在仓库根落产物）。

**定向复验**（只跑受影响的闸门，未重跑全量 16 道）：`03-static-guard`、`05-scaffold-check`、
`07-doc-consistency`、`13-spec-evidence-check` 均 PASS（EXIT=0）。全量 16/16 的结论仍以 8.2 那次为准。

---

## 结论

**可交接。** Stage 1 无「错」，Stage 2 场景映射无缺口、E2E 全绿，Harness 16 道闸门全通过，
数据库已恢复到跑前状态。满足 AGENTS.md §4 进入 ⑤ 归档的条件。
