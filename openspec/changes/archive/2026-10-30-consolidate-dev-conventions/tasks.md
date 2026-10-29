# Tasks

本变更 6 条 Requirement / 16 个 Scenario 全部在 `specs/dev-conventions/spec.md`；实现方式见 `design.md` 的 D1–D7。

顺序是刻意的：闸门先于文档存在。这样每一份文档落地时都能立刻证明「它是被守住的」，而不是写完四份文档再补一个闸门假装守住。

`design.md` 登记了 3 条 Open Question，其中 1 条为阻塞级；实施到对应任务处必须停下确认，不得按默认倾向硬写。

## 1. 闸门先落地

- [x] 1.1 新建 `harness/checks/11-conventions-check.ps1`，实现 design D5 的七项断言，遵守 D6 的实现约束（`<# #>` 块注释、`$ErrorActionPreference='Stop'`、`Split-Path -Parent (Split-Path -Parent $PSScriptRoot)` 定位根、只读、零交互、**UTF-8 with BOM**），验证：文件以 BOM 开头（`Get-Content -Encoding Byte -TotalCount 3` 为 `239 187 191`），且 `powershell -File harness\checks\11-conventions-check.ps1` 能执行到断言阶段而非语法报错
- [x] 1.2 确认闸门先红：此时 `docs/conventions/` 尚不存在，`11` 必须退出码 `1` 并明确指出缺 `docs/conventions/README.md`。验证：记录该次输出的首行到本任务备注。此为预期失败，不是环境故障
- [x] 1.3 分层断言的正向基线：在 `docs/conventions/` 补齐前，单独验证 R6 这一项对当前代码判绿。验证：临时注释掉其余断言只留分层检查，跑 `11` 得退出码 `0`；随后恢复
- [x] 1.4 分层断言的负向验证：在 `backend/src/main/java/com/luyi/myfirst/dao` 下临时给任一类加一行 `import com.luyi.myfirst.web.auth.dto.LoginRequest;`，跑 `11` 确认退出码 `1` 且输出含该文件与行号；随后删除该行并确认恢复 `0`。验证：两次退出码已记录，且 `git status` 中该文件无残留改动

## 2. 四份约定文档

- [x] 2.1 写 `docs/conventions/README.md`：五类主题索引、每类真源指向、新增业务模块必读清单、以及「依赖现状 / 拟引入」两节的**可复制模板**（design D3 的格式）。验证：`11` 中索引一致性一项转绿，且该文件不含任何规则正文（只含指针与模板）
- [x] 2.2 写 `docs/conventions/backend-conventions.md`：包结构与依赖方向、Controller 拆分粒度（对齐 `web/auth/` 的九个细分 Controller）、DTO 与响应、异常收口（`BizException` + `GlobalExceptionHandler`）、错误码命名空间通则。数据库命名与主键一律只给指针。验证：文件含四个固定小节且「真源声明」里每条路径都真实存在。**实施前确认 OQ1**（是否写入尚未落地的 `service/<域>/impl/` 约定），若写入必须放在独立的「目录演进方向（未落地）」小节
- [x] 2.3 写 `docs/conventions/frontend-conventions.md`：目录组织（`app/` / `components/{domain}/` / `lib/{domain}/`）、组件三件套、状态归属层次（哪些状态进 `AuthProvider`、哪些留在页面）、API 封装两层（`lib/contracts/*` 字段契约 + 端点函数）、契约镜像顺序「先改后端 DTO 再来镜像」。验证：文件含四个固定小节，且「机械守卫」段引用 `10-contract-check`
- [x] 2.4 写 `docs/conventions/styling-conventions.md`：CSS Modules 组织、`app/globals.css` 的容器留白机制（不用 `width: min(100%, Npx)` 覆盖父容器）、响应式取向、视觉与可访问性底线。Tailwind 与 shadcn/ui 写入「拟引入」段并附引入条件（design D4）。验证：文件含四个固定小节，且「依赖现状」段的每一项都能在两侧依赖清单中找到。**实施前确认 OQ2**
- [x] 2.5 四份齐备复核：`11` 全部七项断言退出码 `0`。验证：完整输出已记录，无任何一项被跳过

## 3. `AGENTS.md` 三处同步

- [x] 3.1 §6 目录树加两处行：`docs/` 下新增 `conventions/` 条目，`harness/checks/` 下新增 `11-conventions-check.ps1` 条目。验证：`11` 的目录树断言转绿
- [x] 3.2 `<!-- harness-checks: ... -->` 标记追加 `11-conventions-check`。验证：`07-doc-consistency` 退出码 `0`
- [x] 3.3 正文增加一行指向 `docs/conventions/README.md` 的入口（建议落在 §6 之前或 §7 命令速查之后）。验证：`11` 的入口断言转绿
- [x] 3.4 确认三处是**同一次提交**内的改动，而非分三次。验证：`git diff --stat` 中 `AGENTS.md` 只有一个条目

## 4. 集成验收

- [x] 4.1 专项验收：`powershell -File harness\checks\07-doc-consistency.ps1` 与 `powershell -File harness\checks\11-conventions-check.ps1` 均退出码 `0`
- [x] 4.2 一键验收：`powershell -File harness\run-all.ps1`，验证：退出码 `0`，**12 道**闸门全 PASS
- [x] 4.3 逐条 Requirement 对照：为 6 条 Requirement / 16 个 Scenario 逐项标注对应闸门断言或人工核验方式。验证：产出映射清单且无遗漏项，无「仅口头覆盖」

### 4.3 产出：Requirement → 证据映射

闸门：`11-conventions-check`（除 R5 第一行标注的 `07`）。全部证据来自本轮实际执行，含五次探针。

| Req | Scenario | 证据 |
|---|---|---|
| R1 入口唯一且索引双向一致 | 索引与目录一致 | `11` PASSED：4 份约定文档自洽；`run-all` 中 `[PASS] 11-conventions-check` |
| R1 | 新增约定文档未登记 | 探针 A（`zz-probe.md`）→ `约定文档未登记进索引：zz-probe.md`，EXIT=1 |
| R1 | 索引登记了不存在的文件 | 探针 C（索引加 `zz-no-such-doc.md`）→ `索引登记了不存在的文件：zz-no-such-doc.md`，EXIT=1 |
| R1 | 入口未挂到 AGENTS.md | 首次运行 → `AGENTS.md 未引用约定入口：docs/conventions/README.md`，EXIT=1；task 3.3 补 §7 入口行后转绿 |
| R2 声明真源且不重述 | 缺真源声明 | 探针 A → `zz-probe.md 缺少「真源声明」小节` |
| R2 | 真源声明的路径不存在 | 探针 B → `真源声明引用了不存在的路径：docs/conventions/no-such-doc.md` |
| R2 | 不重述既有真源 | **人工核验**：三份正文只给指针；数据库命名/主键在 `db-design-spec` §2–§4，错误码集合在能力 spec，均未复制（此条为 R2 的 MUST NOT，闸门无法机械判定，已登记为 design Risk 2） |
| R3 依赖双向零交集 | 描述了未引入的库 | 探针 B「依赖现状」写 `not-a-real-dependency` → `「依赖现状」写了依赖清单中不存在的名字` |
| R3 | 把已引入的库标成拟引入 | 探针 B「拟引入」写 `next` → `「拟引入」写了已存在的依赖：next` |
| R3 | 两个小节都缺 | 探针 A → 两条缺小节同时报出 |
| R4 登记机械守卫 | 引用了不存在的闸门 | 探针 B 写 `99-no-such-gate.ps1` → `「机械守卫」引用了不存在的闸门：99-no-such-gate.ps1` |
| R4 | 机械守卫小节为空 | 探针 D（末节 `## 机械守卫` 无内容）→ `「机械守卫」小节为空`，EXIT=1 |
| R5 新增闸门三处同步 | 新增闸门未改标记 | 临时从 marker 删 `11-conventions-check` → `07` EXIT=1 并指出该闸门；还原后 EXIT=0 |
| R5 | 新增闸门未改目录树 | 首次运行 → `AGENTS.md 目录树缺少闸门：11-conventions-check.ps1`；task 3.1 补目录树后转绿 |
| R6 后端分层单向 | dao 层引用 web 层 | 探针 C 注入 `dao/TmpLayerProbe.java` → `dao 层不得 import web 包：... 第 3 行`，EXIT=1；删除后恢复 EXIT=0 且 `git -C backend status --porcelain` 为空 |
| R6 | common 层引用业务层 | 探针 E 注入 `common/web/TmpCommonProbe.java` → `common 层不得 import service 包：... 第 3 行`，EXIT=1；删除后恢复 |
| R6 | 现有代码满足单向依赖 | `run-all` 中 `11` PASSED，无任何分层项输出（正向基线） |

**实施中修正的三处闸门缺陷**（不属于 spec 变更，属 task 1.1 的实现完备性）：

1. 索引短文件名被相对项目根解析，`backend-conventions.md` 这类自然写法必错 → 改为项目根与 `docs/conventions/` 两处都试。
2. 索引校验扫了整份 `README.md`，正文举例（`openspec/specs/*/spec.md`）被当成登记项 → 收窄到「索引」小节。
3. `if ($gateText -and ...)` 与 `-not (Get-SectionText ...)` 都把空字符串当 falsy，导致「小节存在但为空」漏检或误报成「缺少小节」→ 改用 `$null -eq` / `$null -ne`。第 3 条若无探针 D 不会被发现。

## Workflow follow-up

- 本变更只改工作区自有文件（`docs/`、`harness/checks/`、`AGENTS.md`），**不触碰 `backend/` 与 `frontend/`**，因此无需子模块提交与 gitlink 更新（`AGENTS.md` 第 6 条硬规则不触发）。
- 归档：先同步 delta 到 `openspec/specs/dev-conventions/spec.md`，再 `/opsx:archive`，最后为归档提交补打 archive tag。
- `design.md` 的 3 条 Open Question 按登记级别在实施时逐条确认；阻塞级（OQ3）未获答复前不得进入第 3 组。
