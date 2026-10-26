# Tasks

## 1. 图片 loader 与 Next 配置

- [x] 1.1 新增 `frontend/lib/image-loader.ts`：默认导出 loader，对绝对 URL 改写 `w`/`q`/`auto=format`/`fit=crop`，对非绝对 URL 原样返回；验证 `frontend/lib/image-loader.test.ts` 中「改写绝对 URL」「原样返回相对路径」「quality 缺省时回落」三个用例全部通过
- [x] 1.2 在 `frontend/next.config.ts` 声明 `images: { loader: 'custom', loaderFile: './lib/image-loader.ts' }`；验证 `cd frontend; npm run build` 退出码为 0，且构建通过

## 2. 编辑推荐封面

- [x] 2.1 `frontend/components/home/editor-picks.tsx` 把原生 `<img>` 换成 `next/image` 的 `<Image>`，保留 900×675 与 `.cover` 类名，补 `sizes="(max-width: 640px) calc(100vw - 64px), (max-width: 900px) calc(50vw - 50px), (min-width: 1160px) 347px, calc(33.33vw - 40px)"`、`loading="lazy"`、`decoding="async"`；验证 `editor-picks.test.tsx` 新增用例：封面 `srcset` 含多个档位、`sizes` 与上述声明一致、`loading` 与 `decoding` 属性存在
- [x] 2.2 更新 `docs/specs/wanderchain/homepage-u6-editor-picks.md` 的图片交付说明，写明走 `next/image` + 自定义 loader + 该 `sizes`；验证文档中描述的属性与 2.1 实现逐项对得上

## 3. 热门景点封面

- [x] 3.1 `frontend/components/home/hot-attractions.tsx` 把原生 `<img>` 换成 `<Image>`，保留 600×600 与 `.cover` 类名，补 `sizes="(max-width: 720px) calc(50vw - 40px), (max-width: 1080px) calc(33.33vw - 38px), (min-width: 1160px) 204px, calc(20vw - 29px)"`、`loading="lazy"`、`decoding="async"`；验证 `hot-attractions.test.tsx` 新增用例通过，断言项与 2.1 一致
- [x] 3.2 更新 `docs/specs/wanderchain/homepage-u8-hot-attractions.md` 的图片交付说明，与 3.1 实现逐项对齐

## 4. 集成验收

- [x] 4.1 运行 `powershell -File harness\run-all.ps1`，退出码为 0；若 `npm run test` 中 `next/image` 在 jsdom 下无法渲染，按 design D4 退回 setup 级 mock，且 mock 必须透传 `srcset`/`sizes` 并在用例中显式断言（不允许删掉断言换取通过）
- [x] 4.2 启动 dev server，用浏览器实测两个区块：封面渲染宽高比分别为 4:3 与 1:1，`srcset` 在窄/宽视口下选到不同档位，滚动到区块时图片才发起请求；把实测数据记入归档前的验收证据
  - 实测环境：dev server + Chrome，DPR 1.5，iframe 固定布局视口（1440 / 640 / 420），每次先 `removeAttribute('srcset')` 再加 cache-busting 参数重新赋值后读 `currentSrc`
  - loader 接通：两个区块封面的 `currentSrc` 全部为 `images.unsplash.com/...&w=<档位>&q=70`，整页 8 条图片请求零 `/_next/image`（jsdom 里测不到这一点，见 design D4）
  - 渲染比例：编辑推荐 345.33×259.00 = **1.33**（4:3）；热门景点 201.86×201.86 = **1.00**（1:1）
  - 选档随视口变化：编辑推荐 1440 视口选 640w、640 视口选 **1080w**（640 断点变单列、图反而拉宽）；热门景点 420 视口选 **256w**（需要 253px，超采 1.2%）
  - sizes 精度：声明值与真实列宽误差 0–0.8px（修正前为 14.67 / 33.33px，根因是双层 `.wc-container` 各扣一次边距）
  - 懒加载：热门景点首图初始 `currentSrc` 为空、`naturalWidth=0`，滚入视口后才发起请求

## Workflow follow-up

- 在 `openspec/changes/optimize-home-images/` 的人工审阅通过后执行实施。
- 实施完成后归档该 change，并按仓库惯例为新归档目录打 `archive/<目录名>` 标签。
