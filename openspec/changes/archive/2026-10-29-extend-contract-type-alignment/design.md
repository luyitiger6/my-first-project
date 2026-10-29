# Design

## Context

动机见 `proposal.md - Why`，行为契约见 `specs/contract-consistency/spec.md`。这里只记录实现取向所需的现状：

- 现有 `harness/checks/10-contract-check.ps1` 已能解析后端 `record` 组件名与前端 `interface` 字段名并做双向比对，且已内建两条防伪：解析出空集合即失败、后端 dto 目录出现 `@JsonProperty` 即失败。它把后端目录、`ErrorResponse.java`、前端契约文件路径**写死**在脚本顶部三个变量里。
- 现有解析取组件名的方式是「参数段按逗号切分后取最后一个 `\w+`」，**类型信息被丢弃**——这正是本 change 要补的输入。
- 当前受管契约面（auth 的 10 个 DTO）字段类型只用到 `String` 与 `Instant`；后端把账户状态在 DTO 层降为 `String`（`MeResponse.status`），前端用字面量联合 `AccountStatus` 表达。没有数值、布尔、数组或嵌套类型。
- 闸门是纯文本静态解析，不编译、不联网、无交互，退出码即结论（AGENTS.md §8）。

## Goals / Non-Goals

**Goals**
- 让同一道闸门在比字段名之外，再比字段类型；类型判定基于一张显式、公开、可扩充的 Java↔TS 映射表。
- 把「受管配对」从写死变量改为脚本顶部一处清单，新增模块只加条目、不改比对逻辑。
- 保持并强化 fail-closed：任何无法确定类型一致性的情况都判红，绝不静默放行。

**Non-Goals**
- 不引入 OpenAPI / 注解处理器 / 代码生成（对只有一个后端契约面的项目属过度机械，且与「护栏每多一条维护成本多一分」冲突）。
- 不做运行时校验或类型反射；不改后端 DTO 结构、不改前端运行时行为。
- 不为尚无后端的首页/搜索 mock 预先造契约（AGENTS.md 明令不预先设想）。
- 不在本 change 内改动在飞的 `add-wanderchain-auth-frontend` 工件。

## Decisions

### D1：类型来源——扩展现有 record/interface 解析，而非另起解析器
后端：参数段切分后，组件名仍是最后一个标识符，**名字之前的剩余串即类型表达式**（保留泛型尖括号与 `[]`，先摘注解）。前端：`interface` 字段 `name:` 之后到行尾/分号即类型注解。
- 备选：引入 Java/TS 语法解析器。否决——重、需依赖，违背闸门「纯文本、零依赖」取向。

### D2：显式 Java↔TS 映射表，表外类型一律 fail-closed
映射表（初版，覆盖常见原始与时间类型，为未来模块预留）：

| Java 类型 | 归一化 TS 类型 |
|---|---|
| `String` / `CharSequence` / `UUID` | `string` |
| `Instant` / `OffsetDateTime` / `LocalDate` / `LocalDateTime` | `string`（ISO-8601） |
| `int` `Integer` `long` `Long` `double` `Double` `float` `Float` `BigDecimal` | `number` |
| `boolean` `Boolean` | `boolean` |
| `List<T>` / `Set<T>` / `T[]` | `Array<map(T)>` |

- 表外的 Java 类型（自定义嵌套 record、`Map<K,V>`、通配泛型 `?`）→ **判红并指出文件与字段**，提示「需显式扩充映射表」。这把「新类型」变成一次显式决策，而不是漏检。
- 备选：未知类型回退为 `any`/放行。否决——直接违背 fail-closed 与 spec「未覆盖类型判失败」。

### D3：前端类型归一化——字面量联合视为 string
前端类型注解归一化规则：`string`/`number`/`boolean` 原样；`'a' | 'b'` 形式的字面量联合归一化为 `string`；`T[]` 与 `Array<T>` 归一化为 `Array<T>`；可选标记 `?` 与 `| null`/`| undefined` 不改变归一化后的基类型。比对时：后端类型经 D2 映射得到期望 TS 类型，与前端归一化类型比较，不等即判红。
- 理由：后端 `MeResponse.status` 是 `String`、前端是 `AccountStatus` 联合，语义一致，必须判过而不是误红。
- 备选：要求前端也用 `string` 而禁用联合。否决——联合类型是前端有价值的窄化，强行放宽会降低前端类型安全。

### D4：可配置扫描清单取代写死变量
脚本顶部改为一处清单，每条目描述一对受管契约：
```
$contractPairs = @(
  @{ Name='auth'
     Backend=@('backend/src/main/java/com/luyi/myfirst/web/auth/dto',
               'backend/src/main/java/com/luyi/myfirst/common/web/ErrorResponse.java')
     Frontend='frontend/lib/contracts/auth.ts'
     ForbiddenFields=@('token','accessToken','refreshToken','sessionId') }
)
```
比对逻辑对每个 pair 独立执行（名字集合、类型映射、camelCase、`@JsonProperty`、forbidden fields、空集合防伪）。清单为空即判红。
- `ForbiddenFields`（令牌字段禁现）作为 pair 级可选属性保留：它是 auth 的策略，随 auth pair 声明，不污染未来其它模块。
- 备选：保持写死、每加模块改脚本主体。否决——正是本 change 要消除的耦合。

### D5：与既有防伪/输出协同
保留「解析出空集合即失败」「`@JsonProperty` 即失败」两条，并把它们下沉到每个 pair。通过态输出从「N 个接口、M 个字段名一致」扩为「N 个接口、M 个字段（名字+类型）一致」，文案如实反映校验维度。

## Risks / Trade-offs

- [文本解析泛型/嵌套类型脆弱] → fail-closed 兜底：解析不出或不认识的类型一律判红并指出位置；当前契约面扁平，风险低；未来引入嵌套 record 时闸门会红并提示扩充映射，这是**预期的显式扩展点**而非漏检。
- [后端将来改用真正的 enum 类型而非 String] → 需在映射表登记该枚举类型名 → `string`；未登记则 fail-closed 报红，不会误判为一致。
- [可配置清单被误清空导致保护形同虚设] → 清单为空即判红（spec 已定为需求）。
- [与在飞 `frontend-nextjs` 的 auth 契约需求重复描述同一闸门] → 归档顺序协调：本 change 在 `add-wanderchain-auth-frontend` 之后归档，届时把 `frontend-nextjs` 那条 auth 专属闸门需求收窄为「auth 是 `contract-consistency` 的首个受管对象」。本 change 不碰在飞工件。
- [映射表现阶段只有 auth 一个消费者，number/boolean/array 行暂无字段使用] → 仍纳入：它们是「整个项目」未来模块必然用到的原始类型，且纳入不削弱 fail-closed（fail-closed 针对的是需要结构处理的嵌套/映射/通配类型）。

## Migration Plan

1. 改 `10-contract-check.ps1`：D1 类型提取 + D2 映射表 + D3 前端归一化 + D4 清单化 + D5 协同；先保证**当前代码正常态仍 exit 0**（类型全一致）。
2. 破坏性验证（每次改完立即还原、`git status` 确认干净）：至少覆盖——后端某字段 `String→int` 而前端仍 `string`（类型漂移红）、后端 `Instant` 对应前端写成 `number`（时间类型红）、映射表外类型（如塞一个嵌套 record 字段）红、清单清空红、蛇形命名红、名字漂移仍红。
3. `frontend/lib/contracts/auth.ts` 注释补写类型约定（时间=ISO-8601 字符串、状态=字面量联合对应后端 String），不改字段。
4. 同步 `AGENTS.md` §6/§9 与根 `README.md` 对 10 号闸门的描述为「字段名 + 类型双向比对、扫描范围可配置」；不增删闸门文件，`<!-- harness-checks -->` 标记不变。
5. 跑 `harness\run-all.ps1`，退出码必须为 0。
6. 回滚策略：本 change 仅动 harness 脚本、契约注释与文档；回滚 = 还原这几个文件，无数据/无构建产物迁移。

## Open Questions

无。映射表覆盖范围、枚举处理、清单结构、归档协调均已在上方决策中定死，不存在会改变 spec、方案或任务拆解的待定项。
