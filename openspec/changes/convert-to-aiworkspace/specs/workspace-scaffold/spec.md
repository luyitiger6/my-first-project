# Spec Delta

## Purpose

让 AIWorkSpace 模板的使用者用一条命令把工作区自身的展示名与 slug 替换为自己的身份，同时不触碰两个子模块的项目身份、远程地址与历史；Harness 以退出码验证改名的完整性。

## ADDED Requirements

### Requirement: 工作区改名只作用于工作区身份

改名脚本 SHALL 接收 `--name`（kebab-case slug）与 `--display`（非空展示名），只替换 `AGENTS.md` 与 `README.md` 中的工作区身份；MUST NOT 修改 `backend/`、`frontend/`、`openspec/`、`.gitmodules` 或包目录；收到 `--package` 时 MUST 以非 0 退出码拒绝并指出应用改名归属子模块仓库。

#### Scenario: 改名执行成功
- **WHEN** 在工作区根执行改名脚本并传入合法的 `--name` 与 `--display`
- **THEN** `AGENTS.md` 与 `README.md` 中的旧展示名与旧 slug 被替换为新值，脚本以退出码 0 结束
- **AND** `backend/`、`frontend/`、`.gitmodules` 与 `openspec/` 的内容保持不变

#### Scenario: 参数缺失或非法
- **WHEN** 缺少 `--name` 或 `--display`，或 `--name` 不是 kebab-case，或 `--display` 为空白
- **THEN** 脚本以非 0 退出码结束，并输出对应的参数提示

#### Scenario: 拒绝应用身份改名参数
- **WHEN** 执行改名脚本并传入 `--package`
- **THEN** 脚本以非 0 退出码结束，并提示应用身份改名应在 backend 仓库内执行

#### Scenario: 重复执行被拒绝
- **WHEN** 在已改名的仓库再次执行改名脚本
- **THEN** 脚本检测不到旧工作区身份，以非 0 退出码结束并提示需要先恢复仓库

### Requirement: 改名结果可被残留检查验证

改名完成后 SHALL 可通过扫描工作区自有文件确认旧展示名与旧 slug 无残留；扫描 MUST 排除子模块、`openspec/`、`docs/`、改名工具自身、IDE 目录与 `.gitmodules`。`.gitmodules` 的 URL 可能包含工作区身份 token，但不属于改名范围，必须通过哈希比较而非残留扫描验证。

#### Scenario: 残留检查通过
- **WHEN** 对改名完成的工作区副本执行旧身份残留扫描
- **THEN** 扫描未发现旧展示名或旧 slug，检查以退出码 0 结束

#### Scenario: 残留检查失败
- **WHEN** 工作区自有文件中仍存在未被替换的旧展示名或旧 slug
- **THEN** 扫描输出命中文件位置，检查以非 0 退出码结束

### Requirement: 改名演练接入 Harness 统一验收

Harness SHALL 在每次统一验收时于临时副本中演练工作区改名并执行残留扫描，且不要求模板仓库自身处于已改名状态。

#### Scenario: 闸门演练通过
- **WHEN** 运行 `harness\run-all.ps1`，且子模块已就绪、改名脚本工作正常
- **THEN** 改名闸门在临时目录完成演练与残留扫描，以退出码 0 结束，整体验收不受影响

#### Scenario: 改名脚本失效
- **WHEN** 改名脚本缺失、演练执行失败或演练后扫描到旧身份残留
- **THEN** 改名闸门以非 0 退出码结束，`run-all.ps1` 整体判定失败
