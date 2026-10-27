# Tasks

## 1. 评分数据与守卫

- [x] 1.1 在 `frontend/lib/home/mock-data.ts` 按 design.md 的换算表改写 9 条景点的 `rating`（`9.9/9.9/9.6/9.5/9.3/9.2/9.0/8.8/8.7` → `4.9/4.9/4.8/4.7/4.6/4.5/4.4/4.3/4.2`）。验证：`git -C frontend diff --stat` 只涉及该文件的 9 行，且文件内不再出现大于 5 的 `rating` 字面量。
- [x] 1.2 在 `frontend/lib/home/data-integrity.test.ts` 新增评分取值域守卫：逐条断言 `0 <= rating <= 5` 且 `rating * 10` 为整数，失败信息带上景点 `id`。验证：`cd frontend; npx vitest run lib/home/data-integrity.test.ts` 全绿；再临时把某条评分改成 `9.6` 跑一次确认守卫变红，随即还原并确认 `git -C frontend diff` 无残留。

## 2. 前端行为验收

- [x] 2.1 跑前端全量测试与构建：`cd frontend; npm run test` 与 `npm run build`。验证：两条命令退出码均为 0，构建成功产出 8 个路由，用例数比 190 增加且无失败。
- [x] 2.2 抽查两处消费点的渲染结果：首页热门景点区块与 `/search?q=<命中城市>`。验证：两处评分文本形如 `Rating 4.x`，页面文本中不出现 `8.` / `9.` 开头的评分；检索分组标题仍为 `Editor's picks` / `Posts` / `Attractions`。

## 3. 单元文档一致性核对

- [x] 3.1 核对三份单元文档是否与修正后的取值域和英文标题一致（`docs/specs/wanderchain/homepage-u0-contract-mock.md` 的 `rating` 不变量、`homepage-u8-hot-attractions.md` 的 S5 / S12、`search-page.md` 的分组标题）。验证：三处原文与 `frontend/lib/home/mock-data.ts`、`frontend/lib/search/query.ts` 的实际取值逐条比对，若全部吻合则不改动任何文档并记录结论；若有偏差则就地修正并在同一任务内说明理由。

## 4. 子模块边界与总闸门

- [ ] 4.1 按子模块边界在 `frontend/` 内提交并推送。验证：`git -C frontend log --oneline -1` 出现本轮提交，推送后 `git -C frontend status -sb` 无 `ahead`。
- [ ] 4.2 回工作区提交 change 产物与新 gitlink，只暂存 `openspec/changes/fix-rating-scale-and-search-labels/` 与 `frontend`。验证：`git ls-files -s frontend` 的提交号等于 `git -C frontend rev-parse HEAD`，`git status --short` 不出现 `.qoder/repowiki/`。
- [ ] 4.3 跑总闸门 `powershell -File harness\run-all.ps1`。验证：退出码为 0 且输出 `RESULT: ALL CHECKS PASSED`；跑完 `git status --short` 为空（05 闸门已还原 `AGENTS.md` / `README.md`）。

## Workflow follow-up

- 人类审阅本轮工件后放行，再执行 `/opsx:apply`。
- 实施完成后执行 `/opsx:archive`，把两份 delta 合入 `openspec/specs/wanderchain-homepage/spec.md` 与 `openspec/specs/wanderchain-search/spec.md`，并打 `archive/<归档目录名>` tag。
