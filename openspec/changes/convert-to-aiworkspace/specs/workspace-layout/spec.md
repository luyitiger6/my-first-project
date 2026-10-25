# Spec Delta

## Purpose

AIWorkSpace 顶层工作区把前端与后端作为两个独立 git 仓库以 submodule 方式挂载，自身只负责规格、护栏、技能与编排，使工作区与两个应用拥有互不污染的提交边界与可复现的验收入口。

## ADDED Requirements

### Requirement: 前后端以 git submodule 挂载

工作区 SHALL 在 `.gitmodules` 中声明 `backend` 与 `frontend` 两个子模块，父仓库 MUST 以 gitlink 记录它们的提交 SHA，MUST NOT 以普通文件条目跟踪子模块内容。

#### Scenario: 父仓库只记录 gitlink
- **WHEN** 在工作区根执行 `git ls-files --stage`
- **THEN** `backend` 与 `frontend` 的条目类型为 `160000`，且 `.gitmodules` 中存在对应的 path 与 url
- **AND** 父仓库索引中不存在以普通 blob 形式跟踪的 `backend/` 或 `frontend/` 文件

#### Scenario: 子模块保留独立历史
- **WHEN** 在 `backend` 或 `frontend` 内执行 `git log`
- **THEN** 输出为该子模块独立仓库的提交历史，而非工作区父仓库的历史

### Requirement: 子模块项目保留独立构建身份

`backend` SHALL 保留自身 Maven 项目根与 Java 包名，`frontend` SHALL 保留自身 npm 项目根与包名；工作区级改名 MUST NOT 修改两者的应用身份。

#### Scenario: 子模块可独立构建
- **WHEN** 分别以 `backend/pom.xml` 与 `frontend/package.json` 作为项目根执行构建
- **THEN** 两端均以退出码 0 完成，且不依赖父仓库的构建配置

#### Scenario: 工作区改名不影响应用身份
- **WHEN** 执行工作区身份改名后检查 `backend/pom.xml`、`spring.application.name`、Java 包目录与 `frontend/package.json`
- **THEN** 上述应用身份字段与改名前的值完全一致

### Requirement: 子模块未初始化时验收必须失败

Harness SHALL 在任何编译、测试或前端检查之前校验两个子模块已初始化且检出提交与父仓库记录的 gitlink 一致；校验 MUST NOT 自动联网、MUST NOT 交互提问。

#### Scenario: 子模块未初始化
- **WHEN** 全新克隆后未执行子模块初始化，直接运行 `harness\run-all.ps1`
- **THEN** 子模块检查以退出码 1 结束，并输出包含 `git submodule update --init --recursive` 的修复提示
- **AND** 后续编译、测试与前端检查不执行

#### Scenario: 子模块检出提交与 gitlink 不一致
- **WHEN** 子模块工作树检出的提交与父仓库记录的 gitlink 不同
- **THEN** 子模块检查以退出码 1 结束，并指出不一致的子模块路径

#### Scenario: 子模块就绪
- **WHEN** `.gitmodules` 存在、两个子模块工作树已初始化且检出提交与 gitlink 一致
- **THEN** 子模块检查以退出码 0 结束，后续闸门继续执行

### Requirement: 工作区与子模块的提交边界

工作区提交 SHALL 只包含工作区自有文件与子模块的 gitlink SHA；子模块内的代码改动 MUST 先在对应子模块仓库提交，Harness MUST NOT 自动暂存、提交或推送任何仓库。

#### Scenario: 子模块内存在未提交改动
- **WHEN** 在 `backend` 或 `frontend` 内修改文件但未在子模块仓库提交
- **THEN** 工作区 `git status` 仅显示该子模块为 modified，不显示具体文件差异
- **AND** 运行 Harness 不会自动提交该改动

#### Scenario: 更新子模块指针
- **WHEN** 子模块仓库产生新提交并在工作区记录新的 gitlink
- **THEN** 工作区提交只包含 `.gitmodules`（如 URL 变化）与新的 gitlink SHA，不包含子模块文件内容

### Requirement: 子模块远程地址可由模板使用者替换

工作区文档 SHALL 说明模板使用者如何把 `.gitmodules` 中的作者仓库地址替换为自己的仓库地址；工作区改名 MUST NOT 改写 `.gitmodules` 的 URL。

#### Scenario: 替换子模块地址
- **WHEN** 模板使用者对 `backend` 或 `frontend` 执行 `git submodule set-url` 并同步配置
- **THEN** `.gitmodules` 与子模块本地配置指向新地址，工作区其余文件无需改动

#### Scenario: 工作区改名后 URL 不变
- **WHEN** 执行工作区身份改名前后比较 `.gitmodules`
- **THEN** 文件内容逐字节一致
