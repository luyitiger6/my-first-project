# Proposal

## Why

进入业务模块开发前，需要一份能被 Agent 直接遵循的开发约定。但这些规则在仓库里已有三处权威表述：`AGENTS.md`（三层分工、目录地图、闸门约定）、`docs/db-design-spec.md`（命名、主键、公共字段、数据类型）、`openspec/specs/*/spec.md`（错误码固定集合、响应字段白名单、写请求来源校验）。

若按主题平铺新建五份约定文档而不做归并，同一规则会出现两处表述，且仓库已有先例证明后果：`docs/db-design-spec.md` 至今仍写 `06-flyway.ps1` 与 Flyway 版本化迁移，而实际闸门早已是 `06-schema-check.ps1`；这类漂移不会造成任何红灯，因为该文件不在 `07-doc-consistency` 与 `08-spec-doc-breakpoints` 的任何待检清单内。

所以本变更要解决的不是「有没有文档」，而是**新文档从第一天起就有机械守卫**。约定只写在 Markdown 里等于不会被执行的护栏——仓库的既有价值观是「让边界可验证」，本变更必须自洽。

## What Changes

- 新建 `docs/conventions/README.md`：五类主题的唯一索引，逐条给出「真源在哪」，并附新增业务模块的必读清单。
- 新建 `docs/conventions/backend-conventions.md`：包结构分层与依赖方向、DTO 与响应约定、异常收口、错误码命名空间划分。
- 新建 `docs/conventions/frontend-conventions.md`：目录组织、组件三件套、状态归属层次、API 封装两层（`lib/contracts/*` 字段契约 + `lib/auth/auth-api.ts` 形态的端点封装）。
- 新建 `docs/conventions/styling-conventions.md`：以仓库存量代码为准的样式约定（CSS Modules、`app/globals.css` 的容器留白、响应式取向），不描述仓库未引入的样式库。
- **不新建** `database-conventions.md` 与 `api-conventions.md`：前者整份指向 `docs/db-design-spec.md` §2–§4，后者并入 `backend-conventions.md` 的错误码一节与 `frontend-conventions.md` 的契约一节，避免同一规则两处表述。
- 新建 `harness/checks/11-conventions-check.ps1`：首版只做零误报的四项机械校验（见 `design.md` D5）。
- 三处成对同步：闸门脚本本身、`AGENTS.md` §6 目录树行、`AGENTS.md` 的 `<!-- harness-checks: ... -->` 标记（漏改会被 `07-doc-consistency` 判红）。
- `AGENTS.md` 增加一行指向 `docs/conventions/README.md` 的入口。

## Capabilities

### New Capabilities
- `dev-conventions`: 仓库级开发约定的唯一入口与索引一致性、约定文档对既有真源的引用关系、现状与拟引入的显式区分，以及可机械化约定与 `harness` 闸门的对应关系。

### Modified Capabilities
（无。`workspace-layout` 的 5 条 Requirement 全部关于 submodule 挂载、构建身份、未初始化失败、提交边界与远程地址替换，不涉及闸门清单本身；`contract-consistency` 的「受管范围可配置」一条已允许只追加清单条目；`database-baseline` 与 `frontend-nextjs` 的行为不因本变更改变。）

## Impact

- **代码**：无。不修改 `backend/` 与 `frontend/` 任何文件，因此不需要子模块提交与 gitlink 更新（`AGENTS.md` 第 6 条硬规则不触发）。
- **闸门**：`run-all.ps1` 的闸门数从 11 变为 12，依据其按文件名排序自动接入的约定，总控脚本无需改动。
- **入口契约**：`AGENTS.md` 的目录树与闸门标记各动一处。
- **运行期与部署**：无影响。`11-conventions-check` 只读文件系统，不连接 MySQL / Redis，不联网。
- **不在范围**：
  - `BaseEntity` 与 `ApiResponse` 的实际落地属于 `add-wanderchain-posts-backend`（该 change 的 tasks 2.1 / 2.2），本变更只在约定文档里引用其结论。
  - `docs/db-design-spec.md` 的 `06-flyway` 漂移（挂起项 t10）不在本变更修正，本变更只保证新文档不再重蹈。
  - 前端组件三件套检查与 `Response implements ApiResponse` 检查不在首版闸门内，理由见 `design.md` D5。
  - 不改 `openspec/config.yaml`，不改任何 schema 与模板。
