---
kind: build_system
name: Harness 驱动的跨语言构建与闸门编排
category: build_system
scope:
    - '**'
source_files:
    - harness/run-all.ps1
    - harness/checks/00-submodule-check.ps1
    - harness/checks/01-compile.ps1
    - harness/checks/02-test.ps1
    - harness/checks/03-static-guard.ps1
    - harness/checks/04-frontend.ps1
    - harness/checks/05-scaffold-check.ps1
    - backend/pom.xml
    - frontend/package.json
    - frontend/Dockerfile
    - frontend/vitest.config.ts
---

## 1. 总体方案

仓库采用 **PowerShell Harness + 子模块** 的顶层编排模式：根目录不直接编译任何代码，而是通过 `harness/run-all.ps1` 按固定顺序调用 `harness/checks/00-*.ps1` 六个闸门脚本，每个子项目（backend/frontend）各自维护自己的构建系统（Maven / Next.js），Harness 仅负责编排、排序和退出码判定。

后端基于 Spring Boot 3.5.5 + Maven（`backend/pom.xml`），前端基于 Next.js 16 + Vitest（`frontend/package.json`），两者均作为 git submodule 挂载在根仓库下，由 `00-submodule-check.ps1` 校验 `.gitmodules` 中 `backend`、`frontend` 两个条目以及父仓库 gitlink 的一致性。

## 2. 关键文件

- `harness/run-all.ps1` — 总入口，扫描 `checks/*.ps1` 并按文件名排序执行，任一非零退出码即阻断。
- `harness/checks/00-submodule-check.ps1` — 校验 `.gitmodules`、gitlink mode=160000、HEAD 与父仓库一致。
- `harness/checks/01-compile.ps1` — `mvn -B -DskipTests compile`。
- `harness/checks/02-test.ps1` — `mvn -B test`（注释明确禁止 `-DskipTests`）。
- `harness/checks/03-static-guard.ps1` — 全文正则扫描 Java 与 TS/TSX 源文件。
- `harness/checks/04-frontend.ps1` — `npm ci → npm run build → npm run test` 三步链。
- `harness/checks/05-scaffold-check.ps1` — 临时副本演练 `scaffold/rename.mjs` 并扫描旧身份残留。
- `backend/pom.xml` — Spring Boot 3.5.5 父 POM，含 flyway-maven-plugin（仅迁移工具用途）。
- `frontend/package.json` — scripts: dev/build/start/test；engines.node >= 20.9.0。
- `frontend/Dockerfile` — 三阶段构建（deps/builder/runner），基于 node:24-alpine，输出 standalone 产物。
- `frontend/vitest.config.ts` — jsdom 环境，`passWithNoTests: true`。

## 3. 架构与约定

### 3.1 闸门顺序与失败语义
`run-all.ps1` 通过 `Get-ChildItem ... | Sort-Object Name` 加载检查，因此**新增闸门必须使用两位数字前缀**（如 `06-xxx.ps1`）才能进入正确顺序。默认行为是遇错即停（`if (-not $ContinueOnError) { break }`），支持 `-ContinueOnError` 参数跑完全部检查并汇总结果。

每个检查独立以 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File` 子进程执行，确保退出码互不污染。

### 3.2 六道闸门的职责划分
| 编号 | 名称 | 职责 |
|---|---|---|
| 00 | submodule-check | 只读校验子模块初始化与 gitlink 一致性，失败时输出修复命令 `git submodule update --init --recursive` |
| 01 | compile | 仅验证后端可编译，不运行测试 |
| 02 | test | 运行后端单元测试 + `@SpringBootTest` 容器装配 |
| 03 | static-guard | 静态红线扫描 |
| 04 | frontend | 依赖安装 + 生产构建 + 组件/代理测试 |
| 05 | scaffold-check | 改名脚手架演练 + 旧身份残留扫描 |

### 3.3 静态红线规则（03-static-guard.ps1）
对 `backend/src/**/*.java` 与 `frontend/**/*.{ts,tsx}`（排除 `node_modules/.next/dist`）逐行匹配：
- 禁止 TODO / FIXME / XXX 占位标记
- 禁止 `System.out.print*`
- 禁止 `@Disabled`（Java 测试）
- 禁止 `(it|describe|test).skip`、`xit`、`xdescribe`（前端测试）

### 3.4 子模块约束
`00-submodule-check.ps1` 强制要求：
- `.gitmodules` 存在且包含 `submodule.backend.path=url` 与 `submodule.frontend.path=url`
- 父仓库中对应路径必须是 gitlink（mode=160000）
- 子模块 HEAD 提交与父仓库记录的 gitlink 完全一致
- `backend/pom.xml` 与 `frontend/package.json` 必须存在（作为“已初始化”的 marker）

### 3.5 前端构建链
`04-frontend.ps1` 严格遵循 `npm ci → npm run build → npm run test` 三步，每一步都单独捕获 `$LASTEXITCODE` 并在失败时立即 exit 1。Next.js 的 `build` 同时承担 TypeScript 类型检查职责。

### 3.6 Docker 构建
`frontend/Dockerfile` 使用三阶段：
- deps：仅安装依赖（`package.json` + `package-lock.json`）
- builder：复制源码并 `npm run build`
- runner：基于 `node:24-alpine`，以非 root 用户 `nextjs` 运行 `.next/standalone/server.js`，暴露 3000 端口，`BACKEND_URL` 通过环境变量覆盖

### 3.7 工作区改名演练
`05-scaffold-check.ps1` 在 `/tmp/scaffold-check-{guid}/` 下复制仓库（排除 `.git/backend/frontend/openspec/docs/.idea/.vscode/.scaffold-tmp/target/node_modules/dist`），注入旧身份 token（`AIWorkSpace` / `ai-workspace`），执行 `node scaffold/rename.mjs --name scaffold-demo --display 'Scaffold Demo'`，然后断言 `.gitmodules` SHA256 未变化，并对除 `scaffold/`、`.gitmodules`、`harness/checks/05-scaffold-check.ps1` 外的所有文件扫描旧身份残留。

## 4. 约定与约束（规则级）

- **规则 1**：新增构建/检查步骤必须放在 `harness/checks/` 下并以两位数字命名，否则不会被 `run-all.ps1` 发现（由 `Sort-Object Name` + 文件名驱动）。来源：`harness/run-all.ps1` 第 36 行。
- **规则 2**：Harness 脚本不得进行交互式提问，所有失败均以非零退出码表达（由 `AGENTS.md §8` 约定引用于 04/05 号检查注释）。来源：`harness/checks/04-frontend.ps1` 与 `05-scaffold-check.ps1` 顶部注释。
- **规则 3**：后端测试不得被跳过——`mvn -DskipTests` 在 compile 阶段允许，但在 test 阶段被注释明确禁止。来源：`harness/checks/02-test.ps1` 注释。
- **规则 4**：源代码中不得出现 TODO/FIXME/XXX、`System.out.print`、`@Disabled` 以及前端测试的 skip/xit/xdescribe，否则静态红线失败。来源：`harness/checks/03-static-guard.ps1` 正则匹配逻辑。
- **规则 5**：子模块 `backend`、`frontend` 必须存在于 `.gitmodules` 且父仓库中以 gitlink（mode 160000）记录，HEAD 必须与 gitlink 一致。来源：`harness/checks/00-submodule-check.ps1` 第 28–79 行。
- **规则 6**：前端依赖安装必须使用 `npm ci`（而非 `npm install`），保证可复现。来源：`harness/checks/04-frontend.ps1` 第 11 行。
- **规则 7**：Node 版本下限为 `>=20.9.0`（`package.json` engines），Docker 镜像使用 `node:24-alpine`。来源：`frontend/package.json` 与 `frontend/Dockerfile`。
- **规则 8**：Docker 构建产物为 Next.js standalone 模式（`.next/standalone`），运行期通过 `BACKEND_URL` 环境变量指向后端服务地址。来源：`frontend/Dockerfile` 第 17–23 行。
- **规则 9**：`scaffold/rename.mjs` 不得修改 `.gitmodules`（子模块 URL 不属于工作区改名范围），改名演练后 `.gitmodules` 的 SHA256 必须保持不变。来源：`harness/checks/05-scaffold-check.ps1` 第 69–80 行。

## 5. 未见的内容

- 无 Makefile、无顶层 `build.sh`/`build.gradle`；构建入口仅为 PowerShell Harness。
- 无 GitHub Actions / GitLab CI 配置文件（`.github`、`.gitlab-ci.yml` 等），Harness 本身即为本地/CI 的统一入口。
- 无多平台交叉编译配置；后端目标 JDK 17（`pom.xml` properties.java.version），前端 Node ≥ 20.9.0。
- 无统一的版本号管理策略：后端为 `0.0.1-SNAPSHOT`，前端为 `0.0.0`，二者独立递增。
