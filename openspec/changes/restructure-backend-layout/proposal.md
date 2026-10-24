# Proposal

## Why

本仓库的目标形态是「前后端分离脚手架模板」：复制者 clone 后应得到一个 backend/ 与 frontend/ 分区清晰的工程。当前后端代码平铺在仓库根（根 pom.xml、根 src/），frontend/ 无处安放；若先引入前端再迁移结构，Harness 三个脚本的路径假设会与前端构建在同一时间点双重失效，故障面叠加、归因模糊。因此先做一次零功能变化的纯结构迁移：把后端收进 backend/，让三道闸门在迁移后立刻恢复绿色，为后续「frontend/ 模板」与「Harness 扩展」两个 change 铺平地基。

## What Changes

- 根 `pom.xml` 迁移至 `backend/pom.xml`
- 根 `src/main`、`src/test` 整体迁移至 `backend/src/`（Java 文件与资源内容不变）
- `harness/checks/01-compile.ps1`：Maven 调用改在 `backend/` 目录下执行
- `harness/checks/02-test.ps1`：Maven 调用改在 `backend/` 目录下执行
- `harness/checks/03-static-guard.ps1`：源码扫描根从仓库根改为 `backend/src`
- `AGENTS.md` 目录地图与命令速查、`README.md` 目录说明与快速开始命令同步更新（`mvn spring-boot:run` 改为在 `backend/` 下执行）
- 清理仓库根的过期构建产物目录 `target/`
- 服务监听端口由 8080 调整为 8989（`application.yml` 的 `server.port`）
- Java 包名由 `com.example.myfirstproject` 重命名为 `com.luyi.myfirst`（目录结构、package 声明、import 同步；pom `groupId` 由 `com.example` 对齐为 `com.luyi`，`artifactId` 保持不变）

除监听端口由 8080 调整为 8989 外，无 **BREAKING** 变更：对外 API（`/api/todos`）与依赖全部不变。端口属于运行配置，不改变 API 契约与业务行为，故本 change 仍不产生 delta spec。

## Capabilities

### New Capabilities

无

### Modified Capabilities

无

本 change 是纯结构迁移（重构 + 工具路径修正），不改变任何可观察行为，故在 `.openspec.yaml` 中声明 `skip_specs: true`，不产生 delta spec。

## Impact

- 代码：5 个 Java 文件迁入 `backend/` 且包名重命名为 `com.luyi.myfirst`；`application.yml` 随迁入 `backend/` 且端口调整为 8989
- 命名：pom `groupId` 由 `com.example` 对齐为 `com.luyi`；`artifactId` 保持不变
- 构建：Maven 工作目录由仓库根变为 `backend/`；`mvn spring-boot:run` 等命令需在 `backend/` 下执行
- 配置：`server.port` 由 8080 改为 8989；文档中所有访问地址同步更新
- 护栏：`harness/checks/` 三个脚本的路径假设全部更新
- 文档：`AGENTS.md` 目录地图与命令速查、`README.md` 目录说明与快速开始命令
- 依赖：无新增、无移除
