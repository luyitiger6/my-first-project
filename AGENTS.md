# AGENTS.md

本文件是这个仓库对 AI 的**唯一入口契约**。任何 agent 进入本仓库，先读完这里再动手；与本文件冲突的即时指令，以本文件为准。

---

## 1. 这个项目是什么

一个 Spring Boot 3.5.5 / Java 17 的最小工程。它的业务功能（待办事项）刻意做得极简，
真正要沉淀的是**「AI 编码如何被约束」这件事如何变成可执行、可验证、可追溯的骨架**。

一句话：**这个仓库的价值不在 backend/，在护栏。**

## 2. 三层分工

| 层 | 目录 | 回答的问题 | 违背后果 |
|---|---|---|---|
| **工件层**（Spec） | `openspec/` | 要做什么、为什么做 | 需求漂移、无法审计 |
| **能力层**（Harness） | `harness/` | 合不合格 | 无人拦截，错误直接流入主干 |
| **行为层**（Skills） | `.agents/skills/` | 怎么干才专业 | 靠猜、靠试、靠嘴硬 |

三层是**乘法关系**：任何一层失效，整体归零。写再多文档、装再多技能，都替代不了一次真实的编译测试。

## 3. 五条硬规则

1. **先规格后代码**：任何超过「改个拼写」的改动，必须先在 `openspec/changes/<change-id>/` 里有 proposal 与 tasks。没有 change 的编码视为越权。
2. **Spec 不能由实现者单方面修改**：实现过程中发现规格有误，应修改 proposal 并说明理由，不能悄悄把 spec 改成代码的样子。
3. **完成判定只看退出码**：`harness\run-all.ps1` 返回 0 才算完成。AI 的自我评价、代码行数、注释完整性都不构成完成证据。
4. **禁止伪造绿灯**：不许 `@Disabled`、不许注释掉断言、不许 `-DskipTests`、不许留 `TODO/FIXME` 交付。第三道闸门会直接拦截。
5. **验收标准不能由实现者自己解释**：spec 里的 `Scenario` 就是验收标准，解释权归 spec，不归写代码的人。

## 4. 标准工作流

```
① 探索（可选）  /opsx:explore
② 定规格        /opsx:propose <你的想法>
                ↓  产出 openspec/changes/<change-id>/
                ↓  proposal.md  specs/  design.md  tasks.md
                ↓  ⚠️ 人类必须在此审阅放行，这是唯一的强制人工卡点
③ 实施          /opsx:apply
                ↓  按 tasks.md 逐条推进，遇到异常触发 systematic-debugging
④ 验收          powershell -File harness\run-all.ps1
                ↓  退出码非 0 → 回到 ③，不许进入 ⑤
⑤ 归档          /opsx:archive
                ↓  change 移入 archive，specs/ 更新为新的真相
```

**第 ② 步是整条链路里唯一不可省略的人工节点。** 其余环节可以自动化，唯独「想做的东西对不对」不能让 AI 自己拍板。

## 5. 技能触发规则

| 场景 | 触发技能 | 强制程度 |
|---|---|---|
| 测试失败 / 报错 / 现象异常 | `systematic-debugging` | 强制，禁止先改代码 |
| 想说「完成了」 | `verification-before-completion` | 强制，禁止无证据声明 |
| 需要写新规格 | OpenSpec 内置 `openspec-propose` | 强制 |

技能不是建议，是流程的一部分。跳过技能等同于跳过检查。

## 6. 目录地图

```
my-first-project/
├── AGENTS.md                  ← 你正在读的文件
├── README.md                  人看的快速上手
├── backend/                   Spring Boot 3.5.5 / Java 17（Maven 项目根）
│   ├── pom.xml                Maven 构建文件
│   └── src/
│       ├── main/java/com/luyi/myfirst/
│       │   ├── Application.java
│       │   ├── domain/              Todo / TodoService
│       │   └── web/                 TodoController
│       └── test/java/com/luyi/myfirst/  单元测试 + 容器装配契约测试
├── frontend/                  Vue 3 + Vite + TypeScript（npm 项目根）
│   ├── package.json           前端脚本（dev/build/test）与依赖
│   └── src/
│       ├── main.ts             入口（最小挂载）
│       ├── api.ts              Todo API fetch 封装（/api/todos）
│       ├── App.vue             Todo 界面（列表 / 新增 / 完成）
│       └── App.spec.ts         组件测试（vitest + jsdom，mock api）
├── openspec/                  【工件层】
│   ├── config.yaml              OpenSpec 配置（schema: spec-driven）
│   ├── specs/                   当前真相：已归档能力的需求描述
│   └── changes/                 在飞变更
│       └── archive/             历史变更（审计追踪 / 回滚依据）
├── harness/                   【能力层】
│   ├── run-all.ps1              总闸门，返回 0 或 1
│   └── checks/
│       ├── 01-compile.ps1       能不能编译
│       ├── 02-test.ps1          行为对不对 + 容器能不能装配
│       ├── 03-static-guard.ps1  有没有伪造绿灯
│       ├── 04-frontend.ps1      前端：npm ci → build → test
│       └── 05-scaffold-check.ps1 模板改名演练 + 残留扫描
├── scaffold/                  【模板改名】
│   └── rename.mjs              分发后第一步执行：替换模板身份标识
├── .agents/skills/            【行为层】
│   ├── systematic-debugging/    四阶段根因法
│   └── verification-before-completion/  先证后宣布
└── .claude/ .qoder/ .opencode/ 各 AI 工具适配层（由 openspec init 生成）
```

## 7. 命令速查

| 目的 | 命令 |
|---|---|
| 一键验收 | `powershell -File harness\run-all.ps1` |
| 只编译 | `powershell -File harness\checks\01-compile.ps1` |
| 只跑测试 | `powershell -File harness\checks\02-test.ps1` |
| 只查红线 | `powershell -File harness\checks\03-static-guard.ps1` |
| 只查前端 | `powershell -File harness\checks\04-frontend.ps1` |
| 只查改名 | `powershell -File harness\checks\05-scaffold-check.ps1` |
| 模板改名 | `node scaffold/rename.mjs --name <新项目名> --package <新包名>`（改名后跑一键验收） |
| 启动服务 | `mvn -f backend/pom.xml spring-boot:run`（访问 `http://localhost:8989/api/todos`） |
| 前端开发 | `cd frontend; npm run dev`（开发代理 /api → 8989） |
| 前端构建 | `cd frontend; npm run build` |
| 前端测试 | `cd frontend; npm run test` |
| 新建变更 | `/opsx:propose <想法>` |
| 实施变更 | `/opsx:apply` |
| 归档变更 | `/opsx:archive` |
| 刷新 AI 指令 | `openspec update` |

## 8. 加新闸门的方式

在 `harness\checks/` 下新增一个 `NN-<名字>.ps1`，遵守两条约定即可自动接入：

- 通过则 `exit 0`，不通过则 `exit 1`
- 不做任何交互式提问（CI 与 agent 环境无法应答）

`run-all.ps1` 按文件名排序执行，遇错即停。不需要改总控脚本。

## 9. 已知边界

- 本骨架**不连接任何外部中间件**，保证 `mvn test` 在任何机器上可重复执行。接入数据库/缓存后，应把「起容器」也纳入 Harness，否则护栏会出现空洞。
- 静态红线目前只有三条，由**真实事故驱动**增补，不预先设想。护栏每多一条，维护成本就多一分。
- `openspec/specs/` 在第一次归档前是空的，这是正常的：真相从第一次变更开始积累。
