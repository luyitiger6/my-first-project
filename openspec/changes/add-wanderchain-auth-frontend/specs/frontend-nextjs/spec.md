# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: 认证契约与后端字段一致并纳入闸门

前端 MUST 在唯一一处声明认证接口的字段契约，字段名 MUST 与后端出站 DTO 的 record 组件名逐字相同，命名风格 MUST 为 camelCase。后端 MUST NOT 用注解改写 JSON 字段名。时间类字段 MUST 以 ISO-8601 字符串呈现，MUST NOT 被前端当作毫秒数值。该一致性 MUST 由 Harness 闸门校验：两侧字段集合不相等、命名风格不符、或后端出现字段改名注解时，闸门 MUST 以非 0 退出码结束。

#### Scenario: 字段集合逐字相同

- **WHEN** 运行契约闸门
- **THEN** 后端每个认证 DTO 的字段名集合与前端契约文件中同名接口的字段名集合完全相等，多一个或少一个都判失败

#### Scenario: 命名风格为 camelCase

- **WHEN** 运行契约闸门
- **THEN** 两侧字段名均匹配小写字母开头的驼峰形式，出现蛇形命名即判失败

#### Scenario: 后端不改写 JSON 字段名

- **WHEN** 后端认证 DTO 目录内出现字段改名注解
- **THEN** 契约闸门以非 0 退出码结束并指出位置

#### Scenario: 前端不得出现后端没有的字段

- **WHEN** 前端契约文件声明了后端不存在的接口或字段
- **THEN** 契约闸门以非 0 退出码结束，界面 MUST NOT 展示该字段
