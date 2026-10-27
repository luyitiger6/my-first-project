# Design

## Context

动机见 `proposal.md` — Why。下面只记录决定实现方式的事实与约束（均为本轮实测）：

- `app/layout.tsx` 第 20 行写死 `lang="zh-CN"`；metadata 的 `title.default` 是「wanderchain · 把想去的地方走成路线」，`description` 为中文；第 22–24 行还有一个中文跳转链接「跳到主要内容」。无 openGraph。
- `lib/home/cities.ts` 的 `CityOption` 只有 `slug` / `name` / `tagline`，8 项全部是中文；`cityName()` 返回中文名，`parseCity()` 把非法值静默归一化为 `all`。
- `lib/home/types.ts` 三类内容均无英文字段：`EditorPick` 有 `title` / `summary` / `editor`，`Post` 有 `title` / `author`，`Attraction` 有 `name`。
- `lib/home/mock-data.ts` 共 299 行，内容量为 6 条编辑推荐 / 14 条帖子 / 9 个景点。
- `lib/home/format.ts` 只有两个函数：`formatCount` 对 ≥10000 手拼「万」，否则 `toLocaleString('zh-CN')`；`formatDate` 手拼「X 月 X 日」。
- `lib/search/query.ts` 的 `matchableCity()` 只返回 `cityName(city)`，`all` 返回空串；`GROUP_META` 的分组名与回链文案、`hitCityLabel()` 的「全城」、`toPostHit()` 的「X 评论」、`toAttractionHit()` 的「评分 X · Y 浏览」全是硬编码中文。
- `package.json` 只有 next / react / react-dom 三个运行时依赖，没有任何 i18n 库；`next.config.ts` 无 i18n 段。

## Goals / Non-Goals

**Goals:**

- 界面英文单语可读，`lang` 与元数据正确，海外用户打开即能读懂并完成检索。
- 数据层中英文并存，界面只读英文字段；中文作为内容资产不丢。
- 搜索同时接受中文与英文输入，英文用户输入城市名不再零命中。
- 全部改动可被现有前端单测套件与九道闸门机械验证。

**Non-Goals:**

- 不做语言切换、不做 locale 路由、不引 next-intl / react-i18next（产品规格明确「不做 i18n 框架」）。
- 不做 AI 拍照理解 / 菜单 OCR / 多模态——留到移动端 change。
- 不做 Tailwind + shadcn 迁移、不新增详情页与 RAG、不做 `/api/v1` 化。
- 不改品牌名 `wanderchain`，不改 URL 契约（`?city=` 与 `?q=` 保持原样）。

## Decisions

**1. 英文单语，而不是中英双语 UI**

P0 规格 §0.3-3 明确「UI 英文优先；不做 i18n 框架」。做双语切换会引入 locale 状态、路由前缀、文案资源文件与双份测试断言，收益却只是让中文用户继续看中文——与本产品「给外国游客用」的定位相反。

替代方案：`/zh` `/en` 双语路由 + next-intl（被否：违反规格约定，且把本 change 的工作量放大三倍）。

**2. 数据层是「加字段」而不是「换语言」**

中文字段留在原位，英文字段并列新增：城市的 `nameEn` / `taglineEn`，编辑推荐的 `titleEn` / `summaryEn` / `editorEn`，帖子的 `titleEn` / `authorEn`，景点的 `nameEn`。理由有二：中文内容是已经写好的资产；规格要求「同时保留中英文」。命名沿用项目既有的驼峰契约（`types.ts` 全驼峰），不照抄规格里的 `name_en` 蛇形写法——那是数据库列名，不是前端类型。

**3. 城市保留 7 个，有意偏离 P0 规格的 3 城**

P0 规格 §0.3-2 限定 `shanghai` / `beijing` / `chengdu`。本次按产品负责人的决定保留现有 7 城（另含 `guangzhou` / `xian` / `hangzhou` / `sanya`），只补英文字段。这不改变任何代码结构，后续若要收敛到 3 城，只需删数据行并同步 spec。

**4. 搜索规格走 REMOVED + ADDED，不走 MODIFIED**

原「匹配字段与分组」含 Scenario「城市 slug 不作为匹配依据」。英文名 `Chengdu` 与 slug `chengdu` 同形，新行为下该场景必然被推翻；而 `openspec validate --strict` 拒绝 MODIFIED 丢弃既有 Scenario（报 `omits scenario(s) the current spec still has`）。因此退役整条、以新命名条款承接，主 spec 的 Requirement 总数不变。

替代方案：保留该 Scenario 并在新条款里声明优先级（被否：一条自相矛盾的场景留在真相层，比多一个 delta 段更贵）。

**5. `lang` 与页面元数据归入 `wanderchain-homepage` 的新条款**

`<html lang>` 实际写在 `layout.tsx`（全站），但 `frontend-nextjs` 能力的 5 条 Requirement 只讲独立构建、同源代理、测试链、闸门接入与静态红线，把语言约束塞进它会稀释该能力的边界。本次只有首页与 `/search` 两个消费方，先放在首页语言基线里；将来若出现非首页的英文页面，再提升为独立能力。

**6. 格式化改用 `Intl` 而不是手写映射**

`formatCount` 用 `Intl.NumberFormat('en-US')`，`formatDate` 用 `Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })`。现有手写实现有两个具体缺陷：`formatCount` 的「万」在英文语境无意义；`formatDate` 的 `getMonth()` 走运行环境时区，服务端渲染与客户端可能差一天。

**7. 空态文案直接采用规格原文**

`Be the first to ask`（热门帖子空态）与 `Browse attractions`（热门景点空态）来自 P0 规格 AC-1.6 / AC-1.8，不另造措辞——这些文案后续会与真实 API 的错误码一起被复用。

**8. 「界面无中文」由一条守卫用例兜住**

中文字符串散落在 layout 的 skip link、`section-state`、`placeholder`、`auth-form` 等十余处，靠人眼逐个排查必漏。在 `app/page.test.tsx` 增加一条断言：渲染结果的 `textContent` 不匹配 `/\p{Script=Han}/u`。这条用例会一次性捕获所有遗漏，且长期防回归。

## Risks / Trade-offs

- [中文用户界面突然全英文] 这是产品定位的必然结果，不是缺陷 → 在 proposal 的 BREAKING 标注里写明；若将来要服务国内用户，另立 change 做 locale 路由。
- [29 条 Mock 内容的英文翻译质量] 人工撰写并与中文字段语义对齐，不做机翻直出 → 三类内容分批完成，每条与中文字段一一对应；完成后人工抽查 3 条。
- [测试断言批量改写可能掩盖真实回归] 只改断言的文案字面量，结构、角色与交互断言一律不动 → 改写后必须全绿且通过用例数不少于改前基线（以改前 `npm run test` 的输出为准，新增用例后只增不减）。
- [英文名与 slug 同形导致「slug 不参与匹配」不可再机械证明] → 用 `xian` / `Xi'an` 这一对不同形的组合作为负例：搜 `xian` 必须零命中，从而证明匹配走的是英文名而非 slug。
- [Mock 数据加字段后可能有位置漏填] → 新字段在 `types.ts` 中设为必填（非可选），`tsc --noEmit` 会把所有漏填位置直接报出来，不靠人眼巡查。
- [中文字段保留但被误渲染] → 守卫用例（Decision 8）兜底；同时代码评审只允许组件读取 `*En` 字段。

## Migration Plan

单次前端提交，无数据迁移、无后端改动、无依赖升级。回滚即 `git revert` 该子模块提交。URL 契约（`?city=`、`?q=`）不变，外部书签不受影响；`/search` 的中文关键词仍可命中，因此旧链接不会失效。
