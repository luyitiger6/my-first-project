# Proposal

## Why

`10-contract-check.ps1` 是「前后端命名规范」唯一的机械执法点，但它的实现落后于自己写下的 spec：`contract-consistency/spec.md` L10 明写「接口名集合 MUST 相等」、L62 明写「两侧字段名 MUST 一律 camelCase」，闸门却都不执行。CodeReview 已用沙箱变异实证四类假绿灯——把接口改名、删整份 interface、跨接口制造同名字段类型冲突、把字段名大小写漂移，闸门一律 EXIT=0 放行。规范定了却没人真拦，等于没定；趁认证契约刚接完、受管面还只有一对（auth）时修，成本最低。

## What Changes

- **H1 接口名集合双向比对**：现状 record/interface 名只做 `$backendRecordCount++`/`$frontendInterfaceCount++` 计数，从不存名、从不比对。改为收集两侧接口名集合并双向比对，任一侧出现对方没有的接口名即判红并列出接口名。
- **H2 按接口嵌套比对字段**：现状把所有 record 字段压进一个扁平 `[ordered]` 字典、所有 interface 字段压进另一个扁平字典，同名字段跨接口后者覆盖前者，类型漂移被吞。改为「接口名 → 该接口字段集」的嵌套结构，对每一对同名接口逐一比字段名集合与字段类型。
- **M1 大小写敏感比较**：PowerShell 哈希表 `.Contains()` 与键查找默认大小写不敏感，`email` 对 `Email` 判为相等而漏掉大小写漂移。接口名与字段名的存在性比对改为大小写敏感（序数比较）。
- **M2 前端侧补 camelCase 校验**：现状只遍历 `$backendTypes.Keys` 查 camelCase，前端 interface 字段完全不查。改为两侧字段名都按 `^[a-z][A-Za-z0-9]*$` 校验。
- **保留既有有效防线**：映射表外类型 fail-closed、空集合判红、`@JsonProperty` 判红、令牌字段禁现、受管清单为空判红——这些不动。
- **负向验证固化**：H1/H2/M1/M2 四类假绿灯样本各自必须让闸门 EXIT=1（M2 使用前端大写开头字段复现旧版放行）；蛇形与下划线开头样本继续判红并补齐 camelCase 诊断。同时现有 auth 契约保持 EXIT=0、`run-all` 全 11 道仍绿。

## Capabilities

### New Capabilities

<!-- 本变更不引入新能力。 -->

### Modified Capabilities

- `contract-consistency`: 两条既有 Requirement 的正文已要求「接口名集合相等」与「两侧 camelCase」，但缺可验收的 Scenario，导致闸门漏实现也无人能判其违约。本变更为「字段名与类型双向一致」补 *接口名漂移判失败*、*同名字段跨接口类型漂移判失败* 与 *字段名大小写漂移判失败* 场景，为「字段命名风格强制 camelCase」补 *前端字段非 camelCase 判失败* 场景，把既有要求变成第三方可验收标准，并在正文显式澄清名字比对大小写敏感及诊断保留接口归属。

## Impact

- **闸门**：`harness/checks/10-contract-check.ps1` 单文件重构（扁平字典 → 按接口嵌套 + 接口名比对 + 大小写敏感 + 前端 camelCase）。
- **spec**：`openspec/specs/contract-consistency/spec.md` 经本变更 delta 归档后新增 4 条 Scenario。
- **代码 / 子模块**：无。已取证当前 auth 契约对齐（后端 10 record 与前端 10 interface 逐一同名、无同名字段跨接口类型冲突），收紧后现有契约仍绿，不触发 `frontend/`、`backend/` 任何返工。
- **范围外**：认证线非阻塞跟进 M4（登录失败刷新已消费图形码）、M5（logout 无 catch + 零测试）、L1（密码提示应为 bytes 非 characters）属子模块代码，另行处理，本变更不含。
- **验收**：`run-all.ps1` 退出码仍须为 0；`10-contract-check` 对本目录内四类变异样本逐一判红。

## 实施取证更正

修复前针对固定版本 `20a54f40ae6319565013d44a06fbfdc41ccab530` 实跑发现：前端 `display_name` / `_email` 已因字段集合差异返回 EXIT=1，不能写成旧版 EXIT=0；前端 `Email` 才是 M2 可稳定复现的假绿灯。对应验证保留所有蛇形用例，增加大写开头对照并断言 camelCase 专项诊断，不减少 delta 的任何验收场景。前文将四类缺陷等同于所有命名反例都放行的表述不准确，以本节及验证脚本逐例结果为准。
