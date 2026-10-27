# Tasks

## 1. 数据层双语化

- [x] 1.1 改 `frontend/lib/home/types.ts`：`EditorPick` 新增必填 `titleEn` / `summaryEn` / `editorEn`，`Post` 新增 `titleEn` / `authorEn`，`Attraction` 新增 `nameEn`（一律必填，不用可选）。验证：`cd frontend; npx tsc --noEmit` 的报错位置即为待补清单（此步预期报错，报错清单一并记录）。
- [x] 1.2 改 `frontend/lib/home/cities.ts`：`CityOption` 接口新增必填 `nameEn` / `taglineEn`，8 项全部补英文字段（`all` → `All cities` / `Everywhere, at any pace`；`beijing` → `Beijing` / `Between city walls and hutong lanes`；`shanghai` → `Shanghai` / `A city under plane trees`；`guangzhou` → `Guangzhou` / `Morning tea and arcades`；`chengdu` → `Chengdu` / `Slow down, then slow down more`；`xian` → `Xi'an` / Thirteen kilometers of wind`；`hangzhou` → `Hangzhou` / Tea hills west of the lake`；`sanya` → `Sanya` / Leave winter on the shore`）；新增 `cityNameEn(slug)`，`cityName()` 保留不动。验证：`cd frontend; npx vitest run lib/home` 通过。
- [x] 1.3 改 `frontend/lib/home/mock-data.ts`：6 条编辑推荐、14 条帖子、9 个景点逐条补英文字段，与中文字段一一对应、语义一致。验证：`cd frontend; npx tsc --noEmit` 退出码 0。
- [x] 1.4 改 `frontend/lib/home/format.ts`：`formatCount` 改用 `Intl.NumberFormat('en-US')`，`formatDate` 改用 `Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })`；同步新增 `frontend/lib/home/format.test.ts`，覆盖 999 / 1,000 / 12,345 与一个固定日期的英文输出。验证：`cd frontend; npx vitest run lib/home/format.test.ts` 绿。
- [x] 1.5 新增 `frontend/lib/home/data-integrity.test.ts`：遍历 `CITIES`、`EDITOR_PICKS`、`POSTS`、`ATTRACTIONS`，断言每条记录的中英字段均非空白，且英文字段不含中文字符（正则 `/\p{Script=Han}/u`）。验证：`cd frontend; npx vitest run lib/home/data-integrity.test.ts` 绿。

## 2. 界面英文化

- [x] 2.1 改 `frontend/app/layout.tsx`：`lang="en"`；metadata 的 `title.default` 改为 `wanderchain · Turn a wish into a route`、`template` 保持 `%s · wanderchain`、`description` 与新增的 `openGraph` 全英文；skip link 文案改为英文。新增 `frontend/app/layout.test.tsx` 断言 `metadata` 三个字段为英文且 `RootLayout` 渲染出 `lang="en"`。验证：`cd frontend; npx vitest run app/layout.test.tsx` 绿。
- [x] 2.2 改 `frontend/components/home/hero.tsx` 全部可见文案为英文（眉标、`h1`、导语、搜索框 label 与 placeholder、提交按钮、三个文字链接、城市规模提示）；`next/image` 的 `sizes` / `priority` / `alt=""`、表单 `method` + `action`、`#cities` 锚点均不动。验证：`cd frontend; npx vitest run components/home/hero.test.tsx` 绿。
- [x] 2.3 改 `frontend/components/home/feature-nav.tsx`、`city-switcher.tsx`（城市名改读 `nameEn`）、`section-state.tsx`、`ai-assistant.tsx` 的可见文案为英文。验证：`cd frontend; npx vitest run components/home/feature-nav.test.tsx components/home/city-switcher.test.tsx components/home/ai-assistant.test.tsx` 绿（`section-state` 无独立测试文件时由区块测试覆盖）。
- [x] 2.4 改 `frontend/components/home/editor-picks.tsx`、`hot-posts.tsx`、`hot-attractions.tsx`：标题取 `titleEn` / `nameEn`，摘要取 `summaryEn`，署名取 `editorEn` / `authorEn`，城市取 `cityNameEn()`；空态分别用 `Be the first to ask` 与 `Browse attractions`。验证：`cd frontend; npx vitest run components/home/editor-picks.test.tsx components/home/hot-posts.test.tsx components/home/hot-attractions.test.tsx` 绿。
- [x] 2.5 改 `frontend/components/site/{site-header,site-footer,placeholder}.tsx`、`frontend/components/auth/{auth-form,account-menu}.tsx` 与 `frontend/app/{login,register,community,attractions}/page.tsx` 的可见文案为英文。验证：`cd frontend; npx vitest run components/auth app` 绿。
- [x] 2.6 改 `frontend/app/search/page.tsx` 与 `frontend/app/search/search.module.css` 涉及的文案（眉标、`h1`、引导态、空态、分组标题、条数、回链）为英文；`search.module.css` 只改字体族兜底，不动断点。验证：`cd frontend; npx vitest run app/search/page.test.tsx` 绿。
- [x] 2.7 在 `frontend/app/page.test.tsx` 新增守卫用例：首页渲染后的 `document.body.textContent` 不匹配 `/\p{Script=Han}/u`；同时把该文件中既有的中文断言字面量改为英文（只改字面量，不动角色与结构断言）。验证：`cd frontend; npx vitest run app/page.test.tsx` 绿，且用例数比改前多 1。

## 3. 检索层中英文匹配

- [x] 3.1 改 `frontend/lib/search/query.ts`：`matchableCity()` 改为同时返回 `cityName(city)` 与 `cityNameEn(city)`（`all` 仍不放入 haystack）；三类内容的 haystack 同时拼接中英文字段；`GROUP_META` 的 `heading` / `anchorLabel`、`hitCityLabel()` 的兜底词、`toPostHit()` 与 `toAttractionHit()` 的 meta 文案改为英文。验证：`cd frontend; npx vitest run lib/search/query.test.ts` 绿。
- [x] 3.2 改 `frontend/lib/search/query.test.ts`：保留既有用例（断言字面量英文化），新增三条——①搜 `chengdu` 命中三类内容；②同一条内容的中文标题与英文标题各搜一次，返回同一结果；③搜 `xian` 零命中（英文名为 `Xi'an`，用于证明 slug 未单独参与匹配）。验证：`cd frontend; npx vitest run lib/search/query.test.ts` 绿，且用例数不少于改前 +3。

## 4. 单元文档同步

- [x] 4.1 更新 `docs/specs/wanderchain/` 下 11 份单元文档中引用了中文界面文案的章节（至少 `homepage-hero.md`、`homepage-u2-skeleton.md`、`homepage-u3-feature-nav.md`、`homepage-u4-ai-assistant.md`、`homepage-u5-city-switcher.md`、`homepage-u6-editor-picks.md`、`homepage-u7-hot-posts.md`、`homepage-u8-hot-attractions.md`、`search-page.md`），把文案示例换成英文，并在每份文档的单元边界处补一行「界面语言：英文单语（不做 i18n 框架）」。验证：`Select-String -Path docs/specs/wanderchain/*.md -Pattern '跳到主要内容|编辑推荐|热门帖子|热门景点'` 的命中只剩规格叙述性表述（不出现作为待实现文案的示例）。
- [x] 4.2 确认闸门配对无需改动并复验：`harness/checks/08-spec-doc-breakpoints.ps1` 的 `$pairs` 仍是 4 组（本轮不迁移文件、不改断点），`AGENTS.md` 的 `<!-- harness-checks: ... -->` 标记不动。验证：`powershell -File harness\checks\07-doc-consistency.ps1; powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 两个退出码均为 0。

## 5. 集成验收

- [x] 5.1 前端整链：`cd frontend; npm run build; npm run test` 均退出码 0，且通过用例数不少于改前基线（新增用例后应更多）。验证：两条命令的输出末行。
- [x] 5.2 行为取证：`cd frontend; npm run dev` 后截图 `/`（英文界面、城市英文名）、`/?city=chengdu`（Chengdu 高亮）、`/search?q=chengdu`（英文命中三类）、`/search?q=成都`（中文仍命中）、`/search?q=zzz`（英文空态）、`/search`（英文引导态），随后关闭服务。验证：截图文件存在且与预期一致。
- [x] 5.3 工作区总闸门：`powershell -File harness\run-all.ps1` 退出码 0（九道闸门全部 PASSED）。验证：`$LASTEXITCODE` 为 0。
- [ ] 5.4 按子模块边界提交：先在 `frontend/` 提交并推送本轮代码与测试，再回工作区提交 `docs/` 与新 `frontend` gitlink。验证：`git -C frontend log --oneline -1` 有新提交，工作区 `git status` 只剩预期的自有文件与 gitlink 变动。

## Workflow follow-up

- 人类审阅 proposal / specs / design / tasks 后放行，才可开始 `/opsx:apply`。
- 实施完成后执行 `/opsx:archive`：`wanderchain-homepage` 追加两条 Requirement（「英文界面语言」「双语内容字段」）；`wanderchain-search` 退役「匹配字段与分组」、追加「匹配字段与分组（中英文）」。
- 归档后按仓库约定给归档提交打 annotated tag `archive/<归档目录名>`，并核对「归档目录数 == 本地 tag 数 == 远端 tag 数」。
