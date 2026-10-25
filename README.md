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
powershell -File harness\run-all.ps1

# 2. 启动后端服务
mvn -f backend/pom.xml spring-boot:run
# 浏览器 / curl 访问 http://localhost:8989/api/todos

# 3. 启动前端（同源代理 /api → 8989）
cd frontend; npm ci; npm run dev
# 浏览器访问 http://localhost:3000

# 4. 提一个新需求（会生成规格，不写代码）
#    在 AI 工具里执行：/opsx:propose 增加按完成状态过滤的查询
```

## 工作区改名（clone 后第一步）

工作区把自身身份刻在 `AGENTS.md` 与 `README.md`（展示名 `AIWorkSpace`、slug `ai-workspace`），
分发出去的新工作区要先把它们换成自己的：

```powershell
node scaffold/rename.mjs --name <新 slug> --display "<新展示名>"
# 例：node scaffold/rename.mjs --name todo-workbench --display "Todo Workbench"
```

- `--name`：kebab-case slug（仓库与文档标识）
- `--display`：展示名，去空白后 1..60 字符
- 只改 `AGENTS.md` 与 `README.md`；不进入 `backend/`、`frontend/`，不改 `.gitmodules`
- 应用身份（Java 包名 / Maven artifactId / 前端包名）属于子模块，应在各自仓库内改名；脚本收到 `--package` 会直接拒绝
- 改名后运行 `powershell -File harness\run-all.ps1` 验收——六道闸门含「改名演练 + 残留扫描」，模板态与已改名态都能跑
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
harness/     六道闸门：submodule → compile → test → static-guard → frontend → scaffold-check
scaffold/    工作区身份改名脚本（分发出去后第一步执行）
.agents/     两个技能：systematic-debugging、verification-before-completion
backend/     [submodule] 独立仓库：Spring Boot 后端（Todo 领域，Maven 项目根）
frontend/    [submodule] 独立仓库：Next.js 16 前端（Todo 界面 + 同源 API 代理，npm 项目根）
.gitmodules  两个子模块的 URL（使用者可替换，工作区改名不触碰）
AGENTS.md    AI 的入口契约，先读这个
```

## 前置环境

- JDK 17+（本机 25 已验证可用）
- Maven 3.9+
- Node.js 20.19+（前端构建、`openspec` CLI 与工作区改名脚本需要；Next.js 16 的最低要求为 20.9.0）
- Git 2.x（子模块需要；新克隆用 `--recurse-submodules`）
- 可访问两个子模块远程仓库的网络与凭据（首次初始化子模块时使用）

npm registry 提示：如默认源访问慢，可切换镜像（本机验证可用：`https://mirrors.tencent.com/npm/`），
但团队若自建私有源，以私有源为准，`package-lock.json` 会钉住版本不受源切换影响。

## 设计取舍

- **前后端用 submodule 而非普通目录**：两个应用要独立提交、独立发布；工作区用 gitlink 锁版本，克隆可复现。代价是新克隆必须先初始化子模块，所以 00 闸门先于编译执行。
- **工作区身份与应用身份分离**：工作区改名只改两份文档，不进入子模块；应用身份改名在各自仓库内完成。
- **不接数据库/缓存**：Harness 要求可重复，外部依赖越少抖动越小。接入后再把「起容器」补进闸门。
- **业务极简**：Todo 只是用来承载护栏的载体，不需要它复杂。
- **红线四条**：`TODO` 占位、`System.out`、`@Disabled`，以及前端跳过写法（`it.skip` 等）。由真实事故驱动增补，不预先设想。
