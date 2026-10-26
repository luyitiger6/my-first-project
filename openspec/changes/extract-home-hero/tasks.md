# Tasks

## 1. 组件与样式落位

- [ ] 1.1 新建 `frontend/components/home/hero.module.css`，把 `app/home.module.css` 中 hero 相关规则（`hero`、`heroInner`、`title`、`lead`、`actions`、`textLink`、`meta`、`aside`、`asideTitle`、`stats`、`stat`、`statLabel`、`statValue`、`asideNote` 及其响应式分支）迁入
- [ ] 1.2 新建 `frontend/components/home/hero.tsx`，导出 `HeroStatLabel`、`HeroStat`、`HomeHeroProps` 与 `HomeHero`；不写 `'use client'`
- [ ] 1.3 实现概览取值：缺省用 `CITIES.length` 与三个 `*_LIMIT`；入参非「恰好四项 + 固定顺序 + 均为非负整数」时整组回退
- [ ] 1.4 从 `app/home.module.css` 删除已迁走的规则，确认原文件不再含 hero 相关类

## 2. 页面接线与清理

- [ ] 2.1 `app/page.tsx` 用 `<HomeHero />` 替换原有内联 hero JSX（原 47–97 行）
- [ ] 2.2 删除 `page.tsx` 中因此不再需要的 import：`CITIES` 与 `EDITOR_PICKS_LIMIT`、`HOT_POSTS_LIMIT`、`HOT_ATTRACTIONS_LIMIT`
- [ ] 2.3 核对 `page.tsx` 中 hero 相关 `styles.*` 引用为 0；`home.module.css` 中仅保留页面级与区块容器样式

## 3. 测试

- [ ] 3.1 新建 `frontend/components/home/hero.test.tsx`，断言默认四项概览的标签顺序与数值
- [ ] 3.2 覆盖非法入参整组回退：数量不足、顺序颠倒、含负数、含小数四种情况均回退为默认值且不抛错
- [ ] 3.3 断言「进入旅游社区」指向 `/community`、「查看景点攻略」指向 `/attractions`、「按城市逛」指向 `#cities`
- [ ] 3.4 用抽取前后的 `container.innerHTML` 比对证明 DOM 结构零变化，并把比对结论记入 tasks 勾选说明
- [ ] 3.5 复核 `app/page.test.tsx`：主视觉抽出后原有断言（区块顺序、城市参数透传）仍应通过，不通过则修断言而非改行为

## 4. 规格与文档同步

- [ ] 4.1 `docs/specs/wanderchain/homepage-u2-skeleton.md`：把「`page.tsx` 内不再残留 hero 内联 JSX」由差异项转为已满足
- [ ] 4.2 `docs/specs/wanderchain/homepage-hero.md`：按实施结果更新 5.5「与现状差异」表，并勾选已完成的验收项
- [ ] 4.3 确认 `openspec/specs/wanderchain-homepage/spec.md` 未被直接修改（真相层只经归档同步）

## 5. 验收

- [ ] 5.1 `powershell -File harness\run-all.ps1` 退出码为 0
- [ ] 5.2 `openspec validate extract-home-hero --strict` 通过

> 提交与推送由人决定：`frontend/` 是子模块，改动需先在子模块仓库内提交，再回父仓库更新 gitlink。agent 不主动提交。
