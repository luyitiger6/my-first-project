---
kind: external_dependency
name: 后端框架：Spring Boot 3.5.5 / Java 17
slug: spring-boot
category: external_dependency
category_hints:
    - framework_behavior
scope:
    - '**'
---

### 角色与集成点
- 仅引入 `spring-boot-starter-web` 与 `spring-boot-starter-test`；当前业务为 Todo REST（`com.luyi.myfirst.web.TodoController` + `domain.TodoService`），端口 `8989`。
- 运行期不依赖任何外部中间件（`application.yml` 仅配置 server.port 与 logging level），保证 `mvn test` 可重复执行。

### 稳定约束
- 构建目标 JDK 17（注释说明本机用 JDK 25 编译）。
- 作为 AIWorkSpace 的「后端子模块」存在，工作区只以 gitlink 锁定其提交，不跟踪文件内容。
- 未来接入数据库时，应通过 Harness 新增闸门把容器装配纳入验收，避免护栏空洞。