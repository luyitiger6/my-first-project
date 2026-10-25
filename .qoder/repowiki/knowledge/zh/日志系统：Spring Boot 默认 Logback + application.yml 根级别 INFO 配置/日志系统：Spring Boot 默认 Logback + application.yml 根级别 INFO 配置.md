---
kind: logging_system
name: 日志系统：Spring Boot 默认 Logback + application.yml 根级别 INFO 配置
category: logging_system
scope:
    - '**'
source_files:
    - backend/src/main/resources/application.yml
    - backend/pom.xml
    - backend/src/main/java/com/luyi/myfirst/Application.java
    - backend/src/main/java/com/luyi/myfirst/web/TodoController.java
    - backend/src/main/java/com/luyi/myfirst/domain/TodoService.java
---

## 1. 使用的框架与工具

- **后端（backend）**：基于 Spring Boot 3.x，使用其内置的 **Logback** 作为日志实现（SLF4J API），通过 `application.yml` 中的 `logging.level.root: INFO` 启用默认控制台输出。仓库中未发现自定义 Logger 初始化、Logback XML/JSON 配置文件或第三方日志库依赖。
- **前端（frontend）**：Next.js 应用，代码中未引入任何结构化日志库（如 winston/pino）；调试输出走浏览器 `console.log` / Node 标准输出，无集中式日志配置。
- **Harness（harness）**：PowerShell 闸门脚本（`00-submodule-check.ps1` ~ `05-scaffold-check.ps1`、`run-all.ps1`）本身不产生结构化日志，仅通过 PowerShell 原生 `Write-Host` / `Exit` 表达执行状态。

## 2. 关键文件

- `backend/src/main/resources/application.yml`：唯一一处日志相关配置，声明 `logging.level.root: INFO`。
- `backend/pom.xml`：包含 Spring Boot Starter（隐含 SLF4J + Logback），未见额外 logging 依赖。
- `backend/src/main/java/com/luyi/myfirst/` 下的 `Application.java`、`TodoController.java`、`TodoService.java`：当前业务代码中**没有显式注入或使用 Logger**，因此运行时日志全部来自 Spring Boot 自身组件。

## 3. 架构与约定

- **最小化设计**：`application.yml` 顶部注释明确“不引入任何外部中间件，保证 mvn test / 启动开箱即用”，日志子系统也遵循同一原则——零配置扩展，仅保留根级别日志等级。
- **根级别统一控制**：所有包共享 `root: INFO` 等级，未为特定包（如 `com.luyi.myfirst`）设置差异化级别。
- **无结构化字段**：未发现 JSON 日志格式、traceId/spanId 注入、MDC 上下文等结构化日志实践。
- **无多 Sink**：未定义 file/console/appender 分离，也未接入 ELK/Loki 等远端收集器。

## 4. 约定与约束

- **观察到的约定**：后端日志通过 Spring Boot 默认 Logback 控制台 Appender 输出，等级为 INFO；业务类未直接记录日志，仅依赖框架自动产生的请求/错误日志。
- **由 Harness 间接约束的规则**：`harness/checks/02-test.ps1` 与 `01-compile.ps1` 在 CI 中运行后端构建与测试，结合 `application.yml` 顶部注释“Harness 约定：测试与构建阶段禁止依赖外部服务”，可推断日志输出不得依赖外部日志服务（如远程 HTTP collector），否则将破坏 Harness 的离线校验语义。
- **约束来源**：该规则并非由代码强制校验，而是由 `application.yml` 注释与 Harness 脚本共同体现的工程约定。

## 5. 结论

本仓库的日志系统是 Spring Boot 默认配置的极简形态：仅通过 `application.yml` 设置根日志等级为 INFO，无自定义 Logger、无结构化字段、无多 Sink、无外部日志采集集成。前后端均未引入独立日志框架，属于“无专门日志系统”的最小可行实现。