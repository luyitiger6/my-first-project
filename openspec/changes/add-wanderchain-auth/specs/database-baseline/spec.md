# Spec Delta

## REMOVED Requirements

### Requirement: 数据库结构由版本化迁移管理

**Reason**: 本变更放弃迁移框架。库内没有需要保住的数据，改结构直接重建库，迁移工具的「演进时保住已有数据」这一全部价值在此不成立，只剩余维护成本。

**Migration**: 由「数据库结构由受版本控制的 DDL 脚本定义」承接。

### Requirement: Flyway 闸门纳入 Harness

**Reason**: Flyway 被移除，闸门不能再以 `flyway:migrate` 作为执行器。

**Migration**: 由「建表闸门纳入 Harness」承接——校验职责一字不变（表名、索引名、约束名、生成列、审计列、重复执行无副作用），只把执行器换成 mysql 客户端，并扩展为同时校验两个库。

### Requirement: 后端运行期不依赖数据库

**Reason**: 该要求与本次变更方向相反。认证需要账户、会话与吊销记录持久化，验证码、冷却与限流计数需要共享缓存；「不依赖数据库」意味着认证无法实现。

**Migration**: 由「后端运行期依赖数据库与缓存」承接，方向整体反转。`01-compile` 与 `02-test` 从此要求 MySQL 与 Redis 可达。

## ADDED Requirements

### Requirement: 数据库结构由受版本控制的 DDL 脚本定义

数据库结构 SHALL 由受版本控制的 DDL 脚本定义，脚本 MUST NOT 依赖迁移框架，且 MUST 幂等（重复执行无副作用）。本阶段库内无可保留数据，结构变更以重建库代替演进；一旦出现必须在生产保住的数据，该决定 MUST 重新评估而不是沿用默认。

#### Scenario: 空库建表成功

- **WHEN** 在空的 MySQL 8 库上执行对应库的 DDL 脚本
- **THEN** 执行以退出码 0 结束，目标表、索引与命名约束均存在

#### Scenario: 重复执行无副作用

- **WHEN** 对已建表的库再次执行同一份 DDL 脚本
- **THEN** 命令仍以退出码 0 结束，既有表结构与数据不变

#### Scenario: DDL 报错即阻断

- **WHEN** DDL 脚本存在语法错误、缺少表或缺少命名约束
- **THEN** 执行以非 0 退出码结束，且闸门判定失败并指出失败原因

### Requirement: 建表闸门纳入 Harness

Harness SHALL 提供独立的建表闸门，在既有 MySQL 8 实例上重建各项目专属 schema、执行对应 DDL 脚本并校验结构；数据库不可达、凭据缺失或建表失败时 MUST 以非 0 退出码结束，且 MUST NOT 静默跳过。

该闸门 MUST 覆盖本仓库全部专属 schema：AI 会话库 `ai_chat_gate` 与 wanderchain 库 `wanderchain`，两者各自独立重建与断言，互不影响。

#### Scenario: 闸门通过

- **WHEN** 运行 `harness\run-all.ps1` 且 `127.0.0.1:8806` 的 MySQL 8 可连接、凭据可用
- **THEN** 建表闸门重建两个专属 schema、各执行一次 DDL、校验结构与幂等，并以退出码 0 结束

#### Scenario: 数据库不可达即失败

- **WHEN** `127.0.0.1:8806` 不可达，或未提供可用凭据
- **THEN** 建表闸门以非 0 退出码结束并输出明确原因，整体验收判定失败

#### Scenario: 结构缺陷被拦截

- **WHEN** DDL 脚本存在语法错误、缺少核心表或缺少命名约束
- **THEN** 建表闸门以非 0 退出码结束并指出失败原因

#### Scenario: 生成列与唯一键确实生效

- **WHEN** 向未注销账户写入两条相同邮箱
- **THEN** 数据库以唯一键冲突拒绝第二条，证明 `active_email` 生成列参与的唯一键真实生效

#### Scenario: 不触碰既有业务库与容器

- **WHEN** 建表闸门执行结束，无论成功或失败
- **THEN** 未创建或删除任何容器，`green-note` 业务库的表集合保持不变

### Requirement: 后端运行期依赖数据库与缓存

后端应用 MUST 依赖 MySQL 与 Redis：账户、会话与吊销记录 MUST 持久化到 MySQL；图形码、注册码、重置码、重发冷却、邮箱发码日配额、登录失败计数与来源限流窗口 MUST 存放于 Redis。

应用启动时 MUST 通过 `schema.sql` 幂等建出所需表结构，且 MUST NOT 依赖 ORM 的自动建表；任一依赖不可达时 MUST 启动失败或使认证链路整体失败，MUST NOT 静默降级为内存实现。单元测试 MUST 连接真实实例，MUST NOT 用 H2 或嵌入式 Redis 替身——生成列与命名 CHECK 的语义只有真实 MySQL 能验证。

#### Scenario: 启动即建表

- **WHEN** 在空库上启动后端应用
- **THEN** 应用启动后表结构已由 `schema.sql` 建出，且无需人工执行任何建表命令

#### Scenario: 数据库不可达时启动失败

- **WHEN** 未配置数据源或 MySQL 不可达时启动后端
- **THEN** 启动以失败结束并输出明确原因，不以内存实现顶替

#### Scenario: 缓存不可达时认证链路失败

- **WHEN** Redis 不可达时调用注册或登录端点
- **THEN** 端点返回错误而非静默放行，且不写入任何绕过限流的状态

#### Scenario: 单元测试连接真实实例

- **WHEN** 执行后端单元测试
- **THEN** 测试连接 `127.0.0.1:8806` 与 `127.0.0.1:6606`，且对生成列与命名约束的断言在真实 MySQL 上执行

## MODIFIED Requirements

### Requirement: AI 会话核心表基线

AI 会话库的 DDL 脚本 SHALL 建立 `users`、`conversations`、`messages`、`usage_records` 四张核心表，并包含主键、对外唯一标识、会话归属外键与消息顺序唯一约束。

#### Scenario: 核心表齐全

- **WHEN** 建表完成后查询数据库元数据
- **THEN** 四张核心表全部存在，且每张表都有主键与创建时间字段

#### Scenario: 对外标识唯一

- **WHEN** 向同一张核心表插入两条相同的对外标识
- **THEN** 数据库以唯一键冲突拒绝第二条记录

#### Scenario: 消息顺序唯一

- **WHEN** 在同一会话中插入两条相同顺序号的消息
- **THEN** 数据库以唯一键冲突拒绝第二条记录

#### Scenario: 角色取值受控

- **WHEN** 插入角色不在 `system`、`user`、`assistant`、`tool` 之内的消息
- **THEN** 数据库以 CHECK 约束拒绝该记录

#### Scenario: 计数不可为负

- **WHEN** 插入 token 计数为负数的消息或用量记录
- **THEN** 数据库以 CHECK 约束拒绝该记录

#### Scenario: 会话归属受外键保护

- **WHEN** 插入一条引用不存在会话的消息
- **THEN** 数据库以外键约束拒绝该记录

#### Scenario: 会话列表与消息翻页有索引

- **WHEN** 查询数据库索引元数据
- **THEN** 会话按用户与最近活跃排序、消息按会话与主键翻页所需索引均存在
