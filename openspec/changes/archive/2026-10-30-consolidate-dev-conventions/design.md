# Design

## Context

用户目标是「让 Agent 在写新模块时自动遵循规则」。现状是规则分散在三处：`AGENTS.md`（三层分工、目录地图、闸门约定）、`docs/db-design-spec.md`（命名 §2、主键 §3、公共字段 §4）、`openspec/specs/*/spec.md`（错误码固定集合、响应字段白名单、写请求来源校验）。

关键反例：`docs/db-design-spec.md` 有 6 处仍写 `06-flyway.ps1`，而实际闸门早已是 `06-schema-check.ps1`。它不造成任何红灯，因为该文件不在 `07-doc-consistency` 与 `08-spec-doc-breakpoints` 的任何待检清单里。**不在闸门扫描范围的文档必然长期漂移**——这是本设计要正面处理的结构性问题。

## Goals / Non-Goals

**Goals**

- 三份约定文档覆盖新增业务模块真正会踩的空缺，其余规则以指针形式引用既有真源。
- 每份文档从第一天起就被 `11-conventions-check` 机械守卫，不重蹈 `db-design-spec` 的覆辙。
- 依赖描述必须与两侧依赖清单一致，杜绝「照着一份写着 Tailwind 的文档去写代码」。

**Non-Goals**

- 不实现 `BaseEntity`、`ApiResponse`（属 `add-wanderchain-posts-backend`）。
- 不修正 `db-design-spec.md` 的 t10 漂移。
- 不做前端组件三件套检查、不做 `Response implements ApiResponse` 检查（理由见 D5）。
- 不重排 `backend` 的 `service/auth/` 目录（属另立变更）。
- 不改任何代码，因此不触发 `AGENTS.md` 第 6 条子模块提交规则。

## Decisions

### D1 · 归并成三份 + 一个索引，而不是五份平铺

| 目标文档 | 写什么 | 明确**不**写什么 |
|---|---|---|
| `README.md` | 五类主题的索引、每类真源指向、新增模块必读清单 | 任何规则正文 |
| `backend-conventions.md` | 包结构与依赖方向、Controller 拆分粒度、DTO 与响应、异常收口、错误码命名空间 | 数据库命名与主键（指向 `docs/db-design-spec.md` §2–§4） |
| `frontend-conventions.md` | 目录组织、组件三件套、状态归属层次、API 封装两层、契约镜像顺序 | 颜色/间距/断点（属 styling） |
| `styling-conventions.md` | CSS Modules 组织、容器留白机制、响应式取向、视觉与可访问性底线 | 组件结构（属 frontend） |

否掉的：按用户原始清单建 5 份。理由是把 `database-conventions.md` 与 `api-conventions.md` 单独成文，必然与 `db-design-spec.md` 和 `lib/contracts/auth.ts` 头部注释形成两处表述；而 `07` 与 `08` 都不扫这两处新文件，漂移无人发现。

### D2 · `database-conventions.md` 与 `api-conventions.md` 的内容去向

| 用户原定的章节 | 新去处 | 形式 |
|---|---|---|
| Entity 基类、公共字段、命名规范 | `docs/db-design-spec.md` §2–§4（不动） | `README.md` 与 `backend-conventions.md` 给出指针 |
| API 响应格式 | `backend-conventions.md` 一节 | 引用 `openspec/specs/wanderchain-auth/spec.md` 的响应白名单要求 |
| 错误码 | `backend-conventions.md` 一节 | 写「命名空间按业务域划分」通则，具体码表指向各 spec |
| 分页 | `backend-conventions.md` 一节 | 引用 `add-wanderchain-posts-backend` 的 design D8 游标方案 |
| 前端字段契约 | `frontend-conventions.md` 一节 | 指向 `frontend/lib/contracts/auth.ts` 头部注释 + `10-contract-check` |

### D3 · 「依赖现状 / 拟引入」采用可机械解析的格式

每份约定文档固定两个二级小节，条目格式统一为：

```markdown
## 依赖现状

- `next` — frontend/package.json dependencies
- `spring-security-crypto` — backend/pom.xml dependencies

## 拟引入

- `tailwindcss` — 引入条件：需另立变更添加依赖并使本文件转入「依赖现状」段
```

约束：**这两个小节内，反引号只用于依赖名**。闸门取这两个小节的段落文本，抽出全部反引号 token，与两侧清单做集合运算：

```
  依赖现状 ∩ 清单 必须 == 依赖现状        （每个现状项都必须真实存在）
  拟引入  ∩ 清单 必须 == 空集             （拟引入项都不能已存在）
  拟引入  ∩ 依赖现状 必须 == 空集         （同一项不能两边都写）
```

两侧清单的取值方式：`frontend/package.json` 的 `dependencies` 与 `devDependencies` 键名并集；`backend/pom.xml` 中 `<dependencies>` 块内的 `<artifactId>`（不含 parent 与 plugin）。

### D4 · Tailwind 与 shadcn/ui 落在「拟引入」

仓库现状是零 Tailwind、零 shadcn/ui、零 UI 库，样式由 22 个 CSS Modules 承担。用户原提示词要求 `styling-conventions.md` 讲这两者。

处置：写入「拟引入」小节，并附引入条件（需另立变更添加依赖；引入后本文件相应段落必须转入「依赖现状」段，否则 `11` 判红）。这样既保留用户意图，又不让文档描述不存在的东西——D3 的机械规则会强制这一点。

### D5 · `11-conventions-check.ps1` 首版只做零误报的五项

| 检查项 | 对应 Requirement | 误报风险 | 是否首版 |
|---|---|---|---|
| 索引与目录双向一致 | R1 | 无 | 是 |
| `AGENTS.md` 引用 `docs/conventions/README.md` | R1 | 无 | 是 |
| 每份文档含四个固定小节 + 真源路径存在 | R2 | 无（格式强制） | 是 |
| 依赖现状 / 拟引入双向零交集 | R3 | 无（格式强制） | 是 |
| 机械守卫段引用的闸门编号存在 | R4 | 无 | 是 |
| `AGENTS.md` 目录树含每个闸门文件 | R5 | 无 | 是 |
| 后端分层依赖方向 | R6 | 已取证为零违反 | 是 |
| 前端组件三件套（`.tsx` + `.module.css` + `.test.tsx`） | — | **高**：现有 44 个组件存在纯逻辑组件无 CSS 的情形 | 否 |
| `web/**/dto/*Response` 必须 `implements ApiResponse` | — | **高**：`ApiResponse` 尚不存在，只能写成「不存在就跳过」= 假绿灯 | 否 |

后两项延后的共同理由：**一个会误报或会静默跳过的闸门，第一次被绕过之后就再也不可信**。宁可先上七项零误报的，等 `add-wanderchain-posts-backend` 落地 `ApiResponse` 后，另立变更把第八项加进来（届时前置条件已满足，不需要「不存在则跳过」的退化路径）。

### D6 · 闸门脚本的实现约束

沿用 `harness/checks/` 既有约定：`<# #>` 块注释声明序号与职责、`$ErrorActionPreference = 'Stop'`、`Split-Path -Parent (Split-Path -Parent $PSScriptRoot)` 定位项目根、只读不改、通过 `exit 0` 失败 `exit 1`、不做交互式提问。

两条本项目特有约束：

- 文件必须存为 **UTF-8 with BOM**，否则 Windows PowerShell 5.1 读取中文标题会乱码，「真源声明」这类按标题匹配的逻辑全部失效。
- 标题匹配必须按二级标题精确匹配（`^##\s+真源声明\s*$`），不能只做 `-match '真源声明'`，否则正文里提到该词就会命中。

### D7 · 与 `add-wanderchain-posts-backend` 的关系

两个 change 无文件冲突：本变更只写 `docs/conventions/` 与 `harness/checks/11-*.ps1`，posts 变更写 `backend/`、`frontend/lib/contracts/posts.ts` 与 `harness/checks/06`、`10`。

两项软依赖需要写明：

- `backend-conventions.md` 会引用 `BaseEntity` 与 `ApiResponse` 的结论，而它们由 posts 变更落地。本变更在文档里以「`add-wanderchain-posts-backend` 的 design D1/D2」形式引用，不复制其内容；即使 posts 变更后改，本文件也不用改。
- 两侧都会改 `AGENTS.md`（posts 改 §6 与 §7，本变更改 §6 与 marker）。谁后提交谁需要处理一次小冲突，语义上不冲突。

## Risks

1. **格式约束过严，作者绕开** → 若「依赖现状」段难写，作者会把依赖写进正文散文，闸门就看不见。缓解：`README.md` 给出可直接复制的模板段，降低遵循成本。
2. **「不重述真源」无法机械判定** → R2 只能保证「真源声明存在且路径有效」，无法阻止把 200 行规则抄过来。这一条靠 review，承认它是文档类约定中不可机械化的残余。
3. **依赖名与包名不一致** → 例如 React 的包名是 `react`，若文档写 `React` 就会判红。缓解：`README.md` 明确「写包名不写显示名」。
4. **`AGENTS.md` 目录树行格式脆弱** → R5 依赖目录树里出现 `11-conventions-check.ps1` 字样，若将来目录树改成表格或重排，断言会失效。缓解：断言只要求「任意一行包含该文件名」，不要求具体位置与缩进。
5. **闸门数量增长** → `run-all` 从 11 道变 12 道，全量耗时增加约一次文件遍历。可忽略。

## Migration Plan

1. 先写 `harness/checks/11-conventions-check.ps1`，此时 `docs/conventions/` 尚未创建——闸门会红。这是预期：闸门先于文档存在，才能验证文档是被它守住的。
2. 逐份写 `README.md` → `backend-conventions.md` → `frontend-conventions.md` → `styling-conventions.md`，每写一份跑一次 `11`，看到红灯项减少。
3. 四份齐备且 `11` 绿后，改 `AGENTS.md` 三处：§6 目录树新增 `docs/conventions/` 与 `11-conventions-check.ps1` 两处行、`harness-checks` 标记追加 `11-conventions-check`、正文增加指向入口的一行。
4. 跑 `07` 与 `11`，全绿后跑 `run-all.ps1`。

回滚方式：删除 `docs/conventions/` 与 `harness/checks/11-conventions-check.ps1`，还原 `AGENTS.md` 两处（marker 与目录树）。无数据迁移，无外部依赖。

## Open Questions

| 级别 | 问题 | 影响任务 | 默认倾向 |
|---|---|---|---|
| 一般 | `backend-conventions.md` 是否写入用户 2026-10-28 定下但**尚未落地**的 `service/<域>/impl/` 目录约定 | 2.2 | 写入独立小节「目录演进方向（未落地）」，不与「现状」混排 |
| 一般 | `styling-conventions.md` 的「拟引入」段是否只写 Tailwind 与 shadcn/ui，还是把「是否引入」本身列为待决 | 2.4 | 只写这两个，附引入条件；不在文档里替用户做引入决策 |
| 阻塞 | `docs/conventions/` 是否需要同步一份到 `.qoder/rules/` 等 AI 工具适配层 | 3.x | 不同步。项目规则正文唯一真源是根 `AGENTS.md`，再建适配层副本会造成多真源 |
