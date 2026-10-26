# Design

## Context

动机见 `proposal.md → Why`。实现前的现状约束：

- 封面图 URL 由 `frontend/lib/home/mock-data.ts` 的 `cover()` 生成，固定为 `https://images.unsplash.com/{photoId}?auto=format&fit=crop&w=900&q=70`，即宽度已写死为 900
- 两处卡片 CSS 已有 `.cover { width: 100%; height: auto; aspect-ratio: …; object-fit: cover; background: linear-gradient(…) }`。`height: auto` 是历史上修正「宽高属性顶死 aspect-ratio」留下的，不能删
- 容器 `.wc-container` 为 `min(1120px, 100% - 40px)`，在 `max-width: 640px` 时收窄为 `100% - 32px`
- `frontend/next.config.ts` 只有 `output: 'standalone'`，无 `images` 配置；依赖中**没有** `sharp`
- 前端闸门 `harness/checks/04-frontend.ps1` 依次执行 `npm ci` → `npm run build` → `npm run test`，任一失败即整仓失败

## Goals / Non-Goals

**Goals:**

- 封面图按实际显示宽度出图，消除 900px 固定请求带来的超采样
- 不新增 npm 依赖，不引入原生二进制，保持仓库「任何机器可重复执行」的契约
- 保持既有 CSS 布局与比例行为不变

**Non-Goals:**

- 不改数据契约（`EditorPick` / `Attraction` 不新增宽度字段）
- 不改 `cover()` 的 URL 形状（`w=900` 仍作为无 `srcset` 环境的兜底 `src`）
- 不为其他区块（hero、帖子列表）引入图片
- 不引入 CDN、图片托管或构建期图片处理管线

## Decisions

### D1：用自定义 loader 直连 Unsplash，不装 `sharp`

在 `next.config.ts` 声明 `images.loader: 'custom'` 与 `images.loaderFile`，新增 `frontend/lib/image-loader.ts`：

```ts
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  // 非绝对 URL（未来的本地图片）原样返回，避免 new URL 抛错
  // 绝对 URL 则改写 w / q / auto / fit，交由 Unsplash CDN 出图
}
```

loader 把 next/image 计算出的宽度档位写入 Unsplash 的 `w` 参数，`srcset` 每一档都指向 Unsplash 的不同尺寸，请求**不经过** Next 的 `/_next/image`。

**理由**：Unsplash 已用 `auto=format` 做 Accept 协商、用 `w` 控制尺寸，优化能力本来就在 CDN 侧；loader 只是把档位透传过去。

**否决的替代方案**：

- `images.remotePatterns` + 安装 `sharp`：`sharp` 是平台相关的原生二进制，`standalone` 部署需额外携带，且 `/_next/image` 会成为运行时中间层。仓库契约明确「不连接任何外部中间件，保证任何机器可重复执行」，此方案与之相悖
- `images.unoptimized: true` + `next/image`：等于放弃优化，只保留组件 API 外壳，不达目的
- 保持原生 `<img>` 手写 `srcset`：需要自己拼 4–5 档并维护，且丢失组件对宽高与优先级的内建处理；收益与维护成本不成比例

### D2：保留 `width` / `height` 属性与既有 CSS，靠 `height: auto` 兜住比例

`<Image>` 仍传 `width` / `height`（900×675、600×600）作为固有比例与首屏占位，CSS 保持 `.cover` 原样。

**理由**：HTML 宽高属性是表现性提示，优先级低于任何 CSS 声明；`.cover` 里的 `height: auto` 会让 `aspect-ratio` 成为高度的唯一来源，所以属性不会重新顶死比例。这条链路在之前的比例失真修复中已被验证过，不加新机制。

**否决的替代方案**：改用 `fill` + 外层 `position: relative` 容器——需要额外包一层 `div`，而 `.card` 是 flex 列布局、`.cover` 是首个子元素，多一层会改变布局语义，收益仅是省掉宽高属性。

### D3：`sizes` 按真实内容宽推导，不用 `vw` 近似

两处网格都嵌在**两层** `.wc-container` 里：`page.tsx` 外层一层，组件内部又一层。每层各吃掉 `100% - 40px`（`@media (max-width: 640px)` 时各 `100% - 32px`），所以真实内容宽是：

- 大屏（`min-width: 1160px`）：容器封顶 1120，内层再减 40 → **1080px**
- 小屏（`max-width: 640px`）：`100vw - 64px`
- 其余：`100vw - 80px`

按列数与 `gap` 反推列宽：

编辑推荐（gap 20px，3/2/1 列）：

```
(max-width: 640px) calc(100vw - 64px),
(max-width: 900px) calc(50vw - 50px),
(min-width: 1160px) 347px,
calc(33.33vw - 40px)
```

热门景点（gap 16px，5/3/2 列）：

```
(max-width: 720px) calc(50vw - 40px),
(max-width: 1080px) calc(33.33vw - 38px),
(min-width: 1160px) 204px,
calc(20vw - 29px)
```

**理由**：`sizes` 决定浏览器选哪一档，高估会白下大图、低估会糊。首版按单层容器推导（360px / 212px），浏览器实测发现声明值系统性偏大 4–8%（1440 视口声明 360，实际 346.67），据此改为按双层容器的真实内容宽计算。热门景点的 640–720px 区间仍声明 `50vw - 40px`（实际 `50vw - 48px`），只在这 80px 窄区间内略偏保守，换取公式少一档。

### D4：测试不 mock `next/image`，直接断言产出属性

jsdom 里 `next/image` 能正常渲染为 `<img>`，但它不加载 `next.config.ts` 的 `images` 配置，实际走的是默认 loader（`/_next/image?url=…`）。也就是说：组件产出的 `srcset` / `sizes` / `loading` / `decoding` 可测，而**自定义 loader 是否真正接入测不出来**。

因此证据拆成两层：`image-loader.test.ts` 覆盖档位改写规则，组件测试覆盖属性产出，loader 的实际接入由浏览器实测（tasks 4.2）确认——正文里 `srcset` 必须指向图片来源域名而不是 `/_next/image`。

**理由**：mock 掉 `next/image` 会让属性产出也失去验证，等于伪造绿灯；而要往 jsdom 里注入 Next 的运行时图片配置，需要 patch 内部模块，脆弱且与真实构建脱节。承认单元测试的边界、把不可测的部分交给端到端实测，比造一条看起来通过的假断言更可靠。

## Risks / Trade-offs

- **自定义 loader 下是否仍需 `remotePatterns`** → 实施时先跑 `npm run test` 与 `npm run build` 验证；若报域名未配置，补 `images.remotePatterns` 放行 `images.unsplash.com` 作为兜底（不影响 custom loader 的出图路径）
- **`npm ci` 一致性** → 本方案不新增依赖，`package.json` 与 `package-lock.json` 均不变，闸门 4 的安装步骤不受影响
- **Unsplash 不可达或请求失败** → `.cover` 的背景渐变与 `aspect-ratio` 已能占位，卡片布局不塌陷；这属于既有行为，本次只保证不退化
- **Next 可能对宽高属性与 CSS 尺寸不一致发出告警** → 以浏览器实测 `getBoundingClientRect` 的渲染比例为准（编辑推荐 4:3、热门景点 1:1），不以控制台告警作为失败判据
- **优化能力绑定在图片来源** → 未来换成自建图床时，loader 需要按新图的参数约定改写；当前所有封面都来自 Unsplash，此约束可接受

## Migration Plan

纯前端渲染改动，无数据迁移与兼容期。回滚方式为还原两个组件与 `next.config.ts`，不涉及持久化状态。
