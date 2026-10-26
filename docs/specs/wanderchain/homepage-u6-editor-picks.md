# U6 · 编辑推荐区块

| 项 | 值 |
|---|---|
| 单元编号 | U6 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 编辑推荐区块` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准，冲突时按主 spec 验收 |

## 1. 边界

**包含**

- 编辑精选卡片：封面、标题、城市、编辑署名、摘要
- 排序：`sort_order` 升序，并列时按 `id` 升序
- 城市过滤：只展示当前城市与全城通用（`all`）的精选
- 空态：无匹配数据时展示空态文案，不报错
- 加载态与错误态（沿用区块三态）

**不包含**

- 收藏、点赞、评论
- 内容详情页与跳转落地页
- 图片上传（封面只接受外部 URL）
- 个性化推荐与「猜你喜欢」

## 2. 数据依赖

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 精选卡片数据 | Mock 契约（U0 `mockRepository`） | 响应形状 `ListResult<EditorPick>`，替换真实数据源时形状不变 |
| 当前城市 | 静态（URL `?city=`） | 由 U5 写入、U2 透传 |
| 后端 API | **需要 API（本期未接）** | 未来对应「编辑推荐列表」接口，另立项；本期零网络请求 |

## 3. 与其他单元的依赖

- **依赖**：
  - U0 —— 类型、Mock 数据与排序逻辑
  - U5 —— 间接：按 `city` 过滤
- **被依赖**：U2 —— 区块由首页骨架挂载

## 4. 验收清单

- [ ] 卡片顺序与 `sort_order` 升序一致，并列项按 `id` 升序
- [ ] 选中非 `all` 城市时，只展示该城市或全城通用的精选卡片
- [ ] 该城市没有精选卡片时，区块展示空态文案且不报错
- [ ] 卡片字段齐全：封面、标题、城市、编辑署名、摘要
- [ ] 全流程不发起网络请求，全部数据来自 Mock 仓储

## 5. 实现位置

- `frontend/components/home/editor-picks.tsx` + `editor-picks.module.css`
- 数据：`frontend/lib/home/repository.ts`
- 测试：`editor-picks.test.tsx`
