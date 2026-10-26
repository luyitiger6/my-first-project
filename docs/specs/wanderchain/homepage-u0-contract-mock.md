# U0 · 契约与 Mock 数据层

| 项 | 值 |
|---|---|
| 单元编号 | U0 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 契约与 Mock 数据层` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准，冲突时按主 spec 验收 |

## 1. 边界

**包含**

- 类型定义：`CitySlug`、`EditorPick`、`Post`、`Attraction`、`ContentStatus`（published/draft/removed）、`ListQuery`、`ListResult<T>`
- 城市白名单 8 项：`all` + 北京、上海、广州、成都、西安、杭州、三亚（slug、中文名、主题色）
- `parseCity`：非法或缺失值归一化为 `all`
- Mock 数据：不少于 6 条编辑精选、14 条帖子（含草稿与已删除）、9 个景点（含草稿），覆盖全部 7 城
- `HomeRepository` 接口与 `mockRepository`：城市过滤、Top N 截断、三级排序

**不包含**

- 真实后端 API、数据库、鉴权
- 任何 UI 渲染与样式
- 分页游标、搜索、缓存策略

## 2. 数据依赖

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 类型与常量 | 静态 | 编译进前端 bundle，无运行期外部依赖 |
| Mock 数据 | 静态 | 作为「契约占位符」，形状即未来 API 的响应形状 |
| 后端 API | **无** | 本期零网络请求；真实接口另立项 |

## 3. 与其他单元的依赖

- **依赖**：无。本单元是其余单元的地基。
- **被依赖**：
  - U2 —— 区块数据源
  - U5 —— 城市列表与 `parseCity`
  - U6 / U7 / U8 —— 排序、过滤、Top N 全部在仓储侧完成，组件只消费结果

## 4. 验收清单

- [ ] 编辑推荐、热门帖子、热门景点、城市列表均有类型定义与 Mock 实现
- [ ] 对同一 Mock 查询重复调用，返回顺序与内容完全一致
- [ ] Mock 数据里确实存在草稿与已删除样本，能验证下游的 published 过滤
- [ ] 非法城市 slug 经 `parseCity` 后得到 `all`
- [ ] 用相同响应形状的真实数据源替换 `mockRepository` 时，组件与单元测试无需修改

## 5. 实现位置

- `frontend/lib/home/types.ts`、`cities.ts`、`mock-data.ts`、`repository.ts`
- 测试：`repository.test.ts`、`cities.test.ts`
