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

无 **BREAKING** 变更：对外 API（`/api/todos`）、端口（8080）、依赖与配置值全部不变，仅目录布局变化。

## Capabilities

### New Capabilities

无

### Modified Capabilities

无

本 change 是纯结构迁移（重构 + 工具路径修正），不改变任何可观察行为，故在 `.openspec.yaml` 中声明 `skip_specs: true`，不产生 delta spec。

## Impact

- 代码：5 个 Java 文件与 `application.yml` 位置变化，内容不变
- 构建：Maven 工作目录由仓库根变为 `backend/`；`mvn spring-boot:run` 等命令需在 `backend/` 下执行
- 护栏：`harness/checks/` 三个脚本的路径假设全部更新
- 文档：`AGENTS.md` 目录地图与命令速查、`README.md` 目录说明与快速开始命令
- 依赖：无新增、无移除
