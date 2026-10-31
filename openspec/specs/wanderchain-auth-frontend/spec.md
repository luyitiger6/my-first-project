# wanderchain-auth-frontend Specification

## Purpose
TBD - created by archiving change add-wanderchain-auth-frontend. Update Purpose after archive.

## Requirements

### Requirement: 会话状态只来自服务端

前端 MUST 通过 `GET /api/auth/me` 判定当前是否已登录，MUST NOT 在浏览器可读存储（`localStorage`、`sessionStorage`、非 HttpOnly cookie）中保存令牌或用户信息。首次挂载时状态为加载中，接口返回 `200` 时进入已登录态，返回 `401` 时进入访客态；网络失败 MUST 归为访客态且 MUST NOT 让页面白屏。登出 MUST 调用后端登出端点，由后端清除 cookie，前端随后回到访客态。登出请求本身失败（网络错误或非 2xx）时，前端 MUST 仍然回到访客态，且 MUST NOT 让该失败以未处理的 promise rejection 形式外泄。

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

#### Scenario: 登出请求失败仍回到访客态

- **WHEN** 已登录用户点击登出，而后端登出端点返回 5xx 或请求因网络错误失败
- **THEN** 顶栏仍然回到登录入口，且该失败不产生未处理的 promise rejection

### Requirement: 登录按错误码分流

登录界面 MUST 依据后端返回的错误码而不是状态码决定行为与文案。收到 `CAPTCHA_INVALID` 时 MUST 取一张图形码并允许带码重试；收到 `RATE_LIMITED` 时 MUST 展示来自 `Retry-After` 的等待时间；两个 `403`（`EMAIL_UNVERIFIED` 与 `CROSS_SITE_REJECTED`）MUST 展示不同文案。界面 MUST NOT 在登录前主动请求图形码。换发新图形码 MUST 只发生在后端明确以图形码为由拒绝时；其它失败 MUST 保留已取到的图形码与用户已输入的答案。换码动作自身失败时，界面 MUST 继续展示原始失败原因，并 MUST 另行提示「图形码刷新失败，请手动刷新」；两条信息 MUST 同时可见且 MUST NOT 互相覆盖。

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

#### Scenario: 非图形码原因的失败不换码

- **WHEN** 界面已经展示图形码，用户登录时遇到网络错误或 `429`，后端并未以 `CAPTCHA_INVALID` 拒绝
- **THEN** 界面保留原来那张图形码与用户已输入的答案，用户可直接重试

#### Scenario: 换码失败不覆盖原始失败原因

- **WHEN** 登录因 `CAPTCHA_INVALID` 失败后，换发新图形码的请求自身也失败
- **THEN** 界面同时展示登录失败的原因与「图形码刷新失败，请手动刷新」的提示，两条信息都不被对方覆盖

### Requirement: 界面不展示后端不存在的字段

前端界面 MUST 只展示后端契约中存在的字段。后端没有角色模型，界面 MUST NOT 展示角色徽章或以角色为条件的分支；用户名称 MUST 取自 `displayName`。

#### Scenario: 顶栏展示显示名

- **WHEN** 已登录用户查看顶栏
- **THEN** 展示的是后端返回的 `displayName`

#### Scenario: 不展示角色徽章

- **WHEN** 任意用户查看顶栏
- **THEN** 界面不出现 `Editor` 之类基于角色的徽章，源码中也不存在角色字段的读取

### Requirement: 注册按两步验证码链路并遵守字节口径

注册界面 MUST 分两步：先提交图形验证码答案换发邮箱注册码，再提交邮箱注册码完成注册。两步 MUST 各自对应一次后端请求，请求体字段名 MUST 取自前端契约。密码长度约束为 8 到 72 字节，界面提示 MUST 以字节为单位表述并 MUST 附一条按汉字估算的换算示例，MUST NOT 把字节数说成字符数。注册第一步失败时，只有后端明确以图形码为由拒绝才 MUST 换发新码，其它失败 MUST 保留当前图形码与已输入的答案。换码动作自身失败时，界面 MUST 继续展示注册失败的原因，并 MUST 另行提示「图形码刷新失败，请手动刷新」；两条信息 MUST 同时可见且 MUST NOT 互相覆盖。注册成功后 MUST 处于已登录态并离开注册页。

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

#### Scenario: 密码提示按字节表述

- **WHEN** 用户查看注册表单的密码提示
- **THEN** 提示给出下限 8 与上限 72，计量单位是字节，并附一条按汉字估算的换算示例，不出现把字节数说成字符数的说法

#### Scenario: 非图形码原因的失败不换码

- **WHEN** 用户提交注册第一步，后端返回 `429` 或请求因网络错误失败，均未以 `CAPTCHA_INVALID` 拒绝
- **THEN** 界面保留原来那张图形码与用户已输入的答案，等待时间提示取自 `Retry-After`

#### Scenario: 换码失败不覆盖原始失败原因

- **WHEN** 注册第一步因 `CAPTCHA_INVALID` 失败后，换发新图形码的请求自身也失败
- **THEN** 界面同时展示注册失败的原因与「图形码刷新失败，请手动刷新」的提示，两条信息都不被对方覆盖

### Requirement: 互动入口安全回跳

详情登录引导 SHALL 使用 `next` 携带站内详情路径，登录与注册切换 SHALL 保留同一合法目标。认证成功且服务端会话确认后 SHALL 返回该详情；无合法目标 SHALL 沿用返回 `/`。目标 MUST 仅接受规范的站内 `/posts/{publicId}` 详情路径，拒绝外部 URL、协议相对 URL、反斜杠、编码绕过及其它路径，MUST NOT 自动重放登录前的评论、投票或收藏。

#### Scenario: 登录返回原详情

- **WHEN** 用户由帖子互动入口进入 `/login?next=...` 并成功完成登录与会话确认
- **THEN** 返回对应站内详情，重新读取本人互动状态，不自动执行先前点击的写操作

#### Scenario: 注册互转保留回跳

- **WHEN** 用户由带合法 next 的登录页切换到注册页并完成注册，或从注册页切回登录
- **THEN** 两步注册与登录错误分流保持原行为，合法详情目标保留，认证和会话确认成功后返回同一详情

#### Scenario: 无 next 沿用默认行为

- **WHEN** 用户直接登录或注册且没有合法 next
- **THEN** 成功后返回 `/`，不改变普通认证入口的默认导航

#### Scenario: 恶意回跳被拒

- **WHEN** next 含外部主机、`//`、反斜杠、重复编码绕过、非法帖子标识或非详情路径
- **THEN** 不导航至该目标，不执行输入内容，认证成功后返回 `/`

#### Scenario: 会话未确认不回跳

- **WHEN** 认证写接口已返回成功但服务端会话读取未能确认当前账户
- **THEN** 不将用户导航成已登录互动状态，提供会话确认失败提示与读取重试，不重新发送注册或自动重放互动
