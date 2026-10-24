# my-first-project

一个把 **SDD + Harness + Skills** 三层落成真实目录的 Spring Boot 骨架。

不是业务项目，是**让 AI 编码变得可验证、可追溯的最小工程示范**。

## 三层是什么

| 层 | 目录 | 解决什么 |
|---|---|---|
| 工件层 | `openspec/` | AI 不知道「要做什么」→ 用规格固定意图 |
| 能力层 | `harness/` | 错了没人拦 → 用退出码行使否决权 |
| 行为层 | `.agents/skills/` | AI 不知道「怎么做才对」→ 用技能固化方法 |

三者是乘法关系：**结果 ≈ 规格质量 × 方法正确度 × 护栏有效度**，任一项为 0 则整体归零。

## 快速开始

```powershell
# 1. 验收当前代码是否健康（应该是 ALL CHECKS PASSED）
powershell -File harness\run-all.ps1

# 2. 启动后端服务
mvn -f backend/pom.xml spring-boot:run
# 浏览器 / curl 访问 http://localhost:8989/api/todos

# 3. 启动前端（开发代理 /api → 8989）
cd frontend; npm install; npm run dev
# 浏览器访问 http://localhost:5173

# 4. 提一个新需求（会生成规格，不写代码）
#    在 AI 工具里执行：/opsx:propose 增加按完成状态过滤的查询
```

## 模板改名（clone 后第一步）

仓库里刻着模板作者的项目身份（`my-first-project` / `com.luyi` / `myfirst`），
分发出去的新项目要先把它们换成自己的：

```powershell
node scaffold/rename.mjs --name <新项目名> --package <新包名>
# 例：node scaffold/rename.mjs --name order-service --package com.acme.order
```

- `--name`：kebab-case 项目名（Maven artifactId、Spring 应用名、文档标题）
- `--package`：点分小写的 Java 包名（至少两段；groupId 自动取去掉末段的前缀）
- 脚本只改 10 个模板身份文件与 2 个包目录，不碰 `openspec/` 历史工件与构建产物
- 改名后运行 `powershell -File harness\run-all.ps1` 验收——五道闸门含「改名演练 + 残留扫描」，漏改一处就会被拦下
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
harness/     五道闸门：compile → test → static-guard → frontend → scaffold-check
scaffold/    模板改名脚本（分发出去后第一步执行）
.agents/     两个技能：systematic-debugging、verification-before-completion
backend/     Spring Boot 后端（Todo 领域，Maven 项目根）
frontend/    Vue 3 前端（Todo 界面，npm 项目根）
AGENTS.md    AI 的入口契约，先读这个
```

## 前置环境

- JDK 17+（本机 25 已验证可用）
- Maven 3.9+
- Node.js 20.19+（前端构建 + `openspec` CLI + 模板改名脚本需要）

npm registry 提示：如默认源访问慢，可切换镜像（本机验证可用：`https://mirrors.tencent.com/npm/`），
但团队若自建私有源，以私有源为准，`package-lock.json` 会钉住版本不受源切换影响。

## 设计取舍

- **不接数据库/缓存**：Harness 要求可重复，外部依赖越少抖动越小。接入后再把「起容器」补进闸门。
- **业务极简**：Todo 只是用来承载护栏的载体，不需要它复杂。
- **红线只有三条**：TODO 占位、`System.out`、`@Disabled`。由真实事故驱动增补，不预先设想。
