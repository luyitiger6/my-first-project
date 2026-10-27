# Design

## Context

动机见 `proposal.md` — Why。下面只记录决定实现方式的事实与约束（均为本轮实测）：

- 首屏当前是 `frontend/components/home/hero.tsx`（Server Component，接收可选 `stats`）+ `hero.module.css`；`app/page.tsx` 以 `<HomeHero />` 无参调用。`stats` 只被 `hero.test.tsx` 覆盖，业务侧从未传入。
- 图片链路已就绪：`next.config.ts` 声明 `images.loader: 'custom'` 与 `loaderFile: './lib/image-loader.ts'`，loader 把宽度档位写进 Unsplash 的 `w` 参数，请求不经过 `/_next/image`，因此**不需要** `remotePatterns`，也不引入 sharp。
- 首页列表上限是截断而非分页：`HOT_POSTS_LIMIT = 10` 而已发布帖子有 13 条，`HOT_ATTRACTIONS_LIMIT = 5` 而已发布景点有 7 个。`mockRepository` 的 `paginate()` 会丢掉窗口外的条目，所以**搜索不能复用 `list*`**。
- 三类内容字段不对称：`Post` 无 `coverUrl`、无 `summary`；`Attraction` 无 `summary`；`EditorPick` 无 `status`（全部视为可展示）。
- `city` 字段存的是 slug（`beijing` / `all` …），中文名只能经 `cityName()` 得到；直接对 slug 做 `includes` 会让「搜索成都」永远落空。
- 首页区块里只有城市区块带 `id="cities"`；`editor-picks` / `hot-posts` / `hot-attractions` 三个 `<section>` 只有 `data-section`，没有锚点 id。
- `docs/specs/wanderchain/homepage-hero.md` 仍是「四项统计 + 无搜索」的旧描述，且它声明的 768/1024 断点与 `hero.module.css` 实际的 `max-width: 860px` 早已对不上（hero 未登记进 08 闸门的配对表，所以无人拦截）。

## Goals / Non-Goals

**Goals:**

- 首屏换成可在大图上叠字的骨架，并在同一屏内提供唯一的检索入口。
- 检索扫全量 Mock 数据，结果按内容类型分组，城市中文名可命中。
- 检索层是纯函数 + Server Component，整条链路零客户端状态、零网络请求；`hero` 与 `/search` 都能在禁用 JS 时工作。
- 让 docs 单元文档追上新实现，并把 hero、search 两份文档纳入 08 闸门的断点校验，避免再次平行漂移。

**Non-Goals:**

- 不做相关性打分、分页、联想补全、搜索历史、城市内二次筛选；数据量只有 6/13/7 条，排序噪声大于收益。
- 不新建详情页，因此结果条目不可点击，只提供分组回首页锚点。
- 不动 `/community`、`/attractions` 两个占位页，不加导航栏入口，不改 `lib/home/repository.ts` 的既有列表契约。
- 不引入 Tailwind / shadcn / Radix，不新增 npm 依赖。

## Decisions

**1. 首屏大图用 `next/image` 的 `fill`，不用 CSS `background-image`**

`fill` 让图片成为普通 `<img>`，可直接复用自定义 loader 的多档 `srcset`；`sizes="100vw"` 说明真实显示宽度；`priority` 让它进首屏关键路径；装饰性大图设 `alt=""` + 容器 `aria-hidden`，不占屏幕阅读器朗读。遮罩与底部渐变用两层绝对定位的 div（`.veil` / `.fade`）实现，`.fade` 用 `linear-gradient(transparent, var(--wc-sand))` 与下方沙色区块对接。

替代方案：CSS `background-image`（被否：拿不到多档源与尺寸占位，且与单元文档「内容图禁用 background-image」的既有约束冲突）；新增图源（被否：复用已有 Unsplash photoId 即可，不引入新资源）。

**2. 搜索框是原生 `<form method="get" action="/search">`**

表单内一个 `name="q"` 的 `<input type="search" required>` + 提交按钮，配一个用 `.wc-visually-hidden` 隐藏但真实存在的 `<label>`。浏览器原生提交即导航到 `/search?q=…`，hero 不需要 `'use client'`，「零数据请求」Scenario 不需要任何新豁免。

替代方案：`useRouter().push()`（被否：hero 变客户端组件，首屏与 spec 的静态渲染语义都要重写）；受控输入 + 回车拦截（被否：纯属实现复杂度，原生表单已覆盖）。

**3. 删除 `stats` 入参，而不是保留成可选**

四个数字全部由 `*_LIMIT` 派生，而这些上限正是搜索要穿透的东西——留在首屏等于在首页展示「热门景点 5」，与「数据里其实有 7 个」自相矛盾。组件签名退化为 `HomeHero()`，`HeroStat` / `HeroStatLabel` / `HeroStatProps` 一并删除，规格里对应的两条 Scenario 一并移除。

替代方案：保留入参但默认不渲染（被否：留一份没人用、却被测试锁死的契约）；把数字改成「共 N 条」（被否：那是列表 `total` 的职责，首屏不应重复区块信息）。

规格层对应动作是 **REMOVED + ADDED** 而不是 MODIFIED：`openspec validate` 拒绝 MODIFIED 丢弃既有 Scenario（会报「omits scenario(s) the current spec still has」），而「四项概览」「入参整组回退」两条场景在新行为下已经不存在，只能随旧 Requirement 一起退役，再由新命名的「首屏主视觉与站内搜索入口」承接全部首屏行为。归档后主 spec 的 Requirement 总数不变（退役 1 条、新增 1 条）。

**4. 城市规模提示由白名单派生**

文案固定，数量取 `CITIES.filter((c) => c.slug !== 'all').length`。这样加/删城市时首屏不会说谎，也与 spec 的「城市规模提示与城市白名单一致」Scenario 对应。

**5. 检索层是独立纯函数模块 `frontend/lib/search/query.ts`**

输入原始关键词字符串，输出 `{ query, total, groups }`：`query` 是 `trim()` 后的回显值，`groups` 只包含有命中的分组，每组带 `heading`、`count`、`items`、`anchorHref`、`anchorLabel`。`groups` 的顺序在代码里写死为 编辑推荐 → 帖子 → 景点。函数直接 import `EDITOR_PICKS` / `POSTS` / `ATTRACTIONS` 原始数组，绕过仓储的 `paginate()`。

替代方案：给 `HomeRepository` 加 `search()`（被否：会把检索语义塞进首页能力的数据契约，还要改「契约与 Mock 数据层」这条 Requirement，两个能力被绑死）；在页面组件里内联过滤（被否：无法单测，页面测试会被数据细节淹没）。

**6. 匹配字段与归一化**

关键词 `trim()` + `toLowerCase()`；对每条内容拼出一个 haystack 再做 `includes`：

| 类型 | 参与匹配的字段 |
|---|---|
| 编辑推荐 | `title`、`summary`、`editor`、城市中文名 |
| 帖子 | `title`、`author`、城市中文名（仅 `published`） |
| 景点 | `name`、城市中文名（仅 `published`） |

城市中文名经 `cityName()` 得到；`city === 'all'` 的内容**不**把城市名放进 haystack（`cityName('all')` 返回「全部」，否则搜「全部」会命中一条全城通用内容，语义误导）。

**7. 结果分组呈现，不做统一卡片**

`Post` 没有封面与摘要，统一卡片必然有的有图有的没图。分组后每组用同一套极简行式条目：标题 + 城市中文名 + 该类型可用的一条元信息（编辑推荐用编辑署名、帖子用作者与评论数、景点用评分与浏览数）。条目用 `<li>` + `<p>`/`<span>`，**不**包 `<Link>`；每组末尾一个 `Link` 到 `/#editor-picks`、`/#hot-posts`、`/#hot-attractions`。

为让这三条回链不落空，需要在 `editor-picks.tsx` / `hot-posts.tsx` / `hot-attractions.tsx` 的 `<section>` 上各补一个 `id`（`data-section` 保留不动，首页顺序测试继续用它断言）。

**8. `/search` 是 Server Component 页面**

`app/search/page.tsx` 接收 `searchParams: Promise<Record<string, string | string[] | undefined>>`（与首页同构），只取第一个值；渲染 `SiteHeader` / `SiteFooter`，正文按「无关键词 → 引导态 / 零命中 → 空态 / 有命中 → 分组」三选一。页面导出 `metadata`（`title: '搜索'`），并输出唯一 `h1`。搜索页不读 `?city=`。

**9. 文档与闸门同步**

`docs/specs/wanderchain/homepage-hero.md` 重写（去掉统计面板与 `stats` 契约，补大图、搜索框、城市规模提示），`docs/specs/wanderchain/search-page.md` 新增；两份都在 5.x 响应式小节写 `真相源：` + 与 CSS `max-width` 完全一致的断点，然后登记进 `harness/checks/08-spec-doc-breakpoints.ps1` 的 `$pairs`。这样 hero 的「文档写 768、实现写 860」这类漂移今后会被闸门直接拦下。

## Risks / Trade-offs

- [首屏大图的 LCP 与流量] 全宽大图在移动端也会取约 100vw 宽的档位 → 用 `sizes="100vw"` 让 loader 取到正确档位，`priority` 保证不延迟，并沿用 Unsplash 的 `auto=format`（AVIF/WebP 由 CDN 协商）。
- [白字压图的可读性不稳定] → 遮罩用上下深、中间略浅的三段渐变保证对比度，标题与导语不直接压在最亮区域；文案块限制 `max-width` 并加轻微 `text-shadow`。
- [jsdom 测不到自定义 loader 的 srcset 档位] → 组件测试只断言 `<img>` 存在、`alt` 为空、`sizes` 属性值，不试图断言多档 URL；档位正确性由 `lib/image-loader.test.ts` 既有用例保证。
- [搜索词回显造成 XSS] → 关键词只以 React 文本节点渲染，不拼 `dangerouslySetInnerHTML`；`q` 只做 `trim` 后回显。
- [锚点回链依赖三个区块的 id] → 若区块 id 未补，回链只是跳回页首，不报错；任务里把三个 id 与首页顺序测试放在同一步核对。
- [Mock 数据变更会让搜索测试变脆] → 测试断言「被首页截断的条目能被搜到」时选取当前数据里确定存在的关键词，并在断言失败信息里写明数据依赖。

## Migration Plan

单次前端提交即可上线，无数据迁移、无向后兼容负担。若需回滚，`git revert` 该子模块提交即可（首屏与 `/search` 都是新增/重写文件，不涉及外部契约）。`/search` 页面在旧版本访问会 404，属预期。
