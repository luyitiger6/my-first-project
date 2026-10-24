# Design

## Context

模板仓库中散布着三类模板作者身份标识，盘点结果（apply 时以 grep 复核）：

- `my-first-project`：项目名 / Maven artifactId / `spring.application.name` / README 与 AGENTS.md 中的引用
- `com.luyi`：Maven groupId 与 Java 包名前缀
- `myfirst`：Java 包名末段（目录 `com/luyi/myfirst` 两处：main 与 test）

命中文件 10 个：`AGENTS.md`、`README.md`、`backend/pom.xml`、`backend/src/main/resources/application.yml`、6 个 Java 文件；另需重命名 2 个包目录路径。

## Goals

- 使用者 clone 后一条命令完成全部替换，漏一处就能被机器发现
- 模板仓库自身（未改名）跑 `run-all.ps1` 必须保持全绿——05 闸门采用「临时目录演练」而非「扫描本仓库」
- 不改 `run-all.ps1`（AGENTS.md §8：新闸门按文件名排序自动接入）

## Decisions

### D1: 改名脚本用 Node（.mjs），不用 PowerShell
跨平台是模板分发的硬需求；Node 已在 README 前置环境中，无新增依赖。脚本为纯 Node 内置模块实现（fs/path/child_process），不引入 npm 依赖。

### D2: 脚本 API 为两个必需参数
`node scaffold/rename.mjs --name <新项目名> --package <新包名>`。新包名如 `com.acme.notes`：groupId 取去掉末段的前缀（`com.acme`），包目录为 `com/acme/notes`，artifactId 与 `spring.application.name` 用 `--name`。缺参数 → stderr 提示 + 退出码 1（对应 spec「参数缺失」Scenario）。

### D3: 改名脚本的替换清单显式写在脚本里
硬编码一个「旧名 → 新值」映射 + 文件清单，逐文件精确替换（不做全仓库盲替换，避免误伤 `openspec/changes/archive/` 里的历史工件与 .git）。目录重命名在文本替换之后执行。

### D4: 残留扫描用同一份旧名清单
残留扫描（05 闸门演练环节）只认三类旧名 token：`my-first-project`、`com.luyi`、`myfirst`，并排除 `.git/`、`target/`、`node_modules/`、`dist/`、`openspec/changes/archive/`。扫描命中即输出文件位置并以非 0 退出。

### D5: 05 闸门 = 临时目录演练
`harness/checks/05-scaffold-check.ps1` 流程：复制仓库（排除 `.git`、构建产物、`openspec/changes/archive/`）到临时目录 → 在副本中执行 `rename.mjs --name demo-app --package com.demo.app` → 在副本中执行残留扫描 → 清理临时目录 → 全过 exit 0，任一步失败 exit 1。这样模板自身（未改名）与改名后的使用者仓库都能过闸门。

### D6: 演练不含编译验证
05 闸门只验证「替换完整性」（文本 + 残留扫描），不在临时目录跑 mvn/npm 编译——闸门要快且不依赖演练环境；改名后编译是否通过由使用者本地的 `run-all.ps1` 四闸门兜底（改名后仓库跑 run-all 是 README 指引的一部分）。

### D7: 归档工件不受改名影响
改名脚本跳过 `openspec/changes/archive/`：历史工件是审计证据，保留模板身份原文，不随新项目改名。

## Risks

- 新项目名/包名含特殊字符（空格、路径分隔符）会导致非法目录名——脚本做参数合法性校验（kebab-case / 点分小写），非法即退出码 1
- 演练复制仓库的成本随仓库变大而涨——当前仓库极小（排除构建产物后 < 1MB），可接受；接入大仓库后再评估
- 脚本替换清单与真实硬编码点可能漂移——05 闸门每轮 run-all 演练一次，漂移即被拦截（这正是加闸门的理由）

## Migration Plan

1. 实现 `scaffold/rename.mjs` 与 `harness/checks/05-scaffold-check.ps1`
2. 文档同步（README「模板改名」章节、AGENTS.md 目录地图与命令速查）
3. `run-all.ps1` 五闸门全绿（05 自动接入，不改总控）
4. 真实演练冒烟：临时目录改名后，检查关键文件内容与包目录结构，再以「改名后仓库跑 run-all」验证闸门对已改名仓库也友好
