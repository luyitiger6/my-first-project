# OpenSpec 工具使用

<cite>
**本文引用的文件**   
- [openspec/config.yaml](file://openspec/config.yaml)
- [openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml](file://openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml)
- [openspec/changes/add-wanderchain-auth/.openspec.yaml](file://openspec/changes/add-wanderchain-auth/.openspec.yaml)
- [openspec/changes/add-wanderchain-auth/specs/wanderchain-auth/spec.md](file://openspec/changes/add-wanderchain-auth/specs/wanderchain-auth/spec.md)
- [openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml](file://openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml)
- [openspec/specs/frontend-nextjs/spec.md](file://openspec/specs/frontend-nextjs/spec.md)
- [.agents/skills/openspec-propose/SKILL.md](file://.agents/skills/openspec-propose/SKILL.md)
- [.agents/skills/openspec-explore/SKILL.md](file://.agents/skills/openspec-explore/SKILL.md)
- [.agents/skills/openspec-apply-change/SKILL.md](file://.agents/skills/openspec-apply-change/SKILL.md)
- [.agents/skills/openspec-archive-change/SKILL.md](file://.agents/skills/openspec-archive-change/SKILL.md)
- [.agents/skills/openspec-sync-specs/SKILL.md](file://.agents/skills/openspec-sync-specs/SKILL.md)
</cite>

## 更新摘要
**已进行的更改**   
- 新增"WanderChain 认证前端变更"章节，展示新的认证前端功能的 OpenSpec 配置结构
- 在"项目配置"和"变更元数据"部分补充了认证相关变更的配置示例
- 更新了"架构总览"中的变更类型分类，增加了认证前后端分离的变更模式
- 在"详细组件分析"中新增了认证前端变更的具体实现说明

## 目录
1. [引言](#引言)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能与可维护性建议](#性能与可维护性建议)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录：常用命令与配置模板](#附录常用命令与配置模板)

## 引言
本指南面向希望在本仓库中使用 OpenSpec 进行"规格驱动"开发的开发者。OpenSpec 通过 `openspec/` 目录组织变更提案、规格说明和归档记录，配合 CLI 完成从立项、审阅、实现到归档的全流程管理。仓库中已包含一个基于 `spec-driven` 工作流的项目示例，以及一套 Agent Skill 文档，用于指导如何调用 OpenSpec CLI 完成提议、探索、实现、同步和归档等操作。

本次更新重点反映三个已归档变更和一个新的活跃变更：
- `extract-home-hero`：将首页主视觉从 `app/page.tsx` 的内联 JSX 抽取为独立 Server Component，并通过 delta spec 向 `wanderchain-homepage` 能力补入"首页主视觉"需求。
- `close-frontend-test-gaps`：以测试补齐与文档对齐为主，外部行为不变；通过 mock 数据源验证排序与截断、用真实 render 期抛错验证 SectionBoundary、按 desktop-first 实际断点修正单元文档响应式小节，并扩充 `harness/checks/08-spec-doc-breakpoints.ps1` 配对表。
- **新增** `add-wanderchain-auth-frontend`：WanderChain 认证前端的活跃变更，建立了 schema-driven 规格格式的入口点，与后端的 `add-wanderchain-auth` 变更形成完整的前后端认证功能。

## 项目结构
仓库中与 OpenSpec 直接相关的根级目录是 `openspec/`，其典型子目录如下：
- `openspec/config.yaml`：项目级 OpenSpec 配置，声明工作流 schema、上下文语言与规则提示等。
- `openspec/specs/`：主规格（main specs）存放位置，按能力路径组织，例如 `workspace-layout`、`workspace-scaffold`、`skill-distribution`、`frontend-nextjs`、`wanderchain-homepage`。
- `openspec/changes/`：活跃变更目录，每个变更是一个以短横线命名的小目录，内部包含 `.openspec.yaml`、`proposal.md`、`design.md`、`tasks.md` 以及 `specs/<capability-path>/spec.md` 等工件。
- `openspec/changes/archive/`：已归档变更目录，通常以 `YYYY-MM-DD-<change-name>` 形式命名；`extract-home-hero` 与 `close-frontend-test-gaps` 均归档于该目录。

```mermaid
graph TB
Root["仓库根目录"] --> ORoot["openspec/"]
ORoot --> Config["config.yaml<br/>项目级配置"]
ORoot --> Specs["specs/<capability>/spec.md<br/>主规格"]
ORoot --> Changes["changes/<change-name>/<br/>活跃变更"]
Changes --> ChangeMeta[".openspec.yaml<br/>变更元数据"]
Changes --> Artifacts["proposal.md / design.md / tasks.md<br/>变更工件"]
Changes --> DeltaSpecs["specs/<capability>/spec.md<br/>差异规格"]
ORoot --> Archive["changes/archive/<date>-<name>/<br/>归档变更"]
Archive --> ExtractHero["2026-10-27-extract-home-hero/<br/>首页主视觉抽取归档"]
Archive --> TestGaps["2026-10-27-close-frontend-test-gaps/<br/>前端测试补齐归档"]
Changes --> AuthFrontend["add-wanderchain-auth-frontend/<br/>认证前端活跃变更"]
```

**图示来源**
- [openspec/config.yaml:1-29](file://openspec/config.yaml#L1-L29)
- [openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml#L1-L3)
- [openspec/changes/add-wanderchain-auth/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml:1-3](file://openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml:1-4](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml#L1-L4)
- [.agents/skills/openspec-propose/SKILL.md:17-24](file://.agents/skills/openspec-propose/SKILL.md#L17-L24)
- [.agents/skills/openspec-archive-change/SKILL.md:176-184](file://.agents/skills/openspec-archive-change/SKILL.md#L176-L184)

**章节来源**
- [openspec/config.yaml:1-29](file://openspec/config.yaml#L1-L29)
- [openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml#L1-L3)
- [openspec/changes/add-wanderchain-auth/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml:1-3](file://openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml:1-4](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml#L1-L4)
- [.agents/skills/openspec-propose/SKILL.md:17-24](file://.agents/skills/openspec-propose/SKILL.md#L17-L24)
- [.agents/skills/openspec-archive-change/SKILL.md:176-184](file://.agents/skills/openspec-archive-change/SKILL.md#L176-L184)

## 核心组件
OpenSpec 在本仓库中的核心组件包括：
- **项目配置**：`openspec/config.yaml` 定义 schema、上下文语言、可选的工件规则与操作建议。
- **变更工件**：每个变更目录下的 `.openspec.yaml`、`proposal.md`、`design.md`、`tasks.md`，以及 `specs/<capability-path>/spec.md`。
- **主规格**：`openspec/specs/<capability-path>/spec.md`，由差异规格合并而来，描述系统应满足的能力契约。
- **CLI 工作流**：通过 `openspec new change`、`openspec status`、`openspec instructions`、`openspec list`、`openspec show`、`openspec validate`、`openspec sync specs`、`openspec archive` 等命令串联。
- **Agent Skill 指引**：`.agents/skills/openspec-*` 提供标准化的命令行操作流程，帮助开发者或 AI 助手正确调用 OpenSpec。

**章节来源**
- [openspec/config.yaml:1-29](file://openspec/config.yaml#L1-L29)
- [.agents/skills/openspec-propose/SKILL.md:17-24](file://.agents/skills/openspec-propose/SKILL.md#L17-L24)
- [.agents/skills/openspec-apply-change/SKILL.md:41-63](file://.agents/skills/openspec-apply-change/SKILL.md#L41-L63)
- [.agents/skills/openspec-archive-change/SKILL.md:73-100](file://.agents/skills/openspec-archive-change/SKILL.md#L73-L100)
- [.agents/skills/openspec-sync-specs/SKILL.md:86-177](file://.agents/skills/openspec-sync-specs/SKILL.md#L86-L177)

## 架构总览
下图展示 OpenSpec 在仓库中的整体协作关系：开发者通过 CLI 创建变更、编写工件；CLI 根据 schema 生成并校验工件；差异规格可以同步到主规格；实现完成后归档变更。`extract-home-hero` 展示了从活跃变更到归档变更的完整生命周期，`close-frontend-test-gaps` 展示了"不修改主规格、只补齐测试与文档"的归档路径，而 `add-wanderchain-auth-frontend` 则展示了新的认证前端功能的活跃变更状态。

```mermaid
sequenceDiagram
participant Dev as "开发者"
participant CLI as "OpenSpec CLI"
participant Change as "变更目录<br/>openspec/changes/<name>"
participant Specs as "主规格<br/>openspec/specs"
participant Archive as "归档目录<br/>changes/archive"
Dev->>CLI : "openspec new change add-wanderchain-auth-frontend"
CLI-->>Change : "创建 .openspec.yaml 与工件骨架"
Dev->>CLI : "openspec status --change add-wanderchain-auth-frontend"
CLI-->>Dev : "返回工件状态与依赖图"
Dev->>Change : "编写 proposal/design/tasks<br/>建立认证前端规格"
Dev->>CLI : "openspec apply (由 skill 驱动)"
CLI-->>Dev : "按 tasks 推进实现，构建认证前端组件"
Dev->>CLI : "openspec sync specs --change add-wanderchain-auth-frontend"
CLI-->>Specs : "同步认证前端规格到主规格"
Dev->>CLI : "openspec archive --change add-wanderchain-auth-frontend"
CLI->>Archive : "移动变更目录为 YYYY-MM-DD-add-wanderchain-auth-frontend"
```

**图示来源**
- [.agents/skills/openspec-propose/SKILL.md:77-137](file://.agents/skills/openspec-propose/SKILL.md#L77-L137)
- [.agents/skills/openspec-sync-specs/SKILL.md:47-177](file://.agents/skills/openspec-sync-specs/SKILL.md#L47-L177)
- [.agents/skills/openspec-apply-change/SKILL.md:41-129](file://.agents/skills/openspec-apply-change/SKILL.md#L41-L129)
- [.agents/skills/openspec-archive-change/SKILL.md:169-184](file://.agents/skills/openspec-archive-change/SKILL.md#L169-L184)

## 详细组件分析

### 项目配置：`openspec/config.yaml`
该文件是 OpenSpec 在项目级的入口配置，当前仓库中的关键内容包括：
- `schema: spec-driven`：指定使用"规格驱动"工作流。
- `context`：声明语言与约束，例如要求所有工件使用中文，但保留 OpenSpec 的结构标题与 SHALL/MUST 关键词为英文。
- 可选的 `rules` 与 `operations`：用于对特定工件或 apply/archive 操作给出指导性建议。

实际使用中，你可以：
- 修改 `context` 来统一团队的语言风格与写作约束。
- 添加 `rules.proposal`、`rules.tasks` 等条目，限制提案长度、任务拆分粒度等。
- 添加 `operations.apply.guidance`、`operations.archive.guidance`，为实施与归档阶段补充建议。

**章节来源**
- [openspec/config.yaml:1-29](file://openspec/config.yaml#L1-L29)

### 变更元数据：`.openspec.yaml`
每个变更目录下都有一个 `.openspec.yaml`，用于声明变更的基本元信息。仓库中既有活跃变更示例，也有归档变更示例：
- 活跃变更示例：`openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml`
- 活跃变更示例：`openspec/changes/add-wanderchain-auth/.openspec.yaml`
- 归档变更示例：`openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml`
- 归档变更示例：`openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml`

这些文件都包含：
- `schema: spec-driven`
- `created: YYYY-MM-DD`

对于 `add-wanderchain-auth-frontend`，这是一个新的活跃变更，建立了 WanderChain 认证前端的 OpenSpec 配置入口。对于 `add-wanderchain-auth`，这是对应的后端认证功能变更。对于 `close-frontend-test-gaps`，归档后的元数据额外包含 `skip_specs: true`，表明该变更不产生也不需要同步 delta spec，而是聚焦于测试补齐与文档对齐。对于 `extract-home-hero`，归档后的元数据表明该变更已于 2026-10-27 创建并完成归档，不再处于活跃状态。在实际项目中，你可能还需要根据工作流扩展字段，例如：
- `skip_specs`：跳过某些工件（如 delta spec）。
- `retire_capabilities`：允许在归档时移除整个能力的主规格。

**章节来源**
- [openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml#L1-L3)
- [openspec/changes/add-wanderchain-auth/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml:1-3](file://openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml:1-4](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml#L1-L4)
- [.agents/skills/openspec-archive-change/SKILL.md:122-124](file://.agents/skills/openspec-archive-change/SKILL.md#L122-L124)

### WanderChain 认证前端变更：`add-wanderchain-auth-frontend`
`add-wanderchain-auth-frontend` 是一个活跃的认证前端变更，与后端的 `add-wanderchain-auth` 变更形成完整的前后端认证功能。这个变更建立了 schema-driven 规格格式的入口点，为 WanderChain 应用的前端认证界面提供规范化的开发流程。

该变更的关键特点包括：
- 使用标准的 `schema: spec-driven` 工作流
- 创建于 2026-10-27，目前仍处于活跃状态
- 与后端认证变更保持独立的规格管理
- 遵循 OpenSpec 的工件结构规范

```mermaid
flowchart TD
A["add-wanderchain-auth-frontend 变更创建"] --> B[".openspec.yaml 设置 schema: spec-driven"]
B --> C["创建变更目录结构"]
C --> D["编写 proposal.md 说明认证前端需求"]
D --> E["设计 design.md 记录前端架构决策"]
E --> F["制定 tasks.md 列出实现步骤"]
F --> G["specs/wanderchain-auth/spec.md 定义前端契约"]
G --> H["openspec sync specs 同步规格"]
H --> I["实现前端认证组件"]
I --> J["openspec archive 归档变更"]
```

**图示来源**
- [openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml#L1-L3)
- [openspec/changes/add-wanderchain-auth/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth/.openspec.yaml#L1-L3)

**章节来源**
- [openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml#L1-L3)
- [openspec/changes/add-wanderchain-auth/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth/.openspec.yaml#L1-L3)

### 归档变更示例：extract-home-hero
`extract-home-hero` 是一个已归档的前端结构重构变更，核心目标是把首页主视觉从 `app/page.tsx` 的内联 JSX 抽取为独立组件，并把行为写进 `wanderchain-homepage` 能力的规格层。

该变更的关键工件如下：
- `.openspec.yaml`：声明 `schema: spec-driven` 与 `created: 2026-10-27`。
- `proposal.md`：说明为什么需要抽取主视觉、变更范围、影响面、是否破坏向后兼容等。
- `design.md`：记录设计决策，包括抽成 Server Component、沿用 CSS Modules、`stats` 非法整组回退、样式迁走不留别名、不接收 `city`、用 DOM 结构比对证明视觉零变化等。
- `tasks.md`：列出组件与样式落位、页面接线与清理、测试、规格与文档同步、验收等任务，全部勾选表示已实现。
- `specs/wanderchain-homepage/spec.md`：delta spec，新增"首页主视觉" Requirement 与多个 Scenario。

归档后，`openspec/specs/wanderchain-homepage/spec.md` 中已经出现"Requirement: 首页主视觉"及其场景，说明 delta spec 已成功同步到主规格。

```mermaid
flowchart TD
A["extract-home-hero 变更创建"] --> B["proposal.md 说明 Why / What / Capabilities / Impact"]
B --> C["design.md 记录 D1–D6 等设计决策"]
C --> D["tasks.md 拆分为组件、页面、测试、规格、验收任务"]
D --> E["specs/wanderchain-homepage/spec.md 新增 ADDED Requirements"]
E --> F["openspec sync specs 同步到主规格"]
F --> G["frontend/app/page.tsx 改为渲染 HomeHero 组件"]
G --> H["openspec archive 归档为 2026-10-27-extract-home-hero"]
```

**图示来源**
- [openspec/changes/archive/2026-10-27-extract-home-hero/proposal.md:1-40](file://openspec/changes/archive/2026-10-27-extract-home-hero/proposal.md#L1-L40)
- [openspec/changes/archive/2026-10-27-extract-home-hero/design.md:1-76](file://openspec/changes/archive/2026-10-27-extract-home-hero/design.md#L1-L76)
- [openspec/changes/archive/2026-10-27-extract-home-hero/tasks.md:1-37](file://openspec/changes/archive/2026-10-27-extract-home-hero/tasks.md#L1-L37)
- [openspec/changes/archive/2026-10-27-extract-home-hero/specs/wanderchain-homepage/spec.md:1-36](file://openspec/changes/archive/2026-10-27-extract-home-hero/specs/wanderchain-homepage/spec.md#L1-L36)
- [frontend/app/page.tsx:1-71](file://frontend/app/page.tsx#L1-L71)

**章节来源**
- [openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml:1-3](file://openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-extract-home-hero/proposal.md:1-40](file://openspec/changes/archive/2026-10-27-extract-home-hero/proposal.md#L1-L40)
- [openspec/changes/archive/2026-10-27-extract-home-hero/design.md:1-76](file://openspec/changes/archive/2026-10-27-extract-home-hero/design.md#L1-L76)
- [openspec/changes/archive/2026-10-27-extract-home-hero/tasks.md:1-37](file://openspec/changes/archive/2026-10-27-extract-home-hero/tasks.md#L1-L37)
- [openspec/changes/archive/2026-10-27-extract-home-hero/specs/wanderchain-homepage/spec.md:1-36](file://openspec/changes/archive/2026-10-27-extract-home-hero/specs/wanderchain-homepage/spec.md#L1-L36)
- [frontend/app/page.tsx:1-71](file://frontend/app/page.tsx#L1-L71)

### 归档变更示例：close-frontend-test-gaps
`close-frontend-test-gaps` 是一个以测试补齐与文档对齐为核心的归档变更，外部行为保持不变。其设计约束来自三处：
- 主规格 `openspec/specs/wanderchain-homepage/` 声明界面为英文，单元文档中的中文文案不能反过来约束实现。
- 前端测试跑在 jsdom 上，没有布局引擎与真实图片加载，布局类场景不可在此层验证。
- `08-spec-doc-breakpoints.ps1` 要求文档响应式小节与 CSS 的 `max-width` 集合完全相等。

该变更的关键设计决策包括：
- 排序与截断用 mock 数据源验证，不用真实 Mock 数据自证。
- `SectionBoundary` 用真实 render 期抛错验证，断言只降级该区块、文案为 `<title> could not load. Please try again later.`。
- 无 `document` 场景只验证 `open()` 的安全分支。
- 断点闸门扩充采用「文档跟实现」，U3/U5/U7 的文档改写为 desktop-first 实际断点，并把三对登记进 08 配对表。
- 文档漂移以主规格与代码为准，补双语字段、修正 `alt` 文案、调整覆盖声明。

```mermaid
flowchart TD
A["close-frontend-test-gaps 变更创建"] --> B[".openspec.yaml 设置 skip_specs=true"]
B --> C["design.md 明确 Goals / Non-Goals / Decisions / Risks"]
C --> D["tasks.md 按 P0/P1/P2/文档漂移/验收 拆解"]
D --> E["use-section-data.test.ts 验证 loading/ready/error/deps/unmount"]
D --> F["section-boundary.test.tsx 验证 render 期异常捕获"]
D --> G["repository.sorting.test.ts 注入乱序/并列/超限数据"]
G --> H["harness/checks/08-spec-doc-breakpoints.ps1 配对表扩充"]
H --> I["openspec archive 归档为 2026-10-27-close-frontend-test-gaps"]
```

**图示来源**
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml:1-4](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml#L1-L4)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/design.md:1-63](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/design.md#L1-L63)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/tasks.md:1-46](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/tasks.md#L1-L46)
- [frontend/components/home/use-section-data.test.ts:1-114](file://frontend/components/home/use-section-data.test.ts#L1-L114)
- [frontend/components/home/section-boundary.test.tsx:1-69](file://frontend/components/home/section-boundary.test.tsx#L1-L69)
- [frontend/lib/home/repository.sorting.test.ts:1-169](file://frontend/lib/home/repository.sorting.test.ts#L1-L169)

**章节来源**
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml:1-4](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml#L1-L4)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/design.md:1-63](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/design.md#L1-L63)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/tasks.md:1-46](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/tasks.md#L1-L46)
- [frontend/components/home/use-section-data.test.ts:1-114](file://frontend/components/home/use-section-data.test.ts#L1-L114)
- [frontend/components/home/section-boundary.test.tsx:1-69](file://frontend/components/home/section-boundary.test.tsx#L1-L69)
- [frontend/lib/home/repository.sorting.test.ts:1-169](file://frontend/lib/home/repository.sorting.test.ts#L1-L169)

### 规格存储位置与差异规格
- 主规格位于 `openspec/specs/<capability-path>/spec.md`。
- 差异规格位于变更目录下的 `openspec/changes/<name>/specs/<capability-path>/spec.md`。
- 差异规格使用 `ADDED Requirements`、`MODIFIED Requirements`、`REMOVED Requirements`、`RENAMED Requirements` 等章节描述变更意图。
- 通过 `openspec sync specs` 或归档流程，差异规格会被智能合并到主规格中。
- 如果变更声明 `skip_specs: true`，则不期望存在 delta spec，也不会触发主规格同步逻辑。

`extract-home-hero` 的 delta spec 仅包含 `ADDED Requirements`，新增"首页主视觉" Requirement，并在归档后出现在 `openspec/specs/wanderchain-homepage/spec.md` 末尾；`close-frontend-test-gaps` 则通过 `skip_specs: true` 明确表示本轮不修改主规格，而是补齐测试与文档。`add-wanderchain-auth-frontend` 作为新的活跃变更，正在建立认证前端的规格定义。

```mermaid
flowchart TD
Start(["开始：是否存在 delta spec"]) --> CheckSkip{"是否声明 skip_specs？"}
CheckSkip --> |是| EndSkip["结束：不执行 delta spec 同步"]
CheckSkip --> |否| ReadDelta["读取 delta spec<br/>ADDED / MODIFIED / REMOVED / RENAMED"]
ReadDelta --> CheckMain{"主规格是否存在？"}
CheckMain --> |否| NewMain["仅允许 ADDED<br/>创建新主规格"]
CheckMain --> |是| Merge["智能合并：<br/>新增、修改、删除、重命名"]
NewMain --> Validate["验证主规格格式"]
Merge --> Validate
Validate --> Done(["结束：主规格已更新"])
```

**图示来源**
- [.agents/skills/openspec-sync-specs/SKILL.md:78-177](file://.agents/skills/openspec-sync-specs/SKILL.md#L78-L177)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml:1-4](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml#L1-L4)

**章节来源**
- [.agents/skills/openspec-sync-specs/SKILL.md:78-177](file://.agents/skills/openspec-sync-specs/SKILL.md#L78-L177)

### 变更提案：创建、审阅与归档
变更提案的生命周期包括：
1. **创建变更**：使用 `openspec new change "<name>"`，CLI 会生成 `.openspec.yaml` 与工件骨架。
2. **查看状态**：使用 `openspec status --change "<name>" --json` 查看工件依赖图、`applyRequires`、`planningHome`、`changeRoot`、`artifactPaths` 等。
3. **获取工件指令**：使用 `openspec instructions <artifact-id> --change "<name>" --json` 获取模板、规则、输出路径与依赖。
4. **编写工件**：按 schema 要求编写 `proposal.md`、`design.md`、`tasks.md`、`specs/<capability-path>/spec.md`；若不需要 delta spec，可在 `.openspec.yaml` 中设置 `skip_specs: true`。
5. **同步规格**：使用 `openspec sync specs --change "<name>"` 将 delta spec 合并到主规格；若 `skip_specs: true`，则跳过该步骤。
6. **实现任务**：通过 skill 驱动的 apply 流程逐步完成 tasks。
7. **归档变更**：使用 `openspec archive --change "<name>"`，归档目录名遵循 `YYYY-MM-DD-<change-name>` 规则。

`extract-home-hero` 与 `close-frontend-test-gaps` 的 `tasks.md` 都展示了完整的任务拆解与验收步骤，前者侧重组件抽取与 delta spec 同步，后者侧重测试补齐、文档对齐与闸门验证。`add-wanderchain-auth-frontend` 作为新的活跃变更，正在建立认证前端的完整工件结构。

```mermaid
flowchart TD
A["openspec new change <name>"] --> B["openspec status --change <name>"]
B --> C["openspec instructions <artifact-id> --change <name>"]
C --> D["编写 proposal / design / tasks"]
D --> E{"是否需要 delta spec？"}
E --> |是| F["编写 specs/<capability>/spec.md"]
E --> |否| G["在 .openspec.yaml 设置 skip_specs=true"]
F --> H["openspec sync specs --change <name>"]
G --> I["跳过 sync specs"]
H --> J["实现 tasks"]
I --> J
J --> K["openspec archive --change <name>"]
```

**图示来源**
- [.agents/skills/openspec-propose/SKILL.md:77-137](file://.agents/skills/openspec-propose/SKILL.md#L77-L137)
- [.agents/skills/openspec-sync-specs/SKILL.md:47-177](file://.agents/skills/openspec-sync-specs/SKILL.md#L47-L177)
- [.agents/skills/openspec-archive-change/SKILL.md:169-184](file://.agents/skills/openspec-archive-change/SKILL.md#L169-L184)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml:1-4](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml#L1-L4)

**章节来源**
- [.agents/skills/openspec-propose/SKILL.md:77-137](file://.agents/skills/openspec-propose/SKILL.md#L77-L137)
- [.agents/skills/openspec-apply-change/SKILL.md:41-129](file://.agents/skills/openspec-apply-change/SKILL.md#L41-L129)
- [.agents/skills/openspec-archive-change/SKILL.md:169-184](file://.agents/skills/openspec-archive-change/SKILL.md#L169-L184)

### 规格同步：delta spec 到 main spec
`openspec sync specs` 的核心逻辑是：
- 从 `openspec status --change "<name>" --json` 的 `artifactPaths.specs.existingOutputPaths` 中读取 delta spec。
- 根据 delta spec 的章节内容，智能合并到 `openspec/specs/<capability-path>/spec.md`。
- 如果主规格不存在，则只允许应用 ADDED requirements，并创建新的主规格。
- 如果 delta 只包含 REMOVED requirements，且变更未声明 `retire_capabilities: true`，则归档时会报错；若已声明，则可视为已退休。
- 同步后需验证主规格格式，确保没有残留 delta 专用章节头。
- 如果变更声明 `skip_specs: true`，则不应存在 delta spec，同步流程应被跳过。

`extract-home-hero` 的 delta spec 仅新增"首页主视觉"，因此同步后主规格末尾追加了该 Requirement 与对应 Scenario；`close-frontend-test-gaps` 因 `skip_specs: true`，本轮不修改主规格，而是通过单元测试与文档闸门保证实现质量。`add-wanderchain-auth-frontend` 作为新的活跃变更，正在建立认证前端的规格定义。

```mermaid
flowchart TD
S["选择变更"] --> T["读取 artifactPaths.specs.existingOutputPaths"]
T --> U{"是否存在 delta spec？"}
U --> |否| EndNo["结束：无 delta spec 可同步"]
U --> |是| V["读取 delta spec 与主规格"]
V --> W{"主规格是否存在？"}
W --> |否| X["仅允许 ADDED<br/>创建新主规格"]
W --> |是| Y["智能合并：新增/修改/删除/重命名"]
X --> Z["验证主规格"]
Y --> Z
Z --> Result["输出同步摘要"]
```

**图示来源**
- [.agents/skills/openspec-sync-specs/SKILL.md:47-177](file://.agents/skills/openspec-sync-specs/SKILL.md#L47-L177)

**章节来源**
- [.agents/skills/openspec-sync-specs/SKILL.md:47-177](file://.agents/skills/openspec-sync-specs/SKILL.md#L47-L177)

### 实现流程：apply 与任务跟踪
apply 流程由 skill 驱动，核心步骤包括：
- 选择变更。
- 通过 `openspec status --change "<name>" --json` 了解 schema、规划根、工件路径。
- 通过 `openspec instructions apply --change "<name>" --json` 获取 contextFiles、任务列表、动态指令。
- 按任务顺序实现代码，并在 tasks 中标记 `- [ ]` 为 `- [x]`。
- 遇到阻塞、歧义或超出规格范围的需求时暂停，建议更新工件。

`extract-home-hero` 的 tasks 明确区分了"组件与样式落位""页面接线与清理""测试""规格与文档同步""验收"五个阶段；`close-frontend-test-gaps` 的 tasks 则按 P0 系统性盲区、P1 测试遗漏、P2 断言强度、文档漂移与断点闸门、验收五类展开，其中测试阶段特别强调用注入数据集验证排序与截断、用 React 错误边界验证 SectionBoundary、用 `URLSearchParams` 解析 URL 参数，并通过 `harness/run-all.ps1` 完成全量闸门验收。`add-wanderchain-auth-frontend` 作为新的活跃变更，正在建立认证前端的完整实现流程。

```mermaid
sequenceDiagram
participant Dev as "开发者"
participant Skill as "apply skill"
participant CLI as "OpenSpec CLI"
Dev->>Skill : "openspec apply"
Skill->>CLI : "openspec status --change <name> --json"
Skill->>CLI : "openspec instructions apply --change <name> --json"
CLI-->>Skill : "contextFiles / tasks / instruction"
Skill->>Dev : "显示进度与剩余任务"
loop 直到完成或阻塞
Skill->>Dev : "实现某个 task"
Dev->>Skill : "标记 task 完成"
Skill->>CLI : "重新获取 apply instructions"
end
Skill-->>Dev : "实现完成或暂停原因"
```

**图示来源**
- [.agents/skills/openspec-apply-change/SKILL.md:41-129](file://.agents/skills/openspec-apply-change/SKILL.md#L41-L129)

**章节来源**
- [.agents/skills/openspec-apply-change/SKILL.md:41-129](file://.agents/skills/openspec-apply-change/SKILL.md#L41-L129)

### 归档流程：archive 与规格一致性检查
归档流程不仅移动变更目录，还会评估 delta spec 是否已同步到主规格：
- 检查工件完成状态。
- 检查任务完成状态。
- 评估 delta spec 与主规格的同步状态。
- 可选择先同步再归档，或直接归档。
- 归档目标目录为 `openspec/changes/archive/YYYY-MM-DD-<change-name>`。

`extract-home-hero` 归档后的目录名为 `2026-10-27-extract-home-hero`，符合日期前缀命名规范；`close-frontend-test-gaps` 归档后的目录名为 `2026-10-27-close-frontend-test-gaps`，同样符合命名规范，且因 `skip_specs: true`，归档时不依赖 delta spec 同步结果。`add-wanderchain-auth-frontend` 作为新的活跃变更，尚未进入归档阶段。

```mermaid
flowchart TD
A["选择变更"] --> B["openspec status --change <name> --json"]
B --> C["检查工件状态"]
C --> D["openspec list --json 检查任务状态"]
D --> E{"delta spec 是否需要同步？"}
E --> |是| F["执行 openspec sync specs"]
E --> |否| G["跳过同步"]
F --> H["验证主规格"]
G --> I["移动到 changes/archive/YYYY-MM-DD-<name>"]
H --> I
I --> J["输出归档摘要"]
```

**图示来源**
- [.agents/skills/openspec-archive-change/SKILL.md:73-184](file://.agents/skills/openspec-archive-change/SKILL.md#L73-L184)

**章节来源**
- [.agents/skills/openspec-archive-change/SKILL.md:73-184](file://.agents/skills/openspec-archive-change/SKILL.md#L73-L184)

## 依赖关系分析
OpenSpec 在本仓库中的依赖关系可以概括为：
- `openspec/config.yaml` 决定工作流 schema 与上下文约束。
- `.openspec.yaml` 描述单个变更的元数据，包括是否跳过 delta spec。
- `proposal.md`、`design.md`、`tasks.md`、`specs/<capability>/spec.md` 构成变更工件集合。
- `openspec/specs/<capability>/spec.md` 是主规格，由 delta spec 同步而来。
- Agent Skill 文档定义了 CLI 命令的标准调用顺序与错误处理策略。

`extract-home-hero` 体现了"规格先行、实现跟进、归档固化"的依赖链：delta spec 定义"首页主视觉"契约，`tasks.md` 驱动前端组件与样式迁移，`frontend/app/page.tsx` 消费 `HomeHero` 组件，最终归档变更并保留主规格作为真相层。`close-frontend-test-gaps` 则体现了"测试与文档对齐优先"的依赖链：`design.md` 明确不引入真实浏览器测试基建、不为布局伪断言，`tasks.md` 驱动 `use-section-data.test.ts`、`section-boundary.test.tsx`、`repository.sorting.test.ts` 等测试落地，并通过 `harness/checks/08-spec-doc-breakpoints.ps1` 锁定文档与 CSS 断点的一致性。`add-wanderchain-auth-frontend` 作为新的活跃变更，正在建立认证前后端分离的依赖关系，与后端的 `add-wanderchain-auth` 变更形成完整的功能闭环。

```mermaid
graph LR
Config["openspec/config.yaml"] --> Schema["schema: spec-driven"]
Meta[".openspec.yaml"] --> ChangeDir["变更目录"]
ChangeDir --> Proposal["proposal.md"]
ChangeDir --> Design["design.md"]
ChangeDir --> Tasks["tasks.md"]
ChangeDir --> Delta["specs/<capability>/spec.md"]
Delta --> MainSpec["openspec/specs/<capability>/spec.md"]
Skills["Agent Skill 文档"] --> CLI["OpenSpec CLI 命令"]
CLI --> ChangeDir
CLI --> MainSpec
ExtractHero["extract-home-hero 归档变更"] --> FrontendPage["frontend/app/page.tsx"]
FrontendPage --> HeroComponent["components/home/hero.tsx"]
TestGaps["close-frontend-test-gaps 归档变更"] --> UseSectionData["use-section-data.test.ts"]
TestGaps --> SectionBoundary["section-boundary.test.tsx"]
TestGaps --> SortingTest["repository.sorting.test.ts"]
AuthFrontend["add-wanderchain-auth-frontend 活跃变更"] --> AuthBackend["add-wanderchain-auth 后端变更"]
AuthFrontend --> FrontendSpec["frontend-nextjs 主规格"]
```

**图示来源**
- [openspec/config.yaml:1-29](file://openspec/config.yaml#L1-L29)
- [openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml#L1-L3)
- [openspec/changes/add-wanderchain-auth/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-extract-home-hero/tasks.md:1-37](file://openspec/changes/archive/2026-10-27-extract-home-hero/tasks.md#L1-L37)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/tasks.md:1-46](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/tasks.md#L1-L46)
- [frontend/components/home/use-section-data.test.ts:1-114](file://frontend/components/home/use-section-data.test.ts#L1-L114)
- [frontend/components/home/section-boundary.test.tsx:1-69](file://frontend/components/home/section-boundary.test.tsx#L1-L69)
- [frontend/lib/home/repository.sorting.test.ts:1-169](file://frontend/lib/home/repository.sorting.test.ts#L1-L169)
- [.agents/skills/openspec-propose/SKILL.md:17-24](file://.agents/skills/openspec-propose/SKILL.md#L17-L24)
- [.agents/skills/openspec-sync-specs/SKILL.md:86-177](file://.agents/skills/openspec-sync-specs/SKILL.md#L86-L177)

**章节来源**
- [openspec/config.yaml:1-29](file://openspec/config.yaml#L1-L29)
- [openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml#L1-L3)
- [openspec/changes/add-wanderchain-auth/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-extract-home-hero/tasks.md:1-37](file://openspec/changes/archive/2026-10-27-extract-home-hero/tasks.md#L1-L37)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/tasks.md:1-46](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/tasks.md#L1-L46)
- [frontend/components/home/use-section-data.test.ts:1-114](file://frontend/components/home/use-section-data.test.ts#L1-L114)
- [frontend/components/home/section-boundary.test.tsx:1-69](file://frontend/components/home/section-boundary.test.tsx#L1-L69)
- [frontend/lib/home/repository.sorting.test.ts:1-169](file://frontend/lib/home/repository.sorting.test.ts#L1-L169)
- [.agents/skills/openspec-propose/SKILL.md:17-24](file://.agents/skills/openspec-propose/SKILL.md#L17-L24)
- [.agents/skills/openspec-sync-specs/SKILL.md:86-177](file://.agents/skills/openspec-sync-specs/SKILL.md#L86-L177)

## 性能与可维护性建议
- **保持工件最小化**：只在必要时创建工件，避免重复描述同一需求。
- **优先使用 delta spec**：通过 delta spec 表达增量变更，减少主规格的大段重写；若确实不需要 delta spec，应在 `.openspec.yaml` 中显式设置 `skip_specs: true`。
- **及时同步主规格**：在归档前执行 `openspec sync specs`，确保主规格反映最新契约。
- **明确变更边界**：在 `proposal.md` 中清晰说明范围、不在范围项与假设。
- **任务可追踪**：在 `tasks.md` 中将大任务拆分为可独立完成的子任务，便于 apply 流程跟踪进度。
- **归档命名规范**：归档目录建议使用 `YYYY-MM-DD-<change-name>`，避免日期重复或命名冲突。
- **结构重构需证明视觉零变化**：参考 `extract-home-hero` 的 DOM 结构比对思路，在不改变用户可见行为的前提下降低回归风险。
- **测试补齐应避免代理断言**：参考 `close-frontend-test-gaps` 的 `repository.sorting.test.ts`，用注入数据集直接验证排序键、并列分支与字面上限，而不是依赖真实 Mock 数据的巧合顺序。
- **文档与实现保持一致**：参考 `close-frontend-test-gaps` 对 U3/U5/U7 响应式小节的改写，让单元文档描述实际 CSS 断点，并通过 `08-spec-doc-breakpoints.ps1` 强制配对。
- **前后端分离变更**：参考 `add-wanderchain-auth-frontend` 与 `add-wanderchain-auth` 的模式，将前后端功能拆分为独立的变更，便于并行开发与独立部署。

[本节为通用建议，不直接分析具体文件]

## 故障排查指南
常见问题与处理方式：
- **找不到 OpenSpec 根目录**：运行 `openspec list --json`，如果返回 `"root": null`，说明当前目录不是 OpenSpec 项目根。可通过 `openspec init` 初始化，或通过 `--store <id>` 指向已注册的 store。
- **store 声明无法解析**：如果错误消息以 `Declared in` 或 `Invalid store declaration in` 开头，说明项目通过 store 声明了 OpenSpec，但当前机器未注册该 store。应先注册 store 或修正 `store:` 配置。
- **工件缺失导致阻塞**：使用 `openspec status --change "<name>" --json` 查看 `applyRequires` 与 `artifacts.requires`，然后按依赖顺序创建缺失工件。
- **delta spec 无法同步**：如果主规格不存在，只有 ADDED requirements 可被应用；如果 delta 只包含 REMOVED requirements，需要确认变更是否声明 `retire_capabilities: true`；如果变更声明 `skip_specs: true`，则不应尝试同步 delta spec。
- **归档时报错**：检查工件是否全部完成、任务是否全部勾选、delta spec 是否已同步到主规格。
- **归档后仍看到活跃变更**：确认变更目录是否已从 `openspec/changes/<name>` 移动到 `openspec/changes/archive/YYYY-MM-DD-<name>`；`extract-home-hero` 已归档至 `2026-10-27-extract-home-hero`，`close-frontend-test-gaps` 已归档至 `2026-10-27-close-frontend-test-gaps`，而 `add-wanderchain-auth-frontend` 仍为活跃变更。

**章节来源**
- [.agents/skills/openspec-explore/SKILL.md:19-30](file://.agents/skills/openspec-explore/SKILL.md#L19-L30)
- [.agents/skills/openspec-apply-change/SKILL.md:15-26](file://.agents/skills/openspec-apply-change/SKILL.md#L15-L26)
- [.agents/skills/openspec-archive-change/SKILL.md:15-26](file://.agents/skills/openspec-archive-change/SKILL.md#L15-L26)
- [.agents/skills/openspec-sync-specs/SKILL.md:108-171](file://.agents/skills/openspec-sync-specs/SKILL.md#L108-L171)

## 结论
OpenSpec 在本仓库中以 `spec-driven` 工作流为核心，通过 `openspec/config.yaml` 与 `.openspec.yaml` 管理项目与变更配置，通过 `openspec/changes` 与 `openspec/specs` 管理变更工件与主规格，并通过 Agent Skill 文档标准化 CLI 调用流程。`extract-home-hero` 展示了从提案、设计、任务拆解、delta spec 同步到归档的完整闭环，同时体现了"规格先行、实现跟进、归档固化"的最佳实践；`close-frontend-test-gaps` 则展示了另一种常见场景：外部行为不变，但通过 mock 数据源、SectionBoundary 错误边界验证与 desktop-first 断点策略补齐测试与文档缺口，并以 `skip_specs: true` 明确本轮不修改主规格；`add-wanderchain-auth-frontend` 作为新的活跃变更，展示了现代前后端分离架构下认证功能的规范化开发流程，与后端的 `add-wanderchain-auth` 变更形成完整的功能闭环。推荐开发者按照"创建变更 → 编写工件 → 同步规格（如需要）→ 实现任务 → 归档变更"的顺序开展工作，以保持规格与实现的持续一致。

[本节为总结性内容，不直接分析具体文件]

## 附录：常用命令与配置模板

### 常用 CLI 命令
- 初始化项目：`openspec init`
- 创建变更：`openspec new change "<name>"`
- 查看变更状态：`openspec status --change "<name>" --json`
- 获取工件指令：`openspec instructions <artifact-id> --change "<name>" --json`
- 列出变更与规格：`openspec list --json`、`openspec list --specs --json`
- 查看规格详情：`openspec show "<spec-id>" --type spec --json --no-scenarios`
- 同步规格：`openspec sync specs --change "<name>"`
- 归档变更：`openspec archive --change "<name>"`
- 验证规格：`openspec validate --specs`

**章节来源**
- [.agents/skills/openspec-explore/SKILL.md:125-141](file://.agents/skills/openspec-explore/SKILL.md#L125-L141)
- [.agents/skills/openspec-propose/SKILL.md:77-137](file://.agents/skills/openspec-propose/SKILL.md#L77-L137)
- [.agents/skills/openspec-sync-specs/SKILL.md:178-181](file://.agents/skills/openspec-sync-specs/SKILL.md#L178-L181)

### 配置文件模板参考
- 项目配置：`openspec/config.yaml`
  - 关键字段：`schema`、`context`、可选 `rules`、可选 `operations`
- 变更元数据：`.openspec.yaml`
  - 关键字段：`schema`、`created`
  - 可选字段：`skip_specs`、`retire_capabilities`
- 活跃变更示例：
  - `openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml`：体现新的认证前端活跃变更元数据形态。
  - `openspec/changes/add-wanderchain-auth/.openspec.yaml`：体现后端认证功能活跃变更元数据形态。
- 归档变更示例：
  - `openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml`：体现带 delta spec 的归档变更元数据形态。
  - `openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml`：体现 `skip_specs: true` 的归档变更元数据形态，可用于对比不同变更类型在 `.openspec.yaml` 上的差异。

**章节来源**
- [openspec/config.yaml:1-29](file://openspec/config.yaml#L1-L29)
- [openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth-frontend/.openspec.yaml#L1-L3)
- [openspec/changes/add-wanderchain-auth/.openspec.yaml:1-3](file://openspec/changes/add-wanderchain-auth/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml:1-3](file://openspec/changes/archive/2026-10-27-extract-home-hero/.openspec.yaml#L1-L3)
- [openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml:1-4](file://openspec/changes/archive/2026-10-27-close-frontend-test-gaps/.openspec.yaml#L1-L4)