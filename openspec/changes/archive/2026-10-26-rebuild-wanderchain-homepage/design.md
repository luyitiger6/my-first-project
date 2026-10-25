# Design

## Context

- 前端是 `frontend/` 子模块，Next.js 16.4.3 + React 19.3.1（App Router），无 UI 库、无 Tailwind，测试链为 vitest + jsdom + Testing Library，已可运行。
- 现有首页是 Todo 示例：`app/page.tsx` 渲染 `components/TodoApp.tsx`，数据经 `lib/api.ts` 走 `/api/todos`；`app/api/[...path]/route.ts` 提供运行期可切换的同源代理。
- Harness 03 扫描前端 `.ts/.tsx`，拦截 `TODO/FIXME/XXX` 与 `it.skip/describe.skip/xit/xdescribe`；04 依次执行 `npm ci` → `npm run build`（含 TS 类型检查）→ `npm run test`。
- 本期没有 wanderchain 后端 API，首页必须在不启动任何服务的情况下可构建、可测试、可展示。

## Goals / Non-Goals

**Goals:**

- 9 个单元各自可独立开发、独立测试、独立交付，Mock 数据即契约。
- 首页在无后端时呈现完整旅行平台首页（导航、城市、编辑精选、热门帖、热门景点、AI 入口）。
- 不新增 npm 依赖，`run-all.ps1` 00–06 全部通过。

**Non-Goals:**

- 真实 API、数据库、JWT 签发与校验、admin 后台、社区/攻略详情页、全局搜索与通知。
- 多语言、暗黑模式、复杂动效、图片上传。

## Decisions

**D1 一个能力承载 9 个单元，而非 9 个 capability。** 能力按内聚行为划分，wanderchain 首页是一个整体；"独立交付"通过契约、每单元独立测试文件与 tasks 分组保证。备选：9 个 capability 会把真相层切成 9 份近乎空壳的 spec，归档与审计成本远高于收益。

**D2 Mock 仓储集中实现排序与过滤，组件只负责渲染。** `lib/home/` 暴露类型、城市白名单、`mockRepository`；三张列表的排序规则（sort_order / 评论数 / 浏览数）写在仓储里，可被单测直接断言。切换真实 API 时只替换仓储实现，组件与测试不动。

**D3 城市状态走 URL `?city=`，不用全局 Context。** 好处是刷新可复现、可分享、单元测试只需构造 URL；非法或缺失值统一归一化为 `all`。城市切换器只负责改写 URL，内容区块自行读取参数，两者无代码级互相依赖。

**D4 认证为前端 Mock：Context + localStorage + 三段式假令牌。** 令牌形如 `header.payload.signature`，payload 含 `sub/role/exp`，仅用于演示角色字段，不验签、不联网。登录页 `/login`、注册页 `/register` 为独立路由；头部只消费 `useAuth()` 的三态（loading / guest / user）。

**D5 样式用 CSS Modules，每单元一个 `.module.css`，设计令牌集中在 `globals.css`。** 不引入 Tailwind/shadcn：本期无 UI 库依赖需求，新增依赖会牵动 `package-lock.json` 与 04 闸门的安装步骤，收益不匹配风险。

**D6 删除范围限定在 Todo 界面，保留代理。** 删 `components/TodoApp.tsx`、`components/TodoApp.test.tsx`、`lib/api.ts`；保留 `app/api/[...path]/route.ts` 与其测试、`next.config.ts`、`Dockerfile`。代理是后续真实 API 的前置基础设施，删了还要再建。

**D7 封面图用原生 `<img>` + 外链 URL，不用 `next/image`。** 避免 `remotePatterns` 配置与图片优化器在离线/构建环境的额外约束；统一 `loading="lazy"`、`width/height` 与背景色兜底，防止布局抖动。

**D8 登录标识定为邮箱（与 US-1 一致），用户名仅用于展示。** 原始范围写的是"用户名 + 密码"，用户故事写的是 email + password，两者冲突；选邮箱是因为注册唯一性与找回密码路径都依赖它。若后续确认为用户名唯一，只改 Mock 仓储与表单校验两处。

**D9 单区块失败隔离用 Error Boundary，而不是每个组件 try/catch。** 每个区块外面包一层 `SectionBoundary`（客户端组件，`getDerivedStateFromError`），失败只降级自身；这样仓储抛错、组件渲染抛错都被覆盖。

**D10 admin 角色只做字段可验证。** Mock 账号 `admin@wanderchain.dev` 登录后 `role=admin`，界面不提供任何管理能力；编辑推荐的"admin 精选"只体现为数据字段与文案。

## Risks / Trade-offs

- **Mock 与真实 API 形状漂移**：约定未来 API 必须满足现有类型；类型是唯一出口，形状变化会先在编译期报错。代价是真实 API 落地时需要一次契约对齐。
- **外链图片不可达**：统一使用固定 Unsplash 图片 ID + 背景色兜底；断言只针对 `src` 属性，不对图片加载成功做验收。
- **Mock 认证给人虚假安全感**：规格明确"仅前端占位"，界面文案不出现"安全/加密"表述；真实认证另立项。
- **直改 `frontend-nextjs` 主 spec 的 Purpose**：CLI 不支持通过 delta 修改 Purpose，而原 Purpose 写着"Todo 界面"。tasks 中列为显式步骤并在归档前复核，避免静默改动。
- **CSS Modules 局部重复**：各单元自包含会重复少量布局样式，换来单元可独立删除/替换；令牌集中在 globals 内控制膨胀。
