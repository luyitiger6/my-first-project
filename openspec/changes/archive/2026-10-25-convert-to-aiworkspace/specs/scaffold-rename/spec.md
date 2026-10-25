# Spec Delta

## REMOVED Requirements

### Requirement: 脚手架支持参数化改名

**Reason**: 工作区不再直接持有 backend 文件；应用身份（`artifactId` / `groupId` / Java 包名）改名必须发生在 backend 独立仓库内，工作区脚本无法跨仓库安全完成。

**Migration**: 应用身份改名在 backend 仓库内执行；工作区级改名改用 `workspace-scaffold` 的 `--name` 与 `--display`。

### Requirement: 改名结果可被残留检查验证

**Reason**: 该 requirement 以工作区直接扫描 backend 文件为前提，子模块化后扫描边界不再覆盖子模块内容。

**Migration**: 工作区级残留检查由 `workspace-scaffold` 承接；应用身份残留由对应子模块仓库自行校验。

### Requirement: 改名验证接入 Harness 统一验收

**Reason**: 5 号闸门收缩为只演练工作区身份改名，不再验证应用身份改名。

**Migration**: 工作区级改名演练由 `workspace-scaffold` 承接；子模块应用仓库自行负责其改名验证。
