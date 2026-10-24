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

# 2. 启动服务
mvn spring-boot:run
# 浏览器 / curl 访问 http://localhost:8080/api/todos

# 3. 提一个新需求（会生成规格，不写代码）
#    在 AI 工具里执行：/opsx:propose 增加按完成状态过滤的查询
```

## 工作流

```
propose（定规格）→ 人工审阅 → apply（实施）→ harness（验收）→ archive（归档）
```

其中 **人工审阅是唯一不可省略的环节**：代码可以让 AI 写，护栏可以让脚本跑，
但「这需求到底对不对」必须由人拍板。

## 目录

```
openspec/    规格与变更（proposal / specs / design / tasks / archive）
harness/     三道闸门：compile → test → static-guard
.agents/     两个技能：systematic-debugging、verification-before-completion
src/         Spring Boot 最小实现（Todo 领域）
AGENTS.md    AI 的入口契约，先读这个
```

## 前置环境

- JDK 17+（本机 25 已验证可用）
- Maven 3.9+
- Node.js 20.19+（仅 `openspec` CLI 需要）

## 设计取舍

- **不接数据库/缓存**：Harness 要求可重复，外部依赖越少抖动越小。接入后再把「起容器」补进闸门。
- **业务极简**：Todo 只是用来承载护栏的载体，不需要它复杂。
- **红线只有三条**：TODO 占位、`System.out`、`@Disabled`。由真实事故驱动增补，不预先设想。
