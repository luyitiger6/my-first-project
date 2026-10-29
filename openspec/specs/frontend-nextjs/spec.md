# frontend-nextjs Specification

## Purpose

为长期运营的 wanderchain 提供 Next.js 前端半边：可独立构建为 Node 服务的 React 工程、以本地 Mock 契约为占位的内容首页（城市筛选、编辑推荐、热门帖子、热门景点、AI 助手入口与 Mock 认证），以及纳入 Harness 统一验收的前端验证链与静态红线。

## Requirements

### Requirement: Next.js 前端可独立构建

前端 SHALL 通过 npm 命令独立完成依赖安装与生产构建，产出 Next.js standalone 服务产物，且构建过程不依赖后端服务在线。

#### Scenario: 生产构建成功

- **WHEN** 在 `frontend/` 目录执行生产构建命令
- **THEN** 构建以退出码 0 结束，并产出 Next.js standalone 服务入口

#### Scenario: 构建不依赖后端运行

- **WHEN** 后端服务未启动时执行前端生产构建
- **THEN** 构建仍以退出码 0 结束

### Requirement: API 同源代理（运行期可切换）

浏览器对 `/api/*` 的请求 SHALL 由前端服务接收并转发至运行期配置的后端地址（默认 `http://localhost:8989`），开发与生产使用同一实现；代理 MUST 透传请求方法、请求体、状态码与响应体，且 MUST NOT 缓存上游响应。后端 MUST NOT 依赖开放跨域来源支撑前端调用。

代理 MUST 额外按白名单转发 `Cookie`、`Origin`、`Referer` 三个请求头：后端只从 cookie 读取令牌、并对写请求做来源校验，缺任一头都会让认证链路在端到端上静默失效。白名单之外的请求头 MUST NOT 转发，`Host` MUST NOT 转发。上游响应的 `Set-Cookie` MUST 逐条回传（多条 MUST NOT 合并为一条），`Retry-After` 与 `Content-Type` 维持既有透传行为。

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

#### Scenario: 认证请求头按白名单转发

- **WHEN** 浏览器带着 `Cookie`、`Origin`、`Referer` 经代理发起写请求
- **THEN** 这三个头原样出现在转发给后端的请求上，后端据此完成令牌读取与来源校验

#### Scenario: 白名单外的请求头不转发

- **WHEN** 浏览器请求携带 `Host` 或其它白名单外的头
- **THEN** 转发给后端的请求不含这些头，后端看到的 `Host` 由转发目标决定而非前端主机名

#### Scenario: 上游 Set-Cookie 逐条回传

- **WHEN** 后端在一个响应里下发多条 `Set-Cookie`
- **THEN** 浏览器收到同样数量的 `Set-Cookie` 条目，每条属性完整，未被逗号合并成一条

### Requirement: 前端测试链可执行

前端 SHALL 提供可通过退出码判定结果的自动化测试，覆盖首页各单元行为与代理转发规则（地址拼接、运行期切换、失败映射），且测试 MUST NOT 依赖后端进程运行。

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

### Requirement: 认证契约面作为 contract-consistency 的首个受管对象

前端 MUST 在唯一一处（`lib/contracts/auth.ts`）声明认证接口的字段契约；该文件与后端认证出站 DTO（`web/auth/dto/*.java`、`common/web/ErrorResponse.java`）构成 `contract-consistency` 能力所定义契约闸门的首个受管配对。字段名与类型双向一致、camelCase 强制、fail-closed 与受管清单可配置等规则均由 `contract-consistency` 规格描述，本能力 MUST NOT 另行重复定义；新增受管模块的方式以 `contract-consistency` 为准。

#### Scenario: 认证契约纳入统一契约闸门

- **WHEN** 运行 `contract-consistency` 定义的契约闸门
- **THEN** 前端认证契约文件与后端认证 DTO 作为一对受管对象参与字段名与类型双向比对，其判定规则以 `contract-consistency` 规格为准
