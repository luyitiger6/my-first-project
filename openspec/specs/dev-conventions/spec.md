# dev-conventions Specification

## Purpose
确立仓库级开发约定的放置与守卫方式：约定文档有唯一入口、只引用既有真源而不重述、明确区分现状与拟引入，且能被 harness 闸门机械校验。它是新增业务模块时 Agent 遵循规则的入口，而不是又一份无人执行的说明书。

## Requirements

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

### Requirement: 后端分包约定默认平铺且按需聚合

后端开发约定 MUST 明确简单模块及简单功能默认在所属业务包内平铺；功能边界清晰、相关文件形成相对完整的一组且聚合能够降低定位和维护成本时，才允许考虑功能子包。约定 MUST NOT 将独立接口、数据表数量、未经确认的文件数量阈值或预想的未来增长作为单独触发条件。

#### Scenario: 简单认证功能保持平铺

- **WHEN** 开发者按约定扩展现有认证模块中的简单功能
- **THEN** 约定引导其复用模块已有职责目录，不因增加一个功能或服务接口就复制一套嵌套结构

#### Scenario: 复杂功能可以聚合

- **WHEN** 某功能有清晰边界和成组的专属文件，且设计能够说明平铺的实际定位困难及聚合收益
- **THEN** 约定允许提出功能子包方案，并在人工审阅通过后实施，不强制整个项目全部平铺

#### Scenario: 仅凭数量或独立接口不足以分包

- **WHEN** 分包理由仅为有独立接口、达到某个文件数量或将来可能变复杂
- **THEN** 该理由不满足约定，开发者保持平铺或补充实际边界与维护收益后提交审阅

### Requirement: 分包示例保留层职责而不要求目录镜像

后端开发约定 MUST 提供简单平铺与复杂聚合两类示例，说明统一的是职责和判断原则，而非目录数量。功能子包 MUST 仍属于原业务模块；约定 MUST NOT 要求每个子功能递归复制完整结构、各层同步创建同名子包或预建没有实际类型的空目录。

#### Scenario: 两种结构可以并存

- **WHEN** 阅读认证模块平铺与帖子互动聚合的示例
- **THEN** 两者均为允许的结构，不因目录深度不同就要求重构现有模块

#### Scenario: 服务聚合不强制持久化层跟随

- **WHEN** 某服务功能聚合为子包，而其持久化类型仍清晰地归属原业务模块
- **THEN** 约定不要求持久化层为保持外观一致而增加同名子包，也不要求每种互动继续向下拆分

### Requirement: 后端类型按所属边界定位

后端开发约定 MUST 区分持久化实体、服务入参与结果、HTTP 请求与响应，分别说明 dao 的 entity、service 的 model、web 的 dto 的归属。功能分包 MUST NOT 改变既有依赖方向；服务模型可以供控制器调用服务时使用，但不能因此迁入 web 导致 service 反向依赖 web。约定 MUST NOT 将这一项目布局宣称为所有架构的唯一合法形式。

#### Scenario: 服务输入与结果不属于 HTTP 入口

- **WHEN** 开发者查找服务调用所需的输入与返回类型
- **THEN** 约定指向该服务所属包的 model，并明确 HTTP 契约另在 web 的 dto，实体另在 dao 的 entity

#### Scenario: 功能聚合后类型仍按层归属

- **WHEN** 同一功能在服务层与 HTTP 层分别使用功能子包
- **THEN** 约定分别指向各层自己的 model 与 dto，不让服务引用 HTTP 请求或响应类型

### Requirement: 分包决策具有人工审阅依据

新增或加深功能子包时，约定 MUST 要求在相应 change 的设计中说明边界、代表性类型、平铺的实际问题、聚合后的定位收益及共享类型归属，并沿用人工审阅后实施的流程。缺少收益依据时 MUST 保持平铺；已记录设计或已归档的事实 MUST NOT 被单独当作用户明确批准某项设计的证据。

#### Scenario: 新增功能子包先记录理由

- **WHEN** Agent 准备把简单功能进一步拆成嵌套包
- **THEN** 约定要求先给出具体边界和维护收益供人工审阅，不能以结构完整或约定一致为由自行实施

### Requirement: 分包判断与机械守卫能力明确区分

约定入口与后端约定 MUST 区分可机械校验的结构及依赖约束和需人工判断的分包粒度。分包规则正文 MUST 有唯一维护位置；入口与其他约定仅引用，不复制全文。现有闸门通过 MUST NOT 被解释为已经验证业务复杂度或分包合理性。

#### Scenario: 读者能够找到规则与审阅方式

- **WHEN** 开发者从开发约定入口查阅包结构规则
- **THEN** 能定位后端约定中的规则正文、目录示例与人工审阅要求；可机械检查的项仍列出既有闸门及其真实覆盖范围

#### Scenario: 不夸大检查结果

- **WHEN** 现有约定检查通过
- **THEN** 仅能据此报告该检查所覆盖的文档自洽性与依赖方向结果，不能报告分包粒度已经获得自动验证
