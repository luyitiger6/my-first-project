# Spec Delta

## Purpose

为全栈脚手架模板提供前端半边：可独立构建的 Vue 3 工程、可操作后端 Todo API 的最小界面，以及可被 Harness 统一验收的前端验证链。

## ADDED Requirements

### Requirement: 前端模板可独立构建

前端模板 SHALL 可通过 npm 命令独立完成依赖安装与生产构建，产出可部署的静态产物。

#### Scenario: 生产构建成功
- **WHEN** 在 `frontend/` 目录执行生产构建命令
- **THEN** 构建以退出码 0 结束，并产出静态产物目录

### Requirement: Todo 界面行为

前端界面 SHALL 支持展示、新增与完成待办事项，并通过后端 API 持久化。

#### Scenario: 列表展示
- **WHEN** 页面加载完成
- **THEN** 界面从后端获取并展示全部待办事项

#### Scenario: 新增待办
- **WHEN** 用户输入标题并提交新增
- **THEN** 界面调用后端创建接口，并将新待办展示在列表中

#### Scenario: 完成待办
- **WHEN** 用户对某条待办执行完成操作
- **THEN** 界面调用后端完成接口，并将该条待办更新为已完成状态

### Requirement: 开发代理联通后端

前端开发模式 SHALL 将发往 `/api` 的请求转发至后端服务地址。

#### Scenario: 开发代理转发
- **WHEN** 开发模式下前端请求以 `/api` 开头的接口
- **THEN** 请求被转发至后端服务（默认 `http://localhost:8989`）

### Requirement: 前端测试链可执行

前端模板 SHALL 提供可通过退出码判定结果的自动化测试。

#### Scenario: 测试全绿
- **WHEN** 在 `frontend/` 目录执行测试命令
- **THEN** 全部测试通过且命令退出码为 0

### Requirement: 前端验收闸门接入 Harness

Harness SHALL 将前端验证纳入统一验收，依赖安装、构建与测试任一失败即整体不合格。

#### Scenario: 前端闸门通过
- **WHEN** 运行 `harness\run-all.ps1`
- **THEN** 前端闸门依次执行依赖安装、构建与测试，全部通过时整体退出码为 0

#### Scenario: 前端闸门失败
- **WHEN** 前端依赖安装、构建或测试任一失败
- **THEN** 前端闸门以非 0 退出码结束，且 `run-all.ps1` 整体判定失败
