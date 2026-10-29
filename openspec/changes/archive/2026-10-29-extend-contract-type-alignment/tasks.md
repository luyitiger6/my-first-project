# Tasks

## 1. 闸门：类型解析与映射（核心）

- [x] 1.1 按 design D1 扩展后端 record 解析：参数段除取最后一个标识符作组件名外，提取名字之前的剩余串作**类型表达式**（先摘注解，保留泛型尖括号与 `[]`）。验证：对当前 auth DTO 能解析出 `String` 与 `Instant` 两类类型，`10-contract-check.ps1` 正常态仍 `exit 0`。
- [x] 1.2 按 design D2 加入 Java↔TS 映射表与映射函数，表外类型（嵌套自定义类型、`Map`、通配泛型）**fail-closed 判红**并指出文件与字段。验证（变异实验，改后立即还原、`git status` 确认干净）：临时给某后端 DTO 塞一个映射表外类型字段 → 闸门 `exit 1` 且报出该字段；还原后 `exit 0`。
- [x] 1.3 按 design D3 实现前端 interface 字段**类型注解归一化**：`string`/`number`/`boolean` 原样，字面量联合归一为 `string`，`T[]` 与 `Array<T>` 归一为 `Array<T>`，忽略 `?` 与 `| null`。验证：`MeResponse.status`（前端 `AccountStatus` 联合）与后端 `String` 判为一致，正常态 `exit 0`（不误红）。
- [x] 1.4 接入类型比对：共有字段两侧类型经映射/归一后比较，不等判红并指出接口名与字段名。验证（两次变异，各自还原）：① 临时把后端 `LoginResponse.expiresAt` 由 `Instant` 改成 `int`（前端仍 `string`）→ `exit 1`；② 临时把前端 `MeResponse.createdAt` 由 `string` 改成 `number`（后端 `Instant`）→ `exit 1`；两次还原后均 `exit 0`。

## 2. 闸门：扫描范围清单化

- [x] 2.1 按 design D4 把写死的「后端目录 + `ErrorResponse.java` + 前端契约文件」三变量重构为脚本顶部一处 `$contractPairs` 清单，比对逻辑对每个 pair 独立执行；`ForbiddenFields` 下沉为 pair 级可选属性（auth pair 保留令牌字段禁现）。验证：正常态 `exit 0`，通过态输出含 pair 名与「接口数 / 字段（名字+类型）数」。
- [x] 2.2 清单为空即判红（spec「清单为空」场景）。验证（变异后还原）：临时清空 `$contractPairs` → `exit 1` 并说明无受管对象；还原后 `exit 0`。
- [x] 2.3 既有防伪下沉到每个 pair：解析出空集合判红、后端出现 `@JsonProperty` 判红、字段名非 camelCase 判红、令牌字段出现判红。验证（各变异后还原）：① 后端某 dto 临时加 `@JsonProperty` → `exit 1`；② 临时把某字段改成蛇形 → `exit 1`；两次还原后 `exit 0`。

## 3. 契约注释与文档同步

- [x] 3.1 在 `frontend/lib/contracts/auth.ts` 顶部注释补写类型约定：时间字段是 ISO-8601 字符串（对应后端 `Instant`）、状态字段是小写字面量联合（对应后端 `String`），并说明类型一致性现由闸门按映射表强制。**不改任何字段名或类型**。验证：`cd frontend; npm run build` 退出码 0（注释改动不影响构建）。
- [x] 3.2 同步 `AGENTS.md` §6 目录地图与 §9 已知边界、根 `README.md` 中对 `10-contract-check` 的描述，从「字段名双向比对」更新为「字段名 + 类型双向比对、扫描范围可配置」；**不增删闸门文件**，`<!-- harness-checks: ... -->` 标记保持不变。验证：`powershell -File harness\checks\07-doc-consistency.ps1` 退出码 0。

## 4. 集成验收

- [x] 4.1 单独跑 `powershell -File harness\checks\10-contract-check.ps1`，正常态退出码 0，输出反映「名字 + 类型」两个维度与受管接口/字段计数。
- [x] 4.2 复核破坏性矩阵全部已还原：1.2 / 1.4 / 2.2 / 2.3 的每处变异均已回退，`cd backend; git status --short` 与 `cd frontend; git status --short` 除本 change 预期改动（仅 `lib/contracts/auth.ts` 注释）外无残留。
- [x] 4.3 跑 `powershell -File harness\run-all.ps1`，退出码必须为 0、十一道闸门全 PASS（本 change 不新增闸门文件，闸门数仍为 11）。

## Workflow follow-up

- 归档顺序：本 change 必须在 `add-wanderchain-auth-frontend` **之后**归档，否则 `contract-consistency` 与 `frontend-nextjs` 的 auth 契约闸门需求会短暂重复。
- 归档时：把 `contract-consistency` 能力目录并入 `openspec/specs/`；并把 `frontend-nextjs` 中那条 auth 专属「契约与后端字段一致并纳入闸门」需求收窄为「auth 契约面是 `contract-consistency` 机制的首个受管对象」，消除重复描述。
- 提交顺序（AGENTS.md §6）：本 change 的 3.1 改的是 frontend 子模块文件（仅注释），1.x/2.x/3.2 改的是工作区自有文件（`harness/`、`AGENTS.md`、`README.md`）。先在 `frontend` 子模块提交并推送注释改动，再回工作区提交 `harness/`+文档与新的 frontend gitlink。
