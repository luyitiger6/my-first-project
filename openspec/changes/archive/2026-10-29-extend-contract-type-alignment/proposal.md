# Proposal

## Why

现有 `harness/checks/10-contract-check.ps1` 只做**字段名**双向比对，不比字段类型。后端把 `String` 改成 `int`、`Instant` 改成 epoch 毫秒 `long`、枚举改成对象、必填改成可空——只要字段名不变，闸门就静默放行，而前端契约声明的类型与真实响应已经不符，问题要到运行期才炸（`NaN`、`Invalid Date`、渲染出 `[object Object]`）。此外闸门的扫描路径写死在 auth 的 dto 目录，未来任何新模块都无法复用这套保护。人肉对照类型同样不可靠，需要让闸门同时盯住**名字与类型**，并把扫描范围做成可配置，才能覆盖「整个项目」而非只有 auth。

## What Changes

- 扩展 `10-contract-check.ps1`：在既有字段名双向比对之上，增加「Java 类型 → TS 类型」映射校验，共有接口的每个字段两侧类型必须落在同一映射上（`String→string`、`Instant→string`、`int/long/double→number`、`boolean→boolean`、`List<T>/T[]→T[]`、后端枚举→前端字面量联合）。
- **fail-closed**：遇到映射表未覆盖的 Java 类型（自定义嵌套 record、`Map`、泛型通配、原始类型缺字段等）直接判失败并指出文件与字段位置，绝不静默放过——延续现有「解析不出形状即失败」的防伪设计。
- **扫描范围可配置**：把「后端 dto 目录/文件 ↔ 前端契约文件」的配对抽成闸门顶部的一张清单（当前只有 auth 一对），未来新增模块只加一行、不改比对逻辑；清单为空或任一侧解析不出形状即失败。
- 契约文件固化类型约定：`frontend/lib/contracts/auth.ts` 已用 `string` 表 `Instant`、用小写字面量联合表枚举，把这些约定写进文件注释并纳入映射表，使「时间字段是 ISO-8601 字符串而非毫秒数值」这条既有约定获得闸门级强制。
- 文档同步：`AGENTS.md` §6/§9 与根 `README.md` 对 10 号闸门的描述，从「字段名双向比对」更新为「字段名 + 类型双向比对、扫描范围可配置」。
- 非破坏：不改任何后端 DTO 结构、不改前端运行时行为，纯护栏增强；因此**不标 BREAKING**。

## Capabilities

### New Capabilities
- `contract-consistency`: 前后端出站契约的**字段名与字段类型**一致性，由 fail-closed 的静态 Harness 闸门强制；扫描范围以可配置清单表达，覆盖当前 auth 契约面并为未来模块预留入口。这是一个跨 backend DTO 与 frontend 契约的工作区级护栏行为，独立于 `frontend-nextjs`（后者描述前端构建、同源代理与首页内容）。

### Modified Capabilities
<!-- 不直接修改已归档主 spec 的需求。与在飞 change 的关系见 Impact。 -->

## Impact

- **核心代码**：`harness/checks/10-contract-check.ps1`（比对逻辑增强 + 映射表 + 可配置扫描清单）。
- **契约与文档**：`frontend/lib/contracts/auth.ts`（注释固化类型约定）、`AGENTS.md`、`README.md`；闸门自身输出文案。
- **与在飞 change 的协调（重要假设）**：`contract-consistency` 泛化了 `add-wanderchain-auth-frontend` 写在 `frontend-nextjs` 下、目前**尚未归档**的「认证契约与后端字段一致并纳入闸门」需求。归档顺序上本 change 应在 `add-wanderchain-auth-frontend` 之后归档；届时 `frontend-nextjs` 中那条 auth 专属的契约闸门需求应收窄为「auth 契约面是 `contract-consistency` 机制的第一个受管对象」，避免两处重复描述同一闸门。此协调在 design.md 记录，不在本 change 内改动在飞工件。
- **不影响**：后端 Java 源码、前端运行时行为、其余十道闸门；`07-doc-consistency` 仍只比对闸门清单标记与文件名，本 change 不增删闸门文件，故标记不变。
- **依赖**：`add-wanderchain-auth-frontend` 已落地的契约文件与 10 号闸门（已提交）。
