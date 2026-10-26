# Design

## Context

见 proposal.md - Why。这里只补实现约束：

- 首页是 Next.js 16 App Router 的单入口 `app/page.tsx`，本身就是 Server Component（`searchParams` 为 Promise，必须 await）。
- 全站样式体系是 CSS Modules + `app/globals.css` 的 `--wc-*` 设计令牌与 `.wc-container` / `.wc-button` 等公共类，仓库内**没有 Tailwind，也没有 shadcn/ui**。
- 测试链为 vitest + jsdom + Testing Library，CSS Modules 在测试环境不产出真实类名，断言必须落在角色、可访问名称与文本上。
- 主视觉目前依赖三个数据契约常量（`EDITOR_PICKS_LIMIT`、`HOT_POSTS_LIMIT`、`HOT_ATTRACTIONS_LIMIT`）与城市白名单数量。

## Goals / Non-Goals

**Goals**

- 让主视觉拥有独立组件边界、独立样式文件与独立测试。
- 让 `page.tsx` 只承担「解析城市 → 编排区块」，不再 import 内容常量。
- 把主视觉的行为写进真相层，使 U2 的验收项可转绿。

**Non-Goals**

- 不改变任何可见文案、DOM 结构或视觉表现。
- 不引入 Tailwind / shadcn/ui（见决策 D2）。
- 不做城市感知（见决策 D5），不改图片方案（主视觉内没有图片）。

## Decisions

### D1：抽成 Server Component，不加 `'use client'`

主视觉没有任何交互状态：三个入口分别是两个 Next `Link` 与一个原生 `<a href="#cities">`，四项概览是静态数字。加 `'use client'` 只会把这段无交互的 DOM 推到客户端渲染。

替代方案：抽成客户端组件以便未来加动画——被否决。当前没有动画需求，提前引入客户端边界会增加首屏 JS。

### D2：沿用 CSS Modules，不借机引入 Tailwind / shadcn/ui

用 Radix/shadcn 的卡片刻画主视觉确实更省事，但代价是把「抽一个组件」升级成「替换全站样式体系」：8 个既有组件、`globals.css` 令牌、构建链与 04 闸门都要一并重验。

替代方案：本次顺带迁移样式体系——被否决，风险与收益不成比例。样式体系迁移应作为独立 change，且在它之后主视觉反而更容易写。

### D3：`stats` 可选，非法时「整组回退」而非「逐项回退」

逐项回退会产生 `编辑推荐 -1` 这类自相矛盾的展示（一项来自入参、一项来自默认值），且无法从界面上判断是否生效。整组回退只有两种稳定状态：全默认或全入参，语义可解释。

替代方案 A：`stats` 必填——被否决，页面当前没有传参需求，必填会让取值逻辑上浮到页面。替代方案 B：逐项回退——被否决，理由如上。

### D4：样式「迁走 + 从原文件删净」，不留别名

`home.module.css` 里的 hero 相关类迁到 `hero.module.css` 后，原文件对应规则必须删除。保留一份「兼容别名」会造成两份真相，改一处不生效，且下次排查时无法判断哪份在用。

替代方案：保留别名类过渡一个版本——被否决，本仓库没有外部消费方，不存在兼容窗口。

### D5：不接收 `city`

主视觉明确「不随城市筛选变化」（见 delta spec 的场景）。若把 `city` 传进来，就等于给未来「主视觉随城市改文案」留了一个静默生效的口子。城市语义统一归 U5，主视觉只消费与城市无关的契约常量。

### D6：用 DOM 结构比对证明「视觉零变化」

抽取前后各渲染一次 `HomePage`，对 `container.innerHTML` 做字符串比对应完全一致。这是唯一不依赖肉眼的硬证据；截图比对在本仓库没有基线图库，成本更高。

替代方案：人工截图对照——保留为补充手段，不作为判据。

## Risks / Trade-offs

- [样式漏迁导致某处回退到无样式] → 迁移后 grep `styles.` 引用，`page.tsx` 中 hero 相关引用必须为 0；`hero.test.tsx` 断言主视觉的标题与概览文本均存在。
- [测试误依赖 CSS Modules 类名] → 断言只使用角色、可访问名称与文本；vitest 环境下类名为 `undefined`，写类名断言会假红或假绿。
- [`#cities` 锚点与 U5 的 `id` 脱钩] → `hero.test.tsx` 断言锚点 `href="#cities"`；U5 的城市入口已用 `id="cities"`，两边都改需同一 change 内完成。
- [删除 import 时漏删，留下死引用] → `03-static-guard` 不查未使用变量，因此以 grep 复核 `page.tsx` 中不再出现 `CITIES`、三个 `*_LIMIT` 为准。

## Migration Plan

纯前端结构变更，无数据迁移、无发布顺序约束。回滚方式为 revert 本次提交；因为 DOM 结构不变，回滚不会影响任何外部契约。

## Open Questions

无。`#cities` 锚点的去留已在 D5 与风险项中定案。
