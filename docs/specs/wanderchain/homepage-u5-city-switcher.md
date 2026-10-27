# U5 · 城市快速入口

| 项 | 值 |
|---|---|
| 单元编号 | U5 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: 城市快速入口` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准 |
| 单元性质 | URL 驱动的城市切换。**唯一写入 `?city=` 的单元** |

---

## 1. 模块边界

界面语言：英文单语（不做 i18n 框架）；城市 chip 与右上角说明只读 `nameEn` / `taglineEn`，中文字段保留为内容资产。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 8 个城市 chip（`all` + 7 城） | 顺序与 `CITIES` 常量一致 |
| 2 | 当前城市高亮 | `aria-pressed="true"` + `active` 样式类 |
| 3 | 点击切换城市 | `router.replace` 改写 URL，**不新增历史记录** |
| 4 | 保留其他查询参数 | 切换时保留 `query` 中除 `city` 外的全部单值参数 |
| 5 | 选中 `All cities` 时移除参数 | URL 中删除 `city`，回到 `/?`（或仅保留其他参数） |
| 6 | 当前城市说明 | 区块右上角展示 `Now: <city name> · <city tagline>` |
| 7 | 区块锚点 `id="cities"` | 供 hero 的 `Browse by city →` 跳转 |
| 8 | 重复点击当前城市 | 短路，不触发导航 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 城市数据的增删改 | U0（`cities.ts` 常量） |
| 根据城市过滤内容 | U6 / U7 / U8（各自读 `city` prop） |
| 首屏的「按城市逛」链接本体 | hero |
| 城市搜索、拼音匹配、联想 | 未立项 |
| 记住上次选择（cookie / localStorage） | 未立项；当前只认 URL |
| 非首页的城市参数处理 | 未立项 |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 城市列表与 tagline | **静态**（`CITIES` 常量） | 8 项，编译期确定 |
| 当前城市 | **静态**（URL `?city=`，由 U2 `parseCity` 归一化后传入） | 组件自身不解析 URL |
| 其余查询参数 | 静态（URL） | 由 U2 `toQuery` 传入，原样保留 |
| 城市接口 | **需要 API（本期未接）** | 若未来后台配置城市，需新增接口；本期零请求 |

### 1.4 与其他单元的关系

- **依赖**：U0（`CITIES` / `cityName` / `CitySlug`）、U2（传入 `activeCity` 与 `query`）
- **被依赖**：U6 / U7 / U8 —— 它们通过 `?city=` 间接依赖本单元写入的结果；hero 的锚点依赖 `id="cities"`
- **结论**：本单元是「城市语义」的唯一写入口，其他单元只读

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 渲染 8 个 chip**
- When 首页加载
- Then 依次渲染 All cities / Beijing / Shanghai / Guangzhou / Chengdu / Xi'an / Hangzhou / Sanya
- And 每个 chip 是 `<button type="button">`，带 `aria-pressed`

**S2 · 选中态**
- When `activeCity='beijing'`
- Then `Beijing` `aria-pressed="true"`，其余 7 个为 `false`
- And `Beijing` 额外带激活样式类

**S3 · 切换到具体城市**
- When 在 `/?` 下点击 `Chengdu`
- Then `router.replace('/?city=chengdu')`
- And 浏览器历史**不新增**条目（后退仍回到进入首页前的位置）

**S4 · 保留其他参数**
- When 在 `/?city=beijing&utm=x` 下点击 `Shanghai`
- Then 跳转到 `/?city=shanghai&utm=x`
- And `utm` 未被丢弃

**S5 · 切回全部**
- When 在 `/?city=beijing&utm=x` 下点击 `All cities`
- Then 跳转到 `/?utm=x`（`city` 被删除，其余保留）

**S6 · 说明文案跟随**
- When 当前城市为 `hangzhou`
- Then 右上角展示 `Now: Hangzhou · Tea hills west of the lake`
- And 切换到其他城市后文案同步更新

**S7 · 重复点击当前城市**
- When 点击已经是选中的城市
- Then 不调用 `router.replace`，URL 不变，无多余渲染

### 2.2 异常路径

**S8 · 非法 `activeCity`**
- When 传入不在 `CITIES` 中的 slug（防御性场景，正常链路由 `parseCity` 拦截）
- Then 说明文案回退到首个城市（`All cities`）的 tagline，页面不报错
- And 8 个 chip 仍全部渲染，无任何 chip 被标记为选中

**S9 · `query` 为空对象**
- When `query={}` 时点击 `Beijing`
- Then 跳转到 `/?city=beijing`（不出现 `/?` 后紧跟空串或 `?&`）

**S10 · `query` 含 `city` 字段**
- When 传入的 `query` 本身含 `city`（例如调用方未剥离）
- Then 以点击的城市覆盖该值，不产生重复参数 `?city=x&city=y`

**S11 · 连续快速切换**
- When 短时间内连续点击多个城市
- Then 最终 URL 反映最后一次点击，不出现参数抖动或空 URL
- And 不抛错（`replace` 幂等）

**S12 · 超窄屏（320px）**
- When 视口 320px
- Then 8 个 chip 自动换行，行内不裁切文字
- And 页面无横向滚动

---

## 3. 数据结构

### 3.1 组件 Props

```ts
interface CitySwitcherProps {
  /** 当前城市，已由 U2 的 parseCity 归一化，本组件不再解析 */
  activeCity: CitySlug
  /** 除 city 外的其余单值查询参数，切换时原样保留 */
  query: Record<string, string>
}

export function CitySwitcher({ activeCity, query }: CitySwitcherProps): JSX.Element
```

### 3.2 Props 约束

| Prop | 类型 | 必填 | 约束 | 违反后果 |
|---|---|---|---|---|
| `activeCity` | `CitySlug` | 是 | 必须是 8 值闭集之一 | 说明文案回退，无 chip 选中 |
| `query` | `Record<string, string>` | 是 | 只含单值；**不得含 `city`** | 可能生成重复参数（已由覆盖逻辑兜底） |
| `query` 值 | `string` | — | 不需要自行编码，交给 `URLSearchParams` | 双重编码导致参数错乱 |

### 3.3 依赖类型

```ts
interface CityOption {
  slug: CitySlug   // 8 值闭集
  name: string     // 中文名，2–3 字（内容资产，不渲染）
  nameEn: string   // 英文名，界面唯一可读名称
  tagline: string  // 中文一句话（内容资产，不渲染）
  taglineEn: string // 英文一句话，2–6 个单词
}
```

| 字段 | 约束 | 违反后果 |
|---|---|---|
| `slug` | 唯一，与 `CitySlug` 一一对应 | chip key 冲突 |
| `nameEn` | 非空，用于按钮可访问名称 | 屏幕阅读器读不到城市名 |
| `taglineEn` | 非空，`all` 也必须有不限城市语义 | 说明行出现空白 |

### 3.4 URL 改写规则

| 点击 | `query` 输入 | 输出 URL |
|---|---|---|
| `all` | `{}` | `/` |
| `all` | `{utm:'x'}` | `/?utm=x` |
| `beijing` | `{}` | `/?city=beijing` |
| `beijing` | `{utm:'x'}` | `/?city=beijing&utm=x` |
| 当前城市 | 任意 | 不跳转 |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 渲染

- [ ] 8 个 chip，顺序为 All cities / Beijing / Shanghai / Guangzhou / Chengdu / Xi'an / Hangzhou / Sanya
- [ ] 每个 chip 为 `<button type="button">` 且带 `aria-pressed`
- [ ] 选中城市 `aria-pressed="true"`，其余为 `"false"`
- [ ] 右上角文案为 `Now: <city name> · <tagline>`
- [ ] 区块容器带 `id="cities"` 与 `data-section="city-switcher"`

### 4.2 切换行为

- [ ] 点击非当前城市后 URL 变为 `/?city=<slug>`
- [ ] `All cities` 时 URL 中不含 `city` 参数
- [ ] 其他查询参数在切换后被保留
- [ ] 点击当前城市不产生导航
- [ ] 连续快速切换后 URL 与最后点击一致
- [ ] 使用 `replace` 而非 `push`：后退不逐步回放每次城市切换

### 4.3 异常与响应式

- [ ] 非法 `activeCity` 下页面不报错、无 chip 选中
- [ ] `query={}` 时不产生 `?&` 或空参数
- [ ] 320px 下 chip 换行、无横向滚动、文字不截断

### 4.4 工程

- [ ] 组件不自行解析 URL，也不读 `useSearchParams`
- [ ] 城市列表只来自 `CITIES`，组件内无硬编码城市名
- [ ] `city-switcher.test.tsx` 覆盖 S1–S7、S9
- [ ] `npx vitest run components/home/city-switcher.test.tsx` 全绿
- [ ] `npm run build` 通过
- [ ] 无 `TODO` / `FIXME`，未被 `03-static-guard` 拦截
- [ ] `powershell -File harness\run-all.ps1` 退出码 0

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- 文件首行 `'use client'`（含 `onClick` 与 `useRouter`）
- 必须用 `useRouter().replace()`，**不得用 `push()`**：城市切换是筛选而非导航，不应堆积历史
- URL 构造必须用 `URLSearchParams`，禁止字符串拼接
- 不得用 `window.location.href` / `location.search`（会整页刷新并丢失客户端状态）
- 不得用 `useSearchParams()`：当前城市与 query 均由服务端 `searchParams` 经 U2 传入，避免双重来源

### 5.2 Tailwind CSS + shadcn/ui

**⚠ 现状：无 Tailwind、无 shadcn/ui**，样式在 `city-switcher.module.css`（`.list` / `.chip` / `.active`）。

若引入后：

| 现状 | 目标 |
|---|---|
| `<ul className={styles.list}>` + `<li>` + `<button>` | `ToggleGroup type="single"` + `ToggleGroupItem`（原生支持 `aria-pressed` 语义） |
| 手写 `.active` 类 | `ToggleGroupItem` 的 `data-state="on"` 样式 |
| 说明文案 | 纯文本，无需组件 |

约束：用 `ToggleGroup` 后必须保留「点当前项不触发导航」的短路逻辑（`onValueChange` 在取消选中时也会触发）；不得用 `Tabs`（Tabs 语义为切换面板，不是筛选）。

### 5.3 响应式（desktop-first）

真相源：`frontend/components/home/city-switcher.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | 单行 8 项，`gap: 10px`，chip 内边距 `10px 20px`、字号 `15px` |
| `≤ 640px` | chip 内边距收窄为 `9px 16px`、字号降到 `14px`，按需换行 |

- `.list` 用 `display: flex; flex-wrap: wrap`，禁止 `overflow-x: auto`（会隐藏部分城市）
- chip 文本 `white-space: nowrap`，容器负责换行
- 320px 下不得出现横向滚动

### 5.4 图片（next/image）

**本单元无图片**。约束：不得为城市 chip 添加封面缩略图；若未来需要，走 `next/image` + 固定宽高，避免切换时布局跳动。

### 5.5 与现状的差异

| # | 本文档要求 | 仓库现状 | 影响 |
|---|---|---|---|
| 1 | 切换用 `replace` | 已实现 | 一致 |
| 2 | 保留其他查询参数 | 已实现（`URLSearchParams(query)`） | 一致 |
| 3 | 8 个 chip | 已实现（`CITIES` 8 项） | 一致 |
| 4 | shadcn `ToggleGroup` | CSS Modules 手写按钮 | 换栈需保留短路逻辑与 `aria-pressed` |
| 5 | 记住上次城市 | **未实现**（只认 URL） | 直接访问 `/` 永远从 `All cities` 开始 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 组件 | `frontend/components/home/city-switcher.tsx` |
| 样式 | `frontend/components/home/city-switcher.module.css` |
| 城市表 | `frontend/lib/home/cities.ts` |
| 类型 | `frontend/lib/home/types.ts`（`CitySlug`） |
| 挂载 | `frontend/app/page.tsx`（`<SectionBoundary title="城市入口">`） |
| 上游传参 | `frontend/app/page.tsx`（`parseCity` / `toQuery`） |
| 测试 | `frontend/components/home/city-switcher.test.tsx` |

```powershell
cd frontend
npx vitest run components/home/city-switcher.test.tsx
npm run build
cd ..
powershell -File harness\run-all.ps1
```
