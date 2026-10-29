# AGENTS.md

本文件是这个仓库对 AI 的**唯一入口契约**。任何 agent 进入本仓库，先读完这里再动手；与本文件冲突的即时指令，以本文件为准。

---

## 1. 这个项目是什么

**AIWorkSpace** 是一个顶层工作区：自身只沉淀**「AI 编码如何被约束」这件事如何变成可执行、可验证、可追溯的骨架**，
前端与后端则作为两个独立 git 仓库，以 **git submodule** 挂载在 `frontend/`、`backend/`，各自保留构建身份、提交历史与发布节奏。

工作区承载的业务是 **wanderchain**（以城市为单位的旅行社区），当前后端聚焦账号认证子系统；业务广度刻意收窄，真正要沉淀的是护栏本身。

一句话：**这个仓库的价值不在 backend/ 与 frontend/ 的代码，在护栏；也不在「管住两个应用」，在「让边界可验证」。**

## 2. 三层分工

| 层 | 目录 | 回答的问题 | 违背后果 |
|---|---|---|---|
| **工件层**（Spec） | `openspec/` | 要做什么、为什么做 | 需求漂移、无法审计 |
| **能力层**（Harness） | `harness/` | 合不合格 | 无人拦截，错误直接流入主干 |
| **行为层**（Skills） | `.agents/skills/` | 怎么干才专业 | 靠猜、靠试、靠嘴硬 |

三层是**乘法关系**：任何一层失效，整体归零。写再多文档、装再多技能，都替代不了一次真实的编译测试。

`backend/` 与 `frontend/` 不属于这三层，它们是被编排的两个独立仓库：工作区只用 gitlink 锁定它们的提交，不跟踪其文件内容。

## 3. 六条硬规则

1. **先规格后代码**：任何超过「改个拼写」的改动，必须先在 `openspec/changes/<change-id>/` 里有 proposal 与 tasks。没有 change 的编码视为越权。
2. **Spec 不能由实现者单方面修改**：实现过程中发现规格有误，应修改 proposal 并说明理由，不能悄悄把 spec 改成代码的样子。
3. **完成判定只看退出码**：`harness\run-all.ps1` 返回 0 才算完成。AI 的自我评价、代码行数、注释完整性都不构成完成证据。
4. **禁止伪造绿灯**：不许 `@Disabled`、不许 `it.skip` 等跳过写法、不许注释掉断言、不许 `-DskipTests`、不许留 `TODO/FIXME` 交付。第三道闸门会直接拦截。
5. **验收标准不能由实现者自己解释**：spec 里的 `Scenario` 就是验收标准，解释权归 spec，不归写代码的人。
6. **子模块边界**：`backend/`、`frontend/` 的改动必须先在对应子模块仓库内提交并推送，再回工作区提交新的 gitlink。工作区提交只包含自有文件、`.gitmodules` 与两个 gitlink；Harness 只读，不自动暂存、提交或推送任何仓库。

## 4. 标准工作流

```
⓪ 初始化（仅新克隆）
                git clone --recurse-submodules <工作区地址>
                或已有克隆：git submodule update --init --recursive
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

子模块未初始化时，00 闸门会让验收在编译之前失败——这是设计行为，不是环境故障。

## 5. 技能触发规则

| 场景 | 触发技能 | 强制程度 |
|---|---|---|
| 测试失败 / 报错 / 现象异常 | `systematic-debugging` | 强制，禁止先改代码 |
| 想说「完成了」 | `verification-before-completion` | 强制，禁止无证据声明 |
| 需要写新规格 | OpenSpec 内置 `openspec-propose` | 强制 |

技能不是建议，是流程的一部分。跳过技能等同于跳过检查。

上表两个自研强制技能（`systematic-debugging`、`verification-before-completion`）以 `.agents/skills/` 为编写真源，逐字节分发到 `.claude/skills/`、`.qoder/skills/`、`.opencode/skills/`，四个适配层的 agent 都能获得同等的文件级强化，不再依赖各自读 AGENTS.md 文字；分发关系与「先改真源再同步副本」的修订顺序见 §6。

## 6. 目录地图

```
ai-workspace/
├── AGENTS.md                  ← 你正在读的文件
├── README.md                  人看的快速上手
├── .gitmodules                两个子模块的 URL（使用者可替换；工作区改名不碰）
├── backend/  [submodule]      独立仓库：Spring Boot 3.5.5 / Java 17，wanderchain 账户认证（Maven 项目根）
│   ├── pom.xml                Maven 构建文件（web / JPA / MySQL / Redis / BCrypt / jjwt）
│   └── src/
│       ├── main/java/com/luyi/myfirst/
│       │   ├── Application.java
│       │   ├── common/enums/        账户状态枚举（三态 + 允许迁移表）
│       │   ├── common/exception/    错误码基类、认证错误枚举与业务异常
│       │   ├── common/id/           ULID 生成（账户与会话主键）
│       │   ├── common/security/     口令哈希抽象与 BCrypt 实现、强度规则
│       │   ├── common/web/          统一错误体与全局异常处理
│       │   ├── config/              wanderchain.auth 配置绑定、MVC 拦截器装配
│       │   ├── dao/auth/            entity / repository / converter（账户与会话持久化）
│       │   ├── service/auth/        接口，impl/ 实现，model/ 载体，support/ 支撑件
│       │   └── web/auth/            REST 控制器，dto/ 请求响应体，interceptor/ 认证拦截与来源校验
│       ├── main/resources/
│       │   ├── application.yml      数据源、Redis、wanderchain.auth 配置
│       │   ├── schema.sql           wanderchain 库建表（accounts / auth_sessions）
│       │   └── db/ai-chat/schema.sql  ai_chat_gate 库建表（AI 会话四表）
│       └── test/java/com/luyi/myfirst/  按被测类所在包放置的单元测试 + 容器装配契约测试
├── frontend/ [submodule]      独立仓库：Next.js 16 App Router + React 19 + TypeScript（npm 项目根）
│   ├── package.json           前端脚本（dev/build/start/test）与依赖
│   ├── Dockerfile             多阶段镜像（deps → builder → runner，非 root 运行）
│   ├── app/
│   │   ├── layout.tsx          根布局（语言、标题、全局样式、AuthProvider）
│   │   ├── page.tsx            首页（城市筛选 + 五个区块）
│   │   ├── login/ register/    登录与两步注册（图形码 → 邮箱码）
│   │   ├── community/ attractions/  板块占位页
│   │   └── api/[...path]/route.ts  同源 API 代理（运行期 BACKEND_URL）
│   ├── components/
│   │   ├── home/               功能导航、城市入口、AI 助手与三类内容区块
│   │   ├── auth/               认证 Provider、表单与账号菜单（会话只来自 /api/auth/me）
│   │   └── site/               页头、页脚与占位页
│   ├── lib/
│   │   ├── home/               类型契约、城市白名单、Mock 数据与仓储
│   │   ├── contracts/          后端 DTO 的镜像契约（字段名唯一真源，10 号闸门双向比对）
│   │   └── auth/               认证 HTTP 客户端与错误归一化
│   ├── vitest.config.ts        测试配置（vitest + jsdom）
│   └── vitest.setup.ts         jest-dom 断言扩展
├── openspec/                  【工件层】
│   ├── config.yaml              OpenSpec 配置（schema: spec-driven）
│   ├── specs/                   当前真相：已归档能力的需求描述
│   └── changes/                 在飞变更
│       └── archive/             历史变更（审计追踪 / 回滚依据）
├── harness/                   【能力层】
│   ├── run-all.ps1              总闸门，返回 0 或 1
│   └── checks/
│       ├── 00-submodule-check.ps1   子模块已初始化且 HEAD 与 gitlink 一致
│       ├── 01-compile.ps1       能不能编译
│       ├── 02-test.ps1          行为对不对 + 容器能不能装配
│       ├── 03-static-guard.ps1  有没有伪造绿灯
│       ├── 04-frontend.ps1      前端：npm ci → build → test
│       ├── 05-scaffold-check.ps1 工作区改名演练 + 残留扫描 + .gitmodules 完整性
│       ├── 06-schema-check.ps1   建表闸门：8806 既有 MySQL 8 + `ai_chat_gate` / `wanderchain` 两个 schema
│       ├── 07-doc-consistency.ps1 文档闸门清单与技术栈描述是否跟得上仓库现状
│       ├── 08-spec-doc-breakpoints.ps1 单元文档声明的断点与实际 CSS 媒体查询一致
│       ├── 09-redis-check.ps1    缓存闸门：6606 既有 Redis 可达、凭据正确、db 3 可选中
│       └── 10-contract-check.ps1 契约闸门：后端 record 组件名与前端契约字段名双向比对
├── scaffold/                  【工作区改名】
│   └── rename.mjs              分发后第一步执行：替换工作区展示名与 slug
├── .agents/skills/            【行为层】自研技能编写真源（source of truth），同目录也存放 openspec init 生成的 openspec-* 技能
│   ├── systematic-debugging/    四阶段根因法
│   └── verification-before-completion/  先证后宣布
└── .claude/ .qoder/ .opencode/ 各 AI 工具适配层：openspec-* 技能与 commands 由 openspec init 生成；
                                 上述两个自研技能在此为分发副本，内容与真源逐字节一致。
                                 修订顺序固定为「先改 .agents/skills/ 真源 → 再同步三处副本」，禁止直接改副本。
```

<!-- harness-checks: 00-submodule-check 01-compile 02-test 03-static-guard 04-frontend 05-scaffold-check 06-schema-check 07-doc-consistency 08-spec-doc-breakpoints 09-redis-check 10-contract-check -->

上面这行标记是**闸门清单的机器可读副本**：新增或删除闸门时同步更新，`07-doc-consistency.ps1` 会把它与 `harness/checks/*.ps1` 的实际文件比对，不一致直接退出码 1。

## 7. 命令速查

| 目的 | 命令 |
|---|---|
| 初始化子模块 | `git submodule update --init --recursive`（新克隆也可 `git clone --recurse-submodules <工作区地址>`） |
| 子模块状态 | `git submodule status`（行首 `-` 表示未初始化） |
| 替换子模块地址 | `git submodule set-url backend <新地址>`（`frontend` 同理），随后 `git submodule sync` |
| 一键验收 | `powershell -File harness\run-all.ps1` |
| 只查子模块 | `powershell -File harness\checks\00-submodule-check.ps1` |
| 只编译 | `powershell -File harness\checks\01-compile.ps1` |
| 只跑测试 | `powershell -File harness\checks\02-test.ps1` |
| 只查红线 | `powershell -File harness\checks\03-static-guard.ps1` |
| 只查前端 | `powershell -File harness\checks\04-frontend.ps1` |
| 只查改名 | `powershell -File harness\checks\05-scaffold-check.ps1` |
| 只查建表 | `powershell -File harness\checks\06-schema-check.ps1`（默认连 `127.0.0.1:8806` 的 `ai_chat_gate` 与 `wanderchain`） |
| 只查文档断点 | `powershell -File harness\checks\08-spec-doc-breakpoints.ps1` |
| 只查缓存 | `powershell -File harness\checks\09-redis-check.ps1`（默认连 `127.0.0.1:6606` 的 db 3） |
| 只查契约 | `powershell -File harness\checks\10-contract-check.ps1`（后端 `web/auth/dto` + `ErrorResponse` 对比 `frontend/lib/contracts/auth.ts`） |
| 预检 MySQL | `Test-NetConnection 127.0.0.1 -Port 8806`（或 `docker ps --filter publish=8806`） |
| 预检 Redis | `Test-NetConnection 127.0.0.1 -Port 6606`（或 `docker ps --filter publish=6606`） |
| 建表闸门凭据 | 设置 `SCHEMA_DB_PASSWORD`；未设置时若 8806 由 Docker 容器发布，闸门会从容器环境读取 root 密码 |
| 缓存闸门凭据 | 设置 `SCHEMA_REDIS_PASSWORD`；未设置时若 6606 由 Docker 容器发布，闸门会从容器启动命令里读取 `--requirepass` |
| 工作区改名 | `node scaffold/rename.mjs --name <新 slug> --display "<新展示名>"`（只改 AGENTS.md / README.md，改名后跑一键验收） |
| 启动服务 | `mvn -f backend/pom.xml spring-boot:run`（监听 `http://localhost:8989`；需先设置 DB / Redis / JWT 环境变量） |
| 前端开发 | `cd frontend; npm run dev`（访问 `http://localhost:3000`，`/api` 由 Route Handler 代理到 8989） |
| 前端构建 | `cd frontend; npm run build`（产物含 `.next/standalone`） |
| 前端测试 | `cd frontend; npm run test` |
| 前端生产启动 | `cd frontend; npm run build; npm run start`（先构建再以生产模式启动） |
| 新建变更 | `/opsx:propose <想法>` |
| 实施变更 | `/opsx:apply` |
| 归档变更 | `/opsx:archive` |
| 刷新 AI 指令 | `openspec update` |

## 8. 加新闸门的方式

在 `harness\checks/` 下新增一个 `NN-<名字>.ps1`，遵守两条约定即可自动接入：

- 通过则 `exit 0`，不通过则 `exit 1`
- 不做任何交互式提问（CI 与 agent 环境无法应答）

`run-all.ps1` 按文件名排序执行，遇错即停。不需要改总控脚本。

新增或删除闸门后，同步修改 §6 下的 `<!-- harness-checks: ... -->` 标记；`07-doc-consistency.ps1` 会把标记与实际文件集合比对，忘了改就会直接拦截。

`06-schema-check.ps1` 也遵守同一约定：它不新建或删除容器，只复用 `127.0.0.1:8806` 的既有 MySQL 8，在专用 schema `ai_chat_gate` 与 `wanderchain` 上执行建表脚本；`green-note` 业务库不在它的操作范围内。

## 9. 已知边界

- 运行期**依赖** `127.0.0.1:8806` 的 `wanderchain` 库与 `127.0.0.1:6606` 的 Redis（db 3）：两者不可达时启动即失败，不存在内存兜底。`mvn test` 直连真实实例而非 H2 / 嵌入式 Redis——生成列与唯一索引的语义本身就是断言对象，替身测不出真实行为。`06-schema-check` 复用同一 MySQL 实例，但只操作 `ai_chat_gate` 与 `wanderchain` 两个专用 schema；不新建/删除容器，不触碰 `green-note` 业务库。
- 建表由受版本控制的 DDL 脚本承担（`backend/src/main/resources/schema.sql` 与 `db/ai-chat/schema.sql`），应用启动时幂等执行，`ddl-auto=none`。本项目不做迁移：库里没有需要保住的数据，改结构直接 drop 重建，因此不引入迁移框架，也没有 `flyway_schema_history` 这类迁移账本。
- 静态红线目前四条：Java 的 TODO 占位、`System.out`、`@Disabled`，以及前端的 TODO 占位与跳过写法；由**真实事故驱动**增补，不预先设想。护栏每多一条，维护成本就多一分。
- `10-contract-check` 只覆盖**认证契约面**（后端 `web/auth/dto/*.java`、`common/web/ErrorResponse.java` 与前端 `lib/contracts/auth.ts`）；首页内容区块的本地 Mock 契约不在它的视野里。它是纯文本解析，不编译、不联网、不依赖 MySQL 与 Redis；解析不出任何形状时直接失败，不拿「两边都空」当相等。
- `openspec/specs/` 只收录**已归档**能力的规格；在飞变更的 delta 位于 `openspec/changes/<change-id>/specs/`。某能力在 `specs/` 中缺席只说明它尚未归档，不能据此推断仓库状态——真相随归档持续累积，本条描述不随归档数量改变。
- 子模块初始化需要访问两个远程仓库（网络与凭据）。00 闸门本身不联网、不自动初始化：未就绪时以退出码 1 失败并打印 `git submodule update --init --recursive`，这是护栏行为而非环境故障。
- 应用身份（Java 包名、Maven artifactId、前端包名）的改名职责在 `backend` / `frontend` 各自仓库内；工作区改名只改 `AGENTS.md` 与 `README.md`，不改 `.gitmodules`，也不改写子模块 URL。
