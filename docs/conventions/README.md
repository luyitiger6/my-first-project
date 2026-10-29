# 开发约定

本目录是仓库内开发约定的**唯一入口**。新增业务模块前，先读这里，再按 `AGENTS.md` 的工作流立项。

## 为什么有这一层

这些规则此前散落在 `AGENTS.md`、`docs/db-design-spec.md` 与 `openspec/specs/*/spec.md`。把它们各复制一份进本目录，会让同一条规则出现两处表述——而本仓库已经有过实证：`docs/db-design-spec.md` 至今仍写 `06-flyway.ps1`，实际闸门早已是 `06-schema-check.ps1`，这个矛盾不产生任何红灯，因为它不在任何闸门的待检清单里。

所以本目录只做两件事：**给出入口**，**把能机械校验的那部分变成闸门**。规则正文留在原处。

## 索引

| 主题 | 位置 | 说明 |
|---|---|---|
| 后端分层、DTO、异常、错误码 | `backend-conventions.md` | 包结构与依赖方向、Controller 拆分、响应与异常收口、错误码命名空间、分页 |
| 前端目录、组件、状态、API 封装 | `frontend-conventions.md` | 组件三件套、状态归属三层、契约与端点两层封装 |
| 样式与视觉 | `styling-conventions.md` | CSS Modules、容器留白、desktop-first 响应式、视觉底线 |
| 数据库命名、主键、公共字段 | `docs/db-design-spec.md` | **不重述**，直接读 §2–§4 |
| 各能力的可验收行为 | `openspec/specs/` | 错误码固定集合、响应字段白名单等以 spec 为准 |

## 新增业务模块必读清单

1. **先立项**：`openspec/changes/<change-id>/` 有 proposal 与 tasks（`AGENTS.md` 第 1 条硬规则）。
2. **定数据**：读 `docs/db-design-spec.md` §2–§4，定表名、列名、索引前缀与公共字段。
3. **定落点**：读 `backend-conventions.md` 确定包位置与依赖方向；读 `frontend-conventions.md` 与 `styling-conventions.md` 确定组件与样式位置。
4. **登记新表**：`harness/checks/06-schema-check.ps1` 只做正向断言，未登记的表会在无人守卫下存在。
5. **登记契约**：新增前后端契约时先改后端 DTO，再到 `frontend/lib/contracts/` 镜像，最后把这一对加进 `harness/checks/10-contract-check.ps1` 的受管清单。
6. **收尾**：跑 `harness\run-all.ps1`，只看退出码。

## 维护规则

- **闸门先于文档**：新增一条约定时，先写能拦住它的断言，再写文档。反过来等于自己给自己发合格证。
- **不重述既有真源**：本目录的文档只允许给出指针。发现自己写了规则正文时，先问「这条规则在别处是否已有权威表述」。
- **区分现状与计划**：依赖与工具必须写进「依赖现状」或「拟引入」其中之一，不得混在正文里含糊表述。写包名不写产品显示名（`react` 而不是 `React`）。
- **不引用 `changes/` 路径**：在飞的变更目录归档后会改名，引用它会制造一条注定失效的指针。

## 真源声明

- `AGENTS.md` — 三层分工、六条硬规则、目录地图、闸门约定
- `docs/db-design-spec.md` — 数据库命名、主键策略、公共字段与数据类型（§2–§4）
- `openspec/specs/` — 各能力的可验收行为

## 依赖现状

- `next` — 前端框架与路由
- `react` — 前端运行时
- `react-dom` — 前端渲染
- `spring-boot-starter-web` — 后端 HTTP 层
- `spring-boot-starter-data-jpa` — 后端持久化
- `spring-boot-starter-data-redis` — 后端缓存与限流

## 拟引入

暂无仓库级拟引入项。各文档的拟引入项以该文档自身的「拟引入」小节为准。

## 机械守卫

- `11-conventions-check.ps1` — 本目录的索引一致性与四个固定小节、依赖描述与两侧清单一致、后端分层依赖方向
- `07-doc-consistency.ps1` — `AGENTS.md` 的闸门清单标记与实际闸门文件双向一致
- `03-static-guard.ps1` — 禁止 `TODO` / `System.out` / `@Disabled` / `it.skip`
