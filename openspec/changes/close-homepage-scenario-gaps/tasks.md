# Tasks

## 1. 热门景点补单列断点

- [x] 1.1 `frontend/components/home/hot-attractions.module.css` 新增 `@media (max-width: 480px)`，把 `.grid` 收成单列；验证：用正则提取该文件的 `max-width` 集合，结果为 1080 / 720 / 480
- [x] 1.2 同步 `docs/specs/wanderchain/homepage-u8-hot-attractions.md` 的响应式小节：§5.3 表格补 `≤ 480px → 1 列` 一行、§4.4 验收清单补 320px 单列表述；验证：`powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 退出码 0

## 2. 占位页补站点框架

- [x] 2.1 `frontend/components/site/placeholder.tsx` 渲染 `SiteHeader` 与 `SiteFooter`，并把撑高职责交给外层 flex 容器，避免与 header/footer 叠加出双倍高度；验证：`npm run build` 通过且 `/community` 页面 HTML 同时含 header 与 footer
- [x] 2.2 补断言：`/community` 与 `/attractions` 渲染结果中同时存在站点顶栏、页脚与 `main-content`；验证：`npm run test` 新增用例通过
- [x] 2.3 收窄 `docs/specs/wanderchain/homepage-u2-skeleton.md` 的 S4：由「任意路径」改为「首页与占位页必须完整」，并写明登录/注册为独立品牌页的显式例外；验证：文档措辞核对，且 `07-doc-consistency.ps1` 退出码 0

## 3. 文档措辞与主规格对齐

- [x] 3.1 `docs/specs/wanderchain/homepage-u3-feature-nav.md` 的 S6、`homepage-u4-ai-assistant.md` 的 S9：把期望抛错文案由中文改为实现实际文案 `useAiAssistant must be used inside AiAssistantProvider`；验证：与 `frontend/components/home/ai-assistant.tsx` 的字符串逐字一致
- [x] 3.2 `docs/specs/wanderchain/homepage-hero.md` 的 S7：标注锚点缺失属浏览器默认行为、本单元不作保障，仅在目标存在时保证跳转；验证：该场景不再表述为可验收结果
- [x] 3.3 `frontend/components/home/ai-assistant.test.tsx` 新增「在 Provider 外调用 `useAiAssistant` 抛出固定英文文案」用例；验证：该用例通过且断言文案与实现逐字一致

## 4. 首页查询参数兜底

- [x] 4.1 `frontend/app/page.tsx` 对 `searchParams` 取缺省空对象；验证：类型检查与 build 通过
- [x] 4.2 `frontend/app/page.test.tsx` 新增「`searchParams` 缺失时页面正常渲染并回落 `all`」用例；验证：用例通过

## 5. 优先集断言补强

- [x] 5.1 `hot-posts.test.tsx` 补排名两位补零、元信息拼接、计数格式化、`0` 值不显示 `NaN` 四条；验证：四条用例通过且断言的是渲染文本
- [x] 5.2 `hot-attractions.test.tsx` 补城市过滤、浏览数格式化、元信息拼接、`city` 变化触发重取四条；验证：四条用例通过
- [x] 5.3 `city-switcher.test.tsx` 补「切回 All cities 删除 `city` 并保留其他参数」与「说明文案跟随当前城市」两条；验证：两条用例通过
- [x] 5.4 `frontend/lib/auth/mock-auth.test.ts` 补会话过期被删除、损坏会话被删除且不抛、无 `window` 时存储访问返回 `null` 三条；验证：三条用例通过
- [x] 5.5 新建 `frontend/components/auth/auth-form.test.tsx`：补「两次密码不一致不调用 `register`」与「提交中按钮禁用且文案为 `Working…`」两条，`useRouter` mock 照 `account-menu.test.tsx` 写法；验证：新文件两条用例通过
- [x] 5.6 `frontend/components/home/editor-picks.test.tsx` 补「先发的慢请求后返回时被丢弃」的竞态用例、`frontend/app/page.test.tsx` 补「重复 `city` 参数取首值」与「`city` 变化触发三个区块重取」；验证：三条用例通过
- [x] 5.7 跑全量前端测试，确认用例数由 208 增至约 228 且全部通过；验证：`npm run test` 退出码 0

## 6. 集成验收与提交

- [x] 6.1 起前端生产服务抽查两档视口：320px 下热门景点为单列、`/community` 有顶栏页脚且无横向滚动；验证：截图或 DOM 报告，抽查后关闭自起进程
- [x] 6.2 `powershell -File harness\run-all.ps1` 退出码 0，九门全 PASS；验证：退出码与各门输出
- [ ] 6.3 `frontend` 子模块内提交并推送，回工作区提交新 gitlink 与文档改动；验证：`git submodule status` 与工作区 `git status` 一致

## Workflow follow-up

- 验收通过后运行 `/opsx:archive` 归档本变更。
- 归档后复跑 `harness\run-all.ps1` 并核对工作区与远端一致。
