# U3 · 功能导航栏

| 项 | 值 |
|---|---|
| 单元编号 | U3 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 功能导航栏` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准，冲突时按主 spec 验收 |

## 1. 边界

**包含**

- 三张平台入口卡片：旅游社区 → `/community`、景点攻略 → `/attractions`、AI 助手 → 唤起面板
- 每张卡片含图标、标题、一句话描述
- `/community` 与 `/attractions` 占位页，说明板块建设中并提供返回首页链接
- 移动端（< 768px）卡片纵向排列

**不包含**

- 社区与攻略页面的真实内容（占位页即可）
- 卡片排序自定义、后台配置、埋点
- 图标动效与复杂交互

## 2. 数据依赖

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 卡片文案与图标 | 静态 | 写在前端常量中，无外部数据源 |
| 后端 API | **无** | 本期零网络请求 |

## 3. 与其他单元的依赖

- **依赖**：U4 —— AI 助手卡片点击后唤起的是同一个占位面板
- **被依赖**：U2 —— 区块由首页骨架挂载
- **无依赖关系**：U0、U1、U5、U6、U7、U8

## 4. 验收清单

- [ ] 三张卡片分别展示旅游社区、景点攻略、AI 助手的标题与描述
- [ ] 点击社区卡片导航到 `/community`，点击攻略卡片导航到 `/attractions`
- [ ] 点击 AI 助手卡片唤起 U4 的占位面板，而不是跳转到新页面
- [ ] `/community` 与 `/attractions` 可正常打开，不落入 404
- [ ] 视口宽度小于 768px 时卡片纵向排列，页面不出现横向滚动

## 5. 实现位置

- `frontend/components/home/feature-nav.tsx` + `feature-nav.module.css`
- `frontend/app/community/page.tsx`、`frontend/app/attractions/page.tsx`
- 测试：`feature-nav.test.tsx`
