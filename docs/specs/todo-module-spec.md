# TODO 待办清单模块规格说明（SPEC）

| 项 | 内容 |
|---|---|
| 版本 | v1.2.1 |
| 状态 | 目标契约（待评审） |
| 适用模块 | `backend` 的 `com.luyi.myfirst`（Todo / TodoService / TodoController）+ `frontend/src/api.ts`、`App.vue` |
| 基线 | 当前实现：内存存储、`POST /{id}/complete`；无更新端点、无扩展字段、无并发保护 |
| 命名约定 | JSON 字段一律 lowerCamelCase，前后端逐字一致 |

> 本文档定义模块的**目标契约**（should be），不是对现状的逐行描述。
> 与当前实现的差异集中在「附录 A：实现差距」，落地前需先立项 change。

---

## 1. 模块边界

### 1.1 包含（本期范围）

| 编号 | 能力 | 说明 |
|---|---|---|
| IN-1 | 查询清单 | 返回全部待办，按创建顺序（id 升序） |
| IN-2 | 创建待办 | 标题必填，可选标签 / 截止日期 / 优先级；服务端分配 id，`done` 初始为 `false` |
| IN-3 | 完成待办 | 将指定 id 置为已完成；重复调用幂等 |
| IN-4 | 更新待办 | `PATCH` 部分更新标题 / 标签 / 截止日期 / 优先级；不可改 `done`、`id` |
| IN-5 | 输入校验 | 标题、标签、日期、优先级、未知字段、不可更新字段；失败不写库 |
| IN-6 | 统一错误响应 | 所有 4xx/5xx 返回结构化 `ErrorResponse` |
| IN-7 | 字段命名契约 | JSON 字段全链路 lowerCamelCase |
| IN-8 | 容量与体积上限 | 总条数 10,000；请求体 16KB；超限拒绝 |
| IN-9 | 并发安全 | id 唯一、单请求原子、不同字段并发不互相覆盖 |
| IN-10 | 前端错误码映射 | 前端按 `code` 显示用户文案，不直接暴露 HTTP 状态 |

### 1.2 不包含（明确不做）

| 编号   | 不做的能力                                                        | 原因                                                       |
|--------|-------------------------------------------------------------------|------------------------------------------------------------|
| OUT-1  | 用户注册 / 登录 / 鉴权 / 多租户                                   | **单用户私有**：部署即单租户，无用户概念（部署边界见 1.3） |
| OUT-2  | 协作、分享、指派、评论                                            | 同上，无多用户模型                                         |
| OUT-3  | 删除待办                                                          | 本期范围外，后续如需另立规格                               |
| OUT-4  | 取消完成（`done: true → false`）                                  | 同上；`done` 只能由 `/complete` 置为 true                  |
| OUT-5  | 分页 / 搜索 / 排序 / 过滤（含按标签、优先级、截止日期筛选与排序） | 数据量为单用户量级，全量按 id 升序返回                     |
| OUT-6  | 附件                                                              | 本期只做文本字段，不做文件                                 |
| OUT-7  | 提醒 / 通知（含基于 `dueDate` 的到期提醒）                        | 无调度与消息通道                                           |
| OUT-8  | 持久化（数据库 / 文件）                                           | 刻意内存存储，保证 Harness 可重复执行                      |
| OUT-9  | 软删除 / 回收站 / 历史版本                                        | 无删除即无此问题                                           |
| OUT-10 | 审计日志 / 操作人追踪                                             | 单用户，追责对象不存在                                     |
| OUT-11 | 并发控制 / 乐观锁（版本号、ETag）                                 | 不做冲突检测；但 id 唯一与单请求原子仍必须保证（见 1.3）   |
| OUT-12 | 标签的独立管理（标签词表、重命名、批量操作）                      | 标签只是 Todo 上的字符串数组，不是独立资源                 |
| OUT-13 | 时区与时间部分                                                    | `dueDate` 是纯日期，不含时分秒与时区                       |
| OUT-14 | 限流 / 防刷                                                       | 单用户本地部署，由部署层承担；对外暴露时必须加             |
| OUT-15 | 幂等键 / 请求去重                                                 | 创建非幂等，由客户端防重（见 1.3）                         |
| OUT-16 | 单条查询（`GET /api/todos/{id}`）                                 | 清单接口已返回全量（OUT-5 不分页），无需单条接口           |
| OUT-17 | 批量操作（批量创建 / 完成 / 更新 / 导入导出）                     | 单用户量级，逐个调用即可；批量语义会引入部分失败问题       |

### 1.3 运行约束

- **部署边界（安全前提）**：服务默认仅监听 `127.0.0.1`（`server.address: 127.0.0.1`，端口沿用 `8989`）。如需对外暴露，必须置于已鉴权、已限流的反向代理之后；否则「单用户私有」不成立，本规格不适用。
- **单实例共享**：同一实例的所有访问者共享同一份数据，本规格不提供任何用户隔离；「单租户」不等于「单用户」。
- **数据生命周期**：进程重启后数据清空，`GET` 返回 `[]`。这是设计选择，不是缺陷。
- **id 生命周期**：仅在**单次进程生命周期内**唯一且递增，重启后从 `1` 重新开始；客户端不得跨重启缓存 id，重启后必须重新拉取。
- **并发语义**：id 唯一性必须保证（不得因并发产生重复 id）；每个写请求内部原子；同一字段并发写入以最后到达者为准；**不同字段并发写入不得互相覆盖**。
- **重复标题**：允许存在同名待办，不做唯一性约束。
- **创建非幂等**：同一请求重放会产生多条记录；客户端不得自动重试 `POST`，提交期间应禁用按钮。
- **标签语义**：字符串数组，大小写敏感（`Work` 与 `work` 视为不同）；顺序保留但**不参与业务判断**；重复按 trim 后集合判定。
- **截止日期语义**：纯日期（`YYYY-MM-DD`），年份限定 `1970..2100`，允许过去日期，不触发任何提醒或状态变更。
- **优先级语义**：仅作为数据保存，不参与默认排序（排序恒按 id 升序）。
- **已完成记录**：允许继续 `PATCH` 修改标题等字段，`done` 状态不受影响。
- **容量上限**：总条数上限 10,000，达到上限后创建返回 `409 TODOS_LIMIT_REACHED`；查询、完成、更新不受影响。容量判定与写入必须原子，并发创建不得突破上限。
- **体积上限**：单个请求体上限 16KB，超限返回 `413 PAYLOAD_TOO_LARGE`。
- **长度计量**：一律按 Unicode code point 计数（Java `codePointCount`、JS `[...s].length`），以服务端计数为准；组合 emoji 可能计为多个 code point。
- **跨域**：默认不启用 CORS；前端与后端不同源时，由部署层配置白名单，应用不放开 `*`。
- **索引**：本期为内存 Map（以 id 为键），无二级索引；若未来持久化，id 主键即可，标签/优先级筛选不在范围（OUT-5）。

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

#### S-02 创建待办（仅必填字段）
```
WHEN  客户端请求 POST /api/todos，body 为 {"title":"下班后去超市买牛奶和鸡蛋"}
THEN  返回 HTTP 201，响应体为
      {"id":1,"title":"下班后去超市买牛奶和鸡蛋","done":false,
       "tags":[],"dueDate":null,"priority":"MEDIUM"}
AND   后续 GET /api/todos 的列表末尾包含该记录
```

#### S-03 标题规范化
```
WHEN  创建时 title 为 "  下班后去超市买牛奶和鸡蛋  "（首尾含空白）
THEN  保存并返回的 title 为 "下班后去超市买牛奶和鸡蛋"（已 trim）
AND   id 照常分配，done=false，tags=[]、dueDate=null、priority=MEDIUM
```

#### S-04 清单有序
```
WHEN  依次创建 id=1..N 的待办后请求 GET /api/todos
THEN  返回长度为 N 的数组
AND   顺序严格按 id 升序（即创建顺序）；更新不改变顺序
```

#### S-05 完成待办
```
WHEN  请求 POST /api/todos/1/complete，且 id=1 存在
THEN  返回 HTTP 200，响应体 done=true
AND   id、title、tags、dueDate、priority 均保持不变
AND   后续 GET 中该条记录 done=true
```

#### S-06 重复完成（幂等）
```
WHEN  对已完成的 id=1 再次请求 POST /api/todos/1/complete
THEN  返回 HTTP 200，done 仍为 true
AND   不新增记录，列表长度不变
```

#### S-07 创建带扩展字段
```
WHEN  客户端请求 POST /api/todos，body 为
      {"title":"周五下班前提交季度报表","tags":["工作","报表"],
       "dueDate":"2026-10-30","priority":"HIGH"}
THEN  返回 HTTP 201，响应体原样回显（title 已 trim）
AND   tags 保持输入顺序，dueDate 为 "2026-10-30"，priority 为 "HIGH"
AND   后续 GET 可见该记录
```

#### S-08 部分更新（只改提供的字段）
```
WHEN  已存在 id=1（priority="LOW"），请求 PATCH /api/todos/1，body 为 {"priority":"HIGH"}
THEN  返回 HTTP 200，响应体为更新后的完整 Todo 对象
AND   priority 变为 "HIGH"
AND   title、tags、dueDate、done 均保持原值
```

#### S-09 清除截止日期
```
WHEN  已存在 id=1（dueDate="2026-10-30"），请求 PATCH /api/todos/1，body 为 {"dueDate":null}
THEN  返回 HTTP 200，dueDate 变为 null
AND   其余字段均不变
```

#### S-10 标签整体替换
```
WHEN  已存在 id=1（tags=["工作","报表"]），请求 PATCH /api/todos/1，body 为 {"tags":["家庭"]}
THEN  返回 HTTP 200，tags 变为 ["家庭"]
AND   是整体替换而非合并（结果中不出现 "工作"、"报表"）
```

#### S-11 并发创建
```
WHEN  同时发起 20 个 POST /api/todos（标题各不相同）
THEN  20 个请求均返回 HTTP 201
AND   分配 20 个互不相同的 id
AND   后续 GET 返回 20 条记录，无结构损坏
```

#### S-12 并发更新不同字段
```
WHEN  已存在 id=1，同时发起 PATCH {"title":"并发更新后的标题文本"}
      与 PATCH {"priority":"HIGH"}
THEN  两个请求均返回 HTTP 200
AND   最终记录同时具备新的 title 与 "HIGH"
AND   不存在某一方的修改被另一方覆盖丢失
```

#### S-13 更新已完成记录
```
WHEN  已存在 id=1 且 done=true，请求 PATCH {"title":"已完成但仍可修改的标题"}
THEN  返回 HTTP 200，title 已更新
AND   done 仍为 true，其余字段不变
```

#### S-14 重复创建（非幂等）
```
WHEN  同一 POST 请求（相同 title）连续发送两次
THEN  两次均返回 HTTP 201
AND   产生两条独立记录，id 不同
AND   这是明确契约：创建不做去重，客户端需自行防重
```

#### S-15 重复更新（幂等）
```
WHEN  同一 PATCH 请求（相同 body）连续发送两次
THEN  两次均返回 HTTP 200
AND   最终状态与只发送一次相同
```

### 2.2 异常路径

#### E-01 标题缺失或为 null
```
WHEN  创建时 body 为 {} 或 {"title":null}
      更新时 body 为 {"title":null}
THEN  返回 HTTP 400，body 为 {"code":"TITLE_BLANK","message":"..."}
AND   创建时不写库；更新时原记录不变
```

#### E-02 标题为空白
```
WHEN  title 为 ""、"   " 或 "\t\n"
THEN  返回 HTTP 400，code=TITLE_BLANK
AND   清单长度不变（更新场景下原记录不变）
```

#### E-03 标题超长
```
WHEN  title 经 trim 后长度 > 100 个 code point
THEN  返回 HTTP 400，code=TITLE_TOO_LONG
AND   清单长度不变（更新场景下原记录不变）
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
      或路径 id 超出 long 可表示范围（如 99999999999999999999）
THEN  返回 HTTP 400，code=INVALID_ID
AND   不发生任何状态变更
```
> 可表示但不存在（含 `0`、负数）归入 E-04 的 404，不归入本场景。

#### E-06 请求无法解析
```
WHEN  body 为空（0 字节）、不是合法 JSON、
      Content-Type 的媒体类型不是 application/json（允许 charset 等参数）、
      或 tags 数组中出现 null 元素
THEN  返回 HTTP 400，code=INVALID_REQUEST
AND   响应体仍为统一 ErrorResponse 结构
```

#### E-07 错误响应格式统一
```
WHEN  任一请求返回 4xx 或 5xx
THEN  响应体字段集合恰为 {code, message}，二者均必填，无其他字段
AND   字段名为 lowerCamelCase
AND   message 使用固定模板，不回显原始输入，长度 ≤ 200 字符
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
THEN  路径不存在时返回 HTTP 404，code=ROUTE_NOT_FOUND；
      方法不支持时返回 HTTP 405，code=METHOD_NOT_ALLOWED
AND   响应体使用统一 ErrorResponse 结构
```

#### E-10 更新不存在的待办
```
WHEN  请求 PATCH /api/todos/999，body 合法（如 {"priority":"HIGH"}），且 id=999 不存在
THEN  返回 HTTP 404，code=TODO_NOT_FOUND
AND   不执行 upsert（不会创建 id=999 或任何新记录）
AND   清单内容与顺序均不变
```

#### E-11 标题过短
```
WHEN  title 经 trim 后长度在 1..9 个 code point 之间（如 "买牛奶"）
THEN  返回 HTTP 400，code=TITLE_TOO_SHORT
AND   清单长度不变（更新场景下原记录不变）
```

#### E-12 标签数量超限
```
WHEN  tags 数组长度 > 5（如 ["工作","家庭","学习","健康","财务","旅行"]）
THEN  返回 HTTP 400，code=TAG_TOO_MANY
AND   清单长度不变（更新场景下原记录不变）
```

#### E-13 标签内容非法
```
WHEN  某个标签经 trim 后为空（如 "   "）
      或某个标签经 trim 后长度 > 20 个 code point
THEN  返回 HTTP 400：空标签为 TAG_BLANK，超长为 TAG_TOO_LONG
AND   整个请求失败，不做部分写入
```

#### E-14 标签重复
```
WHEN  tags 中存在 trim 后完全相同的元素（如 ["工作","工作"]）
THEN  返回 HTTP 400，code=TAG_DUPLICATE
AND   整个请求失败，不做部分写入
```

#### E-15 截止日期非法
```
WHEN  dueDate 不是 YYYY-MM-DD 格式（如 "2026/10/30"）、
      不是真实存在的日期（如 "2026-02-30"、"2026-04-31"、"2026-02-29"）、
      或年份超出 1970..2100
THEN  返回 HTTP 400，code=DUE_DATE_INVALID
AND   清单长度不变（更新场景下原记录不变）
```
> `2024-02-29` 是合法闰日，应接受（见 B-04）。

#### E-16 优先级非法
```
WHEN  priority 不在枚举内（如 "URGENT"、"high"）或为 null
THEN  返回 HTTP 400，code=PRIORITY_INVALID
AND   枚举值大小写敏感，小写不被接受
```

#### E-17 更新请求无可更新字段
```
WHEN  PATCH body 为 {}
THEN  返回 HTTP 400，code=NO_UPDATE_FIELDS
AND   不产生任何变更
```

#### E-18 校验顺序：载荷错误优先于 404
```
WHEN  请求 PATCH /api/todos/999（不存在），且 body 的 title 仅 5 个 code point
THEN  返回 HTTP 400，code=TITLE_TOO_SHORT
AND   不返回 404（字段校验先于资源存在性判断）
```

#### E-19 请求体包含不可更新字段
```
WHEN  创建或更新 body 中出现 id 或 done（如 {"done":true}）
THEN  返回 HTTP 400，code=FIELD_NOT_UPDATABLE
AND   不产生任何变更
AND   本错误优先于未知字段判定
```

#### E-20 请求体包含未声明字段
```
WHEN  创建或更新 body 中出现 3.2 / 3.3 未声明的字段（如 {"foo":1}）
THEN  返回 HTTP 400，code=UNKNOWN_FIELD
AND   不产生任何变更
```

#### E-21 请求体超过体积上限
```
WHEN  请求体大于 16KB
THEN  返回 HTTP 413，code=PAYLOAD_TOO_LARGE
AND   不解析业务字段、不产生任何变更
```

#### E-22 达到容量上限
```
WHEN  系统已有 10,000 条待办时再次创建
THEN  返回 HTTP 409，code=TODOS_LIMIT_REACHED
AND   清单长度不变；查询、完成、更新仍可用
```

### 2.3 边界与默认值

#### B-01 标题长度边界（成功侧）
```
WHEN  title 经 trim 后长度恰好为 10 或恰好为 100 个 code point
THEN  创建成功，返回 HTTP 201
AND   保存的标题与输入一致（trim 后）
```

#### B-02 重复标题
```
WHEN  连续创建两条 title 均为 "明天早上买牛奶和鸡蛋" 的待办
THEN  两次均返回 201，分配不同 id
AND   清单中存在两条独立记录
```

#### B-03 重启后数据清空
```
WHEN  服务重启后请求 GET /api/todos
THEN  返回 HTTP 200
AND   响应体为 []（内存存储，不做恢复）
AND   重启后 id 从 1 重新开始，客户端必须重新拉取
```

#### B-04 允许过去与闰日的截止日期
```
WHEN  创建时 dueDate 为 "2020-01-01" 或 "2024-02-29"（均早于今天）
THEN  返回 HTTP 201
AND   dueDate 原样保存，不报错、不自动修正
```

#### B-05 优先级缺省值
```
WHEN  创建时未提供 priority
THEN  返回 HTTP 201
AND   响应中 priority 为 "MEDIUM"
```

#### B-06 标题长度边界（失败侧）
```
WHEN  title 经 trim 后长度为 9 或 101 个 code point
THEN  分别返回 HTTP 400：9 为 TITLE_TOO_SHORT，101 为 TITLE_TOO_LONG
AND   不创建记录（更新场景下原记录不变）
```

---

## 3. 数据结构

### 3.1 Todo（响应实体）

| 字段 | JSON 类型 | Java / TS 类型 | 必填 | 约束 | 来源 |
|---|---|---|---|---|---|
| `id` | number | `long` / `number` | 是 | 正整数 ≥1；**进程内**单调递增；只读 | 服务端生成 |
| `title` | string | `String` / `string` | 是 | trim 后 10..100 code point，禁止纯空白 | 客户端输入 |
| `done` | boolean | `boolean` / `boolean` | 是 | 默认 `false`，只由 `/complete` 置为 `true` | 服务端维护 |
| `tags` | string[] | `List<String>` / `string[]` | 是 | 0..5 个；每个 trim 后 1..20 code point；trim 后不得重复；默认 `[]` | 客户端输入 |
| `dueDate` | string \| null | `LocalDate` / `string \| null` | 是 | `YYYY-MM-DD`，真实日期，年份 1970..2100；默认 `null`；允许过去 | 客户端输入 |
| `priority` | string | `String` / `'LOW' \| 'MEDIUM' \| 'HIGH'` | 是 | 枚举，大小写敏感；默认 `MEDIUM` | 客户端输入 |

**补充说明**
1. **长度计量**：所有"长度"均按 Unicode code point 计；服务端计数为唯一裁判；组合 emoji（ZWJ 序列）可能计为多个 code point，属已知限制。
2. **索引**：本期无二级索引——内存 Map 以 id 为键，查询为全量按 id 升序；若未来持久化，id 主键即可。
3. **id 生命周期**：仅在单次进程生命周期内递增且唯一；重启后从 1 重新开始，不得跨重启缓存。
4. 字段顺序不影响契约；前端 `number` 承载 int64，在本模块取值范围内安全。

### 3.2 CreateTodoRequest（创建请求体）

| 字段 | JSON 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| `title` | string | 是 | trim 后 10..100 code point | 超短 / 超长 / 空白均拒绝 |
| `tags` | string[] \| null | 否 | 默认 `[]`；`null` 等价于 `[]`；元素规则见 3.1 | 顺序保留 |
| `dueDate` | string \| null | 否 | 默认 `null`；格式、真实性与年份范围校验 | 纯日期，无时间与时区 |
| `priority` | string | 否 | 默认 `MEDIUM`；必须是枚举值 | `null` 非法 |

- 出现 `id` 或 `done` → `400 FIELD_NOT_UPDATABLE`。
- 出现其他未声明字段 → `400 UNKNOWN_FIELD`（严格模式，不静默忽略）。

### 3.3 UpdateTodoRequest（更新请求体，PATCH）

| 字段 | JSON 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| `title` | string | 否 | 提供则 trim 后 10..100 code point | `null` 非法 |
| `tags` | string[] \| null | 否 | 提供则**整体替换**；`null` 等价于 `[]` | 非增量合并 |
| `dueDate` | string \| null | 否 | 提供则校验格式；`null` 表示清除 | 纯日期 |
| `priority` | string | 否 | 提供则必须是枚举值 | `null` 非法 |

- **空对象 `{}`** → `400 NO_UPDATE_FIELDS`；仅含未知字段时返回 `UNKNOWN_FIELD`，含 `id` / `done` 时返回 `FIELD_NOT_UPDATABLE`，判定顺序见 3.6。
- 未提供的字段保持原值（部分更新语义）。
- 出现 `id` 或 `done` → `400 FIELD_NOT_UPDATABLE`；出现其他未声明字段 → `400 UNKNOWN_FIELD`。
- **必须区分「字段缺席」与「显式 null」**：建议用 `JsonNullable<T>` 或 `JsonNode` 手动解析；若实现无法区分，本契约视为未满足。
- 成功后返回**完整 Todo 对象**（与 create / complete 一致）。
- 允许更新已完成记录，`done` 状态不受影响。

### 3.4 ErrorResponse（错误响应体）

| 字段 | JSON 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| `code` | string | 是 | 大写下划线枚举，见 3.5 | 机器可读，前端据此分支 |
| `message` | string | 是 | 固定模板；不回显原始输入；≤200 字符；不含堆栈与内部实现 | 人类可读 |

响应体**恰含**这两个字段，不得附加 `path`、`timestamp`、`exception` 等框架默认字段。

### 3.5 HTTP 状态码与错误码

| HTTP | code | 触发场景 | 对应场景 |
|---|---|---|---|
| 200 | — | 查询成功、完成成功、更新成功 | S-01、S-04 ~ S-06、S-08 ~ S-10、S-12、S-13、S-15、B-03 |
| 201 | — | 创建成功 | S-02、S-03、S-07、S-11、S-14、B-01、B-02、B-04、B-05 |
| 400 | `TITLE_BLANK` | 标题缺失 / null / 空白 | E-01、E-02 |
| 400 | `TITLE_TOO_SHORT` | trim 后 1..9 code point | E-11、B-06 |
| 400 | `TITLE_TOO_LONG` | trim 后 > 100 code point | E-03、B-06 |
| 400 | `TAG_TOO_MANY` | tags 元素数量 > 5 | E-12 |
| 400 | `TAG_BLANK` | 某个标签 trim 后为空 | E-13 |
| 400 | `TAG_TOO_LONG` | 某个标签 trim 后 > 20 code point | E-13 |
| 400 | `TAG_DUPLICATE` | trim 后存在重复标签 | E-14 |
| 400 | `DUE_DATE_INVALID` | 非 `YYYY-MM-DD`、非法日期或年份越界 | E-15 |
| 400 | `PRIORITY_INVALID` | 不在枚举内或为 null | E-16 |
| 400 | `NO_UPDATE_FIELDS` | PATCH body 为空对象 `{}` | E-17 |
| 400 | `FIELD_NOT_UPDATABLE` | body 含 `id` / `done` | E-19 |
| 400 | `UNKNOWN_FIELD` | body 含未声明字段 | E-20 |
| 400 | `INVALID_ID` | 路径 id 非整数或超出 long 范围 | E-05 |
| 400 | `INVALID_REQUEST` | 空 body / JSON 非法 / 类型不匹配 / Content-Type 非 application/json | E-06 |
| 404 | `TODO_NOT_FOUND` | 目标 id 不存在（完成 / 更新） | E-04、E-10 |
| 404 | `ROUTE_NOT_FOUND` | 未定义的路径 | E-09 |
| 405 | `METHOD_NOT_ALLOWED` | 方法不支持 | E-09 |
| 409 | `TODOS_LIMIT_REACHED` | 总条数已达 10,000 | E-22 |
| 413 | `PAYLOAD_TOO_LARGE` | 请求体 > 16KB | E-21 |
| 500 | `INTERNAL_ERROR` | 未预期异常 | E-08 |

### 3.6 校验顺序

| 顺序 | 检查内容 | 失败返回 | 相关场景 |
|---|---|---|---|
| 1 | 体积：请求体是否 > 16KB | `413 PAYLOAD_TOO_LARGE` | E-21 |
| 2 | 可解析：JSON 合法、类型匹配、路径 id 为整数 | `400 INVALID_REQUEST` / `INVALID_ID` | E-05、E-06 |
| 3 | 字段约束：title / tags / dueDate / priority、不可更新字段、未知字段、PATCH 至少一个字段 | `400` 对应错误码 | E-01 ~ E-03、E-11 ~ E-20 |
| 4 | 资源存在性：目标 id 是否存在 | `404 TODO_NOT_FOUND` | E-04、E-10 |
| 5 | 业务规则：总条数是否已达上限 | `409 TODOS_LIMIT_REACHED` | E-22 |
| 6 | 执行 | 兜底 `500 INTERNAL_ERROR` | E-08 |

同一请求同时违反第 3、4 步时，返回第 3 步的 400，不返回 404（见 E-18）。

同一请求命中多个字段类错误时，按以下顺序取**首个**命中项（保证实现与测试有唯一答案）：

1. `FIELD_NOT_UPDATABLE`（`id` / `done`）
2. `UNKNOWN_FIELD`
3. `title`（`TITLE_BLANK` → `TITLE_TOO_SHORT` / `TITLE_TOO_LONG`）
4. `tags`（`TAG_TOO_MANY` → 按数组顺序的 `TAG_BLANK` / `TAG_TOO_LONG` → `TAG_DUPLICATE`）
5. `dueDate`（`DUE_DATE_INVALID`）
6. `priority`（`PRIORITY_INVALID`）
7. `NO_UPDATE_FIELDS`（仅当 body 中无任何声明字段，即 `{}`）

### 3.7 命名与一致性规则

1. JSON 字段名一律 **lowerCamelCase**，禁止 `snake_case`、`PascalCase`、短横线。
2. 前后端 `Todo` 字段必须逐字一致：`id`、`title`、`done`、`tags`、`dueDate`、`priority`。
3. 枚举值不属于字段名，统一大写：`LOW` / `MEDIUM` / `HIGH`。
4. 服务端 record 与前端 `interface` 同名字段，新增字段须同时改两侧，否则视为契约破坏。
5. `ErrorResponse` 的 `code`、`message` 同样适用本规则。

### 3.8 显式 null 与字段缺席语义

| 字段 | 创建：未提供 | 创建：显式 null | PATCH：未提供 | PATCH：显式 null | 类型错误 |
|---|---|---|---|---|---|
| `title` | `TITLE_BLANK` | `TITLE_BLANK` | 保持不变 | `TITLE_BLANK` | `INVALID_REQUEST` |
| `tags` | `[]` | `[]` | 保持不变 | `[]`（清空） | `INVALID_REQUEST` |
| `dueDate` | `null` | `null` | 保持不变 | 清除为 `null` | `INVALID_REQUEST` |
| `priority` | `MEDIUM` | `PRIORITY_INVALID` | 保持不变 | `PRIORITY_INVALID` | `INVALID_REQUEST` |

- `id`、`done` 出现在任何请求体中 → `FIELD_NOT_UPDATABLE`（优先于未知字段判定）。
- 其他未声明字段 → `UNKNOWN_FIELD`。
- `tags` 数组元素为 `null` → `INVALID_REQUEST`。

---

## 4. 验收标准

> 标记：**[M]** 可机械验证（接口测试 / 脚本）；**[H]** 需人工复核。
> 勾选前必须有证据；人工项须写明复核人与结论。

### 4.1 功能（正常路径）

- [ ] **AC-01 [M]** 空清单返回 `200` 且 body 为 `[]`（S-01）
- [ ] **AC-02 [M]** 创建返回 `201`，回显六个字段，默认值为 `false / [] / null / MEDIUM`（S-02）
- [ ] **AC-03 [M]** 标题首尾空白被 trim 后保存（S-03）
- [ ] **AC-04 [M]** 清单按 id 升序返回，更新不改变顺序（S-04）
- [ ] **AC-05 [M]** 完成后 `done=true`，其余字段不变（S-05）
- [ ] **AC-06 [M]** 重复完成返回 `200` 且不产生新记录（S-06）
- [ ] **AC-07 [M]** 创建带 tags / dueDate / priority 时回显正确：title 已 trim，tags trim 后保持输入顺序，dueDate 与 priority 原值（S-07）
- [ ] **AC-08 [M]** PATCH 只改提供的字段，未提供字段保持原值，响应为完整 Todo（S-08）
- [ ] **AC-09 [M]** `dueDate:null` 可清除截止日期，其余字段不变（S-09）
- [ ] **AC-10 [M]** PATCH tags 为整体替换而非合并（S-10）
- [ ] **AC-11 [M]** 并发 20 个 POST → 20 个 `201`、20 个唯一 id、GET 返回 20 条（S-11）
- [ ] **AC-12 [M]** 并发 PATCH 不同字段 → 两个修改都生效，无字段丢失（S-12）
- [ ] **AC-13 [M]** 已完成的记录仍可 PATCH，`done` 保持 true（S-13）
- [ ] **AC-14 [M]** 相同 POST 连发两次 → 2 条记录、id 不同（S-14）
- [ ] **AC-15 [M]** 相同 PATCH 连发两次 → 最终状态与一次相同（S-15）

### 4.2 异常路径

- [ ] **AC-16 [M]** 创建或更新时标题缺失 / null / 空白 → `400 TITLE_BLANK`，无写入（E-01、E-02）
- [ ] **AC-17 [M]** 标题 trim 后 1..9 → `400 TITLE_TOO_SHORT`（E-11）
- [ ] **AC-18 [M]** 标题 trim 后 > 100 → `400 TITLE_TOO_LONG`（E-03）
- [ ] **AC-19 [M]** tags 超过 5 个 → `400 TAG_TOO_MANY`（E-12）
- [ ] **AC-20 [M]** 标签空白 → `400 TAG_BLANK`（E-13）
- [ ] **AC-21 [M]** 标签单项 > 20 → `400 TAG_TOO_LONG`（E-13）
- [ ] **AC-22 [M]** 标签重复 → `400 TAG_DUPLICATE`（E-14）
- [ ] **AC-23 [M]** 截止日期格式错误 / 非真实日期 / 年份越界 → `400 DUE_DATE_INVALID`；`2024-02-29` 合法（E-15、B-04）
- [ ] **AC-24 [M]** 优先级非法（含小写、null）→ `400 PRIORITY_INVALID`（E-16）
- [ ] **AC-25 [M]** PATCH `{}` → `400 NO_UPDATE_FIELDS`（E-17）
- [ ] **AC-26 [M]** body 含 `id` 或 `done` → `400 FIELD_NOT_UPDATABLE`，且优先于未知字段（E-19）
- [ ] **AC-27 [M]** body 含未声明字段 → `400 UNKNOWN_FIELD`（E-20）
- [ ] **AC-28 [M]** 请求体 > 16KB → `413 PAYLOAD_TOO_LARGE`，不解析业务字段（E-21）
- [ ] **AC-29 [M]** 已达 10,000 条时创建 → `409 TODOS_LIMIT_REACHED`；查询/完成/更新不受影响（E-22）
- [ ] **AC-30 [M]** 完成不存在的 id → `404 TODO_NOT_FOUND`（E-04）
- [ ] **AC-31 [M]** 更新不存在的 id → `404 TODO_NOT_FOUND`，不 upsert、无变更（E-10）
- [ ] **AC-32 [M]** 非整数 id 或超出 long 范围 → `400 INVALID_ID`（E-05）
- [ ] **AC-33 [M]** 空 body / 非法 JSON / tags 含 null 元素 / Content-Type 非 application/json → `400 INVALID_REQUEST`，无写入（E-06）
- [ ] **AC-34 [M]** `Content-Type: application/json; charset=UTF-8` 的合法请求 → 正常 `201`，不被误判为媒体类型错误（E-06）
- [ ] **AC-35 [M]** 载荷非法优先于 404：不存在 id + 5 字符标题 → `400 TITLE_TOO_SHORT`（E-18）
- [ ] **AC-36 [M]** 所有 4xx/5xx 响应体字段集合**恰为** `{code,message}`；body 不匹配 `(?i)exception|stacktrace|at com\.|java\.|sql`；message ≤ 200 字符（E-07、E-08）
- [ ] **AC-37 [M]** 未定义路由 → `404 ROUTE_NOT_FOUND`；不支持的方法 → `405 METHOD_NOT_ALLOWED`；两者错误体统一（E-09）

### 4.3 契约一致性

- [ ] **AC-38 [M]** 所有响应 JSON 的 key 匹配 `^[a-z][a-zA-Z0-9]*$`（脚本扫描，命中 0）
- [ ] **AC-39 [M]** 契约测试断言 Todo 响应 key 集合恰为 `{id,title,done,tags,dueDate,priority}`；前端 `tsc --noEmit` 通过
- [ ] **AC-40 [H]** 后端 record 与前端 `interface` 逐字段复核一致（字段名、类型、可空性），复核人签字
- [ ] **AC-41 [M]** `ErrorResponse` 响应体恰含 `code`、`message` 两个字段，无第三个字段
- [ ] **AC-42 [H]** 前端按 `code` 映射用户文案；不得只显示 `请求失败：HTTP 400`

### 4.4 边界与工程闸门

- [ ] **AC-43 [M]** 标题长度恰好 10 或 100 时创建成功（B-01）
- [ ] **AC-44 [M]** 标题长度 9 → `TITLE_TOO_SHORT`；101 → `TITLE_TOO_LONG`（B-06）
- [ ] **AC-45 [M]** 同名待办可并存，id 不同（B-02）
- [ ] **AC-46 [M]** 重启后清单为空；重启后创建从 id=1 开始（B-03）
- [ ] **AC-47 [M]** 过去的 `dueDate` 与闰日 `2024-02-29` 均可正常保存（B-04）
- [ ] **AC-48 [M]** 未提供 priority 时默认为 `MEDIUM`（B-05）
- [ ] **AC-49 [M]** `powershell -File harness\run-all.ps1` 退出码为 `0`
- [ ] **AC-50 [M]** `application.yml` 中 `server.address` 为 `127.0.0.1`，启动日志绑定的地址与之相同（1.3）
- [ ] **AC-51 [M]** 预置 9,999 条后并发 10 个创建 → 恰好 1 个 `201`、9 个 `409`，总数为 10,000（E-22）

---

## 附录 A：与当前实现的差距

> 以下条目是「规格已定义、代码未实现」的部分。落地需走 OpenSpec change，
> 不得以「当前代码就是这样」为由改写规格（AGENTS.md 硬规则 2）。

| 差距 | 当前实现 | 规格目标 | 影响场景 |
|---|---|---|---|
| 无扩展字段 | 仅 `id/title/done` | 增加 `tags/dueDate/priority` | S-07、E-12 ~ E-16 |
| 无更新端点 | 不存在 `PATCH` | `PATCH /api/todos/{id}` + 404 + 字段校验 | S-08 ~ S-10、S-13、S-15、E-10、E-17、E-19 |
| 无标题长度约束 | 仅校验非空白 | 10..100 code point | E-03、E-11、B-01、B-06 |
| 无全局异常处理 | `IllegalArgumentException` 冒泡，返回 500 | 400 / 404 / 409 / 413 + `ErrorResponse` | E-01 ~ E-04、E-07、E-08、E-10 |
| 无「未找到」语义 | 未找到与参数错误同表现为 500 | `404 TODO_NOT_FOUND` | E-04、E-10 |
| 无 `INVALID_ID` 映射 | 非数字 id 由框架返回默认 400 体 | `400 INVALID_ID` + 统一体 | E-05 |
| 无统一错误体 | 框架默认错误 JSON | `{"code","message"}` | E-06 ~ E-09 |
| 无并发安全 | `sequence++` 非原子；`LinkedHashMap` 非线程安全 | 原子 id、原子读改写、并发不丢字段 | S-11、S-12、AC-11、AC-12 |
| 无容量 / 体积上限 | 无 | 10,000 条 / 16KB | E-21、E-22 |
| 无监听地址限制 | Spring 默认绑定 `0.0.0.0:8989` | `server.address: 127.0.0.1` | 1.3、AC-50 |
| 无未知字段 / 不可更新字段校验 | Jackson 默认忽略未知字段 | `400 UNKNOWN_FIELD` / `FIELD_NOT_UPDATABLE` | E-19、E-20 |
| 前端无扩展字段与校验 | 仅标题输入框，无长度校验 | 按本规格实现输入与回显 | S-07 ~ S-10、E-11 |
| 前端无错误码映射 | 仅显示 `请求失败：HTTP 400` | 按 `code` 映射文案 | AC-42 |

## 附录 B：落地路径

1. 立项 change（如 `define-todo-module-contract`），把本文件的 Scenario 转成 delta spec 的 `### Requirement` + `#### Scenario`。
2. 实现差距表中的 13 项，按依赖排序：监听地址收敛到 `127.0.0.1` → 统一错误体与全局异常处理 → 并发安全与 id 原子分配 → 扩展字段与 PATCH → 容量/体积与字段校验 → 前端字段与错误码映射。
3. 补齐接口测试，覆盖 E-01 ~ E-22、B-01 ~ B-06，以及 S-11 ~ S-15、E-22 的并发与幂等断言。
4. `harness\run-all.ps1` 退出码 0 后归档，本文档随即由主 spec 取代。

## 附录 C：变更记录

| 日期 | 版本 | 改了什么 | 为什么 |
|---|---|---|---|
| 2026-10-25 | v1.0 | 初稿，基于现有三操作（查询 / 创建 / 完成） | 建立契约基线 |
| 2026-10-25 | v1.1 | 增加 `tags` / `dueDate` / `priority` 与 `PATCH` 更新；标题下限改为 10；新增 E-10 ~ E-18、B-04 ~ B-05；验收标准重排 | 产品决策：支持标签、截止时间、优先级；最小标题 10 字符；明确更新不存在 id 的处理 |
| 2026-10-25 | v1.2 | 按安全 / 数据 / 灰色地带 / 异常 / 验收五维审查修复：补部署边界与限流归属、容量与体积上限、未知字段与不可更新字段校验、并发唯一性与原子性、absent/null 语义表、长度计量单位、日期年份范围、前端错误码映射；修正 200/201 交叉引用；验收加 `[M]/[H]` 标记并补并发 / 幂等 / 体积 / 容量项 | 消除规格自相矛盾与不可实现的契约，使每条验收可判定 |
| 2026-10-25 | v1.2.1 | 自查补漏：补未定义路由 / 方法的错误码（`ROUTE_NOT_FOUND` / `METHOD_NOT_ALLOWED`）并与 E-09、AC-37 对齐；3.5 的 200 映射补 B-03；拆分原 AC-33、AC-38 为单一断言并新增 charset 与人工复核项；AC-36 字段集合由 ⊆ 改为「恰为」；3.6 增加同层多错并存的判定顺序；E-05 覆盖 id 溢出；补 OUT-16 / OUT-17 与容量并发断言；附录 A 补监听地址差距（12 → 13 项），验收 47 → 51 条 | 消除「错误码必填但路由 404 无码」「一条验收含多个结论」「多字段非法时判定不唯一」三处不可测试的灰色地带 |
