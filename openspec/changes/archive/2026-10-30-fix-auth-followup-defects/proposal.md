# Proposal

## Why

`add-wanderchain-auth-frontend` 归档时，CodeReview 记下三项非阻塞缺陷，一直未处理。它们都不影响主流程，但都会让用户或运维在边角路径上吃亏：

1. **注册第一步的失败分支无差别换码**。`auth-form.tsx` 的 catch 里对「注册 + 第一步」这个组合一律 `loadCaptcha()`，而 `loadCaptcha` 会顺带清空图形码答案。于是网络错误、`429` 冷却这类**图形码根本没被消费**的失败，也会把用户已经看好的图和已输入的答案一起换掉，逼用户重来一次。
2. **刷新图形码会覆盖真正的失败原因**。`loadCaptcha` 自带 catch 并 `setError(...)`，当刷新本身失败时，用户看到的是「图形码获取失败」，而不是刚才那次登录/注册真正失败的原因。
3. **登出请求失败会漏出未处理的 rejection**。`auth-provider.tsx` 的 `logout` 只有 `try/finally`，界面状态能正确回到访客态，但 promise 会以 rejection 结束，`onClick={() => void logout()}` 这条路径上没人接，控制台留下未捕获异常。
4. **密码提示把字节说成字符**。提示常量名为 `PASSWORD_MIN_BYTES` / `PASSWORD_MAX_BYTES`，文案却写 `characters`。更麻烦的是主 spec 自身互斥：`wanderchain-auth-frontend` 的 Requirement 正文写「8 到 72 字节」，同一 Requirement 下的 Scenario 却写「提示的下限是 8 个字符」。按哪一条实现都能自称合规，这正是必须由规格裁决、而不是由实现者顺手决定的点。

## What Changes

- **图形码刷新时机收窄为「码确实被拒」**：只有后端以 `CAPTCHA_INVALID` 明确拒绝时才换发新码并清空答案；其它失败（网络错误、`429` 冷却、字段校验 `400`）保留当前码与已输入答案。
- **刷新失败不再劫持错误提示**：换码动作自身的失败 MUST NOT 覆盖原始失败原因，原始原因优先展示。
- **登出失败收敛**：登出请求失败时仍回到访客态，且 MUST NOT 产生未处理的 promise rejection；补一条失败路径测试（成功路径已有覆盖，不重复造）。
- **密码提示改为字节口径**，并修正主 spec 内「字节 / 字符」互斥表述。因为要改写既有 Scenario 的措辞，按本项目约束采用 **REMOVED 旧 Requirement + ADDED 新命名 Requirement** 承接，Requirement 总数不变。

不改后端任何契约、不改 API 路径与字段、不引入新依赖。

## Capabilities

### New Capabilities

（无。本次只修正既有前端认证行为，不引入新的系统能力边界。）

### Modified Capabilities

- `wanderchain-auth-frontend`：收窄图形码刷新时机与错误提示归属（登录与注册两条链路）；明确登出失败仍回到访客态且不抛未处理异常；密码提示以字节表述，并消除 Requirement 正文与 Scenario 之间的「字节 / 字符」互斥。

## Impact

- `frontend/components/auth/auth-form.tsx`：`PASSWORD_HINT` 文案、`loadCaptcha` 与 catch 分支的刷新条件、错误提示优先级。
- `frontend/components/auth/auth-provider.tsx`：`logout` 的失败收敛。
- 前端测试：`auth-form` 相关用例补充「码未被消费时不换码」「刷新失败不覆盖原错误」「提示为字节口径」，`auth-provider` 补充登出失败的失败路径用例。
- 不改 `frontend/lib/auth/*` 的请求层、不改后端 `service/auth` 与 `web/auth`、不改前后端契约字段，因此契约闸门（`10-contract-check`）预期不受影响。
