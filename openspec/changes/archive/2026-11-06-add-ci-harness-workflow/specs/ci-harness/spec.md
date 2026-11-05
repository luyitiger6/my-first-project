# Spec Delta

## Purpose

托管 CI 是 Harness 的自动按铃者：它在每次 push 与 pull request 时执行全部闸门，以退出码作为唯一判定，并临时供给闸门所需的 MySQL / Redis 与跨平台执行环境，使「护栏拥有否决权」不依赖任何人记得手动运行。

## ADDED Requirements

### Requirement: push 与 pull_request 触发全量闸门

托管 CI SHALL 在 `push` 与 `pull_request` 事件发生时执行工作区总闸门，覆盖 `harness/checks/` 下全部 `NN-*.ps1` 检查。CI MUST NOT 只执行闸门子集，也 MUST NOT 以「本次改动看起来不相关」为由跳过任何一道闸门。

#### Scenario: push 触发

- **WHEN** 任意提交被推送到工作区仓库的任意分支
- **THEN** 工作流被调度，并按文件名顺序执行全部闸门

#### Scenario: pull_request 触发

- **WHEN** 工作区仓库收到新的 pull request 或被推送新提交到已有 pull request
- **THEN** 工作流被调度，并执行与 push 完全相同的闸门集合

### Requirement: 退出码是唯一判定，禁止软通过

工作流 SHALL 以总闸门进程的退出码决定 job 结果。任一闸门非 0 退出时 job MUST 失败；工作流 MUST NOT 使用 `continue-on-error`、`-ContinueOnError`、`-DskipTests` 或任何吞掉退出码的写法。总闸门遇错即停时，未执行的闸门 MUST 视为未通过，不得报告为通过。

#### Scenario: 某道闸门失败

- **WHEN** 任意一道闸门以非 0 退出码结束
- **THEN** 工作流 job 以失败状态结束，并保留该闸门的控制台输出

#### Scenario: 全部闸门通过

- **WHEN** 全部闸门均以退出码 0 结束
- **THEN** 工作流 job 以成功状态结束

### Requirement: CI 临时供给闸门所需的外部依赖

CI 环境 SHALL 自行提供 `02-test`、`06-schema-check`、`09-redis-check` 所依赖的 MySQL 8 与 Redis 实例，监听地址与本地约定一致（`127.0.0.1:8806` 与 `127.0.0.1:6606`），并在 MySQL 中预先存在 `wanderchain` 库。依赖不可用时闸门 MUST 以失败结束，MUST NOT 降级为跳过、内存实现或假通过。

#### Scenario: 全新 runner 上执行依赖闸门

- **WHEN** 在没有任何本地中间件的新 runner 上运行工作流
- **THEN** 测试、建表与缓存三道闸门连接 CI 临时实例执行，不出现跳过标记

#### Scenario: 依赖未就绪

- **WHEN** MySQL 或 Redis 在闸门执行时不可达
- **THEN** 对应闸门以非 0 退出码结束，工作流失败

### Requirement: 子模块按 gitlink 检出且不被修改

CI SHALL 检出工作区仓库及其递归子模块，检出提交 MUST 与父仓库记录的 gitlink 一致；工作流 MUST NOT 在 `backend` 或 `frontend` 内写入、暂存、提交或推送任何内容。

#### Scenario: 子模块检出与 gitlink 一致

- **WHEN** 工作流检出完成并执行 `00-submodule-check`
- **THEN** 该闸门以退出码 0 结束，两个子模块的 HEAD 与 gitlink 相同

#### Scenario: 子模块未被检出

- **WHEN** 检出配置遗漏子模块，工作树中的 `backend/` 或 `frontend/` 为空
- **THEN** `00-submodule-check` 以退出码 1 结束，后续闸门不执行

### Requirement: 闸门脚本跨平台可执行

总闸门与各检查脚本 SHALL 不依赖 Windows 专有的可执行文件名。在 Windows 与 Linux 上执行同一份脚本时，MUST 产生相同的闸门集合、相同的执行顺序与相同的退出码语义。

#### Scenario: Linux runner 执行总闸门

- **WHEN** 在 Linux 环境以 PowerShell 7 执行 `harness/run-all.ps1`
- **THEN** 每个子闸门由当前 PowerShell 宿主拉起并正常返回退出码，而非因找不到 `powershell.exe` 失败

#### Scenario: Windows 本地执行总闸门

- **WHEN** 在 Windows 本地以 `powershell -File harness\run-all.ps1` 执行
- **THEN** 行为与本次变更前一致，子闸门仍由 Windows PowerShell 拉起

### Requirement: 闸门集合与清单标记保持不变

本次 CI 接入 MUST NOT 新增或删除 `harness/checks/` 下的任何闸门。CI 执行的闸门集合与 `AGENTS.md` 中 `<!-- harness-checks: ... -->` 标记列出的集合 MUST 保持一一对应。

#### Scenario: 文档闸门在 CI 内通过

- **WHEN** 工作流执行 `07-doc-consistency`
- **THEN** 该闸门以退出码 0 结束，说明 CI 未引入清单之外的闸门

### Requirement: 凭据不写入版本库且不依赖仓库密钥

CI 使用的数据库与缓存口令 SHALL 只作为临时实例的测试口令存在。工作流 MUST NOT 写入真实凭据，也 MUST NOT 要求配置仓库 secret 才能执行，使 fork 发起的 pull request 同样能完成校验。

#### Scenario: fork 的 pull request 触发

- **WHEN** 来自 fork 的 pull request 触发工作流且没有可用的仓库 secret
- **THEN** 工作流按临时实例口令完成依赖准备并执行全部闸门，不因缺少 secret 而失败
