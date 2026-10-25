# frontend-nextjs Specification

## Purpose

为长期运营的全栈工程提供 Next.js 前端半边：可独立构建为 Node 服务的 React 工程、可操作后端 Todo API 的最小界面，以及纳入 Harness 统一验收的前端验证链与静态红线。

## Requirements

### Requirement: Next.js 前端可独立构建

前端 SHALL 通过 npm 命令独立完成依赖安装与生产构建，产出 Next.js standalone 服务产物，且构建过程不依赖后端服务在线。

#### Scenario: 生产构建成功

- **WHEN** 在 `frontend/` 目录执行生产构建命令
- **THEN** 构建以退出码 0 结束，并产出 Next.js standalone 服务入口

#### Scenario: 构建不依赖后端运行

- **WHEN** 后端服务未启动时执行前端生产构建
- **THEN** 构建仍以退出码 0 结束

### Requirement: Todo 界面行为

前端界面 SHALL 支持展示、新增与完成待办事项，全部数据经后端 Todo API 读写，界面 MUST NOT 维护独立于后端的待办数据源。

#### Scenario: 列表展示

- **WHEN** 页面加载完成
- **THEN** 界面调用后端列表接口并展示全部待办事项

#### Scenario: 新增待办

- **WHEN** 用户输入标题并提交新增
- **THEN** 界面调用后端创建接口，并将新待办展示在列表中

#### Scenario: 完成待办

- **WHEN** 用户对某条待办执行完成操作
- **THEN** 界面调用后端完成接口，并将该条待办更新为已完成状态

#### Scenario: 请求失败提示

- **WHEN** 后端请求返回失败或网络不可达
- **THEN** 界面展示错误信息，且不清空已成功加载的列表

### Requirement: API 同源代理（运行期可切换）

浏览器对 `/api/*` 的请求 SHALL 由前端服务接收并转发至运行期配置的后端地址（默认 `http://localhost:8989`），开发与生产使用同一实现；代理 MUST 透传请求方法、请求体、状态码与响应体，且 MUST NOT 缓存上游响应。后端 MUST NOT 依赖开放跨域来源支撑前端调用。

#### Scenario: 同源转发

- **WHEN** 浏览器请求 `/api/todos`
- **THEN** 请求由前端服务处理，并被转发至当前配置的后端地址

#### Scenario: 运行期切换后端

- **WHEN** 修改 `BACKEND_URL` 并重启前端进程，且未重新构建产物
- **THEN** 后续 `/api/*` 请求被转发至新地址

#### Scenario: 请求语义透传

- **WHEN** 经代理发起列表、新增或完成请求
- **THEN** 请求方法、请求体、状态码与响应体与直连后端一致

#### Scenario: 不缓存上游响应

- **WHEN** 后端数据发生变化后经代理再次请求同一接口
- **THEN** 代理返回后端的最新数据，而非缓存结果

#### Scenario: 后端不可达

- **WHEN** 后端连接失败
- **THEN** 代理返回 502 状态码，界面展示错误信息

### Requirement: 前端测试链可执行

前端 SHALL 提供可通过退出码判定结果的自动化测试，覆盖 Todo 界面行为与代理转发规则（地址拼接、运行期切换、失败映射），且测试 MUST NOT 依赖后端进程运行。

#### Scenario: 测试全绿

- **WHEN** 在 `frontend/` 目录执行测试命令
- **THEN** 全部测试通过且命令退出码为 0

#### Scenario: 测试不依赖后端

- **WHEN** 后端服务未启动时执行前端测试
- **THEN** 测试仍可完成并以退出码 0 结束

#### Scenario: 代理规则被测试覆盖

- **WHEN** 执行前端测试命令
- **THEN** 代理的地址拼接、运行期切换与后端失败映射均有对应用例，且不启动后端进程

### Requirement: 前端验收闸门接入 Harness

Harness SHALL 将前端验证纳入统一验收，依赖安装、生产构建与测试任一失败即整体不合格。

#### Scenario: 前端闸门通过

- **WHEN** 运行 `harness\run-all.ps1`
- **THEN** 前端闸门依次执行依赖安装、生产构建与测试，全部通过时整体退出码为 0

#### Scenario: 前端闸门失败

- **WHEN** 前端依赖安装、构建或测试任一失败
- **THEN** 前端闸门以非 0 退出码结束，且 `run-all.ps1` 整体判定失败

### Requirement: 前端源码纳入静态红线

Harness 静态红线 SHALL 覆盖前端 TypeScript 源码，拦截占位标记与跳过测试写法；命中任一违规即整体不合格。

#### Scenario: 拦截占位标记

- **WHEN** 前端源码中出现 `TODO`、`FIXME` 或 `XXX` 占位标记
- **THEN** 静态红线闸门以非 0 退出码结束并列出违规位置

#### Scenario: 拦截跳过测试

- **WHEN** 前端测试中出现 `it.skip`、`describe.skip`、`xit` 或 `xdescribe` 等跳过写法
- **THEN** 静态红线闸门以非 0 退出码结束并列出违规位置

#### Scenario: 后端专属规则不误伤前端

- **WHEN** 静态红线扫描前端源码
- **THEN** 仅应用前端适用的红线规则，Java 专属规则不作用于前端文件
