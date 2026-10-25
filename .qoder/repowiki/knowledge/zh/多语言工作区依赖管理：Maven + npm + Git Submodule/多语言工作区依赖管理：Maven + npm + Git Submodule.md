---
kind: dependency_management
name: 多语言工作区依赖管理：Maven + npm + Git Submodule
category: dependency_management
scope:
    - '**'
source_files:
    - .gitmodules
    - backend/pom.xml
    - frontend/package.json
    - frontend/package-lock.json
---

## 1. 使用的系统与方式

本仓库是一个顶层编排型工作区，依赖管理按子项目拆分到各自的语言生态中：

- **后端（Java/Spring Boot）**：使用 Maven，通过 `spring-boot-starter-parent` BOM 统一管理 Spring 生态版本。
- **前端（Next.js/React）**：使用 npm，依赖声明在 `frontend/package.json`，锁定文件为 `frontend/package-lock.json`。
- **跨模块依赖**：`backend`、`frontend` 两个独立仓库以 **Git Submodule** 形式挂载到本仓库根目录。

## 2. 关键文件

- `.gitmodules` — 定义两个子模块的 URL 与路径映射。
- `backend/pom.xml` — Maven 项目描述，继承 `spring-boot-starter-parent:3.5.5`，仅声明 `spring-boot-starter-web` 与 `spring-boot-starter-test` 两个运行时依赖；Flyway 作为构建期插件引入（注释明确“只作为迁移工具使用：不引入运行期 flyway-core / DataSource / JPA”）。
- `frontend/package.json` — 声明 `next@16.4.3`、`react@19.3.1`、`react-dom@19.3.1` 三个运行时依赖，以及测试/类型相关 devDependencies。
- `frontend/package-lock.json` — npm 锁文件，固定第三方包精确版本。

## 3. 架构与约定

- **子模块隔离**：每个子项目维护自己的依赖清单，顶层不聚合 POM 或 workspace。`.gitmodules` 将 `backend` 指向 `https://github.com/luyitiger6/ai-workspace-backend`，`frontend` 指向 `https://github.com/luyitiger6/ai-workspace-frontend`。
- **Spring 版本收敛**：通过 `<parent>` 继承 Spring Boot 3.5.5，所有 Spring 生态依赖的版本由父 POM 的 dependencyManagement 决定，子 POM 不再显式写版本号。
- **JDK 约束**：`pom.xml` 中 `<java.version>17</java.version>`，但注释说明“适配本机 JDK 25”，实际构建由 Spring Boot 3.5.5 支持。
- **Node 引擎约束**：`package.json` 中 `engines.node = ">=20.9.0"`，强制安装环境满足最低版本。
- **开发期 vs 运行期依赖分离**：后端通过 Maven scope `test` 区分测试依赖；前端通过 `dependencies` 与 `devDependencies` 两组字段区分。

## 4. 约定与约束

- **依赖声明位置**：Java 依赖统一写在 `backend/pom.xml` 的 `<dependencies>` 块中，不在源码或其他文件中散落声明。
- **Spring 生态不直接指定版本**：除 Flyway 插件及其 MySQL 驱动（`flyway-maven-plugin:11.7.2`、`flyway-mysql:11.7.2`）外，所有 Spring 相关依赖均省略 `<version>`，由 parent BOM 管理。
- **Flyway 仅限构建期**：pom.xml 中 Flyway 配置位于 `<build><plugins>` 而非 `<dependencies>`，且注释明确禁止引入运行期依赖。
- **npm 依赖锁定**：前端使用 `package-lock.json` 锁定第三方包版本，提交时应随代码变更同步更新。
- **Node 版本下限**：`engines.node >= 20.9.0` 是硬性要求，低于该版本的 Node 不应被用于构建或运行前端。
- **私有仓库/代理**：未发现 `settings.xml`、`.npmrc`、`~/.m2/settings.xml` 或 `GOPRIVATE` 等私有源配置，依赖拉取走默认公共仓库（Maven Central / npm registry）。
- **无 vendoring**：未使用 Go modules vendor、Go dep、Bazel module 等 vendoring 策略；依赖由各语言包管理器在构建时从远程下载。