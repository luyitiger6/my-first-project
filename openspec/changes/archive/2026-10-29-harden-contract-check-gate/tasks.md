# Tasks

> design.md 定了四条决策（按接口嵌套 / 大小写敏感序数比较 / 前端补 camelCase / 变异副本负向验证）。本变更只动 `harness/checks/10-contract-check.ps1` 一个脚本加本目录下的验证样本，不碰子模块、不在实施阶段改动主 spec 或已批准的 delta。

## 1. 重构闸门：扁平字典 → 按接口嵌套

- [x] 1.1 后端解析改为 `$backendInterfaces[recordName] = 有序字段字典(fieldName→type)`，record 名来自现有正则 `Groups[1]`（当前只喂 `$backendRecordCount++`）；保留去注释、去 `@注解` 的预处理。判据：解析后每个 record 名都成为外层键，其组件成为内层字段字典。
- [x] 1.2 前端解析改为 `$frontendInterfaces[interfaceName] = 有序字段字典(fieldName→type)`，interface 名来自现有正则 `Groups[1]`；`type` 别名表 `$feAliases` 维持不变供归一化用。判据：auth.ts 的 10 个 interface 各成外层键。
- [x] 1.3 外层接口名集合与内层字段名集合的存在性比对，一律改用大小写敏感方式（`-ccontains` 或 `[StringComparer]::Ordinal` 的 `HashSet`），字段字典构造也用大小写敏感比较器，杜绝 `userId`/`userid` 在赋值阶段被并键。判据：把后端某字段名仅改大小写，闸门能判为「后端有前端无 + 前端有后端无」两条。
- [x] 1.4 保留全部既有防线：映射表外类型 fail-closed、任一侧空集合判红、`@JsonProperty` 判红、令牌字段禁现、受管清单为空判红、`Map-JavaToTs`/`Normalize-Ts` 逻辑不动。判据：diff 只改比对结构与大小写敏感性，未删任何一条既有 `$failures +=`。

## 2. 补齐四项执法

- [x] 2.1 H1 接口名双向比对：分别列出「后端有而前端无」「前端有而后端无」的接口名并判红。判据：删掉前端一份 interface 或改其名字，闸门 EXIT=1 且报出接口名。
- [x] 2.2 H2 按共有接口逐一比字段：对每个两侧同名的接口，双向比其字段名集合，再对共有字段经映射/归一比类型；不再跨接口共享一个扁平字典。判据：在两个不同接口制造同名字段的类型冲突，闸门 EXIT=1 且报出接口名 + 字段名。
- [x] 2.3 M2 前端 camelCase：对 `$frontendInterfaces` 每个接口的字段名执行 `-cnotmatch '^[a-z][A-Za-z0-9]*$'` 判红，报错格式与后端侧一致。判据：把前端某字段改成蛇形或大写开头，闸门 EXIT=1 且报出该字段名。
- [x] 2.4 受管清单根路径参数化：脚本顶部接受一个可选根路径参数（默认仓库根），供第 3 组验证脚本指向临时副本；run-all 调用不传参、行为与现状一致。判据：不带参数直接跑，结果与重构前对真实仓库的判定一致。

## 3. 负向验证（核心验收，样本随变更留档）

- [x] 3.1 在本变更目录下新增验证脚本与四类变异样本说明，验证脚本在 `$env:TEMP` 复制受管文件、注入变异、用根路径参数指向副本跑闸门，跑完清理副本不污染工作树。判据：验证脚本可重复执行、退出码自身可断言（全过 exit 0，任一变异未判红则 exit 1）。
- [x] 3.2 四类变异各自断言 EXIT=1：①接口改名/删接口（H1）②跨接口同名字段类型冲突（H2）③字段名大小写漂移（M1）④前端字段大写开头、蛇形及下划线开头（M2）。判据：四类分别跑，闸门均 EXIT=1 并报出对应接口名/字段名。
- [x] 3.3 回归对照：对未变异的副本断言 EXIT=0，证明重构没把正常契约误判为红。判据：未变异副本 EXIT=0。
- [x] 3.4 旧闸门假绿灯留证：固定旧版本与当前版本使用同样样本对照，四类缺陷各有旧版 EXIT=0、新版 EXIT=1 的证据；M2 用大写开头字段，蛇形样本旧版已 EXIT=1 的事实按 proposal 更正说明保留，不伪造历史绿灯。判据：design 样本表与可执行对照结果一致。

## 4. 验收

- [x] 4.1 对真实仓库跑 `powershell -File harness\checks\10-contract-check.ps1`，EXIT=0（现有 auth 契约收紧后仍绿）。
- [x] 4.2 `powershell -File harness\run-all.ps1` EXIT=0，全 11 道 PASS；`07-doc-consistency` 不因本变更误伤（未改 AGENTS.md 闸门清单标记）。
- [x] 4.3 `openspec validate harden-contract-check-gate --strict` 通过；新增 4 条 Scenario 均对应到第 2、3 组的可执行判据。

## 本轮验收记录（2026-10-29）

- `powershell -File harness\checks\10-contract-check.ps1`：EXIT=0，10 record / 10 interface，按接口累计各 33 字段，33 项类型比对通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File openspec\changes\harden-contract-check-gate\verify-contract-check.ps1`：EXIT=0；28 个样本，25 个负例均 EXIT=1 且诊断匹配，3 个正例均 EXIT=0。
- 同一脚本 `-CompareBaseline -Repeat 3`：28 样本 × 新旧两版 × 3 轮 = 168 次检查，0 次断言失败。日志 `backend/target/harden-mutations.log`。四类假绿灯对应旧版 EXIT=0 → 新版 EXIT=1；蛇形旧版已判红，详见 proposal 更正说明及 design 样本表。
- `powershell -File harness\run-all.ps1`：实际 EXIT=0，11 道 `[PASS]`，`RESULT: ALL CHECKS PASSED`。独立控制台 wrapper 保留的退出码为 `backend/target/harden-runall-final.exit`，完整日志 `backend/target/harden-runall-final.log`。
- `openspec validate harden-contract-check-gate --strict`：通过。新增四个 Scenario 分别对应 H1、H2、M1、M2 样本组。
- 前后端工作树无修改，gitlink 对齐；未提交、推送、同步主 spec 或归档。未运行浏览器 E2E；本轮只验证静态契约检查，不扩展解析语法或类型系统。
