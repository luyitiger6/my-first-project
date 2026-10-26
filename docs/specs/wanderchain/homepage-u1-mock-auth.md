# U1 · Mock 认证

| 项 | 值 |
|---|---|
| 单元编号 | U1 |
| 归属能力 | `wanderchain-homepage` |
| 对应主 spec | `### Requirement: Mock 认证（登录标识为邮箱）` — [spec.md](../../../openspec/specs/wanderchain-homepage/spec.md) |
| 规格层级 | 人读契约（`docs/specs/`，草稿层）。行为真相以主 spec 为准，冲突时按主 spec 验收 |

## 1. 边界

**包含**

- 注册、登录、退出、读取当前会话
- 会话持久化在 `localStorage`，纯前端自包含
- 假 JWT：三段式字符串，payload 含 `sub` / `role` / `exp`
- 内置账号 `admin@wanderchain.dev`（角色 `admin`）
- `AuthProvider` + `useAuth()`：暴露 `loading` / `guest` / `user` 三态与 `login` / `register` / `logout`
- 登录页、注册页、头部账号入口（`AccountMenu`）

**不包含**

- 真实 JWT 签发与校验、密码哈希与存储
- 邮箱验证、找回密码、Magic Link、MFA
- Google / Apple / 微信登录
- 用户资料编辑、头像上传、权限校验

## 2. 数据依赖

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 会话存储 | 浏览器 `localStorage` | 键值与结构即契约；清空存储等同退出 |
| 用户与令牌 | 静态（内存 + 本地存储） | 无服务端，无密码校验服务 |
| 后端 API | **无** | 本期零网络请求；真实认证另立项 |

## 3. 与其他单元的依赖

- **依赖**：无。与 U0 的契约层无耦合，可并行开发。
- **被依赖**：U2 —— `app/layout.tsx` 挂载 `AuthProvider`，站点头部放置 `AccountMenu`

## 4. 验收清单

- [ ] 提交未注册的邮箱、密码与用户名完成注册后，会话建立并显示当前用户名
- [ ] 提交已注册邮箱与错误密码时，界面展示错误提示且不建立会话
- [ ] 已登录用户刷新页面后仍处于登录态，并显示同一用户
- [ ] 访客打开首页时，头部展示登录入口而非用户名
- [ ] 使用 admin 角色 Mock 账号登录后，当前用户对象的角色为 `admin`
- [ ] 退出后回到访客态，受保护入口恢复为登录入口
- [ ] 整个登录/注册流程不发起任何网络请求

## 5. 实现位置

- `frontend/lib/auth/mock-auth.ts`
- `frontend/components/auth/auth-provider.tsx`、`auth-form.tsx`、`account-menu.tsx`
- `frontend/app/login/page.tsx`、`frontend/app/register/page.tsx`
- 测试：`mock-auth.test.ts`、`account-menu.test.tsx`
