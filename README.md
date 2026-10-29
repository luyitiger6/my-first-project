# AIWorkSpace

**AIWorkSpace** 是一个把 **SDD + Harness + Skills** 三层落成真实目录的**顶层工作区**。
工作区自身只负责规格、护栏与技能；`backend/` 与 `frontend/` 作为两个独立 git 仓库以 **submodule** 挂载，
各自保留构建身份、提交历史与发布节奏。

不是业务项目，是**让 AI 编码变得可验证、可追溯、边界清晰的最小工程示范**。

## 三层是什么

| 层 | 目录 | 解决什么 |
|---|---|---|
| 工件层 | `openspec/` | AI 不知道「要做什么」→ 用规格固定意图 |
| 能力层 | `harness/` | 错了没人拦 → 用退出码行使否决权 |
| 行为层 | `.agents/skills/` | AI 不知道「怎么做才对」→ 用技能固化方法 |

三者是**乘法关系**：**结果 ≈ 规格质量 × 方法正确度 × 护栏有效度**，任一项为 0 则整体归零。

`backend/` 与 `frontend/` 不属于这三层，它们是被编排的两个独立仓库。

## 快速开始

```powershell
# 0. 克隆（连同两个子模块）
git clone --recurse-submodules <工作区仓库地址>
# 已有克隆但子模块为空时：
git submodule update --init --recursive

# 1. 验收当前代码是否健康（应该是 ALL CHECKS PASSED）
#    跑完整条闸门链；06 复用 127.0.0.1:8806 的 MySQL 8，09 复用 127.0.0.1:6606 的 Redis
powershell -File harness\run-all.ps1

# 只跑建表闸门（仍使用同一 8806 实例，操作 ai_chat_gate 与 wanderchain 两个专用 schema）
powershell -File harness\checks\06-schema-check.ps1

# 2. 启动后端服务（需先设置 WANDERCHAIN_DB_USER / WANDERCHAIN_DB_PASSWORD / WANDERCHAIN_REDIS_PASSWORD / WANDERCHAIN_JWT_SECRET）
mvn -f backend/pom.xml spring-boot:run
# 服务监听 http://localhost:8989

# 3. 启动前端（同源代理 /api → 8989）
cd frontend; npm ci; npm run dev
# 浏览器访问 http://localhost:3000

# 4. 提一个新需求（会生成规格，不写代码）
#    在 AI 工具里执行：/opsx:propose <一句话描述你要的能力>
```

## 工作区改名（clone 后第一步）

工作区把自身身份刻在 `AGENTS.md` 与 `README.md`（展示名 `AIWorkSpace`、slug `ai-workspace`），
分发出去的新工作区要先把它们换成自己的：

```powershell
node scaffold/rename.mjs --name <新 slug> --display "<新展示名>"
# 例：node scaffold/rename.mjs --name example-workspace --display "Example Workspace"
```

- `--name`：kebab-case slug（仓库与文档标识）
- `--display`：展示名，去空白后 1..60 字符
- 只改 `AGENTS.md` 与 `README.md`；不进入 `backend/`、`frontend/`，不改 `.gitmodules`
- 应用身份（Java 包名 / Maven artifactId / 前端包名）属于子模块，应在各自仓库内改名；脚本收到 `--package` 会直接拒绝
- 改名后运行 `powershell -File harness\run-all.ps1` 验收——闸门链含「改名演练 + 残留扫描」，模板态与已改名态都能跑
- 已改名仓库重复执行会被拒绝（需要 git 还原后再试）

## 工作流

```
propose（定规格）→ 人工审阅 → apply（实施）→ harness（验收）→ archive（归档）
```

其中 **人工审阅是唯一不可省略的环节**：代码可以让 AI 写，护栏可以让脚本跑，
但「这需求到底对不对」必须由人拍板。

## 目录

```
openspec/    规格与变更（proposal / specs / design / tasks / archive）
harness/     闸门链（按文件名顺序执行，遇错即停）：00-submodule-check → 01-compile → 02-test
             → 03-static-guard → 04-frontend → 05-scaffold-check → 06-schema-check
             → 07-doc-consistency → 08-spec-doc-breakpoints → 09-redis-check → 10-contract-check
scaffold/    工作区身份改名脚本（分发出去后第一步执行）
.agents/     两个技能：systematic-debugging、verification-before-completion
backend/     [submodule] 独立仓库：Spring Boot 后端（wanderchain 账户认证，Maven 项目根）
frontend/    [submodule] 独立仓库：Next.js 16 前端（wanderchain 首页 + 认证接入 + 同源 API 代理，npm 项目根）
.gitmodules  两个子模块的 URL（使用者可替换，工作区改名不触碰）
AGENTS.md    AI 的入口契约，先读这个
```

## 前置环境

- JDK 17+（本机 25 已验证可用）
- Maven 3.9+
- Node.js 20.19+（前端构建、`openspec` CLI 与工作区改名脚本需要；Next.js 16 的最低要求为 20.9.0）
- Git 2.x（子模块需要；新克隆用 `--recurse-submodules`）
- 可访问两个子模块远程仓库的网络与凭据（首次初始化子模块时使用）
- MySQL 8（默认 `127.0.0.1:8806`）的既有实例，两个库各归其主：`wanderchain` 供后端启动与 `02-test`（认证两表），`ai_chat_gate` 供 `06-schema-check` 做建表断言（AI 会话四表）；闸门不新建/删除容器，也不碰 `green-note` 业务库
- Redis 7（默认 `127.0.0.1:6606`，db 3）的既有实例：`09-redis-check` 验证可达、凭据正确、db 可选；后端运行期用它存图形码、注册码、登录失败计数与发码配额
- Docker CLI（可访问 8806 / 6606 容器，用于凭据发现与 `docker exec` 断言；或提供本机 `mysql` / `redis-cli` 客户端）

npm registry 提示：如默认源访问慢，可切换镜像（本机验证可用：`https://mirrors.tencent.com/npm/`），
但团队若自建私有源，以私有源为准，`package-lock.json` 会钉住版本不受源切换影响。

凭据按「谁读它」分三组，未设置时闸门会按表里的兜底顺序自己找：

| 使用者 | 变量（括号内为默认值） | 未设置时的兜底 |
|---|---|---|
| `06-schema-check` | `SCHEMA_DB_HOST`（`127.0.0.1`）/ `SCHEMA_DB_PORT`（`8806`）/ `SCHEMA_DB_USER`（`root`）/ `SCHEMA_DB_NAME`（`ai_chat_gate`）/ `SCHEMA_DB_PASSWORD` | 从发布 8806 的容器读 `MYSQL_ROOT_PASSWORD`；读不到即失败 |
| `09-redis-check` | `SCHEMA_REDIS_HOST`（`127.0.0.1`）/ `SCHEMA_REDIS_PORT`（`6606`）/ `SCHEMA_REDIS_DB`（`3`）/ `SCHEMA_REDIS_PASSWORD` | 从 6606 容器启动命令的 `--requirepass` 解析 |
| 后端启动与 `02-test` | `WANDERCHAIN_DB_USER`（`root`）/ `WANDERCHAIN_DB_PASSWORD` / `WANDERCHAIN_REDIS_PASSWORD` / `WANDERCHAIN_JWT_SECRET` | 两个密码从容器发现（Redis 空密码是合法部署），JWT 用测试专用默认值 |

`SCHEMA_DB_NAME` 只影响 `ai_chat_gate`（可换成 `ai_chat_gate_<suffix>` 做并行验证），`wanderchain` 是写死的。

`01` / `04` / `10` 不依赖数据库与缓存（`10` 只做文本解析）；`02` / `06` / `09` 与后端启动都依赖上表实例，连不上即非 0 退出。预检：

```powershell
Test-NetConnection 127.0.0.1 -Port 8806   # 或 docker ps --filter publish=8806
Test-NetConnection 127.0.0.1 -Port 6606   # 或 docker ps --filter publish=6606
```

## 设计取舍

- **前后端用 submodule 而非普通目录**：两个应用要独立提交、独立发布；工作区用 gitlink 锁版本，克隆可复现。代价是新克隆必须先初始化子模块，所以 00 闸门先于编译执行。
- **工作区身份与应用身份分离**：工作区改名只改两份文档，不进入子模块；应用身份改名在各自仓库内完成。
- **运行期依赖两个既有实例**：后端启动与 `02-test` 直连 `127.0.0.1:8806` 的 `wanderchain` 库与 `127.0.0.1:6606` 的 Redis（db 3），没有 H2 或嵌入式 Redis 兜底——生成列语义、唯一索引行为、Redis 原子脚本正是断言对象，替身测不出真实行为。代价是 `run-all` 依赖这两个实例与凭据。
- **业务收窄**：业务只保留 wanderchain 的账户认证子系统（注册、登录、登出、找回密码），用来承载护栏而不是撑功能广度——功能广度不是这个仓库的目标。
- **红线四条**：`TODO` 占位、`System.out`、`@Disabled`，以及前端跳过写法（`it.skip` 等）。由真实事故驱动增补，不预先设想。
- **字段名一致性交给闸门而不是人**：`10-contract-check` 解析后端 record 组件名与前端契约文件的 interface 字段名做双向比对。选文本解析而不是代码生成：生成器会把「两侧一致」变成「两侧同源」，一旦生成物被手改就无人发现；比对则保留两侧各自的写法自由，只钉住字段名。代价是它只认 record 与 interface 两种形状。
