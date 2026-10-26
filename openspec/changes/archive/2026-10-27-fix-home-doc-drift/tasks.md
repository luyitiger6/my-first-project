# Tasks

## 1. 修正 u6 编辑推荐文档

- [x] 1.1 `docs/specs/wanderchain/homepage-u6-editor-picks.md` §4.3「图片与响应式」的断点验收项改为实现值：`320px 视口无横向滚动；> 900px 三列、≤ 900px 两列、≤ 640px 单列`。验证方式：与 `frontend/components/home/editor-picks.module.css` 的 `@media` 断点逐值对照
- [x] 1.2 同文件 §5.3 重写：标题改为「响应式（desktop-first）」，首行写入真相源 `frontend/components/home/editor-picks.module.css`，表格换成 `≤ 640px` / `≤ 900px` / `> 900px` 三行累进形式，删除与 §5.2 重复的 Tailwind 目标翻译（16/20/24px 间距），保留「卡片 `min-width: 0`」「封面容器 `aspect-ratio` + `overflow: hidden`」两条约束。验证方式：§5.2 到 §5.4 的标题层级与相邻小节一字未动
- [x] 1.3 同文件 §5.4「图片（next/image）」的「⚠ 现状：使用原生 `<img>`」改为已接入 `next/image` + 自定义 loader（`frontend/lib/image-loader.ts`），并写明该方案请求不经过 `/_next/image`、因此不需要 `images.remotePatterns`。验证方式：与 `frontend/next.config.ts` 的 `images` 段对照
- [x] 1.4 同文件 §5.5 差异表重写：第 1、2 条（`next/image`、域名注册）改为已解决/不适用；第 3 条（Tailwind + shadcn）不在本 change 范围，保持原样。验证方式：全表不再出现「原生 `<img>`」「无 `images` 段」

## 2. 修正 u8 热门景点文档

- [x] 2.1 `docs/specs/wanderchain/homepage-u8-hot-attractions.md` §4.4「图片与响应式」的断点验收项改为：`320px 视口无横向滚动；> 1080px 五列、≤ 1080px 三列、≤ 720px 两列`。验证方式：与 `hot-attractions.module.css` 的 `@media` 断点逐值对照
- [x] 2.2 同文件 §5.3 按同 1.2 的格式重写，真相源为 `frontend/components/home/hot-attractions.module.css`；§5.3 末尾「与 U6 的列数断点不同（U6 用 768px 起两列）」改为「U6 以 900px 为界」，保留「不要为统一而改本单元断点」的约束
- [x] 2.3 同文件 §5.4 的「⚠ 现状：使用原生 `<img>`」改为已接入 `next/image` + 自定义 loader，并删除「依赖 `remotePatterns`（当前未注册）」这条已不成立的前提
- [x] 2.4 同文件 §5.5 差异表第 1、2 条改写；第 3 条「列数断点 640 起两列 | CSS Module 现状一致」这句自证必须删掉，改为实测值

## 3. 新增文档断点闸门

- [x] 3.1 新增 `harness/checks/08-spec-doc-breakpoints.ps1`：内含显式配对表（u6 → `editor-picks.module.css`、u8 → `hot-attractions.module.css`），文档侧用 `[<>≤≥]\s*(\d+)px` 取断点集合、CSS 侧用 `max-width:\s*(\d+)px` 取集合，两者不相等则逐条打印差异并 `exit 1`；文档缺少「真相源」行也判失败；全程不交互。验证方式：用 `UTF8Encoding($true)` 写入，首字节为 `EF BB BF`
- [x] 3.2 负向验证：把 u6 §5.3 的 `≤ 900px` 临时改成 `≤ 901px`，运行闸门应退出 1 且输出指出 900/901 差异；还原后退出 0 且打印通过信息。验证方式：两次退出码与输出均留档
- [x] 3.3 更新 `AGENTS.md`：§6 的 `<!-- harness-checks: ... -->` 标记加入 `08-spec-doc-breakpoints`，目录树补该闸门一行说明；§7 命令速查补「只查文档断点」。验证方式：`07-doc-consistency.ps1` 退出 0（标记与实际文件双向一致）

## 4. 验收

- [x] 4.1 `powershell -File harness\run-all.ps1` 退出码 0，九道闸门全 PASS
- [x] 4.2 `openspec validate fix-home-doc-drift --strict` 返回 valid
