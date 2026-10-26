# U5 · 城市快速入口

| 项 | 值 |
|---|---|
| 单元编号 | U5 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 城市快速入口` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准，冲突时按主 spec 验收 |

## 1. 边界

**包含**

- 渲染 8 个城市入口：`all` + 北京、上海、广州、成都、西安、杭州、三亚
- 当前城市高亮，并用 `aria-pressed` 标记选中态
- 点击时用 `router.replace` 写入 `?city=<slug>`，保留其他查询参数
- 选中态唯一；非 `all` 城市可再切回 `all`
- 非法或缺失参数回落 `all`

**不包含**

- 定位、城市搜索、多选、城市详情页
- 城市内容配置后台
- 城市切换动效

## 2. 数据依赖

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 城市白名单 | 静态 | 来自 U0 的 `lib/home/cities.ts`（slug、中文名、主题色） |
| 当前城市 | 静态（URL 查询参数） | `?city=` 是唯一状态源，不进全局 Context、不持久化 |
| 后端 API | **无** | 本期零网络请求 |

## 3. 与其他单元的依赖

- **依赖**：U0 —— 城市列表与 `parseCity`
- **被依赖**：
  - U2 —— 区块由首页骨架挂载
  - U6 / U7 / U8 —— **间接依赖**：三个内容区块按本单元写入的 `city` 过滤数据

## 4. 验收清单

- [ ] 首页展示 8 个城市入口，`all` 与 7 个城市齐全
- [ ] 点击某城市入口后，URL 的 `city` 参数变为该城市 slug，且该入口高亮
- [ ] 直接访问 `/?city=beijing` 时，北京入口处于高亮态
- [ ] 访问 `/?city=atlantis` 时，页面以 `all` 展示内容且 `all` 入口高亮
- [ ] 选中城市后刷新页面，城市选择保持不变
- [ ] 任意时刻只有一个入口处于选中态

## 5. 实现位置

- `frontend/components/home/city-switcher.tsx` + `city-switcher.module.css`
- 依赖 `frontend/lib/home/cities.ts`
- 测试：`city-switcher.test.tsx`
