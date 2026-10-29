# Design

## Context

动机见 proposal.md - Why；验收标准见 specs delta。当前 `10-contract-check.ps1` 用两个扁平 `[ordered]` 字典（`$backendTypes`、`$frontendTypes`）承载字段，键只有字段名、不含接口归属；record/interface 名解析出来只喂给计数器。PowerShell 哈希表默认大小写不敏感，`.Contains()` 与键赋值都把 `email`/`Email` 当同一个键。这两点是 H1/H2/M1 假绿灯的结构性根因，M2 是单纯漏写前端循环。受管清单当前只有 auth 一对，且已取证两侧接口名逐一同名、无同名字段跨接口类型冲突——收紧后现有契约仍绿，重构无返工风险。

## Goals / Non-Goals

**Goals:**
- 让闸门真正执行 spec 已要求的接口名集合相等、按接口比字段、两侧 camelCase、大小写敏感。
- 负向验证可复现：四类假绿灯样本各自判红，且证明旧闸门对同样样本放行（M2 采用大写开头样本）；蛇形样本保留旧版已判红的真实基线。
- 保留既有全部有效防线（fail-closed 映射、空集合判红、@JsonProperty、令牌禁现、清单为空判红）。

**Non-Goals:**
- 不放宽 contract-consistency 的既有约束；delta 仅补场景并显式澄清大小写敏感及诊断归属，不在实施阶段改动主 spec。
- 不扩展到 auth 以外的新受管对（清单机制不变，仍只追加条目即可纳管）。
- 不碰子模块代码；认证线 M4/M5/L1 不在本变更。
- 不引入代码生成或运行时反射——维持纯文本静态解析（生成会把「两侧一致」偷换成「两侧同源」，手改生成物无人发现，违背 spec 选型理由）。

## Decisions

**决策 1：扁平字典 → 按接口名嵌套。**
两侧都改为「接口名 → 有序字段字典（字段名 → 类型）」的两层结构：后端 `$backendInterfaces[recordName][fieldName]=type`，前端 `$frontendInterfaces[interfaceName][fieldName]=type`。比对分两步：先双向比接口名集合（H1），再对每个共有接口名双向比其字段名集合与字段类型（H2）。
- 备选：保留扁平字典但键改成 `接口名.字段名` 复合键。否决——复合键能救 H2 的覆盖问题，但接口名集合比对（H1）仍要单独提取前缀，不如直接嵌套清晰；且错误信息要还原接口归属更绕。

**决策 2：存在性比对一律大小写敏感（M1）。**
接口名与字段名的「对方有没有」判定，不用哈希表 `.Contains()`（大小写不敏感），改用显式序数比较：把两侧名字取到数组后用 `-ccontains`，或用 `[System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)`。字段字典本身也须用大小写敏感的构造，避免 `userId`/`userid` 在赋值阶段就被并成一个键。
- 备选：只靠 camelCase 正则拦大小写。否决——`userId` 与 `userid` 都可能是合法 camelCase，正则拦不住「两侧都对但彼此不等」的漂移，必须靠大小写敏感的名字集合比对。

**决策 3：前端补 camelCase 循环（M2）。**
把现有只遍历后端字段的 camelCase 校验，对前端每个接口的字段名同样执行 `^[a-z][A-Za-z0-9]*$`（`-cnotmatch` 大小写敏感）。两侧共用同一判据与同一报错格式。

**决策 4：负向验证用「临时副本变异 + 断言 EXIT=1」，样本随变更留档。**
在 `$env:TEMP` 下复制一份受管文件，对副本注入四类变异（改名接口 / 制造跨接口同名字段类型冲突 / 字段名大小写漂移 / 前端字段大写开头及蛇形），用 `-ContractRoot` 指向副本跑闸门，断言每类都 EXIT=1；再对未变异副本断言 EXIT=0 作对照。验证脚本与样本放在本变更目录下备审计，跑完即清理副本，不污染工作树。为让闸门可指向副本，重构时把受管清单的根路径参数化（默认仓库根，可被验证脚本覆盖），这是唯一为可测性做的接口调整。
- 备选：只在 CI 里手工验证不留档。否决——假绿灯的本质是「没人能证明它拦得住」，负向样本不留档就等于下次重构又可能悄悄退化。

## Risks / Trade-offs

- [收紧后误伤现有契约] → 已取证接口名同名、无同名类型冲突；apply 阶段第一步先对真实仓库跑一次确认 EXIT=0，再动变异验证。
- [嵌套重构引入解析回归，把原本能解析的 record/interface 漏解析成空] → 保留「任一侧空集合判红」防线；负向验证含一条「未变异副本 EXIT=0」对照，解析退化会立刻暴露。
- [参数化根路径被滥用为绕过闸门] → 参数仅供验证脚本指向临时副本，默认值锁死仓库根；run-all 调用时不传该参数，行为与现状一致。
- [PowerShell 大小写敏感写法在 5.1 与 7 行为差异] → 统一用 .NET `StringComparer.Ordinal` / `-ccontains`，不依赖文化设置；闸门脚本仍存为 UTF-8 with BOM。

## Migration Plan

纯闸门脚本重构，无数据迁移、无部署。落地顺序：重构脚本 → 对真实仓库跑 `10-contract-check` 确认仍 EXIT=0 → 跑四类变异验证确认各自 EXIT=1 → 跑 `run-all.ps1` 全 11 道确认 EXIT=0。回滚 = 还原单文件。

## 验证样本与复现入口

脚本：本目录 `verify-contract-check.ps1`。每例从真实受管契约重新复制，先验证变异锚点存在；当前闸门指向副本执行。脚本同时断言退出码与具体错误诊断，防止运行异常冒充业务判红；finally 清理本轮 GUID 临时目录。旧闸门从固定提交 `20a54f40ae6319565013d44a06fbfdc41ccab530` 读取，复制到副本的 `harness/checks/` 下直接执行，不修改旧版逻辑。

| 样本 / 根因 | 旧版退出码 | 修复后预期 | 诊断要求 |
|---|---|---|---|
| H1：RegisterResponse 改名或整份删除；旧版只计数不比名字 | 0 | 1 | 缺失接口及名字 |
| H2：LoginResponse.email 改为 int，旧版被后续 record 的同名字段覆盖 | 0 | 1 | LoginResponse.email 类型不一致 |
| H2：只删除 RegisterResponse.email，旧版在其它接口仍能找到 email | 0 | 1 | RegisterResponse.email 缺失 |
| M1：publicId/publicid、expiresAt/expiresat；接口首字母大小写 | 0 | 1 | 双向缺失及原始大小写 |
| M1：同接口 userId/userid、同文件 CaseShape/caseshape | 0 | 1 | 首个接口/字段的类型冲突不得被并键吞掉 |
| M2：RegisterResponse.Email 大写开头，旧版无前端命名检查 | 0 | 1 | 前端字段不是 camelCase |
| M2：display_name、_email | 1 | 1 | 新增前端 camelCase 专项诊断；不伪称旧版放行 |
| 保留防线：后端非法命名、时间类型错配、两侧未知类型、JsonProperty、两侧空集合、空清单、四种令牌字段及 Token 大小写变体 | 1 | 1 | 对应防线及接口/字段定位 |
| 正常原始契约、不同接口同名但各自匹配的不同类型、数组/时间/UUID/别名/null 归一化 | 0 | 0 | 通过 |

从工作区根运行（只需 PowerShell 5.1 与 Git，不启动服务）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File openspec\changes\harden-contract-check-gate\verify-contract-check.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File openspec\changes\harden-contract-check-gate\verify-contract-check.ps1 -CompareBaseline -Repeat 3
powershell -NoProfile -ExecutionPolicy Bypass -File openspec\changes\harden-contract-check-gate\verify-contract-check.ps1 -ReproduceOnly -Repeat 3
```

默认模式只验当前实现，`-CompareBaseline` 同验旧版和当前，`-ReproduceOnly` 仅核对旧版历史行为；历史模式返回 0 不代表旧闸门正确。28 个样本包含 25 个负例与 3 个正例。归档后将命令中的 change 路径替换为实际归档目录即可，脚本通过 Git 定位工作区根，不依赖 change 层级。受工作区写权限约束时可将 `$env:TEMP` 指向已忽略的 `backend/target`，文件结构和清理机制不变。

实现细节：两层 OrderedDictionary 均使用 `StringComparer.Ordinal`；令牌禁现仍保持原有的不区分大小写判据。根路径默认值在脚本正文内推导，避免 PowerShell 5.1 在参数默认表达式求值时 `$PSScriptRoot` 为空。两份 PowerShell 脚本使用 UTF-8 BOM，数据读取明确使用 UTF-8。

边界：本次不扩展正则解析器的语法覆盖或类型归一规则，不新增错误码、端点常量比对；不验证浏览器交互。变异回归独立运行并随 change 留档，未新增 Harness 编号闸门。
