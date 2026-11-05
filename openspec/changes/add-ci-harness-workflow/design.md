# Design

## Context

现有十一道闸门全部是 PowerShell 脚本，按文件名排序由 `harness/run-all.ps1` 串行拉起。脚本当前只能在 Windows 上执行：

- `run-all.ps1` 第 54 行用 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File` 拉起每个子闸门；
- `05-scaffold-check.ps1` 第 73 行写死 `node.exe`。

三道闸门依赖真实中间件：`02-test` 的 `mvn test` 直连 `127.0.0.1:8806/wanderchain` 与 `127.0.0.1:6606` 的 db 3，`06-schema-check` 与 `09-redis-check` 同样按这两个地址探测。三道闸门都内置了「从发布端口的容器读出凭据」的兜底：02/06 读 `MYSQL_ROOT_PASSWORD`，02/09 读 Redis 启动命令里的 `--requirepass`。

数据库侧还有一个约束：`application.yml` 的 JDBC URL 不含 `createDatabaseIfNotExist`，而 `spring.sql.init.mode: always` 会在测试上下文启动时执行 `schema.sql`。因此 **CI 的 MySQL 必须先存在 `wanderchain` 库**，表可以由测试启动过程自己建。

两个子模块是公开仓库（匿名 HTTPS 可读），`actions/checkout` 用默认 token 就能递归检出到 gitlink 提交，不需要 PAT。

## Goals / Non-Goals

**Goals:**

- push 与 pull_request 都自动执行全量闸门，结果只看退出码。
- CI 自带 JDK 17、Maven、Node 20.9+、MySQL 8、Redis，不依赖 runner 预装状态。
- 同一份 `harness/` 脚本在 Windows 与 Linux 上执行，闸门集合、顺序与退出码语义一致。
- 全部依赖在 job 内临时创建，结束后随 runner 销毁，不触碰任何真实数据。

**Non-Goals:**

- 不做多 OS / 多 JDK 矩阵，不做测试分片与并行加速。
- 不做镜像构建、推送与部署流水线（与 `add-backend-container-deploy` 的 Non-Goal 一致）。
- 不做「按改动范围选择闸门」的增量执行器——那等于允许 CI 自行判断哪些护栏可以不跑。
- 不在版本库内配置分支保护；把 CI 设为必需检查属于 GitHub 仓库设置，需人工操作。

## Decisions

### D1 运行环境：`ubuntu-latest` + PowerShell 7，而不是 Windows runner

GitHub 托管的 Windows runner 只支持 Windows 容器，无法启动 `mysql:8.0` / `redis:7` 这类 Linux 镜像；而 `services` 容器同样只在 Linux runner 上受支持。02/06/09 必须要真实中间件，所以 Windows runner 上「全量闸门」根本不可达。

ubuntu runner 预装 PowerShell 7（`pwsh`）、Maven 与 Docker，且支持 `services`，是唯一能让十一门闸门全部真实执行的托管形态。

**备选：**
- **self-hosted Windows runner**：环境与本地完全一致、零脚本改动，但需要一台常驻机器与运维成本，且违背「托管 CI 开箱即用」的初衷。
- **windows-latest + 跳过 02/06/09**：直接违反「任一闸门非零即失败」与「禁止跳过」，等于把最核心的测试闸门摘掉，不可接受。

代价是必须做 D2 的两处跨平台适配。这两处改动都很小，且让脚本本身更通用，不是为 CI 特供的分支。

### D2 平台适配：按 PowerShell 版本判断宿主，而不是按 OS

`run-all.ps1` 用 `$PSVersionTable.PSEdition` 选择子进程可执行文件：

- Windows PowerShell 5.1（`Desktop`）→ `powershell.exe`，本地行为逐字节不变；
- PowerShell 7（`Core`，Windows 或 Linux）→ `pwsh`。

不用 `$IsWindows`，因为它在 PowerShell 5.1 里不存在（值为 `$null`），会让本地判断落到错误分支。用 PSEdition 判断则两个版本都稳定。

`05-scaffold-check.ps1` 的 `node.exe` 改为 `node`：Windows 上 `node` 经 `PATHEXT` 解析到 `node.exe`，Linux 上是原生可执行文件，一处写法两端通用。

**备选**：在 workflow 里把 `pwsh` 链接成 `powershell.exe` 骗过脚本。这会掩盖脚本的平台假设，且下一次有人改脚本时同样的坑会重来，不做。

### D3 外部依赖：GitHub `services`，口令用 CI 内临时值

`services` 由 GitHub 自动等待 healthcheck、自动收集日志、job 结束自动清理，比手工 `docker run` + 轮询就绪少一整套自研等待逻辑。

- MySQL：`mysql:8.0`，`ports: 8806:3306`，`MYSQL_ROOT_PASSWORD` 与 `MYSQL_DATABASE: wanderchain` 都用临时口令 / 库名。healthcheck 用 `mysqladmin ping` 并带同一临时口令。
- Redis：`redis:7`，`ports: 6606:6379`，**不设** `requirepass`。02 的注入逻辑对空密码显式放行（`-AllowEmpty`），09 无密码时直接 `PING`，两者都已支持。

**备选**：手工 `docker run`。能精确控制启动参数（如给 Redis 加 `--requirepass`），但要多写就绪等待与清理，且 services 已经覆盖同样能力。

`SCHEMA_DB_PASSWORD` 与 `WANDERCHAIN_DB_PASSWORD` 在 workflow 里显式设为同一临时口令，作为「容器发现」之外的双保险；Redis 侧不设密码变量。

### D4 检出：递归子模块 + 关闭凭据持久化

`actions/checkout@v4` 配 `submodules: recursive`，把两个子模块检出到 gitlink 指向的提交，00 闸门才能通过。`persist-credentials: false`：工作流不需要向任何仓库写回。

**备选**：手动 `git submodule update --init --recursive`。与 checkout 的内置能力重复，且会多一段失败重试逻辑。若将来子模块转为私有，需要换成带 PAT 的检出，属于已知升级点（见 Risks）。

### D5 缓存与超时：只缓存依赖，不缓存构建产物

`actions/setup-java` 开 `cache: maven`，`actions/setup-node` 开 `cache: npm` 并指向 `frontend/package-lock.json`。构建产物（`target/`、`.next/`）不缓存，因为它们比重新构建更容易产生假绿。

`timeout-minutes: 45`：后端 50+ 个测试类含多次 Spring 上下文装配，前端要跑 `npm ci` + Next 构建 + vitest；45 分钟是「够用但不至于挂死一小时」的折中值。

`concurrency` 按「工作流 + PR 编号或 ref」分组并 `cancel-in-progress: true`，连续推送时只保留最新一次运行，避免队列堆积。CI 环境是一次性的，取消不留下需要清理的状态。

### D6 脚本编码不在本次转换范围

`06-schema-check.ps1` 等脚本的中文注释使用非 UTF-8 编码保存。PowerShell 7 按 UTF-8 读取时，中文注释与部分日志会显示为乱码，但退出码语义不受影响。

不在本次顺手全量转码：那会把 diff 扩大到多个与 CI 接入无关的脚本，且没有任何行为收益。若实施时发现乱码导致语法错误（而非仅显示问题），再把对应文件按 UTF-8 BOM 重存，作为排障步骤处理。

## Risks / Trade-offs

- **`frontend/package-lock.json` 可能缺少 Linux 平台的 optional 依赖**（如 `@next/swc-linux-x64-gnu`）→ 首次 CI 的 `npm ci` 会失败。修复需要在 Linux 环境重新生成锁文件，那属于 `frontend` 子模块的改动，**超出本 change「不改子模块」的边界，必须先获得授权**。实施时先跑一次观察实际结果，不预先假设。
- **CI 空库上 `mvn test` 可能有隐式数据依赖** → 失败时按闸门输出定位，优先在 CI 侧补初始化（如 `MYSQL_DATABASE`），不动测试代码；确需改测试时另立 change。
- **子模块将来转私有** → 默认 token 拉不到，需要配置 PAT 或换 self-hosted runner。登记为升级点，不在本次处理。
- **脚本中文日志在 Linux 下乱码** → 只影响可读性，不影响退出码；按 D6 处理。
- **45 分钟超时可能不够** → 首次运行观察实际耗时，必要时上调；不上调闸门内容来「省时间」。
- **临时口令写在 workflow 明文里** → 它只对 job 内临时容器有效，job 结束即销毁，不是真实凭据；换成 secrets 反而会让 fork PR 无法执行。

## Migration Plan

1. 新增 `.github/workflows/harness.yml`，内容为 D1–D5 的落地。
2. 修改 `harness/run-all.ps1`（宿主选择）与 `harness/checks/05-scaffold-check.ps1`（`node`）。
3. 本地 Windows 执行一次受影响的单项闸门（`05-scaffold-check`）确认零回归；其余闸门本次未被改动逻辑，不重复全量验收。
4. 推送后观察首轮 CI：若失败，按闸门输出逐项修复；全绿后再报告「CI 接入完成」。
5. 回滚：删除 workflow 文件即可停用 CI；两处脚本适配保留也无副作用（Windows 行为不变）。
