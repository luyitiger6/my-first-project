# Spec Delta

## REMOVED Requirements

### Requirement: 前端模板可独立构建

**Reason**: 该能力绑定 Vue 3 与 Vite 静态产物，前端已替换为 Next.js 服务端运行形态，产物目录由 `dist/` 变为 `.next/`，原构建约定不再成立。

**Migration**: 由 `frontend-nextjs` 能力的「Next.js 前端可独立构建」承接，构建产物为 standalone 服务入口。

### Requirement: Todo 界面行为

**Reason**: 该能力的界面行为虽在语义上保留，但承载它的能力身份绑定 Vue 3 前端模板；Vue 实现整体删除后，此 requirement 无法在新代码上验证。

**Migration**: 由 `frontend-nextjs` 能力的「Todo 界面行为」承接，覆盖列表、新增、完成与失败提示，验收标准以该能力为准。

### Requirement: 开发代理联通后端

**Reason**: 原开发代理由 Vite dev server 配置实现，Vite 已移除，该配置项与新构建链无关。

**Migration**: 由 `frontend-nextjs` 能力的「API 同源代理（运行期可切换）」承接，转发改由前端服务的代理实现，后端地址运行期生效，无需重建产物。

### Requirement: 前端测试链可执行

**Reason**: 原测试链基于 Vue Test Utils，随 Vue 依赖一并删除；测试工具与断言对象均已更换。

**Migration**: 由 `frontend-nextjs` 能力的「前端测试链可执行」承接，测试覆盖 Todo 三条行为，且不依赖后端进程。

### Requirement: 前端验收闸门接入 Harness

**Reason**: 该闸门的三步结构保留，但构建命令随前端框架更换而失效，原 requirement 描述的前端实现不再存在。

**Migration**: 由 `frontend-nextjs` 能力的「前端验收闸门接入 Harness」承接，闸门仍为依赖安装、生产构建与测试三步。
