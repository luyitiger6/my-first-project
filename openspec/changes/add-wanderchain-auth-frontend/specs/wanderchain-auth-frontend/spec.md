# Spec Delta

## ADDED Requirements

### Requirement: 会话状态只来自服务端

前端 MUST 通过 `GET /api/auth/me` 判定当前是否已登录，MUST NOT 在浏览器可读存储（`localStorage`、`sessionStorage`、非 HttpOnly cookie）中保存令牌或用户信息。首次挂载时状态为加载中，接口返回 `200` 时进入已登录态，返回 `401` 时进入访客态；网络失败 MUST 归为访客态且 MUST NOT 让页面白屏。登出 MUST 调用后端登出端点，由后端清除 cookie，前端随后回到访客态。

#### Scenario: 已登录用户刷新页面仍是登录态

- **WHEN** 持有有效认证 cookie 的用户加载任意页面
- **THEN** 顶栏在加载态结束后展示该用户的显示名，而不是登录入口

#### Scenario: 无会话时展示登录入口

- **WHEN** `GET /api/auth/me` 返回 `401`
- **THEN** 顶栏展示指向 `/login` 的登录入口，且不展示任何用户信息

#### Scenario: 后端不可达不白屏

- **WHEN** `GET /api/auth/me` 请求失败（网络错误或 5xx）
- **THEN** 页面正常渲染为访客态，不出现未捕获异常导致的白屏

#### Scenario: 登出后回到访客态

- **WHEN** 已登录用户点击登出
- **THEN** 前端调用登出端点，顶栏回到登录入口，且再次请求受保护接口不再成功

#### Scenario: 前端可读存储不含认证信息

- **WHEN** 完成注册或登录后检查浏览器可读存储
- **THEN** 其中不存在令牌、密码或用户资料，认证凭据只存在于 HttpOnly cookie

### Requirement: 注册走两步验证码链路

注册界面 MUST 分两步：先提交图形验证码答案换发邮箱注册码，再提交邮箱注册码完成注册。两步 MUST 各自对应一次后端请求，请求体字段名 MUST 取自前端契约。密码长度提示 MUST 与后端约束一致（8 到 72 字节），MUST NOT 沿用更宽松的旧提示。注册成功后 MUST 处于已登录态并离开注册页。

#### Scenario: 第一步换发邮箱注册码

- **WHEN** 用户填写邮箱与图形码答案并请求注册码
- **THEN** 前端向注册码端点发一次请求，成功后界面进入等待邮箱码的第二步

#### Scenario: 图形码错误时不发第二步

- **WHEN** 图形码答案错误，后端返回 `400` 与 `CAPTCHA_INVALID`
- **THEN** 界面展示对应提示并刷新图形码，不进入第二步，也不提交注册请求

#### Scenario: 重发受冷却限制

- **WHEN** 后端因冷却返回 `429`
- **THEN** 界面展示需等待的秒数，该秒数取自响应的 `Retry-After`，前端不再重复发请求

#### Scenario: 第二步完成注册并自动登录

- **WHEN** 用户提交邮箱注册码且后端返回 `200`
- **THEN** 前端进入已登录态并跳离注册页，浏览器已收到认证 cookie

#### Scenario: 密码提示与后端约束一致

- **WHEN** 用户查看注册表单的密码提示
- **THEN** 提示的下限是 8 个字符而不是 6 个

### Requirement: 登录按错误码分流

登录界面 MUST 依据后端返回的错误码而不是状态码决定行为与文案。收到 `CAPTCHA_INVALID` 时 MUST 取一张图形码并允许带码重试；收到 `RATE_LIMITED` 时 MUST 展示来自 `Retry-After` 的等待时间；两个 `403`（`EMAIL_UNVERIFIED` 与 `CROSS_SITE_REJECTED`）MUST 展示不同文案。界面 MUST NOT 在登录前主动请求图形码。

#### Scenario: 凭证正确直接登录

- **WHEN** 用户提交正确的邮箱与密码且后端返回 `200`
- **THEN** 前端进入已登录态并跳离登录页，整个过程未请求过图形码端点

#### Scenario: 达到阈值后才要求图形码

- **WHEN** 后端返回 `400` 与 `CAPTCHA_INVALID`
- **THEN** 界面出现图形码图片与答案输入框，用户带码重试后请求体包含图形码字段

#### Scenario: 限流展示等待时间

- **WHEN** 后端返回 `429`
- **THEN** 界面展示的等待秒数取自 `Retry-After`，且前端不再自动重试

#### Scenario: 两个 403 文案不同

- **WHEN** 后端分别返回 `EMAIL_UNVERIFIED` 与 `CROSS_SITE_REJECTED`
- **THEN** 界面展示两种不同提示，而不是同一句「登录失败」

#### Scenario: 凭证错误不泄露账户是否存在

- **WHEN** 后端返回 `401`
- **THEN** 界面只展示统一的凭证错误提示，不区分「邮箱未注册」与「密码错误」

### Requirement: 界面不展示后端不存在的字段

前端界面 MUST 只展示后端契约中存在的字段。后端没有角色模型，界面 MUST NOT 展示角色徽章或以角色为条件的分支；用户名称 MUST 取自 `displayName`。

#### Scenario: 顶栏展示显示名

- **WHEN** 已登录用户查看顶栏
- **THEN** 展示的是后端返回的 `displayName`

#### Scenario: 不展示角色徽章

- **WHEN** 任意用户查看顶栏
- **THEN** 界面不出现 `Editor` 之类基于角色的徽章，源码中也不存在角色字段的读取
