# U2 · 首页骨架与区块编排

| 项 | 值 |
|---|---|
| 单元编号 | U2 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 首页骨架与区块编排` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准，冲突时按主 spec 验收 |

## 1. 边界

**包含**

- `app/page.tsx`：服务端组件按固定顺序组合五个区块，读取 `searchParams.city` 后下发
- `app/layout.tsx`：wanderchain 元信息（标题、描述、`lang="zh-CN"`），挂载 `AuthProvider`
- `app/globals.css`：设计令牌（色板、字号、间距、圆角、阴影）与基础排版
- `SectionBoundary`：区块级 Error Boundary，单区块失败不影响其他区块
- 页脚与站点骨架（含头部、返回按钮布局）

**不包含**

- 五个区块的具体内容实现（由 U3–U8 提供）
- 路由级错误页、加载骨架屏、SSR 数据缓存策略
- 多语言、暗黑模式、复杂动效

## 2. 数据依赖

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 城市查询参数 | 静态（URL） | 来自 `?city=`，非法或缺失回落 `all` |
| 区块内容 | 由各区块自取（Mock） | 骨架只负责编排与隔离，不内联业务数据 |
| 后端 API | **无** | 本期零网络请求 |

## 3. 与其他单元的依赖

- **依赖**：
  - U0 —— 区块数据源与 `parseCity`
  - U1 —— `AuthProvider` 与本单元共享 layout
  - U3 / U4 / U5 / U6 / U7 / U8 —— 区块组件全部由本单元挂载
- **被依赖**：无。本单元是装配点，位于依赖链末端。

## 4. 验收清单

- [ ] 首页渲染完成后，五个区块按「功能导航 → 城市快速入口 → 编辑推荐 → 热门帖子 → 热门景点」顺序出现
- [ ] 某内容区块数据源抛错时，该区块展示错误态，其余区块仍正常渲染
- [ ] 访问 `/?city=shanghai` 时，三个内容区块均以 `shanghai` 作为查询条件
- [ ] 访问 `/` 且未携带 `city` 时，三个内容区块均以 `all` 作为查询条件
- [ ] AI 助手入口在任何区块失败的情况下仍然可用
- [ ] 页面元信息为 wanderchain，`lang` 为 `zh-CN`

## 5. 实现位置

- `frontend/app/page.tsx`、`layout.tsx`、`globals.css`
- `frontend/components/home/section-boundary.tsx`、`section-state.tsx`、`use-section-data.ts`
- `frontend/components/site/site-header.tsx`、`site-footer.tsx`、`placeholder.tsx`
- 测试：`app/page.test.tsx`
