# Tasks

## 1. 差异核对

- [x] 1.1 核对「契约与 Mock 数据层」与实现的差异：热门景点走 `components/home/hot-attractions.tsx` → `lib/attractions/attractions-api`，编辑推荐与热门帖子仍走 `lib/home` 的 `mockRepository`
- [x] 1.2 核对「Mock 认证」与实现的差异：会话来自 `/api/auth/me`（`components/auth/auth-provider.tsx`），`account-menu.tsx` 只在登录态渲染显示名与 `Log out`，`MeResponse` 字段为 publicId / email / displayName / status / createdAt，无角色字段

## 2. 规格修正

- [x] 2.1 以 REMOVED + ADDED 承接两条失效 Requirement：「契约与 Mock 数据层」→「首页数据来源分层」，「Mock 认证（登录标识为邮箱）」→「首页账号入口读取真实会话」
- [x] 2.2 `openspec validate retire-homepage-mock-clauses --strict` 退出码为 0（实测 `Change is valid`）

## 3. 归档

- [x] 3.1 `openspec archive` 将 delta 合入 `wanderchain-homepage`，Requirement 总数保持 16（实测 added 2 / removed 2，计数仍为 16）
- [x] 3.2 复核主 spec 无 delta 段头残留，`openspec validate --specs` 全绿（段头 none，16 passed / 0 failed）

## Workflow follow-up

- 本变更只改 `openspec/` 下的规格与工件，不涉及 backend / frontend 子模块，工作区单笔提交即可。
- 归档后打 annotated tag `archive/2026-11-02-retire-homepage-mock-clauses` 并推送。
