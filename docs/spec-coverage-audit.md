# docs/ 规格文档 When/Then 场景覆盖审计报告

> 审计日期：2026-10-27  
> 审计范围：`docs/specs/wanderchain/*.md`（11 份）+ `docs/db-design-spec.md`  
> 判定口径：已覆盖 = 存在测试断言直接验证场景核心行为；部分覆盖 = 有相关测试但断言未触及核心；未覆盖 = 无对应验证

---

## 总览

| 文档 | 场景数 | 已覆盖 | 部分覆盖 | 未覆盖 |
|---|---|---|---|---|
| homepage-hero.md | 10 | 5 | 1 | 4 |
| homepage-u0-contract-mock.md | 11 | 6 | 2 | 3 |
| homepage-u1-mock-auth.md | 16 | 11 | 4 | 1 |
| homepage-u2-skeleton.md | 13 | 5 | 7 | 1 |
| homepage-u3-feature-nav.md | 10 | 3 | 2 | 5 |
| homepage-u4-ai-assistant.md | 17 | 10 | 2 | 5 |
| homepage-u5-city-switcher.md | 12 | 7 | 2 | 3 |
| homepage-u6-editor-picks.md | 11 | 6 | 1 | 4 |
| homepage-u7-hot-posts.md | 14 | 9 | 2 | 3 |
| homepage-u8-hot-attractions.md | 14 | 10 | 2 | 2 |
| search-page.md | 9 | 7 | 1 | 1 |
| db-design-spec.md | 13 | 10 | 3 | 0 |
| **合计** | **150** | **89** | **29** | **32** |

---

## 覆盖率

| 指标 | 值 |
|---|---|
| 严格覆盖率（仅已覆盖） | 89/150 = 59.3% |
| 宽松覆盖率（已覆盖 + 部分覆盖） | 118/150 = 78.7% |
| 前端 wanderchain（hero~u8 + search，127 条） | 78 已覆盖 + 23 部分 = 79.5% |
| db-design-spec（13 条） | 10 已覆盖 + 3 部分 = 100% |

---

## 逐文档明细

### homepage-hero.md

- 已覆盖: [S1] 唯一 h1 + 文案 + 区域命名
- 部分覆盖: [S2] 背景大图属性 — `priority`/loader 与 next.config 接线未断言
- 已覆盖: [S3] 搜索框 GET 提交到 /search?q=
- 已覆盖: [S4] 三个文字入口 href 正确
- 已覆盖: [S5] 城市规模提示数字派生自白名单
- 已覆盖: [S6] `/?city=beijing` 首屏与无参数一致
- 未覆盖: [S7] `#cities` 锚点目标缺失兜底 — 文档声明为浏览器默认行为，刻意不测
- 未覆盖: [S8] 320px 纵向布局/无横向滚动 — jsdom 无布局引擎
- 未覆盖: [S9] 无 JS 时首屏可见 — 需禁用 JS 的真实浏览器
- 未覆盖: [S10] `prefers-reduced-motion` 无位移过渡 — CSS 媒体查询，jsdom 不解析

### homepage-u0-contract-mock.md

- 已覆盖: [S1] `parseCity` 合法/非法/缺失三路径
- 已覆盖: [S2] 数组入参取首元素
- 已覆盖: [S3] 城市过滤命中本城 + all 通用
- 部分覆盖: [S4] 三类排序 — 景点排序断言是代理（id 顺序与 viewCount 降序巧合重合）
- 部分覆盖: [S5] 截断与总数分离 — 精选的 total 未断言，上限用常量自比未钉死字面值
- 已覆盖: [S6] `formatCount` 千分位 + `formatDate` 锁 Asia/Shanghai
- 已覆盖: [S7] 非法城市静默回落不抛错
- 未覆盖: [S8] `cityNameEn` 未收录 slug 兜底返回 `'All cities'` — 测试遗漏
- 未覆盖: [S9] 无匹配时仓储返回 `{items:[], total:0}` — 测试遗漏
- 已覆盖: [S10] draft/removed 不出现不计入 total
- 未覆盖: [S11] `publishedAt` 非法时不抛错 — 测试遗漏

### homepage-u1-mock-auth.md

- 已覆盖: [S1] 已登录首帧恢复 + admin 标
- 已覆盖: [S2] 无会话时 guest + 登录入口
- 部分覆盖: [S3] 注册后写入 localStorage + replace('/') — 未读取 key 验证落盘，replace 未断言
- 已覆盖: [S4] 登录签发三段式令牌 + 会话持久化
- 部分覆盖: [S5] 邮箱大小写/trim 不敏感 — trim 分支未被触发
- 已覆盖: [S6] 退出后 session 移除、回 guest
- 部分覆盖: [S7] 邮箱非法 → AuthError — 未断言文案，表单侧 role="alert" 未验证
- 已覆盖: [S8] 密码 < 6 → 精确文案
- 未覆盖: [S9] 用户名 trim 后 < 2 → 固定文案 — 测试遗漏，分支从未执行
- 已覆盖: [S10] 邮箱重复 → 精确文案
- 部分覆盖: [S11] 邮箱不存在 vs 密码错 — 只覆盖密码错分支
- 已覆盖: [S12] 两次密码不一致
- 已覆盖: [S13] 会话过期删除返回 null
- 已覆盖: [S14] 会话 JSON 损坏时删除不抛
- 已覆盖: [S15] 提交中 disabled + Working…
- 已覆盖: [S16] 无 window 时返回 null 不抛 ReferenceError

### homepage-u2-skeleton.md

- 部分覆盖: [S1] 五区块顺序 + 标题 — 顺序已断言，3/5 个标题零断言
- 已覆盖: [S2] `/?city=beijing` 下发到区块
- 部分覆盖: [S3] 非 city 参数保留 — 页面层无测试
- 部分覆盖: [S4] 全站顶栏/页脚/跳过链接 — 跳过链接与浮动 AI 按钮零断言
- 部分覆盖: [S5] loading → ready 态 — `role="status"` 加载态零断言
- 已覆盖: [S6] 非法城市归一化为 all
- 已覆盖: [S7] 单区块 reject 不影响其余
- 未覆盖: [S8] render 期抛错被 SectionBoundary 捕获 — section-boundary.tsx 无测试文件
- 部分覆盖: [S9] 空态不与错误态并存 — 互斥约束未验证
- 部分覆盖: [S10] city 变化重取 + 不变时不重复取 — 后半句无断言
- 部分覆盖: [S11] 旧结果丢弃 + 卸载无警告 — 卸载路径无断言
- 已覆盖: [S12] 重复参数取首值
- 已覆盖: [S13] searchParams 缺失仍正常渲染

### homepage-u3-feature-nav.md

- 部分覆盖: [S1] 三卡顺序 + 四要素 — DOM 顺序/描述/图标/动作文案无断言
- 已覆盖: [S2] 社区/攻略链接指向
- 已覆盖: [S3] AI 卡打开 dialog
- 未覆盖: [S4] aria-labelledby + h2 + 图标 aria-hidden — 测试遗漏
- 未覆盖: [S5] Tab 顺序/焦点环/Enter+Space — jsdom 不实现焦点序列
- 已覆盖: [S6] Provider 外调用抛固定错误
- 未覆盖: [S7] 目标页缺失落 404 — 文档声明不属本单元职责
- 部分覆盖: [S8] 320px 单列 — 代理断言，jsdom 无法验证堆叠
- 未覆盖: [S9] 描述超两行卡片增高 — 纯布局
- 未覆盖: [S10] 面板已开时再点 AI 卡幂等 — 测试遗漏

### homepage-u4-ai-assistant.md

- 部分覆盖: [S1] 首帧无 dialog + aria-expanded=false — 初始态与 aria-expanded 无断言
- 已覆盖: [S2] 悬浮按钮打开面板
- 已覆盖: [S3] 顶栏触发器打开同一面板
- 已覆盖: [S4] Esc 关闭 + 焦点归还
- 已覆盖: [S5] 遮罩关闭 + 焦点归还
- 未覆盖: [S6] 面板内点击不关闭 — 测试遗漏
- 已覆盖: [S7] ×/Got it 关闭 + 焦点归还
- 已覆盖: [S8] 打开后焦点落在关闭按钮
- 已覆盖: [S9] Provider 外抛错
- 未覆盖: [S10] 已打开时再次 open() 幂等 — 测试遗漏
- 部分覆盖: [S11] 关闭后再打开焦点指向新触发器 — 未在二次打开后断言
- 未覆盖: [S12] 触发元素已移除时焦点归还静默跳过 — 测试遗漏
- 未覆盖: [S13] 无 document 环境 open() 不抛 — 测试遗漏
- 未覆盖: [S14] 320px 悬浮按钮 aria-label — 测试遗漏
- 已覆盖: [S15] Tab 循环到最后回第一
- 已覆盖: [S16] Shift+Tab 循环
- 已覆盖: [S17] body overflow 锁定与恢复

### homepage-u5-city-switcher.md

- 部分覆盖: [S1] 8 个 chip 顺序 + type="button" — 顺序与 type 无断言
- 已覆盖: [S2] 当前城市唯一 aria-pressed="true"
- 已覆盖: [S3] 点击城市 → router.replace
- 已覆盖: [S4] 保留非 city 参数
- 已覆盖: [S5] All cities 删除 city 保留其余
- 已覆盖: [S6] Now: nameEn · taglineEn
- 已覆盖: [S7] 重复点击当前城市不导航
- 未覆盖: [S8] 非法 activeCity 兜底 — 测试遗漏
- 已覆盖: [S9] query={} 时 URL 正确
- 部分覆盖: [S10] 已有 city 时覆盖不重复 — toContain 无法排除重复参数
- 未覆盖: [S11] 连续快速切换只保留最后 — 测试遗漏
- 未覆盖: [S12] 320px 换行/不裁切 — CSS 布局

### homepage-u6-editor-picks.md

- 部分覆盖: [S1] 卡片五要素 — 城市标/摘要/编辑署名零断言
- 已覆盖: [S2] sortOrder 升序 + id 兜底
- 已覆盖: [S3] 城市过滤
- 已覆盖: [S4] city 变化重新取数
- 未覆盖: [S5] 加载态 role="status" 文案 — 全仓零断言
- 已覆盖: [S6] reject 展示 role="alert" 错误文案
- 已覆盖: [S7] 空态文案含城市英文名
- 未覆盖: [S8] 封面 404 保留 4:3 占位 — jsdom 不加载图片
- 未覆盖: [S9] 标题/摘要超长换行不溢出 — 纯 CSS 排版
- 未覆盖: [S10] 320px 单列/4:3 — CSS 媒体查询
- 已覆盖: [S11] 竞态保护只渲染最后结果

### homepage-u7-hot-posts.md

- 已覆盖: [S1] ≤10 条 + 七要素
- 已覆盖: [S2] 排名两位补零 01/10
- 已覆盖: [S3] 排序四级键
- 已覆盖: [S4] draft/removed 不出现
- 未覆盖: [S5] city 过滤 — 测试遗漏（双层缺口）
- 已覆盖: [S6] 元信息拼接格式
- 已覆盖: [S7] 千分位浏览数
- 部分覆盖: [S8] city 变化重取 + 排名重开 — 组件层无 rerender 测试
- 已覆盖: [S9] reject 错误态
- 已覆盖: [S10] 空态文案
- 未覆盖: [S11] 标题超两行换行不挤压 — CSS 排版
- 已覆盖: [S12] viewCount/commentCount=0 显示 0 而非 NaN
- 未覆盖: [S13] 320px 纵向堆叠 — CSS + 未纳入 08 闸门
- 部分覆盖: [S14] 快速切换只渲染最后结果 — hot-posts 自身无测试

### homepage-u8-hot-attractions.md

- 已覆盖: [S1] ≤5 景点卡片
- 已覆盖: [S2] 排序正确
- 已覆盖: [S3] draft/removed 排除
- 已覆盖: [S4] 城市过滤
- 已覆盖: [S5] 评分 toFixed(1)
- 已覆盖: [S6] 浏览数千分位
- 已覆盖: [S7] 元信息拼接
- 已覆盖: [S8] city 变化重取
- 已覆盖: [S9] reject 错误态
- 已覆盖: [S10] 空态文案
- 未覆盖: [S11] 图片加载失败保留 1:1 占位 — jsdom 不模拟图片错误
- 部分覆盖: [S12] 评分边界 0/5/4.95 — data-integrity 验证取值域，未用边界值渲染
- 部分覆盖: [S13] 320px 单列 — 08 闸门验证断点数值，无布局行为测试
- 未覆盖: [S14] 快速切换只渲染最后 — 测试遗漏

### search-page.md

- 已覆盖: [S1] 空/纯空白 → 引导态
- 已覆盖: [S2] 分组顺序 + 条数 + 回显
- 已覆盖: [S3] 首页截断外的内容可搜
- 已覆盖: [S4] 归一化（大小写/trim/slug 不同形零命中）
- 已覆盖: [S5] 分组回链锚点
- 已覆盖: [S6] 零命中空态
- 已覆盖: [S7] draft/removed 不可搜
- 未覆盖: [S8] 特殊字符纯文本回显 — 测试遗漏
- 部分覆盖: [S9] 320px 布局 — 08 闸门验证断点，无布局行为测试

### db-design-spec.md

- 已覆盖: [D1] 迁移可在空库执行
- 已覆盖: [D2] 重复执行幂等
- 已覆盖: [D3] 四张核心表存在
- 已覆盖: [D4] 13 个命名索引存在
- 已覆盖: [D5] 19 个命名约束存在
- 已覆盖: [D6] 生成列 active_email + total_tokens
- 已覆盖: [D7] created_at 审计列
- 部分覆盖: [D8] 迁移失败闸门红 — 机制存在但无负面测试
- 已覆盖: [D9] 不触碰业务库 green-note
- 已覆盖: [D10] 运行期不依赖数据库
- 部分覆盖: [D11] 外键 RESTRICT — DDL 写了但闸门未查 referential_constraints
- 部分覆盖: [D12] DDL 与规格逐字段一致 — 实际一致但闸门只断言名称级
- 已覆盖: [D13] 迁移文件命名规范

---

## 未覆盖场景归因分类

| 缺失原因 | 场景数 | 代表 |
|---|---|---|
| jsdom/CSS 不可测（需真实浏览器） | 14 | 所有 320px 布局、图片加载失败、prefers-reduced-motion、无 JS 首屏 |
| 测试遗漏（可补） | 15 | U0-S8/S9/S11, U1-S9, U3-S4/S10, U4-S6/S10/S12/S13/S14, U5-S8/S11, U7-S5, U8-S14, Search-S8 |
| 浏览器默认/文档声明不测 | 3 | hero-S7, U3-S7, U3-S5(Tab) |

---

## Action Items

### P0 — 系统性盲区（影响全仓）

1. **加载态 `role="status"` 零断言**：三个内容区块的加载文案与 SectionLoading 组件全仓无覆盖。建议新建 `use-section-data.test.ts` 统一验证 pending → ready → error 三态。
2. **SectionBoundary 无测试文件**：render 期异常捕获完全未验证。建议新建 `section-boundary.test.tsx`。

### P1 — 测试遗漏（成本低、jsdom 可测）

3. U7-S5：hot-posts 城市过滤双层缺口（组件 + 仓储均无断言）
4. U0-S8：`cityNameEn` 未收录 slug 兜底
5. U0-S9：仓储空结果契约
6. U1-S9：用户名 < 2 分支
7. U4-S6：面板内点击不关闭
8. U4-S10：重复 open() 幂等
9. U4-S12/S13：焦点归还容错 + 无 document 环境
10. U5-S8：非法 activeCity 兜底
11. U5-S11 / U8-S14：快速切换竞态
12. Search-S8：特殊字符纯文本回显
13. U3-S4/S10：无障碍属性 + 面板幂等

### P2 — 断言强度不足（假安全感）

14. U0-S4：景点排序代理断言（mock 数据巧合）
15. U0-S5：上限用常量自比，未钉死字面值
16. U5-S10：`toContain` 无法排除重复参数
17. U1-S11：邮箱不存在分支未测

### P3 — 需真实浏览器（建议引入 Playwright E2E）

18. 所有 320px 响应式布局（7 条）
19. 图片加载失败保留占位比例（2 条）
20. `prefers-reduced-motion`（1 条）
21. 无 JS 首屏可见（1 条）
22. 08 闸门配对表扩充（U3/U5/U7 断点未纳入）

### P4 — 文档与实现漂移

23. U0 §3.1 接口定义缺 `titleEn`/`summaryEn` 等字段
24. U6 §4.3 alt 文案中英文不一致
25. U4 §4.4 声称覆盖 S1–S9 但 S6 实际无测试

---

## 总结

前端 wanderchain 部分覆盖良好（79.5%），主要缺口集中在 jsdom 技术限制与少量测试遗漏；db-design 由 06-schema-check 闸门全面兜底（100%）。最高 ROI 行动是补 P1 的 13 条低成本测试遗漏 + P0 的两个系统性盲区。

---

## 整改结果（同日回写，仅前端）

> 上方正文保留为审计快照，本节记录按本报告执行后的状态。

| 项 | 状态 | 证据 |
|---|---|---|
| P0-1、P0-2（加载态 / SectionBoundary） | 已完成 | 新增 `use-section-data.test.ts`（6）、`section-boundary.test.tsx`（3）、`section-state.test.tsx`（4）；三个区块各补 `role="status"` 用例 |
| P1-3 ~ P1-13 | 已完成 | U7-S5 双层断言、U0-S8/S9/S11、U1-S9/S11、U4-S1/S2/S6/S10/S11/S12/S13/S14、U5-S8/S11、U7/U8-S14 竞态、Search-S8、U3-S1/S4/S10 |
| P2-14 ~ P2-17 | 已完成 | 新增 `repository.sorting.test.ts`（8，注入数据集＋字面上限 6/10/5）；`city-switcher.test.tsx` 改用 `URLSearchParams` |
| P3-22（08 闸门配对表） | 已完成 | U3/U5/U7 §5.3 改写为 desktop-first 实际断点并补「真相源」；配对表 4 → 7，`08` 退出码 0 |
| P4-23 ~ P4-25（文档漂移） | 已完成 | U0 §3.1 双语字段、U6 三处 `alt`、U4 §4.4 覆盖声明改为 S1–S17 |
| P3-18 ~ P3-21（真实浏览器） | 保留为已知边界 | 320px 布局、图片加载失败、`prefers-reduced-motion`、无 JS 首屏：需 Playwright，本次不引入 |

验证：`npm run test` 283 例 / 25 文件全绿；`npm run build` 退出码 0；`harness\run-all.ps1` 退出码 0（00–08 九道闸门全部 PASS）。

> 一处口径修正：U0-S9 的「sanya 空结果」在真实 Mock 下不成立——`matchesCity` 让 `city: 'all'` 的通用编辑精选始终命中，`listEditorPicks({city:'sanya'})` 实际返回 1 条。因此空结果契约改在 `repository.sorting.test.ts` 注入空数据集验证，`repository.test.ts` 则钉死真实行为（`[4]` / total 1）。

