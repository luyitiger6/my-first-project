# Design

## Context

当前布局：根 `pom.xml` + 根 `src/`，Harness 三个脚本以仓库根为锚点（01/02 在根目录执行 `mvn`，03 扫描根 `src`）。目标：后端整体收进 `backend/`，为 `frontend/` 让出仓库根。动机见 proposal.md - Why。

约束：

- 迁移后 `powershell -File harness\run-all.ps1` 必须退出码 0（护栏优先）
- 任何 Java 源码与配置内容不得改变
- 项目尚未纳入 git 版本控制（见 Risks）

## Goals / Non-Goals

**Goals:**

- 后端代码完整收进 `backend/`，Maven 生命周期在 `backend/` 内闭环
- 三道闸门在迁移后立刻全部变绿
- 文档中的命令与真实目录布局一致

**Non-Goals:**

- 不新增 `frontend/`（后续 change 的范围）
- 不新增 Harness 闸门、不改 `run-all.ps1`
- 不做 Maven 多模块化（双构建链方案下保持单 pom）
- 不执行 git init（另议）

## Decisions

**D1：pom 与 src 一并放入 `backend/`，仓库根不再留任何 Maven 痕迹**

- 理由：模板复制者视角下 `backend/` 自包含；仓库根留给 `frontend/`、`harness/`、`openspec/` 等工程化层。
- 备选：仅移动 src、保留根 pom —— 否决：pom 与 src 分离会使 `backend/` 名不副实，且后续 frontend 加入后根目录混乱。

**D2：01/02 脚本用 `Set-Location (Join-Path $projectRoot 'backend')` 切换工作目录，而非 `mvn -f backend\pom.xml`**

- 理由：脚本已有 `Set-Location` 模式，改动最小；`-f` 会改变 Maven 的 basedir 语义，部分插件（如资源路径解析）行为可能与现在不一致。工作目录法与迁移前行为严格等价。
- 备选：`mvn -f` 参数 —— 保留作为文档中的等价替代写法。

**D3：03 的扫描根改为 `Join-Path $projectRoot 'backend\src'`，红线逻辑本身不动**

- 理由：零行为变化的最小 diff。前端红线的对应物（console.log 等）留给后续「Harness 扩展」change。

**D4：文档命令统一以 `mvn -f backend/pom.xml spring-boot:run` 为主推，并注明进入 `backend/` 后可直接 `mvn spring-boot:run`**

- 理由：从仓库根一条命令可启动，符合现有 README 的「一条命令」体验。

**D5：迁移与脚本修改一次性完成，中途不运行 Harness**

- 理由：分阶段执行必然出现短暂红灯，且无信息量；以「全部改完 → run-all 退出码 0」作为唯一验收点。

## Risks / Trade-offs

- [项目无 git 版本控制，迁移是纯文件系统操作，出错无法回滚] → 执行移动前先在仓库外做一次完整备份，再开始迁移
- [根 `target/` 是旧构建产物，迁移后 Maven 会在 `backend/target` 重新生成，若不清理将长期并存两份] → tasks 显式包含删除根 `target/`
- [`AGENTS.md` 与 `README.md` 中路径描述分散多处，漏改一处会误导模板复制者] → tasks 逐条列全：AGENTS.md §6 目录地图、§7 命令速查；README 目录段与快速开始
- [`run-all.ps1` 锚定仓库根、以子进程调用 checks，理论上无需改动] → 验收时显式验证，若 run-all 有隐含路径假设则一并修正

## Migration Plan

1. 在仓库外做完整备份
2. 一次性执行 tasks 中的全部移动与修改
3. `powershell -File harness\run-all.ps1` → 退出码必须为 0
4. `mvn -f backend/pom.xml spring-boot:run` → 访问 `http://localhost:8080/api/todos` 正常
5. 删除根 `target/`，确认 Harness 再次全绿
