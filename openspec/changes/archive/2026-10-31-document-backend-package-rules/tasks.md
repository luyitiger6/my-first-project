# Tasks

实施前置：用户已审阅并明确放行本 change。本次仅实施约定文档调整，任务状态如下；不代表完整验收通过。

## 1. 后端约定正文

- [x] 1.1 将 `design.md` D2 的规则与两个节选目录示例整合到 `docs/conventions/backend-conventions.md` 的包结构章节，按 D1 修订原职责表与依赖图解释，避免重复或冲突。验证：逐项对照分包默认策略、两类示例、类型归属和人工审阅场景，确认没有数量硬阈值、强制递归或批量重构要求。
- [x] 1.2 在后端约定的“机械守卫”中明确现有检查覆盖范围，补充分包合理性由人工审阅的说明；保留四个固定小节及既有禁止项。验证：与现有 `11-conventions-check.ps1` 的实际检查范围对照，不声称自动判断复杂度或包深度。

## 2. 统一入口与维护说明

- [x] 2.1 按 D1 更新 `docs/conventions/README.md` 的索引描述、导言及维护说明，区分既有真源引用、新规则维护位置、机械检查和人工判断。验证：入口能定位后端分包正文，不复制全文、不引用在飞 change 路径，不新增未登记文档；第三方依赖不变且无需引入新包。

## 3. 文档集成核对

- [x] 3.1 运行 `powershell -NoProfile -File harness\checks\11-conventions-check.ps1` 和 `openspec validate document-backend-package-rules --strict`，并逐条核对本 change 的规格场景。验证：两项命令均返回 0，人工核对结论与未覆盖范围分别说明，不报告完整验收通过。
- [x] 3.2 检查工作区变更范围。验证：本 change 工件外只涉及上述两份约定文档，没有本次引入的 Java、前端、Harness、子模块指针或历史归档修改；发现其他 Agent 的改动仅记录，不覆盖或回退。

## Verification

- 已执行 `powershell -NoProfile -File harness\checks\11-conventions-check.ps1`：输出 `11-conventions-check PASSED`，覆盖 4 份约定文档自洽性及脚本列出的分层 import 禁止项。
- 已执行 `openspec validate document-backend-package-rules --strict`：输出 `Change 'document-backend-package-rules' is valid`；`git diff --check` 无空白错误。
- 已逐条阅读核对 10 个 Scenario：简单平铺、复杂聚合条件、非数量触发、两种结构并存、各层不必镜像、服务及 HTTP 类型分别归属、新层级的审阅依据、正文唯一入口与机械检查边界均已在约定中落实。这是文档对照结果，不是脚本对业务复杂度的自动判断。
- Git 范围核对：本 change 工件外仅修改 `docs/conventions/backend-conventions.md` 与 `docs/conventions/README.md`；没有 Java、前端、Harness、子模块指针或历史归档变更。
- 未覆盖：Maven、前端构建、业务测试、E2E 与全量 Harness；未提交、推送、同步正式规格或归档。

## Workflow follow-up

- 本变更不新增或运行单元测试、集成测试、E2E、Maven 或前端构建；完整验收按当前 `AGENTS.md` 后置，在用户需要时集中执行。未执行不记为通过。
- 提交、推送、正式规格同步与归档均另获授权；不因规划工件齐备就自动实施或归档。
