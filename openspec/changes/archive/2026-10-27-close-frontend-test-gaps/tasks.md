# Tasks

## 1. P0 系统性盲区

- [x] 1.1 新建 `frontend/components/home/use-section-data.test.ts`：初始 `loading`、resolve → `ready`（items/total）、reject → `error`、deps 不变不重复取数、deps 变化重新取数、卸载前 resolve 不更新状态；验证：`npx vitest run components/home/use-section-data.test.ts` 全绿
- [x] 1.2 新建 `frontend/components/home/section-boundary.test.tsx`：render 期抛错被捕获、只降级自身、文案为 `<title> could not load. Please try again later.`、兄弟区块不受影响；验证：该文件全绿
- [x] 1.3 新建 `frontend/components/home/section-state.test.tsx`：`SectionLoading` 为 `role="status"` 且携带 label、`SectionError` 为 `role="alert"`、`EmptyState` 不占用这两种 role；验证：该文件全绿
- [x] 1.4 `editor-picks.test.tsx`、`hot-posts.test.tsx`、`hot-attractions.test.tsx` 各补一条「pending 期间 `role="status"` 可见，resolve 后消失」；验证：三条用例全绿

## 2. P1 测试遗漏

- [x] 2.1 U7-S5：`hot-posts.test.tsx` 补 `city='chengdu'` 只渲染本城与全城通用帖子；`repository.test.ts` 补 `listHotPosts({city:'chengdu'})` 的过滤与 `total`；验证：组件与仓储两侧各有断言
- [x] 2.2 U0-S8：`cities.test.ts` 补 `cityNameEn('unknown' as CitySlug) === 'All cities'` 与 `cityName` 中文兜底；验证：用例通过
- [x] 2.3 U0-S9/S11：在 `repository.sorting.test.ts` 用注入的空数据集验证 `{ items: [], total: 0 }`（真实 Mock 中 `all` 通用卡片使 sanya 仍命中 1 条，无法造出空结果）；`format.test.ts` 补 Invalid Date 抛 `RangeError`；验证：用例通过
- [x] 2.4 U1-S9/S11/S5/S7：`mock-auth.test.ts` 补用户名 trim 后 <2、邮箱大小写 + 首尾空格、邮箱不存在与密码错误文案完全一致、非法邮箱精确文案且不写存储；验证：用例通过
- [x] 2.5 U4-S6：`ai-assistant.test.tsx` 补点击面板标题/正文/空白处不关闭；验证：用例通过
- [x] 2.6 U4-S1/S2/S10/S11/S12/S13/S14：补首帧无 dialog 且两触发器 `aria-expanded="false"`、打开后同步为 `true`、重复 `open()` 只有一个面板、关闭后再打开焦点归还新触发器、触发元素移除时静默跳过、无 `document` 时 `open()` 不抛、悬浮按钮 `aria-label` 仍存在、SSR 首屏无遮罩；验证：用例通过
- [x] 2.7 U5-S8/S11：`city-switcher.test.tsx` 补非法 `activeCity` 回落 All cities 且无 chip 选中、连续点击三次只保留最后一次 URL；验证：用例通过
- [x] 2.8 U7-S14 / U8-S14：`hot-posts.test.tsx`、`hot-attractions.test.tsx` 各补「先发的慢请求后返回不覆盖新城市结果」；验证：两条用例通过
- [x] 2.9 Search-S8：`app/search/page.test.tsx` 补含引号/尖括号/脚本标签的关键词按纯文本回显且不生成可执行节点；验证：用例通过
- [x] 2.10 U3-S1/S4/S10：`feature-nav.test.tsx` 补三卡顺序与四要素、`aria-labelledby` + h2 + 图标 `aria-hidden`、面板已开时再次点击 AI 卡仍只有一个面板；验证：用例通过

## 3. P2 断言强度

- [x] 3.1 新建 `frontend/lib/home/repository.sorting.test.ts`：`vi.mock('./mock-data')` 注入乱序/并列/超限数据，验证三类排序的每个排序键、`id` 兜底、字面上限 6/10/5、`total` 为截断前总数、`draft`/`removed` 不计入；验证：该文件全绿
- [x] 3.2 U5-S10：`city-switcher.test.tsx` 用 `URLSearchParams` 解析目标 URL，断言 `getAll('city')` 长度为 1 且值为点击城市；验证：用例通过

## 4. 文档漂移与断点闸门

- [x] 4.1 U0 §3.1：`EditorPick` 补 `titleEn`/`summaryEn`/`editorEn`，`Post` 补 `titleEn`/`authorEn`，`Attraction` 补 `nameEn`，与 `lib/home/types.ts` 一致；验证：字段逐个比对
- [x] 4.2 U6 §4.3：`alt` 由 `alt="<标题>封面"` 改为 `alt="<titleEn> cover"`；验证：与 `editor-picks.tsx` 一致
- [x] 4.3 U4 §4.4：覆盖声明改为 S1–S17，并勾选已由用例覆盖的 checklist 项；验证：声称范围与测试文件用例一一对应
- [x] 4.4 U3/U5/U7 §5.3：响应式小节改写为 desktop-first 实际断点并补「真相源」声明；`harness/checks/08-spec-doc-breakpoints.ps1` 配对表新增三对；验证：`powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 退出码 0

## 5. 验收

- [x] 5.1 `cd frontend; npm run test` 退出码 0，用例数从 230 增至 283（25 个测试文件全绿）
- [x] 5.2 `cd frontend; npm run build` 退出码 0（含 TypeScript 类型检查；已修正 `use-section-data.test.ts` 对联合类型的属性访问）
- [x] 5.3 `powershell -File harness\checks\07-doc-consistency.ps1` 与 `08-spec-doc-breakpoints.ps1` 退出码 0（08 覆盖 7 份单元文档）
- [x] 5.4 `powershell -File harness\checks\04-frontend.ps1` 退出码 0（npm ci → build → 283 例测试全绿）
- [x] 5.5 `powershell -File harness\run-all.ps1` 退出码 0：00–08 九道闸门全部 PASS（含 06-flyway 在 127.0.0.1:8806/ai_chat_gate 迁移验证）

## Workflow follow-up

- 验收通过后运行 `/opsx:archive` 归档本变更。
