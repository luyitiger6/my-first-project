# U6 · 编辑推荐区块

| 项 | 值 |
|---|---|
| 单元编号 | U6 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 编辑推荐区块` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | 带封面图的内容卡片网格，上限 6 条 |

---

## 1. 模块边界

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 精选卡片网格 | 封面 + 城市标 + 标题 + 摘要 + 编辑署名 |
| 2 | 城市过滤 | 当前城市 + 全城通用（`all`）两类 |
| 3 | 排序 | `sortOrder` 升序，并列按 `id` 升序（由 U0 仓储保证） |
| 4 | 上限 6 条 | `EDITOR_PICKS_LIMIT`，截断由仓储完成 |
| 5 | 三态：加载 / 错误 / 空 | 复用 U2 的 `SectionLoading` / `SectionError` / `EmptyState` |
| 6 | 城市标签文案 | `all` 显示「全城」，其余显示中文城市名 |
| 7 | 封面图 | 固定 4:3，走 `next/image` + 自定义 loader 按响应式档位出图，懒加载，`alt="<标题>封面"` |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 精选详情页与跳转 | 未立项（当前卡片不可点） |
| 收藏 / 点赞 / 评论 | 未立项 |
| 图片上传与裁剪 | 未立项（只接受外部 URL） |
| 个性化推荐 / 猜你喜欢 | 未立项 |
| 「共 N 条」总数展示 | 当前不展示（`total` 已返回但未使用） |
| 分页、加载更多、无限滚动 | 未立项 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 精选卡片数据 | **Mock 契约**（U0 `mockRepository.listEditorPicks`） | 响应形状 `ListResult<EditorPick>`，换真实 API 时形状不变 |
| 当前城市 | **静态**（由 U2 传入的 `city` prop） | 本组件不读 URL |
| 封面图 | 静态 URL（`images.unsplash.com`） | 由 U0 `cover()` 生成；渲染前经自定义 loader 把宽度档位写进 `w` 参数 |
| 编辑推荐接口 | **需要 API（本期未接）** | 本期零网络请求 |

### 1.4 与其他单元的关系

- **依赖**：U0（类型 + 仓储 + 排序）、U2（三态组件 + `useSectionData`）、U5（间接：`city` 来自 URL）
- **被依赖**：U2（挂载）
- **结论**：等 U0 冻结、U2 三态就绪后即可独立开工

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 渲染精选卡片**
- When 数据 `ready` 且 `items` 非空
- Then 渲染卡片网格，每张卡含封面、城市标、标题、摘要、编辑署名
- And 卡片数量 = `items.length`，且不超过 6

**S2 · 排序正确**
- When 后端返回乱序数据
- Then 展示顺序为 `sortOrder` 升序，`sortOrder` 相同时按 `id` 升序
- And 组件自身**不排序**（排序归 U0，避免两处规则不一致）

**S3 · 城市过滤**
- When `city='beijing'`
- Then 只展示 `city === 'beijing'` 与 `city === 'all'` 的精选
- And 精选上的城市标：`all` 显示「全城」，其余显示中文名

**S4 · 切换城市重取**
- When `city` 由 `beijing` 变为 `shanghai`
- Then 区块回到加载态并重新取数，展示上海相关精选

**S5 · 加载态**
- When 首次渲染或 `city` 变化
- Then 展示 `role="status"` 的「编辑正在挑这一期的路线…」

### 2.2 异常路径

**S6 · 取数失败**
- When 仓储 reject
- Then 展示 `role="alert"` 的「编辑推荐暂时没能加载出来，稍后再试试。」
- And 不展示任何卡片，也不展示空态

**S7 · 空结果**
- When 该城市无精选
- Then 展示「<城市名>还没有编辑精选，换座城市看看。」
- And 不展示错误提示；城市名取自 `cityName(city)`，`all` 时为「全部」

**S8 · 图片加载失败**
- When 封面 URL 404 或网络中断
- Then 保留 4:3 占位区域，`alt` 文本可读，布局不塌陷
- And 其余卡片不受影响

**S9 · 超长文本**
- When 标题超过 20 字或摘要超过 60 字
- Then 文本正常换行，卡片高度由内容决定，不出现横向溢出
- And 不静默截断（不得使用 `line-clamp` 隐藏语义）

**S10 · 超窄屏（320px）**
- When 视口 320px
- Then 卡片单列，封面保持 4:3，无横向滚动

**S11 · 快速连续切换城市**
- When 短时间内多次切换 `city`
- Then 只渲染最后一次请求的结果（`useSectionData` 的 `active` 竞态保护）
- And 不出现旧城市卡片闪现到新城市下的情况

---

## 3. 数据结构

### 3.1 组件 Props

```ts
interface EditorPicksProps {
  /** 当前城市，来自 U2 的 parseCity 结果；组件不解析、不校验 */
  city: CitySlug
}

export function EditorPicks({ city }: EditorPicksProps): JSX.Element
```

| Prop | 类型 | 必填 | 约束 | 违反后果 |
|---|---|---|---|---|
| `city` | `CitySlug` | 是 | 8 值闭集之一 | 过滤无结果 → 空态 |
| `city` 来源 | — | — | 必须来自 URL 归一化结果，不得在组件内 fallback | 两处默认值不一致 |

### 3.2 依赖的数据类型（U0）

```ts
interface EditorPick {
  id: number
  title: string
  summary: string
  city: CitySlug
  coverUrl: string
  editor: string
  sortOrder: number
}

interface ListResult<T> { items: T[]; total: number }
```

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `title` | 非空，≤ 24 字 | h3，允许换行 |
| `summary` | 非空，≤ 80 字 | 正文段落，最多展示 3 行（视觉裁切，不做字符串截断） |
| `city` | `CitySlug` | `all` → 「全城」；否则 → 中文名 |
| `coverUrl` | 绝对 URL | 4:3，`loading="lazy"`，经自定义 loader 按档位改写 `w` |
| `editor` | 非空，2–8 字 | 署名，前缀「编辑 · 」由展示层决定（当前仅展示名字） |
| `sortOrder` | 可负数 | 不展示，仅参与排序 |

### 3.3 状态映射

| `state.status` | 展示 |
|---|---|
| `loading` | `<SectionLoading label="编辑正在挑这一期的路线…" />` |
| `error` | `<SectionError message="编辑推荐暂时没能加载出来，稍后再试试。" />` |
| `ready` + `items=[]` | `<EmptyState message="{cityName(city)}还没有编辑精选，换座城市看看。" />` |
| `ready` + `items>0` | 卡片网格 |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 内容

- [ ] 卡片含封面、城市标、标题、摘要、编辑署名五要素
- [ ] 卡片数量 = `items.length` 且 ≤ 6
- [ ] `sortOrder` 升序，并列按 `id` 升序
- [ ] 城市标：`all` 显示「全城」，其余显示中文城市名
- [ ] 区块 eyebrow 为 `Editor's picks`，h2 为「编辑推荐」，说明文案一致

### 4.2 状态

- [ ] 加载态为 `role="status"` 且文案「编辑正在挑这一期的路线…」
- [ ] 错误态为 `role="alert"` 且文案「编辑推荐暂时没能加载出来，稍后再试试。」
- [ ] 空态文案含当前城市名，且不出现错误提示
- [ ] 切换城市触发重新取数，旧结果不会覆盖新城市

### 4.3 图片与响应式

- [ ] 封面为 4:3；`alt="<标题>封面"`
- [ ] 封面走 `next/image`，带多档 `srcset`；`sizes` 为 `(max-width: 640px) calc(100vw - 64px), (max-width: 900px) calc(50vw - 50px), (min-width: 1160px) 347px, calc(33.33vw - 40px)`
- [ ] 封面 `loading="lazy"` + `decoding="async"`，且 `.cover` 含 `height: auto`（防 `aspect-ratio` 失效）
- [ ] 图片加载失败时占位不塌陷
- [ ] 320px 单列、无横向滚动；≥768px 两列；≥1024px 三列

### 4.4 工程

- [ ] 组件内无排序逻辑（排序归 U0）
- [ ] 组件不直接 import `mock-data`
- [ ] `data-section="editor-picks"` 存在
- [ ] `editor-picks.test.tsx` 覆盖 S1–S3、S6、S7
- [ ] `npx vitest run components/home/editor-picks.test.tsx` 全绿
- [ ] `npm run build` 通过
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 文件首行 `'use client'`（使用 `useSectionData`）
- 取数必须通过 `useSectionData(() => mockRepository.listEditorPicks({ city }), [city])`，`deps` 只写 `[city]`
- `load` 必须是内联箭头函数（避免每次渲染新建引用导致重复取数）
- 不得在组件内 `useEffect` 二次请求或用 `useState` 自行管理三态
- 不得使用 `next/link` 包裹卡片：当前无详情页，禁止造死链

### 5.2 Tailwind CSS + shadcn/ui

**⚠ 现状：无 Tailwind、无 shadcn/ui**，样式在 `editor-picks.module.css`（`.grid` / `.card` / `.cover` / `.body` / `.city` / `.title` / `.summary` / `.editor`）。

若引入后：

| 现状 | 目标 |
|---|---|
| `<ul className={styles.grid}>` + `<li className={styles.card}>` | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5` + `Card` |
| `.cover` 的 4:3 | `relative aspect-[4/3] w-full overflow-hidden` + `Image fill` |
| `.city` 小标签 | `Badge variant="secondary"` |
| 三态文案 | 保留 U2 组件，不换 `Skeleton`（会改变测试断言） |

约束：卡片当前不可点击，**不得**套 `Card` 的 hover 抬升效果制造可点暗示；若将来加详情页，须同时补 `Link` 与 `aria-label`。

### 5.3 响应式（mobile-first）

| 断点 | 列数 | 间距 |
|---|---|---|
| 默认（320–767px） | 1 | `16px` |
| `≥768px` | 2 | `20px` |
| `≥1024px` | 3 | `24px` |

- 断点只放大列数，不改变卡片内部结构
- 卡片作为 grid item 需 `min-width: 0`，防长标题撑破
- 封面容器用 `aspect-ratio: 4/3` + `overflow: hidden`，图片 `object-fit: cover`

### 5.4 图片（next/image）

**⚠ 现状：使用原生 `<img>`**（`width={900} height={675} loading="lazy"`），未接入 `next/image`。

目标约束：

- 换 `next/image` 后可用 `fill` + `sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"`
- 必须先在 `next.config.ts` 注册源站：

```ts
images: {
  remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
}
```

- 首屏以下卡片保持 `loading="lazy"`；不得给全部卡片加 `priority`
- `alt` 规则不变：`"<标题>封面"`；纯装饰封面才允许 `alt=""`（当前封面承载内容语义，不可置空）
- **历史坑**：给 `<img>` 同时写 `width` + `height` 且 CSS 用 `aspect-ratio` 时，必须保留 `.cover { height: auto }`，否则图片比例会被宽高属性顶死（已发生过一次失真事故）

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | `next/image` | 原生 `<img>` | 无自动格式转换与尺寸优化 |
| 2 | 图片域名注册 | `next.config.ts` 无 `images` 段 | 直接改 `Image` 会在运行期报域名未配置 |
| 3 | Tailwind + shadcn | CSS Modules 手写 | 换栈需重做 4:3 封面容器 |
| 4 | 「共 N 条」 | 未展示（`total` 未使用） | 与 `ListResult.total` 的语义存在未消费字段 |
| 5 | 卡片可点击 | 不可点（无详情页） | 与 spec 一致，勿擅自加链接 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 组件 | `frontend/components/home/editor-picks.tsx` |
| 样式 | `frontend/components/home/editor-picks.module.css` |
| 数据 | `frontend/lib/home/repository.ts`（`listEditorPicks`） |
| 三态 | `frontend/components/home/section-state.tsx` |
| 取数 Hook | `frontend/components/home/use-section-data.ts` |
| 挂载 | `frontend/app/page.tsx` |
| 测试 | `frontend/components/home/editor-picks.test.tsx` |

```powershell
cd frontend
npx vitest run components/home/editor-picks.test.tsx
npm run build
cd ..
powershell -File harness\run-all.ps1
```
