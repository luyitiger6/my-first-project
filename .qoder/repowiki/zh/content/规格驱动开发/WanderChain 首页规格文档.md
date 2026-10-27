基于分析，我现在了解了具体的变更内容。让我更新 WanderChain 首页规格文档：

# WanderChain 首页规格文档

<cite>
**本文引用的文件**   
- [README.md](file://README.md)
- [homepage-hero.md](file://docs/specs/wanderchain/homepage-hero.md)
- [homepage-u1-mock-auth.md](file://docs/specs/wanderchain/homepage-u1-mock-auth.md)
- [homepage-u2-skeleton.md](file://docs/specs/wanderchain/homepage-u2-skeleton.md)
- [homepage-u4-ai-assistant.md](file://docs/specs/wanderchain/homepage-u4-ai-assistant.md)
- [homepage-u5-city-switcher.md](file://docs/specs/wanderchain/homepage-u5-city-switcher.md)
- [homepage-u8-hot-attractions.md](file://docs/specs/wanderchain/homepage-u8-hot-attractions.md)
- [frontend/app/page.tsx](file://frontend/app/page.tsx)
- [frontend/app/layout.tsx](file://frontend/app/layout.tsx)
- [frontend/components/home/hero.tsx](file://frontend/components/home/hero.tsx)
- [frontend/components/home/hero.module.css](file://frontend/components/home/hero.module.css)
- [frontend/components/home/hero.test.tsx](file://frontend/components/home/hero.test.tsx)
- [frontend/components/home/use-section-data.ts](file://frontend/components/home/use-section-data.ts)
- [frontend/components/home/feature-nav.tsx](file://frontend/components/home/feature-nav.tsx)
- [frontend/components/home/ai-assistant.tsx](file://frontend/components/home/ai-assistant.tsx)
- [frontend/components/home/ai-assistant.module.css](file://frontend/components/home/ai-assistant.module.css)
- [frontend/components/home/ai-assistant.test.tsx](file://frontend/components/home/ai-assistant.test.tsx)
- [frontend/components/site/site-header.tsx](file://frontend/components/site/site-header.tsx)
- [frontend/components/home/editor-picks.tsx](file://frontend/components/home/editor-picks.tsx)
- [frontend/components/home/hot-posts.tsx](file://frontend/components/home/hot-posts.tsx)
- [frontend/components/home/hot-attractions.tsx](file://frontend/components/home/hot-attractions.tsx)
- [frontend/components/home/city-switcher.tsx](file://frontend/components/home/city-switcher.tsx)
- [frontend/app/community/page.tsx](file://frontend/app/community/page.tsx)
- [frontend/app/attractions/page.tsx](file://frontend/app/attractions/page.tsx)
- [frontend/lib/image-loader.ts](file://frontend/lib/image-loader.ts)
- [frontend/lib/image-loader.test.ts](file://frontend/lib/image-loader.test.ts)
- [frontend/next.config.ts](file://frontend/next.config.ts)
- [frontend/components/home/editor-picks.module.css](file://frontend/components/home/editor-picks.module.css)
- [frontend/components/home/hot-attractions.module.css](file://frontend/components/home/hot-attractions.module.css)
</cite>

## 更新摘要
**所做更改**
- 新增独立的 Hero 首屏组件规格与实现
- 增强 Mock 认证、骨架结构、城市切换器、热门景点规格文档
- **新增 AI 助手模态框无障碍功能增强**：焦点陷阱、背景滚动锁定、完整键盘导航支持
- **新增九个规格场景（S15-S17）**：Tab 键正向循环、Shift+Tab 反向循环、背景滚动锁定行为
- 更新首页聚合器以使用新的 Hero 组件
- 完善类型定义和验收标准
- **修正热门景点区块响应式设计规范**：从移动优先改为桌面优先策略，断点从640px/1024px调整为1080px/720px
- **更新图片处理机制说明**：现在使用Next.js Image优化和自定义loader，不再需要images.remotePatterns配置

## 目录
1. [引言](#引言)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能与可维护性](#性能与可维护性)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)

## 引言
本规格文档聚焦 WanderChain 首页能力，围绕"城市旅行指南"的入口、导航、内容与交互契约进行说明。当前实现以 Next.js 前端为主，后端接口尚未接入；所有数据通过 Mock 仓储提供，确保 UI 与业务逻辑可在零网络请求下独立开发与验收。

该仓库采用"规格 + 护栏 + 技能"三层工作区模式：`openspec/` 定义意图与主规格，`harness/` 用闸门链保证构建、迁移与一致性，`.agents/skills/` 固化 AI 编码方法。WanderChain 首页属于 `wanderchain-homepage` 能力，其子单元契约位于 `docs/specs/wanderchain/`。

**章节来源**
- [README.md:1-111](file://README.md#L1-L111)

## 项目结构
WanderChain 首页由一个页面级路由和多个可复用区块组成：

- 页面层：`frontend/app/page.tsx` 作为首页入口，负责解析 URL 城市参数、组装 Hero 区域与区块容器。
- Hero 首屏：独立的 `HomeHero` 组件，包含品牌标识、主标题、CTA 按钮和统计面板。
- 区块组件：功能导航、城市切换、编辑推荐、热门帖子、热门景点分别位于 `components/home/*`。
- 共享 Hook：`useSectionData` 统一封装加载、就绪、错误三态。
- **AI 助手模态框**：Provider 管理面板开关、焦点恢复、Esc 关闭、遮罩点击关闭，以及完整的键盘导航支持。
- **响应式图片优化**：自定义 image loader、srcset 生成、sizes 属性计算，针对封面图进行性能优化。
- 占位页：`/community` 与 `/attractions` 为板块建设中的占位页面。

```mermaid
graph TB
Home["首页<br/>frontend/app/page.tsx"] --> Header["站点头部<br/>SiteHeader"]
Home --> Footer["站点底部<br/>SiteFooter"]
Home --> Hero["Hero 首屏<br/>hero.tsx"]
Home --> FeatureNav["功能导航<br/>feature-nav.tsx"]
Home --> CitySwitcher["城市切换<br/>city-switcher.tsx"]
Home --> EditorPicks["编辑推荐<br/>editor-picks.tsx"]
Home --> HotPosts["热门帖子<br/>hot-posts.tsx"]
Home --> HotAttractions["热门景点<br/>hot-attractions.tsx"]
FeatureNav --> AiAssistant["AI 助手面板<br/>ai-assistant.tsx"]
EditorPicks --> UseSection["区块数据钩子<br/>use-section-data.ts"]
HotPosts --> UseSection
HotAttractions --> UseSection
AiAssistant --> FocusTrap["焦点陷阱<br/>Tab/Shift+Tab 循环"]
AiAssistant --> ScrollLock["滚动锁定<br/>body.style.overflow"]
EditorPicks --> ImageOptimization["图片优化<br/>image-loader.ts"]
HotAttractions --> ImageOptimization
ImageOptimization --> NextConfig["Next.js 配置<br/>next.config.ts"]
```

**图表来源**
- [frontend/app/page.tsx:1-71](file://frontend/app/page.tsx#L1-L71)
- [frontend/components/home/hero.tsx:1-93](file://frontend/components/home/hero.tsx#L1-L93)
- [frontend/components/home/feature-nav.tsx:1-116](file://frontend/components/home/feature-nav.tsx#L1-L116)
- [frontend/components/home/city-switcher.tsx:1-74](file://frontend/components/home/city-switcher.tsx#L1-L74)
- [frontend/components/home/editor-picks.tsx:1-66](file://frontend/components/home/editor-picks.tsx#L1-L66)
- [frontend/components/home/hot-posts.tsx:1-59](file://frontend/components/home/hot-posts.tsx#L1-L59)
- [frontend/components/home/hot-attractions.tsx:1-70](file://frontend/components/home/hot-attractions.tsx#L1-L70)
- [frontend/components/home/use-section-data.ts:1-44](file://frontend/components/home/use-section-data.ts#L1-L44)
- [frontend/components/home/ai-assistant.tsx:1-212](file://frontend/components/home/ai-assistant.tsx#L1-L212)
- [frontend/lib/image-loader.ts:1-20](file://frontend/lib/image-loader.ts#L1-L20)
- [frontend/next.config.ts:1-14](file://frontend/next.config.ts#L1-L14)

**章节来源**
- [frontend/app/page.tsx:1-71](file://frontend/app/page.tsx#L1-L71)

## 核心组件
- **Hero 首屏组件**：独立的 `HomeHero` 组件，包含眉标、主标题、导语、CTA 按钮和统计面板，支持自定义统计数据展示。
- 首页聚合器：解析 `searchParams`，调用 `parseCity` 得到当前城市，并将城市与查询参数透传给各区块。Hero 区域展示本期统计上限，区块按"功能入口 → 城市入口 → 内容列表"顺序渲染。
- 区块数据钩子：`useSectionData` 将异步数据源包装为 `{loading, error, ready}` 三态，避免重复拉取并处理组件卸载后的状态更新。
- 功能导航：包含旅游社区、景点攻略两个链接卡片，以及 AI 助手按钮；后两者分别跳转到占位页或唤起同一面板。
- **AI 助手模态框**：Provider 管理面板开关、焦点恢复、Esc 关闭与遮罩点击关闭；触发器支持头部与悬浮两种形态。**新增完整无障碍支持**：焦点陷阱（Tab/Shift+Tab 循环）、背景滚动锁定、键盘导航支持。
- 城市切换：根据 URL `?city=` 渲染选中项，点击时替换查询参数，保持其他查询键不变。
- 内容区块：编辑推荐、热门帖子、热门景点均通过 `mockRepository` 获取数据，并按各自排序与过滤规则展示。
- **响应式图片优化系统**：自定义 next/image loader 将宽度档位直接写入 Unsplash CDN 参数，结合 srcset 和 sizes 属性实现智能图片加载。

**章节来源**
- [frontend/components/home/hero.tsx:10-44](file://frontend/components/home/hero.tsx#L10-L44)
- [frontend/app/page.tsx:32-35](file://frontend/app/page.tsx#L32-L35)
- [frontend/components/home/use-section-data.ts:6-43](file://frontend/components/home/use-section-data.ts#L6-L43)
- [frontend/components/home/feature-nav.tsx:50-115](file://frontend/components/home/feature-nav.tsx#L50-L115)
- [frontend/components/home/ai-assistant.tsx:41-120](file://frontend/components/home/ai-assistant.tsx#L41-L120)
- [frontend/components/home/city-switcher.tsx:13-31](file://frontend/components/home/city-switcher.tsx#L13-L31)
- [frontend/lib/image-loader.ts:1-20](file://frontend/lib/image-loader.ts#L1-L20)

## 架构总览
WanderChain 首页采用"页面装配 + 区块消费 + Mock 仓储"的分层结构。当前阶段不依赖真实后端，所有数据契约以类型与 Mock 数据固定，后续替换为真实 API 时，组件与测试无需重写。

```mermaid
graph TB
subgraph "页面层"
Page["首页 page.tsx"]
Layout["根布局 layout.tsx"]
end
subgraph "交互层"
Hero["Hero 首屏 hero.tsx"]
Nav["功能导航 feature-nav.tsx"]
City["城市切换 city-switcher.tsx"]
AI["AI 助手 ai-assistant.tsx"]
end
subgraph "内容区块"
Picks["编辑推荐 editor-picks.tsx"]
Posts["热门帖子 hot-posts.tsx"]
Attractions["热门景点 hot-attractions.tsx"]
end
subgraph "数据层"
Hook["use-section-data.ts"]
Repo["Mock 仓储 repository.ts契约"]
end
subgraph "图片优化层"
Loader["自定义 image loader<br/>image-loader.ts"]
Config["Next.js 配置<br/>next.config.ts"]
CDN["Unsplash CDN"]
end
Page --> Hero
Page --> Nav
Page --> City
Page --> Picks
Page --> Posts
Page --> Attractions
Layout --> AI
Nav --> AI
Picks --> Hook
Posts --> Hook
Attractions --> Hook
Hook --> Repo
Picks --> Loader
Attractions --> Loader
Loader --> Config
Config --> CDN
```

**图表来源**
- [frontend/app/page.tsx:37-63](file://frontend/app/page.tsx#L37-L63)
- [frontend/app/layout.tsx:25-29](file://frontend/app/layout.tsx#L25-L29)
- [frontend/components/home/hero.tsx:46-92](file://frontend/components/home/hero.tsx#L46-L92)
- [frontend/components/home/feature-nav.tsx:71-115](file://frontend/components/home/feature-nav.tsx#L71-L115)
- [frontend/components/home/city-switcher.tsx:13-31](file://frontend/components/home/city-switcher.tsx#L13-L31)
- [frontend/components/home/editor-picks.tsx:10-12](file://frontend/components/home/editor-picks.tsx#L10-L12)
- [frontend/components/home/hot-posts.tsx:11-12](file://frontend/components/home/hot-posts.tsx#L11-L12)
- [frontend/components/home/hot-attractions.tsx:11-12](file://frontend/components/home/hot-attractions.tsx#L11-L12)
- [frontend/components/home/use-section-data.ts:15-42](file://frontend/components/home/use-section-data.ts#L15-L42)
- [frontend/lib/image-loader.ts:1-20](file://frontend/lib/image-loader.ts#L1-L20)
- [frontend/next.config.ts:1-14](file://frontend/next.config.ts#L1-L14)

## 详细组件分析

### Hero 首屏组件（新增）
Hero 首屏是独立的 React Server Component，包含品牌标识、主标题、导语、CTA 按钮和统计面板。组件支持通过 `stats` prop 自定义右侧统计面板的数据，默认值来自数据契约常量。

```mermaid
flowchart TD
Start["HomeHero 组件"] --> Resolve["resolveStats(stats)"]
Resolve --> Valid{"stats 合法？"}
Valid --> |否| Default["使用默认统计数据"]
Valid --> |是| Custom["使用传入统计数据"]
Default --> Render["渲染首屏内容"]
Custom --> Render
Render --> Eyebrow["显示眉标 'wanderchain · 城市旅行指南'"]
Render --> Title["显示 h1 主标题"]
Render --> Lead["显示导语段落"]
Render --> Actions["显示三个 CTA 按钮"]
Render --> Stats["显示统计面板"]
```

**图表来源**
- [frontend/components/home/hero.tsx:34-44](file://frontend/components/home/hero.tsx#L34-L44)
- [frontend/components/home/hero.tsx:46-92](file://frontend/components/home/hero.tsx#L46-L92)

**章节来源**
- [homepage-hero.md:1-286](file://docs/specs/wanderchain/homepage-hero.md#L1-L286)
- [frontend/components/home/hero.tsx:1-93](file://frontend/components/home/hero.tsx#L1-L93)
- [frontend/components/home/hero.module.css:1-107](file://frontend/components/home/hero.module.css#L1-L107)
- [frontend/components/home/hero.test.tsx:1-122](file://frontend/components/home/hero.test.tsx#L1-L122)

### 首页聚合器与城市参数流
首页是数据与交互的装配点：它从 Next.js 的 `searchParams` 中读取城市，使用 `parseCity` 做非法值归一化，再构造稳定查询对象传递给城市切换与内容区块。Hero 区域展示城市数量与各区块上限，强调"本地 Mock 契约，未来接口替换不重写界面"。

```mermaid
sequenceDiagram
participant Browser as "浏览器"
participant Page as "首页 page.tsx"
participant Hero as "Hero 首屏"
participant CityHook as "parseCity / cities"
participant Switcher as "城市切换 city-switcher.tsx"
participant Blocks as "内容区块"
Browser->>Page : 访问首页并携带 ?city=...
Page->>Hero : 渲染 HomeHero 组件
Page->>CityHook : parseCity(params.city)
CityHook-->>Page : 返回有效城市 slug
Page->>Switcher : 传入 activeCity 与 query
Switcher->>Browser : router.replace(更新 ?city=...)
Browser->>Page : 重新渲染
Page->>Blocks : 传入 city 并刷新区块数据
```

**图表来源**
- [frontend/app/page.tsx:32-35](file://frontend/app/page.tsx#L32-L35)
- [frontend/app/page.tsx:42-63](file://frontend/app/page.tsx#L42-L63)
- [frontend/components/home/city-switcher.tsx:13-31](file://frontend/components/home/city-switcher.tsx#L13-L31)

**章节来源**
- [frontend/app/page.tsx:32-35](file://frontend/app/page.tsx#L32-L35)
- [frontend/app/page.tsx:42-63](file://frontend/app/page.tsx#L42-L63)

### 功能导航与 AI 助手入口
功能导航承载三个平台入口：旅游社区、景点攻略、AI 助手。前两者为路由跳转，后者通过 `useAiAssistant().open()` 唤起同一面板。U3 规格要求移动端纵向排列，且 `/community`、`/attractions` 必须存在占位页。

```mermaid
flowchart TD
Start["用户点击功能导航卡片"] --> Type{"卡片类型？"}
Type --> |旅游社区| LinkCommunity["跳转到 /community"]
Type --> |景点攻略| LinkAttractions["跳转到 /attractions"]
Type --> |AI 助手| OpenPanel["调用 useAiAssistant().open()"]
OpenPanel --> Panel["显示 AI 助手占位面板"]
LinkCommunity --> End["结束"]
LinkAttractions --> End
Panel --> End
```

**图表来源**
- [frontend/components/home/feature-nav.tsx:50-115](file://frontend/components/home/feature-nav.tsx#L50-L115)
- [frontend/app/community/page.tsx:9-15](file://frontend/app/community/page.tsx#L9-L15)
- [frontend/app/attractions/page.tsx:9-15](file://frontend/app/attractions/page.tsx#L9-L15)

**章节来源**
- [homepage-u3-feature-nav.md:10-50](file://docs/specs/wanderchain/homepage-u3-feature-nav.md#L10-L50)
- [frontend/components/home/feature-nav.tsx:71-115](file://frontend/components/home/feature-nav.tsx#L71-L115)
- [frontend/app/community/page.tsx:1-18](file://frontend/app/community/page.tsx#L1-L18)
- [frontend/app/attractions/page.tsx:1-18](file://frontend/app/attractions/page.tsx#L1-L18)

### AI 助手模态框与无障碍增强（已更新）
AI 助手是纯前端占位：Provider 管理面板开关、焦点恢复、Esc 关闭与遮罩点击关闭；触发器支持头部与悬浮两种形态。**已增强完整无障碍功能**：焦点陷阱、背景滚动锁定、键盘导航支持。

**新增无障碍特性：**
- **焦点陷阱**：Tab 键在面板内正向循环，Shift+Tab 反向循环
- **背景滚动锁定**：打开期间 `document.body.style.overflow = 'hidden'`，关闭后恢复原值
- **键盘导航**：Esc 关闭、Tab/Shift+Tab 循环、运行期查询可聚焦元素
- **焦点管理**：打开时自动聚焦关闭按钮，关闭后焦点归还触发元素

```mermaid
classDiagram
class AiAssistantProvider {
+boolean isOpen
+open() void
+close() void
+focusTrap() void
+scrollLock() void
}
class AiAssistantTrigger {
+variant : "header" | "floating"
}
class KeyboardNavigation {
+handleTabKey() void
+handleShiftTabKey() void
+handleEscapeKey() void
}
class FocusManagement {
+restoreFocusRef : HTMLElement
+closeButtonRef : HTMLButtonElement
+panelRef : HTMLElement
}
AiAssistantProvider <.. AiAssistantTrigger : "通过 useAiAssistant 调用 open"
AiAssistantProvider <.. KeyboardNavigation : "键盘事件监听"
AiAssistantProvider <.. FocusManagement : "焦点控制"
```

**图表来源**
- [frontend/components/home/ai-assistant.tsx:14-28](file://frontend/components/home/ai-assistant.tsx#L14-L28)
- [frontend/components/home/ai-assistant.tsx:41-120](file://frontend/components/home/ai-assistant.tsx#L41-L120)
- [frontend/components/home/ai-assistant.tsx:123-156](file://frontend/components/home/ai-assistant.tsx#L123-L156)
- [frontend/components/home/ai-assistant.tsx:178-211](file://frontend/components/home/ai-assistant.tsx#L178-L211)
- [frontend/components/home/feature-nav.tsx:71-115](file://frontend/components/home/feature-nav.tsx#L71-L115)

**章节来源**
- [homepage-u4-ai-assistant.md:10-52](file://docs/specs/wanderchain/homepage-u4-ai-assistant.md#L10-L52)
- [homepage-u4-ai-assistant.md:97-110](file://docs/specs/wanderchain/homepage-u4-ai-assistant.md#L97-L110)
- [frontend/components/home/ai-assistant.tsx:41-120](file://frontend/components/home/ai-assistant.tsx#L41-L120)
- [frontend/components/home/ai-assistant.tsx:178-211](file://frontend/components/home/ai-assistant.tsx#L178-L211)

### 响应式图片优化系统（已更新）
WanderChain 首页实现了完整的响应式图片优化系统，专门针对编辑推荐和热门景点区块的封面图进行性能优化。该系统基于 next/image 组件，通过自定义 loader 和精确的 sizes 属性计算，实现智能图片加载。

**核心组件：**

1. **自定义 Image Loader** (`lib/image-loader.ts`)：
   - 将 next/image 计算的宽度档位直接写入 Unsplash CDN 的 `w` 参数
   - 自动设置质量参数 `q`（默认 70）和格式优化 `auto=format`
   - 对非绝对 URL 进行安全处理，避免 URL 解析错误

2. **Sizes 属性计算**：
   - 编辑推荐：`(max-width: 640px) calc(100vw - 64px), (max-width: 900px) calc(50vw - 50px), (min-width: 1160px) 347px, calc(33.33vw - 40px)`
   - **热门景点（已更新）**：`(max-width: 720px) calc(50vw - 40px), (max-width: 1080px) calc(33.33vw - 38px), (min-width: 1160px) 204px, calc(20vw - 29px)`

3. **CSS 适配（已更新）**：
   - 编辑推荐：3列网格（桌面）→ 2列（平板）→ 1列（移动）
   - **热门景点（已更新）**：5列网格（桌面）→ 3列（1080px断点）→ 2列（720px断点）

**更新** 热门景点区块的响应式设计已从移动优先策略调整为桌面优先策略，断点从原来的640px/1024px调整为1080px/720px，提供更优的桌面端体验。

```mermaid
flowchart TD
User["用户访问页面"] --> Browser["浏览器解析 sizes 属性"]
Browser --> Calc["计算目标图片尺寸"]
Calc --> Loader["调用自定义 image loader"]
Loader --> Unsplash["Unsplash CDN 生成优化图片"]
Unsplash --> Response["返回最佳尺寸图片"]
Response --> Display["渲染到页面"]
subgraph "编辑器精选 sizes 计算"
EP1["< 640px: 100vw - 64px"]
EP2["< 900px: 50vw - 50px"]
EP3["> 1160px: 347px"]
EP4["默认: 33.33vw - 40px"]
end
subgraph "热门景点 sizes 计算已更新"
HA1["< 720px: 50vw - 40px"]
HA2["< 1080px: 33.33vw - 38px"]
HA3["> 1160px: 204px"]
HA4["默认: 20vw - 29px"]
end
```

**图表来源**
- [frontend/lib/image-loader.ts:8-18](file://frontend/lib/image-loader.ts#L8-L18)
- [frontend/components/home/editor-picks.tsx:40-49](file://frontend/components/home/editor-picks.tsx#L40-L49)
- [frontend/components/home/hot-attractions.tsx:45-54](file://frontend/components/home/hot-attractions.tsx#L45-L54)
- [frontend/components/home/editor-picks.module.css:68-78](file://frontend/components/home/editor-picks.module.css#L68-L78)
- [frontend/components/home/hot-attractions.module.css:54-64](file://frontend/components/home/hot-attractions.module.css#L54-L64)

**章节来源**
- [frontend/lib/image-loader.ts:1-20](file://frontend/lib/image-loader.ts#L1-L20)
- [frontend/lib/image-loader.test.ts:1-24](file://frontend/lib/image-loader.test.ts#L1-L24)
- [frontend/next.config.ts:6-10](file://frontend/next.config.ts#L6-L10)
- [frontend/components/home/editor-picks.tsx:40-49](file://frontend/components/home/editor-picks.tsx#L40-L49)
- [frontend/components/home/hot-attractions.tsx:45-54](file://frontend/components/home/hot-attractions.tsx#L45-L54)

### 区块数据加载三态
所有数据区块共用 `useSectionData`，将异步数据源包装为 loading、error、ready 三种状态。组件只关心最终渲染结果，从而在 Mock 与真实 API 之间平滑切换。

```mermaid
flowchart TD
Enter["进入区块"] --> Load["调用 load()"]
Load --> Loading["状态设为 loading"]
Loading --> Result{"load 成功？"}
Result --> |是| Ready["状态设为 ready，写入 items 与 total"]
Result --> |否| Error["状态设为 error"]
Ready --> Render["渲染列表"]
Error --> RenderError["渲染错误提示"]
```

**图表来源**
- [frontend/components/home/use-section-data.ts:6-43](file://frontend/components/home/use-section-data.ts#L6-L43)

**章节来源**
- [frontend/components/home/use-section-data.ts:1-44](file://frontend/components/home/use-section-data.ts#L1-L44)

### 编辑推荐区块
编辑推荐按 `sort_order` 升序、并列时按 `id` 升序排序，并仅展示当前城市与全城通用的精选。空态文案不报错，加载与错误态沿用区块三态。**已集成响应式图片优化**，使用精确的 sizes 属性和自定义 image loader 实现最佳加载性能。

```mermaid
flowchart TD
Start["EditorPicks(city)"] --> Fetch["mockRepository.listEditorPicks({ city })"]
Fetch --> Sort["按 sort_order 升序，并列按 id 升序"]
Sort --> Filter["过滤非当前城市与非 all 的条目"]
Filter --> Empty{"是否有数据？"}
Empty --> |否| ShowEmpty["显示空态文案"]
Empty --> |是| RenderCards["渲染封面、标题、城市、编辑署名、摘要"]
RenderCards --> ImageOpt["应用响应式图片优化"]
ImageOpt --> Sizes["计算 sizes 属性"]
Sizes --> Loader["调用自定义 image loader"]
```

**图表来源**
- [frontend/components/home/editor-picks.tsx:10-61](file://frontend/components/home/editor-picks.tsx#L10-L61)
- [frontend/components/home/editor-picks.tsx:40-49](file://frontend/components/home/editor-picks.tsx#L40-L49)
- [frontend/lib/image-loader.ts:8-18](file://frontend/lib/image-loader.ts#L8-L18)

**章节来源**
- [homepage-u6-editor-picks.md:10-54](file://docs/specs/wanderchain/homepage-u6-editor-picks.md#L10-L54)
- [frontend/components/home/editor-picks.tsx:1-66](file://frontend/components/home/editor-picks.tsx#L1-L66)

### 热门帖子区块
热门帖子最多展示 10 条已发布帖子，三级排序为评论数降序 → 浏览数降序 → 发布时间降序。草稿与已删除帖子一律排除。

```mermaid
flowchart TD
Start["HotPosts(city)"] --> Fetch["mockRepository.listHotPosts({ city })"]
Fetch --> FilterPublished["过滤 ContentStatus=published"]
FilterPublished --> Sort["评论数降序 → 浏览数降序 → 发布时间降序"]
Sort --> Limit["截断至 Top 10"]
Limit --> Render["渲染序号、标题、作者、评论数、浏览数、发布时间"]
```

**图表来源**
- [frontend/components/home/hot-posts.tsx:11-58](file://frontend/components/home/hot-posts.tsx#L11-L58)

**章节来源**
- [homepage-u7-hot-posts.md:10-56](file://docs/specs/wanderchain/homepage-u7-hot-posts.md#L10-L56)
- [frontend/components/home/hot-posts.tsx:1-59](file://frontend/components/home/hot-posts.tsx#L1-L59)

### 热门景点区块（已更新）
热门景点按浏览量与发布时间排序，展示封面、名称、城市与评分、浏览数。空态与错误态沿用通用区块状态。**已集成响应式图片优化**，使用精确的 sizes 属性和自定义 image loader 实现最佳加载性能。

**更新** 响应式设计已从移动优先策略调整为桌面优先策略：
- 桌面端：5列网格布局
- 平板端（≤1080px）：3列网格布局  
- 移动端（≤720px）：2列网格布局

```mermaid
flowchart TD
Start["HotAttractions(city)"] --> Fetch["mockRepository.listHotAttractions({ city })"]
Fetch --> Sort["按浏览数与发布时间排序"]
Sort --> Render["渲染封面、名称、城市、评分、浏览数"]
Render --> ImageOpt["应用响应式图片优化"]
ImageOpt --> Sizes["计算 sizes 属性"]
Sizes --> Loader["调用自定义 image loader"]
```

**图表来源**
- [frontend/components/home/hot-attractions.tsx:11-65](file://frontend/components/home/hot-attractions.tsx#L11-L65)
- [frontend/components/home/hot-attractions.tsx:45-54](file://frontend/components/home/hot-attractions.tsx#L45-L54)
- [frontend/lib/image-loader.ts:8-18](file://frontend/lib/image-loader.ts#L8-L18)

**章节来源**
- [frontend/components/home/hot-attractions.tsx:1-70](file://frontend/components/home/hot-attractions.tsx#L1-L70)

### 契约与 Mock 数据层
U0 明确类型定义、城市白名单、Mock 数据规模与 `HomeRepository` 接口边界。它是其余区块的地基，组件与单元测试应通过替换 `mockRepository` 来验证未来真实 API 的兼容性。

- 类型与常量：`CitySlug`、`EditorPick`、`Post`、`Attraction`、`ContentStatus`、`ListQuery`、`ListResult<T>`。
- 城市白名单：`all` 加北京、上海、广州、成都、西安、杭州、三亚。
- 行为约束：`parseCity` 对非法或缺失值归一化为 `all`；Mock 数据覆盖全部 7 城，并包含草稿与已删除样本。
- 验收重点：重复调用顺序一致、非法城市 slug 归一、替换数据源时组件与测试无需修改。

**章节来源**
- [homepage-u0-contract-mock.md:10-53](file://docs/specs/wanderchain/homepage-u0-contract-mock.md#L10-L53)

## 依赖关系分析
WanderChain 首页的依赖关系遵循"页面装配 → 区块消费 → 数据契约"的单向依赖，避免循环耦合：

- 页面依赖：城市解析、区块组件、站点头尾。
- Hero 依赖：数据契约常量（CITIES、LIMITS），无外部状态。
- 区块依赖：`useSectionData`、`mockRepository`、城市名称格式化。
- **AI 助手依赖**：Provider 上下文，被功能导航与站点头部触发。**新增无障碍依赖**：焦点管理、键盘事件监听、滚动控制。
- **图片优化依赖**：next/image 组件、自定义 image loader、Next.js 配置。
- 契约依赖：U0 是 U2/U3/U4/U6/U7 的基础，但 U0 不反向依赖任何 UI 组件。

```mermaid
graph LR
U0["U0 契约与 Mock"] --> U2["U2 首页骨架"]
U0 --> U6["U6 编辑推荐"]
U0 --> U7["U7 热门帖子"]
U0 --> U8["U8 热门景点"]
U4["U4 AI 助手"] --> U3["U3 功能导航"]
U2 --> U3
U2 --> U5["U5 城市切换"]
U2 --> U6
U2 --> U7
U2 --> U8
Hero["Hero 首屏"] --> U0
Accessibility["无障碍功能"] --> U4
ImageOpt["图片优化系统"] --> U6
ImageOpt --> U8
Loader["image-loader.ts"] --> Config["next.config.ts"]
```

**图表来源**
- [homepage-u0-contract-mock.md:34-40](file://docs/specs/wanderchain/homepage-u0-contract-mock.md#L34-L40)
- [homepage-u3-feature-nav.md:32-36](file://docs/specs/wanderchain/homepage-u3-feature-nav.md#L32-L36)
- [homepage-u4-ai-assistant.md:33-38](file://docs/specs/wanderchain/homepage-u4-ai-assistant.md#L33-L38)
- [homepage-u6-editor-picks.md:35-40](file://docs/specs/wanderchain/homepage-u6-editor-picks.md#L35-L40)
- [homepage-u7-hot-posts.md:36-41](file://docs/specs/wanderchain/homepage-u7-hot-posts.md#L36-L41)
- [frontend/lib/image-loader.ts:1-20](file://frontend/lib/image-loader.ts#L1-L20)
- [frontend/next.config.ts:1-14](file://frontend/next.config.ts#L1-L14)

**章节来源**
- [homepage-u0-contract-mock.md:34-40](file://docs/specs/wanderchain/homepage-u0-contract-mock.md#L34-L40)
- [homepage-u3-feature-nav.md:32-36](file://docs/specs/wanderchain/homepage-u3-feature-nav.md#L32-L36)
- [homepage-u4-ai-assistant.md:33-38](file://docs/specs/wanderchain/homepage-u4-ai-assistant.md#L33-L38)
- [homepage-u6-editor-picks.md:35-40](file://docs/specs/wanderchain/homepage-u6-editor-picks.md#L35-L40)
- [homepage-u7-hot-posts.md:36-41](file://docs/specs/wanderchain/homepage-u7-hot-posts.md#L36-L41)

## 性能与可维护性
- **零网络请求**：当前所有区块通过 Mock 仓储提供数据，避免首屏阻塞与跨域问题；真实 API 接入时只需替换数据源。
- **Hero 组件优化**：独立的 Hero 组件减少页面组件复杂度，支持静态渲染和无客户端依赖。
- **三态加载**：`useSectionData` 统一管理 loading/error/ready，减少重复请求与竞态条件。
- **城市参数稳定**：首页对 `searchParams` 做单值归一，避免数组参数导致的不必要重渲染。
- **响应式图片优化（已更新）**：
  - 自定义 image loader 直接将宽度参数传递给 Unsplash CDN，避免经过 Next.js 的 `/_next/image` 端点
  - 精确的 sizes 属性计算确保浏览器选择最优图片尺寸
  - 懒加载和异步解码提升首屏性能
  - CSS aspect-ratio 和 object-fit 确保图片在不同屏幕尺寸下的显示效果
  - **热门景点区块**：优化的桌面优先响应式策略提供更好的大屏幕上体验
- **可替换数据层**：类型与 `ListResult<T>` 契约使 Mock 与真实 API 可互换，组件与测试无需改动。
- **无障碍性能优化**：AI 助手模态框使用运行期查询而非缓存的可聚焦元素列表，避免内存泄漏和性能问题。

[本节为通用指导，不直接分析具体文件]

## 故障排查指南
- **Hero 组件问题**：检查 `stats` prop 是否合法（长度=4、顺序正确、值为非负整数）；确认组件未被误标记为 Client Component。
- **AI 助手模态框问题**：
  - 面板未打开：检查是否包裹在 `AiAssistantProvider` 内；确认触发按钮调用了 `open()` 而非跳转。
  - 焦点异常：确认焦点陷阱正常工作（Tab/Shift+Tab 循环）；检查关闭按钮初始焦点设置。
  - 滚动穿透：确认 `document.body.style.overflow` 设置为 `hidden`；检查组件卸载时的清理函数。
  - 键盘导航失效：检查 `keydown` 事件监听是否正确注册和清理。
- **图片优化问题（已更新）**：
  - 图片未优化：确认 next.config.ts 中已配置自定义 loader；检查 image-loader.ts 是否正确导出。
  - 图片尺寸不正确：检查 sizes 属性是否与 CSS 网格布局匹配；确认 width/height 属性设置合理。
  - **热门景点响应式问题**：确认断点设置（1080px/720px）与 CSS 媒体查询一致；检查桌面优先策略是否正确应用。
  - CDN 请求失败：检查图片 URL 是否为有效的 https URL；确认 Unsplash CDN 可访问。
  - 性能问题：检查是否正确使用 loading="lazy" 和 decoding="async"；确认 sizes 属性计算准确。
- 面板无法关闭：确认遮罩点击、关闭按钮与 Esc 事件监听未被阻止；检查焦点归还逻辑。
- 城市切换无效：确认 URL 查询参数格式为 `?city=slug`，且 `parseCity` 能识别该 slug。
- 区块为空：检查 Mock 数据是否包含对应城市的条目；确认编辑器精选与帖子的状态过滤逻辑。
- 网络请求异常：当前实现不应发起任何请求；若出现 fetch/XHR，优先检查是否误接真实 API 或未正确替换 `mockRepository`。

**章节来源**
- [homepage-hero.md:79-87](file://docs/specs/wanderchain/homepage-hero.md#L79-L87)
- [homepage-u4-ai-assistant.md:40-52](file://docs/specs/wanderchain/homepage-u4-ai-assistant.md#L40-L52)
- [homepage-u4-ai-assistant.md:97-110](file://docs/specs/wanderchain/homepage-u4-ai-assistant.md#L97-L110)
- [frontend/components/home/ai-assistant.tsx:60-75](file://frontend/components/home/ai-assistant.tsx#L60-L75)
- [frontend/components/home/ai-assistant.tsx:86-122](file://frontend/components/home/ai-assistant.tsx#L86-L122)
- [frontend/components/home/city-switcher.tsx:17-31](file://frontend/components/home/city-switcher.tsx#L17-L31)
- [frontend/lib/image-loader.ts:8-18](file://frontend/lib/image-loader.ts#L8-L18)
- [frontend/next.config.ts:6-10](file://frontend/next.config.ts#L6-L10)

## 结论
WanderChain 首页在当前阶段以清晰的契约与 Mock 数据为基础，实现了城市筛选、功能导航、AI 助手入口与三类内容区块。**新增的独立 Hero 首屏组件**进一步提升了代码的可维护性和组件复用性。**增强的 AI 助手模态框无障碍功能**提供了完整的焦点陷阱、背景滚动锁定和键盘导航支持，确保了良好的用户体验和无障碍访问。**更新的响应式图片优化系统**通过自定义 image loader、精确的 sizes 属性计算和 Unsplash CDN 集成，显著提升了封面图的加载性能和用户体验。**特别地，热门景点区块的响应式设计已从移动优先策略调整为桌面优先策略**，使用1080px/720px断点提供更好的桌面端体验。架构上坚持"UI 与数据解耦、Mock 与真实 API 可替换"，并通过三态加载、无障碍设计和图片优化提升可维护性与可用性。后续接入真实后端时，应优先替换 `mockRepository`，并保持类型与响应形状不变，以确保最小改动成本与最大回归安全性。

[本节为总结性内容，不直接分析具体文件]