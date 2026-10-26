# U8 · 热门景点区块

| 项 | 值 |
|---|---|
| 单元编号 | U8 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 热门景点区块` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准，冲突时按主 spec 验收 |

## 1. 边界

**包含**

- 最多展示 5 个**已发布**景点
- 排序：浏览数降序 → 发布时间降序
- 每个展示：封面、名称、城市、评分、浏览量
- 空态：无匹配数据时展示空态文案
- 加载态与错误态（沿用区块三态）

**不包含**

- 景点详情页、地图、导航
- 评分写入、用户点评、收藏
- 图片上传（封面只接受外部 URL）
- 景点搜索与筛选面板

## 2. 数据依赖

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 景点数据 | Mock 契约（U0 `mockRepository`） | 响应形状 `ListResult<Attraction>`；Mock 中含草稿样本 |
| 状态过滤 | 静态（`ContentStatus`） | 只保留 `published`，`draft` 与 `removed` 一律排除 |
| 当前城市 | 静态（URL `?city=`） | 由 U5 写入、U2 透传 |
| 后端 API | **需要 API（本期未接）** | 未来对应「热门景点榜」接口，另立项；本期零网络请求 |

## 3. 与其他单元的依赖

- **依赖**：
  - U0 —— 类型、Mock 数据、排序与截断逻辑
  - U5 —— 间接：按 `city` 过滤
- **被依赖**：U2 —— 区块由首页骨架挂载

## 4. 验收清单

- [ ] Mock 中已发布景点多于 5 个时，区块只展示排序后的前 5 个
- [ ] 两个景点浏览数不同时浏览数多者在前；相同时发布时间晚者在前
- [ ] Mock 中存在草稿或已删除景点时，这些景点不出现在区块内
- [ ] 每个展示封面、名称、城市、评分、浏览量
- [ ] 封面保持固定宽高比，不被图片原始尺寸撑变形
- [ ] 无匹配数据时展示空态文案且不报错
- [ ] 全流程不发起网络请求

## 5. 实现位置

- `frontend/components/home/hot-attractions.tsx` + `hot-attractions.module.css`
- 数据：`frontend/lib/home/repository.ts`
- 测试：`hot-attractions.test.tsx`
