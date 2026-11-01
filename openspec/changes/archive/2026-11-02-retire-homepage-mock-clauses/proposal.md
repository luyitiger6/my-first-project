# Proposal

## Why

`wanderchain-homepage` 主规格里仍保留两条上线前的 Mock 时代条款：「契约与 Mock 数据层」要求全部内容区块共享 Mock 数据源，「Mock 认证」要求会话只存在于前端且 MUST NOT 发起网络请求。而认证早已接到真实后端（会话来自 `/api/auth/me`，令牌走 HttpOnly cookie），热门景点也已读 `GET /api/attractions`，两条条款与实现方向相反。

规格是验收解释权的持有者。留着失效条款会让后来者按错误前提判断现状，也让「替换真实数据源不改组件」这类断言失去可验证的对象。

## What Changes

- 退役「契约与 Mock 数据层」，改为「首页数据来源分层」：城市白名单、编辑推荐与热门帖子仍由 `lib/home` 的 Mock 仓储供给，热门景点经后端景点接口读取，组件 MUST NOT 内联业务数据。
- 退役「Mock 认证（登录标识为邮箱）」，改为「首页账号入口读取真实会话」：会话来自 `/api/auth/me`，未登录展示登录入口，登录态展示显示名与退出入口；注册、登录、验证码与错误码的具体行为由 `wanderchain-auth-frontend` 承载。
- 明确用户对象不含角色字段：后端 `MeResponse` 只有 publicId / email / displayName / status / createdAt，头部 MUST NOT 渲染任何角色徽章。
- **BREAKING**：删除「会话 MUST NOT 发起网络请求」与「角色字段可用」两项断言，它们描述的是已被替换掉的旧实现。

## Capabilities

### New Capabilities

无。本变更不引入新能力，只修正既有能力的规格表述。

### Modified Capabilities

- `wanderchain-homepage`: 用 REMOVED + ADDED 承接两条失效 Requirement（「契约与 Mock 数据层」→「首页数据来源分层」，「Mock 认证（登录标识为邮箱）」→「首页账号入口读取真实会话」），Requirement 总数保持 16。

## Impact

- 规格：`openspec/specs/wanderchain-homepage/spec.md`，两条 Requirement 整块替换。
- 代码：无改动。当前实现已是目标形态，本变更只让规格追上实现。
- 依赖边界：认证细节仍由 `wanderchain-auth-frontend` 定义，首页侧不重复声明，避免两处平行真相。
- 验收：`openspec validate --specs` 与 07 / 08 闸门不受影响。
