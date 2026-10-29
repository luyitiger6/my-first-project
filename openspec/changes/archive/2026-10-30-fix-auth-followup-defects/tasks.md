# Tasks

> design.md 定了六条决策（换码条件收窄 / 刷新失败走独立提示位 / 字节文案附换算示例 / provider 内收敛登出 / REMOVED+ADDED / 复用既有测试文件）。本变更只动 `frontend/components/auth/` 下的两个组件与两个测试文件，不碰后端、不改契约字段。design 里两条待决项已由用户裁决：OQ1 要附换算示例，OQ2 自动换码与手动刷新失败都要提示且不覆盖原始原因。

## 1. 图形码刷新时机与错误提示归属

- [x] 1.1 `loadCaptcha` 失败时只写独立提示位 `captchaNotice`（文案「图形码刷新失败，请手动刷新」），不写 `error`、不清空 `captcha` 与 `captchaAnswer`；成功时清除该提示。判据：`auth-form.test.tsx` 新增用例，模拟自动换码失败，断言原始错误文案仍在、刷新失败提示同时出现、且 `captchaAnswer` 未被清空。
- [x] 1.2 catch 分支的换码条件收窄为 `isCaptchaRequired(cause)` 单条件，去掉 `(isRegister && step === 'captcha')`。判据：`auth-form.test.tsx` 新增用例，注册第一步遇 `429` 与网络错误时断言图形码端点调用次数不增加、原答案保留；遇 `CAPTCHA_INVALID` 时断言调用次数恰好加一并清空答案。
- [x] 1.3 登录链路补回归断言：已展示图形码时遇到 `401`/`429`/网络错误不触发换码。判据：`auth-form.test.tsx` 用例断言这三次失败后图形码端点调用次数保持不变。
- [x] 1.4 手动刷新失败同样提示：用户点 Refresh 而换码请求失败时显示同一条 `captchaNotice`。判据：`auth-form.test.tsx` 用例断言首次进页取码成功后、点 Refresh 失败时提示出现，再次 Refresh 成功时提示消失。

## 2. 密码提示字节口径

- [x] 2.1 `PASSWORD_HINT` 改为「字节为主 + 汉字换算示例」，逐字为 `8-72 bytes (about 3-24 Chinese characters)`，两个区间均从 `PASSWORD_MIN_BYTES` / `PASSWORD_MAX_BYTES` 除以 UTF-8 汉字字节宽算出（下限 `ceil`、上限 `floor`），不硬编码。判据：文案含 `bytes`，不含把字节说成字符的表述，且无魔法数。
- [x] 2.2 补断言锁定单位与换算。判据：`auth-form.test.tsx` 用例断言密码输入框的 placeholder 中出现 `8`、`72` 与 `bytes`，并含汉字换算示例 `3`、`24`；断言不出现「8 characters」这种把下限说成字符的说法。

## 3. 登出失败收敛

- [x] 3.1 `logout` 在 `finally` 之外补 `catch`，使请求失败时对外不再以 rejection 结束，界面仍回到访客态。判据：`auth-provider.test.tsx` 新增失败路径用例，登出端点返回 `500` 时 `await logout()` 不抛异常，且 `status` 变为 `guest`、`user` 为 `null`。
- [x] 3.2 复核唯一生产调用点不受影响。判据：`account-menu.test.tsx` 既有「退出后回到访客态」用例仍通过，且 `account-menu.tsx` 未新增 catch。

## 4. 集成验收

- [x] 4.1 `cd frontend; npm run test` 全绿，新增用例与既有 319 例同批通过，无跳过写法。
- [x] 4.2 `powershell -File harness\checks\04-frontend.ps1` 以退出码 0 结束（含 `npm ci`、构建与测试）。
- [x] 4.3 `powershell -File harness\run-all.ps1` 以退出码 0 结束，11 道闸门全 `[PASS]`；其中 `03-static-guard` 不因新增文案或注释被误伤。
- [x] 4.4 `openspec validate fix-auth-followup-defects --strict` 通过，且 REMOVED 与 ADDED 的两条注册 Requirement 不同名。
- [x] 4.5 `git -C backend status --short` 为空，确认本次未触碰后端子模块。

## Workflow follow-up

- 在 `frontend` 子模块内提交并推送本次改动，再回工作区更新 gitlink。
- 归档本变更，把 delta 合入 `wanderchain-auth-frontend` 主 spec，并补打 `archive/<归档目录名>` 标签。
