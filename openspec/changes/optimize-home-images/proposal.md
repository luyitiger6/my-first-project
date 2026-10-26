# Proposal

## Why

编辑推荐与热门景点的封面图都固定请求 `w=900`：编辑推荐三列布局下每张实际只渲染约 244–400px，热门景点五列下更只有约 150–250px。等于每次都为用不到的像素付流量与解码成本，且所有设备拿到同一张图，没有多档与格式协商。

## What Changes

- 两处原生 `<img>` 改为 `next/image` 的 `<Image>`，封面图获得 srcset 多档与格式协商
- 新增自定义图片 loader，把宽度档位改写到 Unsplash 的 `w` 参数上，直接由 Unsplash CDN 出图；不引入 `sharp`，不启用 Next 的 `/_next/image` 优化端点
- 为两个区块补 `sizes`，描述真实响应式列宽，让浏览器按实际显示宽度选档
- 组件测试补封面图断言：srcset 含多档、sizes 与断点一致、懒加载与异步解码存在
- 保留现有 CSS 的 `aspect-ratio + height:auto`，避免图片宽高属性重新顶死比例

## Capabilities

### New Capabilities

无。本次只修改既有 `wanderchain-homepage` 能力。

### Modified Capabilities

- `wanderchain-homepage`: 新增一条封面图按需出图的 Requirement —— 编辑推荐与热门景点的封面 MUST 通过 next/image 按响应式档位请求，MUST NOT 固定请求单一大尺寸原图

## Impact

- `frontend/components/home/editor-picks.tsx`、`frontend/components/home/hot-attractions.tsx`：换 Image 组件并补 `sizes`
- `frontend/next.config.ts`：配置 `images.loader: 'custom'` 与 `images.loaderFile`
- 新增 `frontend/lib/image-loader.ts`
- `frontend/components/home/editor-picks.test.tsx`、`frontend/components/home/hot-attractions.test.tsx`：补封面图断言
- 不新增 npm 依赖（不装 `sharp`），不改 CSS 布局，不改数据契约
