# Spec Delta

## Purpose

确立仓库级开发约定的放置与守卫方式：约定文档有唯一入口、只引用既有真源而不重述、明确区分现状与拟引入，且能被 harness 闸门机械校验。它是新增业务模块时 Agent 遵循规则的入口，而不是又一份无人执行的说明书。

## ADDED Requirements

### Requirement: 约定入口唯一且索引双向一致

`docs/conventions/README.md` MUST 是仓库内开发约定的唯一入口，并被 `AGENTS.md` 以路径形式引用。该索引 MUST 列出 `docs/conventions/` 下除自身以外的每一个 Markdown 文件，且列出的每个路径 MUST 真实存在。

#### Scenario: 索引与目录一致

- **WHEN** 执行 `11-conventions-check`
- **THEN** 索引列出的每个路径都存在，且目录下每个 Markdown 文件都在索引中出现，闸门退出码 `0`

#### Scenario: 新增约定文档未登记

- **WHEN** 在 `docs/conventions/` 下新增一个 Markdown 文件但未写进索引
- **THEN** `11-conventions-check` 退出码 `1`，并指出该文件名

#### Scenario: 索引登记了不存在的文件

- **WHEN** 索引里写了一个已被删除或从未存在的路径
- **THEN** `11-conventions-check` 退出码 `1`，并指出该路径

#### Scenario: 入口未挂到 AGENTS.md

- **WHEN** `AGENTS.md` 中不含指向 `docs/conventions/README.md` 的引用
- **THEN** `11-conventions-check` 退出码 `1`

### Requirement: 约定文档声明真源且不重述

每份约定文档 MUST 含二级标题为「真源声明」的小节，列出它引用而非重述的上游文档。该小节内以反引号给出且以 `/` 或 `.md` 结尾的仓库路径 MUST 真实存在。约定文档 MUST NOT 完整复制既有真源中的规则正文。

#### Scenario: 缺真源声明

- **WHEN** 某份约定文档没有「真源声明」小节
- **THEN** `11-conventions-check` 退出码 `1`，并指出该文件

#### Scenario: 真源声明的路径不存在

- **WHEN** 「真源声明」小节引用了 `docs/db-design-spec.md` 但该文件已被移动或删除
- **THEN** `11-conventions-check` 退出码 `1`，并指出失效路径

### Requirement: 依赖现状与拟引入双向零交集

每份约定文档 MUST 含二级标题为「依赖现状」与「拟引入」的两个小节。「依赖现状」小节提到的每一个库、框架或工具名 MUST 出现在 `frontend/package.json` 的 `dependencies` 或 `devDependencies`，或 `backend/pom.xml` 的依赖声明中；「拟引入」小节提到的每一个名字 MUST NOT 出现在上述任一处。

#### Scenario: 描述了仓库未引入的库

- **WHEN** 某份约定文档把 `Tailwind` 写进「依赖现状」小节，而 `frontend/package.json` 中不存在该依赖
- **THEN** `11-conventions-check` 退出码 `1`，并指出该名字

#### Scenario: 把已引入的库标成拟引入

- **WHEN** 某份约定文档把 `react` 写进「拟引入」小节，而它已在 `frontend/package.json` 的 `dependencies` 中
- **THEN** `11-conventions-check` 退出码 `1`

#### Scenario: 两个小节都缺

- **WHEN** 某份约定文档缺少「依赖现状」或「拟引入」任一小节
- **THEN** `11-conventions-check` 退出码 `1`

### Requirement: 约定文档登记机械守卫

每份约定文档 MUST 含二级标题为「机械守卫」的小节且内容非空，逐条给出该文件里哪些约定由哪道闸门守住。该小节内引用的闸门标识（`NN-<名字>` 形式）MUST 对应 `harness/checks/` 下真实存在的脚本。

#### Scenario: 引用了不存在的闸门

- **WHEN** 某份约定文档的「机械守卫」小节写了 `12-style-check`，而 `harness/checks/` 下没有该脚本
- **THEN** `11-conventions-check` 退出码 `1`

#### Scenario: 机械守卫小节为空

- **WHEN** 某份约定文档有「机械守卫」标题但其下没有任何条目
- **THEN** `11-conventions-check` 退出码 `1`

### Requirement: 新增闸门三处成对同步

在 `harness/checks/` 下新增 `NN-*.ps1` 时，同一次提交 MUST 同时更新 `AGENTS.md` 的 `<!-- harness-checks: ... -->` 标记与 §6 目录树中该闸门所在行。

#### Scenario: 新增闸门未改标记

- **WHEN** 新增 `11-conventions-check.ps1` 但未把它写进 `harness-checks` 标记
- **THEN** `07-doc-consistency` 退出码 `1`

#### Scenario: 新增闸门未改目录树

- **WHEN** 新增 `11-conventions-check.ps1` 但 `AGENTS.md` §6 目录树中没有该文件的行
- **THEN** `11-conventions-check` 退出码 `1`

### Requirement: 后端分层依赖方向单向

`dao/` 与 `service/` 下的 Java 源文件 MUST NOT import `com.luyi.myfirst.web.` 包下的类型；`common/` 下的 Java 源文件 MUST NOT import `com.luyi.myfirst.dao.`、`com.luyi.myfirst.service.` 或 `com.luyi.myfirst.web.` 包下的类型。

#### Scenario: dao 层引用 web 层

- **WHEN** `dao/` 下某个类出现 `import com.luyi.myfirst.web.` 的语句
- **THEN** `11-conventions-check` 退出码 `1`，并指出文件与行号

#### Scenario: common 层引用业务层

- **WHEN** `common/` 下某个类 import 了 `dao`、`service` 或 `web` 包中的类型
- **THEN** `11-conventions-check` 退出码 `1`

#### Scenario: 现有代码满足单向依赖

- **WHEN** 在未引入违规 import 的当前代码上执行 `11-conventions-check`
- **THEN** 这一项断言通过，闸门不因该规则报错
