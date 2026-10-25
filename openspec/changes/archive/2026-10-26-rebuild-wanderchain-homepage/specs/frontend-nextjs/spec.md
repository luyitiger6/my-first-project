# Spec Delta

## REMOVED Requirements

### Requirement: Todo 界面行为

**Reason**: 首页重建为 wanderchain 首页，Todo 示例界面与其数据封装被删除，该界面不再存在。

**Migration**: 界面行为由新增能力 `wanderchain-homepage` 承接；`/api/*` 同源代理要求保留不变，后续真实 API 接入时继续复用该代理。

## MODIFIED Requirements

### Requirement: 前端测试链可执行

前端 SHALL 提供可通过退出码判定结果的自动化测试，覆盖首页各单元行为与代理转发规则（地址拼接、运行期切换、失败映射），且测试 MUST NOT 依赖后端进程运行。

#### Scenario: 测试全绿

- **WHEN** 在 `frontend/` 目录执行测试命令
- **THEN** 全部测试通过且命令退出码为 0

#### Scenario: 测试不依赖后端

- **WHEN** 后端服务未启动时执行前端测试
- **THEN** 测试仍可完成并以退出码 0 结束

#### Scenario: 代理规则被测试覆盖

- **WHEN** 执行前端测试命令
- **THEN** 代理的地址拼接、运行期切换与后端失败映射均有对应用例，且不启动后端进程
