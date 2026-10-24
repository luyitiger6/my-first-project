# TODO 待办清单模块规格说明（SPEC）

| 项 | 内容 |
|---|---|
| 版本 | v1.0 |
| 状态 | 目标契约（待评审） |
| 适用模块 | `backend` 的 `com.luyi.myfirst`（Todo / TodoService / TodoController）+ `frontend/src/api.ts` |
| 基线 | 当前实现：内存存储、`POST /{id}/complete` 语义 |
| 命名约定 | JSON 字段一律 lowerCamelCase，前后端逐字一致 |

> 本文档定义模块的**目标契约**（should be），不是对现状的逐行描述。
> 与当前实现的差异集中在「附录 A：实现差距」，落地前需先立项 change。

---

## 1. 模块边界

### 1.1 包含（本期范围）

| 编号 | 能力 | 说明 |
|---|---|---|
| IN-1 | 查询清单 | 返回全部待办，按创建顺序（id 升序） |
| IN-2 | 创建待办 | 仅接收标题，服务端分配 id，`done` 初始为 `false` |
| IN-3 | 完成待办 | 将指定 id 置为已完成；重复调用幂等 |
| IN-4 | 输入校验 | 标题非空白、长度上限；校验失败不写库 |
| IN-5 | 统一错误响应 | 所有 4xx/5xx 返回结构化 `ErrorResponse` |
| IN-6 | 字段命名契约 | JSON 字段全链路 lowerCamelCase |

### 1.2 不包含（明确不做）

| 编号 | 不做的能力 | 原因 |
|---|---|---|
| OUT-1 | 用户注册 / 登录 / 鉴权 / 多租户 | **单用户私有**：部署即单租户，无用户概念 |
| OUT-2 | 协作、分享、指派、评论 | 同上，无多用户模型 |
| OUT-3 | 删除待办 | 本期范围外，后续如需另立规格 |
| OUT-4 | 修改标题 | 同上 |
| OUT-5 | 取消完成（`done: true → false`） | 同上 |
| OUT-6 | 分页 / 搜索 / 排序 / 过滤 | 数据量为单用户量级，全量返回 |
| OUT-7 | 截止日期 / 优先级 / 标签 / 附件 | 当前数据模型只有 `id/title/done` |
| OUT-8 | 提醒 / 通知 | 无调度与消息通道 |
| OUT-9 | 持久化（数据库 / 文件） | 刻意内存存储，保证 Harness 可重复执行 |
| OUT-10 | 软删除 / 回收站 / 历史版本 | 无删除即无此问题 |
| OUT-11 | 审计日志 / 操作人追踪 | 单用户，追责对象不存在 |
| OUT-12 | 并发控制 / 乐观锁 | 单用户假设，不保证并发一致性 |

### 1.3 运行约束

- **数据生命周期**：进程重启后数据清空，`GET` 返回 `[]`。这是设计选择，不是缺陷。
- **单用户假设**：所有请求属于同一用户，接口不接收 `userId`，也不校验身份。
- **id 分配**：服务端单调递增，从 `1` 开始；客户端不得指定或复用 id。
- **重复标题**：允许存在同名待办，不做唯一性约束。

---

## 2. 核心应用场景

> 语义：**WHEN** 触发条件 → **THEN** 可观察结果 → **AND** 附加断言（必须同时成立）。
> 异常路径与正常路径同等重要，验收时逐条核对。

### 2.1 正常路径

#### S-01 查看空清单
```
WHEN  客户端请求 GET /api/todos，且系统内无任何待办
THEN  返回 HTTP 200，响应体为 []
AND   不返回错误字段
```

#### S-02 创建待办
```
WHEN  客户端请求 POST /api/todos，body 为 {"title":"买牛奶"}
THEN  返回 HTTP 201，响应体为 {"id":1,"title":"买牛奶","done":false}
AND   后续 GET /api/todos 的列表末尾包含该记录
```

#### S-03 标题规范化
```
WHEN  创建时 title 为 "  买牛奶  "（首尾含空白）
THEN  保存并返回的 title 为 "买牛奶"（已 trim）
AND   id 照常分配，done 仍为 false
```

#### S-04 清单有序
```
WHEN  依次创建 id=1..N 的待办后请求 GET /api/todos
THEN  返回长度为 N 的数组
AND   顺序严格按 id 升序（即创建顺序）
```

#### S-05 完成待办
```
WHEN  请求 POST /api/todos/1/complete，且 id=1 存在
THEN  返回 HTTP 200，响应体 done=true
AND   id 与 title 保持不变
AND   后续 GET 中该条记录 done=true
```

#### S-06 重复完成（幂等）
```
WHEN  对已完成的 id=1 再次请求 POST /api/todos/1/complete
THEN  返回 HTTP 200，done 仍为 true
AND   不新增记录，列表长度不变
```

### 2.2 异常路径

#### E-01 标题缺失或为 null
```
WHEN  body 为 {} 或 {"title":null}
THEN  返回 HTTP 400，body 为 {"code":"TITLE_BLANK","message":"..."}
AND   清单长度不变（未创建记录）
```

#### E-02 标题为空白
```
WHEN  title 为 ""、"   " 或 "\t\n"
THEN  返回 HTTP 400，code=TITLE_BLANK
AND   清单长度不变
```

#### E-03 标题超长
```
WHEN  title 经 trim 后长度 > 100
THEN  返回 HTTP 400，code=TITLE_TOO_LONG
AND   清单长度不变
```

#### E-04 完成不存在的待办
```
WHEN  请求 POST /api/todos/999/complete，且 id=999 不存在
THEN  返回 HTTP 404，code=TODO_NOT_FOUND
AND   清单内容与顺序均不变
```

#### E-05 路径 id 非法
```
WHEN  请求 POST /api/todos/abc/complete（非整数）
THEN  返回 HTTP 400，code=INVALID_ID
AND   不发生任何状态变更
```
> 数字但不存在（含 `0`、负数）归入 E-04 的 404，不归入本场景。

#### E-06 请求体非法
```
WHEN  body 不是合法 JSON，或 Content-Type 不是 application/json
THEN  返回 HTTP 400，code=INVALID_REQUEST
AND   响应体仍为统一 ErrorResponse 结构
```

#### E-07 错误响应格式统一
```
WHEN  任一请求返回 4xx 或 5xx
THEN  响应体包含且仅包含 code、message 两个必填字段
AND   字段名为 lowerCamelCase
AND   不包含堆栈、内部类名、SQL 或实现细节
```

#### E-08 未预期异常
```
WHEN  服务端发生未捕获异常
THEN  返回 HTTP 500，code=INTERNAL_ERROR
AND   对外不泄漏异常堆栈与实现细节
```

#### E-09 未定义的路由或方法
```
WHEN  请求未定义的路径，或对已有路径使用不支持的方法
THEN  返回 HTTP 404（路径不存在）或 405（方法不支持）
AND   响应体使用统一 ErrorResponse 结构
```

### 2.3 边界与幂等

#### B-01 标题长度边界
```
WHEN  title 经 trim 后长度恰好为 100
THEN  创建成功，返回 HTTP 201
AND   保存的标题与输入一致（trim 后）
```

#### B-02 重复标题
```
WHEN  连续创建两条 title 均为 "买牛奶" 的待办
THEN  两次均返回 201，分配不同 id
AND   清单中存在两条独立记录
```

#### B-03 重启后数据清空
```
WHEN  服务重启后请求 GET /api/todos
THEN  返回 HTTP 200
AND   响应体为 []（内存存储，不做恢复）
```

---

## 3. 数据结构

### 3.1 Todo（响应实体）

| 字段 | JSON 类型 | Java / TS 类型 | 必填 | 约束 | 来源 |
|---|---|---|---|---|---|
| `id` | number | `long` / `number` | 是 | 正整数，≥1，单调递增，只读 | 服务端生成 |
| `title` | string | `String` / `string` | 是 | trim 后长度 1..100，禁止纯空白 | 客户端输入 |
| `done` | boolean | `boolean` / `boolean` | 是 | 默认 `false`，只由服务端变更 | 服务端维护 |

字段顺序不影响契约。前端 `number` 承载 int64，在本模块取值范围内安全。

### 3.2 CreateTodoRequest（请求体）

| 字段 | JSON 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| `title` | string | 是 | trim 后长度 1..100，禁止纯空白 | 仅此字段参与创建 |

未声明的多余字段忽略，不报错。

### 3.3 ErrorResponse（错误响应体）

| 字段 | JSON 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| `code` | string | 是 | 大写下划线枚举，见 3.4 | 机器可读，前端据此分支 |
| `message` | string | 是 | 非空，不含堆栈与内部实现 | 人类可读 |

### 3.4 HTTP 状态码与错误码

| HTTP | code | 触发场景 | 对应场景 |
|---|---|---|---|
| 200 | — | 查询成功、完成成功 | S-01、S-04、S-05、S-06 |
| 201 | — | 创建成功 | S-02、S-03、B-01、B-02 |
| 400 | `TITLE_BLANK` | 标题缺失 / null / 空白 | E-01、E-02 |
| 400 | `TITLE_TOO_LONG` | trim 后长度 > 100 | E-03 |
| 400 | `INVALID_ID` | 路径 id 非整数 | E-05 |
| 400 | `INVALID_REQUEST` | JSON 非法 / 类型不匹配 | E-06 |
| 404 | `TODO_NOT_FOUND` | 目标 id 不存在 | E-04 |
| 405 | `METHOD_NOT_ALLOWED` | 方法不支持 | E-09 |
| 500 | `INTERNAL_ERROR` | 未预期异常 | E-08 |

### 3.5 命名与一致性规则

1. JSON 字段名一律 **lowerCamelCase**，禁止 `snake_case`、`PascalCase`、短横线。
2. 前后端 `Todo` 字段必须逐字一致：`id`、`title`、`done`。
3. 服务端 record 与前端 `interface` 同名字段，新增字段须同时改两侧，否则视为契约破坏。
4. `ErrorResponse` 的 `code`、`message` 同样适用本规则。

---

## 4. 验收标准

> 每条必须可机械验证：接口测试、类型检查或 Harness 闸门。勾选前需有证据。

### 4.1 功能（正常路径）

- [ ] **AC-01** 空清单返回 `200` 且 body 为 `[]`（S-01）
- [ ] **AC-02** 创建返回 `201`，回显 `id/title/done`，且 `done=false`（S-02）
- [ ] **AC-03** 标题首尾空白被 trim 后保存（S-03）
- [ ] **AC-04** 清单按 id 升序返回，数量与创建数一致（S-04）
- [ ] **AC-05** 完成后 `done=true` 且列表中同步可见（S-05）
- [ ] **AC-06** 重复完成返回 `200` 且不产生新记录（S-06）

### 4.2 异常路径

- [ ] **AC-07** 缺失 / null / 空白标题 → `400 TITLE_BLANK`，清单不变（E-01、E-02）
- [ ] **AC-08** 标题超过 100 字符 → `400 TITLE_TOO_LONG`，清单不变（E-03）
- [ ] **AC-09** 完成不存在的 id → `404 TODO_NOT_FOUND`（E-04）
- [ ] **AC-10** 非整数 id → `400 INVALID_ID`（E-05）
- [ ] **AC-11** 非法 JSON → `400 INVALID_REQUEST`（E-06）
- [ ] **AC-12** 所有 4xx/5xx 响应体均为 `ErrorResponse`，无堆栈泄漏（E-07、E-08）
- [ ] **AC-13** 未定义路由 / 方法 → `404` / `405` 且错误体统一（E-09）

### 4.3 契约一致性

- [ ] **AC-14** 所有 JSON 字段名为 lowerCamelCase（静态扫描，命中 0）
- [ ] **AC-15** 前端 `Todo` interface 与后端 `Todo` record 字段逐字一致（`id/title/done`）
- [ ] **AC-16** `ErrorResponse` 只含 `code`、`message` 两个必填字段

### 4.4 边界与工程闸门

- [ ] **AC-17** 标题长度恰好 100 时创建成功（B-01）
- [ ] **AC-18** 同名待办可并存，id 不同（B-02）
- [ ] **AC-19** 重启后清单为空且不报错（B-03）
- [ ] **AC-20** `powershell -File harness\run-all.ps1` 退出码为 `0`

---

## 附录 A：与当前实现的差距

> 以下条目是「规格已定义、代码未实现」的部分。落地需走 OpenSpec change，
> 不得以「当前代码就是这样」为由改写规格（AGENTS.md 硬规则 2）。

| 差距 | 当前实现 | 规格目标 | 影响场景 |
|---|---|---|---|
| 无全局异常处理 | `IllegalArgumentException` 冒泡，返回 500 | 400 / 404 + `ErrorResponse` | E-01 ~ E-04、E-07、E-08 |
| 无标题长度上限 | 任意长度均可创建 | trim 后 ≤ 100 | E-03、B-01 |
| 无「未找到」语义 | 未找到与参数错误同表现为 500 | `404 TODO_NOT_FOUND` | E-04 |
| 无 `INVALID_ID` 映射 | 非数字 id 由框架返回默认 400 体 | `400 INVALID_ID` + 统一体 | E-05 |
| 无统一错误体 | 框架默认错误 JSON | `{"code","message"}` | E-06 ~ E-09 |
| 无删除 / 编辑 / 取消完成 | 不存在 | 明确不在本期范围 | OUT-3 ~ OUT-5 |

## 附录 B：落地路径

1. 立项 change（如 `define-todo-module-contract`），把本文件的 Scenario 转成 delta spec 的 `### Requirement` + `#### Scenario`。
2. 实现差距表中的 5 项（全局异常处理器、长度校验、404 语义、错误码映射、统一错误体）。
3. 补齐接口测试，覆盖 E-01 ~ E-09 与 B-01 ~ B-03。
4. `harness\run-all.ps1` 退出码 0 后归档，本文档随即由主 spec 取代。
