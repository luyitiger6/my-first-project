# Proposal

## Why

对 `docs/specs/wanderchain/` 全部 137 条场景做逐条审计后，仍有 6 条未覆盖，另有 61 条虽由代码满足却没有任何自动化断言。未覆盖项里的三条是实现与文档的硬缺口：320px 下热门景点仍是两列、占位页没有站点框架导致进去后回不来、首页对缺失的 `searchParams` 没有兜底。两条是文档措辞与主规格「英文界面语言」冲突——文档把 AI 助手上下文缺失的错误文案写成中文，而实现与主规格都要求英文。还有一条（首屏锚点目标缺失）把浏览器默认行为写成了验收标准，无法被任何断言保障。

这些缺口的共同点是：闸门全绿也发现不了。08 只比对断点集合，07 只比对闸门清单与技术栈token，主规格又没有覆盖响应式列数与站点框架，于是文档、CSS 与测试三方可以各自平行。

## What Changes

- **热门景点补单列断点**：`hot-attractions.module.css` 增加 `max-width: 480px` 的单列规则；`homepage-u8-hot-attractions.md` 的响应式小节同步声明 `≤ 480px`，保持与 08 闸门的配对约定。
- **占位页补站点框架**：`PlaceholderPage` 渲染 `SiteHeader` 与 `SiteFooter`，使 `/community`、`/attractions` 能导航回首页；登录与注册页保持独立双栏品牌页，`homepage-u2-skeleton.md` 的「任意路径」相应收窄为「首页与占位页」，并写明登录/注册为刻意的例外。
- **错误文案对齐英文**：`homepage-u3-feature-nav.md` 与 `homepage-u4-ai-assistant.md` 中 `useAiAssistant` 上下文缺失的期望文案，由中文改为实现实际抛出的英文文案。主规格「英文界面语言」优先于草稿层文档，因此改文档而非改代码。
- **锚点场景降级**：`homepage-hero.md` 的「锚点目标缺失」明确标注为浏览器默认行为、本单元不作保障，不再充当验收标准。
- **查询参数兜底**：首页页面组件对 `searchParams` 取缺省空对象，避免缺失时抛错。
- **补约 20 条断言**：覆盖排名补零、元信息拼接、计数格式化、极端数值、城市过滤、切换城市重取、竞态丢弃、数组型参数、缺失 `searchParams`、会话过期与损坏、SSR 守卫、重复提交禁用、上下文缺失抛错。

无 **BREAKING** 变更：所有改动都是让实现、文档与主规格收敛到同一套行为，不改变主规格已声明的外部行为。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- 无。本次属于文档、样式与测试对齐，主规格已声明的行为不变，因此 `.openspec.yaml` 声明 `skip_specs: true`。

## Impact

- 前端样式：`frontend/components/home/hot-attractions.module.css`
- 前端组件：`frontend/components/site/placeholder.tsx`、`frontend/app/page.tsx`
- 前端测试：`hot-attractions.test.tsx`、`hot-posts.test.tsx`、`city-switcher.test.tsx`、`app/page.test.tsx`、`lib/auth/mock-auth.test.ts`，并新增 `auth-form.test.tsx` 与 AI 助手上下文缺失用例
- 文档：`docs/specs/wanderchain/` 下的 `homepage-hero.md`、`homepage-u2-skeleton.md`、`homepage-u3-feature-nav.md`、`homepage-u4-ai-assistant.md`、`homepage-u8-hot-attractions.md`
- 闸门：08 要求 u8 文档断点集合与 CSS `max-width` 集合完全相等，480 必须两侧同改；新增测试不改变闸门清单
