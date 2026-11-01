# Proposal

## Why

现有后端约定已定义分层与 `impl/model/support` 的职责，但没有说明何时保持平铺、何时按功能聚合，容易把每个子功能都扩展成一套嵌套目录。将用户确认的“简单功能不套娃，复杂功能按需聚合”写为可审阅规则，使 `auth` 平铺与 `post/interaction` 分包有一致的判断依据。

## What Changes

- 在现有 `docs/conventions/backend-conventions.md` 补充分包判断、简单/复杂两种目录示例和新增子包的人工审阅要求；规则草案全文见本 change 的 `design.md`。
- 明确默认平铺；仅当功能边界清晰、相关文件形成相对完整的一组且聚合确实便于定位时，才考虑分子包。独立接口、表数量、预想的未来增长均不能单独作为分包理由，不设置文件数量硬阈值。
- 明确分子包不改变层的职责：持久化实体留在 dao，服务输入/结果留在 service 的 model，HTTP 请求/响应留在 web 的 dto；不强制各层目录一一镜像，不创建空壳目录。
- 保留当前 `auth` 与 `post/interaction` 结构，不据此递归拆分评论、投票、收藏，也不合并现有服务类。
- 小范围更新约定索引的维护说明：已有规则引用真源；新的分包实践落在后端约定；可机械检查的项沿用闸门，复杂度判断明确由人工审阅。不新增检查脚本或依赖。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `dev-conventions`：补充分包约定的默认策略、类型归属说明、可追溯决策与人工审阅边界。

## Impact

- 实施落点仅为 `docs/conventions/backend-conventions.md` 和 `docs/conventions/README.md`；规格 delta 在本 change 中维护，正式规格待获准归档时同步。
- 不修改 `backend/`、`frontend/`、`AGENTS.md`、Harness 脚本或历史归档；不移动 Java 文件、不改 package/import、不改接口、数据表及运行行为，不涉及 green-note 项目。
- 第三方包：不新增、不升级；复用现有 OpenSpec CLI 和约定检查脚本。
- 本轮仅产出规划工件，待人工审阅后再实施。仅校验提案，不运行 Maven、前端构建、业务测试或全量 Harness；这不构成完整验收通过。
