# database-baseline Specification

## Purpose

为 AI 会话项目提供可审计的数据库结构基线与迁移验收：核心表由版本化迁移建立，Harness 在既有 MySQL 8 实例的专用 schema 上验证迁移可执行、结构正确且可重复执行。

## Requirements

### Requirement: 数据库结构由版本化迁移管理

数据库结构 SHALL 仅通过带版本号的迁移脚本变更；迁移历史 MUST 记录在数据库中，已成功应用的迁移 MUST NOT 被修改后重复执行。

#### Scenario: 空库迁移成功
- **WHEN** 在一个空的 MySQL 8 数据库上执行全部迁移
- **THEN** 迁移以退出码 0 结束，核心表与迁移历史表均存在，且历史记录标记为成功

#### Scenario: 重复执行无副作用
- **WHEN** 对已经完成迁移的数据库再次执行迁移
- **THEN** 已成功的版本不会被重复执行，命令仍以退出码 0 结束

#### Scenario: 迁移失败即阻断
- **WHEN** 任一迁移脚本执行报错
- **THEN** 迁移命令以非 0 退出码结束，且不会把该版本记录为成功

### Requirement: AI 会话核心表基线

第一条迁移 SHALL 建立 `users`、`conversations`、`messages`、`usage_records` 四张核心表，并包含主键、对外唯一标识、会话归属外键与消息顺序唯一约束。

#### Scenario: 核心表齐全
- **WHEN** 迁移执行完成后查询数据库元数据
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

### Requirement: Flyway 闸门纳入 Harness

Harness SHALL 提供独立的 Flyway 闸门，在既有 MySQL 8 实例的专用 schema 上执行迁移并校验结构；数据库不可达、凭据缺失或迁移失败时 MUST 以非 0 退出码结束，且 MUST NOT 静默跳过。

#### Scenario: 闸门通过
- **WHEN** 运行 `harness\run-all.ps1` 且 `127.0.0.1:8806` 的 MySQL 8 可连接、凭据可用
- **THEN** Flyway 闸门重建专用 schema `ai_chat_gate`、执行迁移、校验结构与幂等，并以退出码 0 结束

#### Scenario: 数据库不可达即失败
- **WHEN** `127.0.0.1:8806` 不可达，或未提供可用凭据
- **THEN** Flyway 闸门以非 0 退出码结束并输出明确原因，整体验收判定失败

#### Scenario: 迁移缺陷被拦截
- **WHEN** 迁移脚本存在语法错误或缺少核心表
- **THEN** Flyway 闸门以非 0 退出码结束并指出失败原因

#### Scenario: 不触碰既有业务库与容器
- **WHEN** Flyway 闸门执行结束，无论成功或失败
- **THEN** 未创建或删除任何容器，`green-note` 业务库的表集合保持不变，闸门只改专用 schema `ai_chat_gate`

### Requirement: 后端运行期不依赖数据库

本变更后，后端应用与单元测试 MUST NOT 依赖数据库连接；数据源与 JPA 接入属于后续独立变更。

#### Scenario: 单元测试不需要数据库
- **WHEN** 在未运行 MySQL 的机器上执行后端单元测试
- **THEN** 测试全部通过且退出码为 0

#### Scenario: 应用启动不需要数据源
- **WHEN** 在未配置数据库连接的情况下启动后端
- **THEN** 应用正常启动，Todo 接口仍按内存实现工作

#### Scenario: 编译与测试闸门不要求 Docker
- **WHEN** 单独运行 `01-compile.ps1` 或 `02-test.ps1`
- **THEN** 两个闸门均不要求 Docker 或 MySQL 实例
