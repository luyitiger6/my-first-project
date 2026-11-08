# My profile · 个人中心

| 项 | 值 |
|---|---|
| 单元编号 | My profile |
| 归属能力 | `wanderchain-profile` |
| 对应主 spec | `openspec/specs/wanderchain-profile/spec.md` |
| 承载 Requirement | `个人中心的入口与访问边界`、`资料字段口径`、`兴趣标签清单可匿名读取`、`昵称与既有显示名同源`、`头像上传复用既有媒体通道` |
| 规格层级 | 人读契约。读取与保存编排在 `app/me/me-content.tsx`，本单元负责六态表达与四项表单交互 |
| 单元性质 | 客户端个人中心页（六态、头像上传、昵称/简介计数、标签复选、保存与顶栏同步） |

---

## 1. 模块边界

界面标签与状态文案使用英文；昵称、简介、头像地址与兴趣标签直接展示接口原文，不翻译、不补假字段。中文只出现在文档里。

### 1.1 包含

| # | 能力 | 说明 |
|---|---|---|
| 1 | 六态页面 | 加载 / 未登录 / 会话过期 / 已登录 / 空资料 / 读取失败 |
| 2 | 头像 | 72px 圆形预览，支持上传与手填地址，失败回退占位 |
| 3 | 昵称 / 简介 | 实时计数 `{n} / 64` 与 `{n} / 200`，不硬截断 |
| 4 | 兴趣标签 | 服务端清单复选，最多 5 个，清单演进只读提示 |
| 5 | 保存 | 只保存改动字段，成功跳转广场，顶栏昵称同步 |

### 1.2 不包含

| 排除项 | 归属 |
|---|---|
| 公开主页 `/users/{publicId}` | 阶段 3 |
| 我的帖子 / 我的收藏聚合 | 本轮范围外 |
| 昵称唯一性、头像裁剪、资料历史版本 | 本轮范围外 |
| 离开页面的未保存拦截 | 本轮不做 |
| 对外标识、邮箱、账户状态的展示 | 页面不展示（PRD §7 口径） |

### 1.3 数据来源

| 依赖项 | 形态 | 说明 |
|---|---|---|
| 本人资料读取 | `profileApi.me` → `GET /api/profile` | 本阶段 Mock，联调切真接口 |
| 本人资料更新 | `profileApi.update` → `PUT /api/profile` | 部分更新，可空字段 |
| 兴趣标签清单 | `profileApi.interests` → `GET /api/profile/interests` | 公开，服务端唯一真源 |
| 头像上传 | `uploadCoverImage` → `POST /api/media` | 真实接口，5 MB、JPEG/PNG/WebP |
| 会话判定 | `AuthProvider` → `GET /api/auth/me` | 真实接口，不 Mock |

### 1.4 与其他单元的关系

- **依赖**：`AuthProvider`（`status` / `expireSession` / `setDisplayName`）、`lib/profile/`（契约与客户端）、`lib/media/`（上传）、`lib/profile/profile-input`（校验口径）。
- **被依赖**：`components/auth/account-menu.tsx` 登录态提供 `My profile` 直链入口。
- **衔接**：保存成功后 `setDisplayName` 同步顶栏并跳转广场 `/posts`；广场卡片作者区读取名片呈现新昵称与头像。

---

## 2. 核心场景

### 2.1 正常路径

**S1 · 会话确认中**
- When 会话尚未确认，或已确认登录但资料未返回
- Then 显示骨架（头像圆形 + 字段块）+ `Loading your profile…`（`role="status"`）、`aria-busy="true"`，不渲染表单

**S2 · 未登录**
- When 会话确认完成且无账户
- Then 显示 `Log in to manage your profile.` + `Log in` 链接（`/login`，不带返程地址），不渲染表单，不发起资料读取

**S3 · 已登录**
- When 资料返回成功
- Then 四项表单取返回值；资料与标签就位后一次呈现完整表单

**S4 · 空资料**
- When 资料返回成功且四项全空
- Then 仍是完整表单：人形占位、`0 / 64`、`0 / 200`、无已选标签；`Save` 禁用 + `No unsaved changes.`

**S5 · 保存成功**
- When 用户改动字段并保存成功
- Then 立即跳转到广场 `/posts`，顶栏昵称同步新值，广场作者区展示新昵称与头像

**S6 · 头像上传**
- When 用户选择本地图片
- Then 立即上传，成功回填 `Image URL` 并刷新预览；上传中禁用上传控件与 `Save`，旁挂 `Uploading…`

### 2.2 异常路径

**S7 · 会话过期**
- When 已登录进入后任一次读取或保存被判定为登录失效
- Then 表单一次性收起，`Your session has expired. Log in to continue.`（`role="alert"`）+ 登录引导，输入不回填，焦点落 `Log in`

**S8 · 读取失败**
- When 资料读取失败且非登录失效
- Then `Your profile could not load. Please try again.`（`role="alert"`）+ `Retry`，不渲染表单

**S9 · 校验失败**
- When 提交被服务端以 `400` 拒绝
- Then 输入全部保留；能归因到字段的标在字段并聚焦，不能归因的表单顶部 `Some fields are not valid. Check them and try again.`

**S10 · 标签清单失败**
- When 标签清单加载失败
- Then 区块内 `Interests could not load.` + `Retry`，已选标签只读展示；其他字段仍可保存

**S11 · 来源被拒 / 网络异常**
- When 请求来源被拒或网络异常
- Then 顶部 `role="alert"` 对应文案，输入保留，`Save` 恢复可用

---

## 3. 数据结构

### 3.1 组件结构

页面为 App Router 服务端外壳（`app/me/page.tsx`，含 `metadata.title = 'My profile'`）+ 客户端主体（`app/me/me-content.tsx`）。客户端内部状态为 `phase`（`loading` / `guest` / `expired` / `ready` / `error`）与 `interestsPhase`（`loading` / `ready` / `error`）两层。

### 3.2 依赖的数据类型

```ts
interface Profile {
  publicId: string
  displayName: string
  avatarUrl: string
  bio: string
  interests: string[]
}

interface UpdateProfileRequest {
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  interests: string[] | null
}
```

镜像真源是 `lib/contracts/profile.ts` 的 `ProfileResponse` / `UpdateProfileRequest`（与后端 record 同名同字段）；`null` 表示未提交、保持原值。校验口径在 `lib/profile/profile-input.ts`（code point 计长、`strip` 后 1–64、简介 ≤200、标签最多 5 个）。

| 字段 | 约束 | 展示规则 |
|---|---|---|
| `displayName` | strip 后 1–64 | 单行输入 + 实时计数，超限只提示不截断 |
| `avatarUrl` | 空或 http(s) 绝对地址 | 72px 圆形预览，失败回退首字符 / 人形占位 |
| `bio` | ≤200 | 多行 textarea，换行计 1 |
| `interests` | 清单内、≤5、去重 | 胶囊复选，选满 5 其余禁用 |
| `publicId` | 真实对外标识 | 不渲染（PRD §7） |

### 3.3 文案契约

| 位置 | 文案 |
|---|---|
| eyebrow / 标题 | `Account` / `My profile` |
| 加载 | `Loading your profile…` |
| 未登录 | `Log in to manage your profile.` / `Log in` |
| 会话过期 | `Your session has expired. Log in to continue.` |
| 读取失败 | `Your profile could not load. Please try again.` / `Retry` |
| 字段 | `Avatar` / `Image URL` / `Upload image` / `Display name` / `Bio` / `Interests` |
| 计数 | `{n} / 64` / `{n} / 200` |
| 上传 | `Uploading…` |
| 校验 | `Display name is required.` / `Display name must be 64 characters or fewer.` / `Bio must be 200 characters or fewer.` / `Enter a full http(s) image address.` |
| 标签 | `Choose up to 5.` / `You have selected the maximum of 5 interests.` / `Loading interests…` / `Interests could not load.` / `Some saved interests are no longer available.` |
| 保存 | `Save` / `Saving…` / `Some fields are not valid. Check them and try again.` / `Profile could not be saved. Please try again.` |
| 禁用说明 | `No unsaved changes.` |
| 昵称为空 | `Your posts show "Author unavailable" until you add a display name.` |
| 来源被拒 | `The request was rejected because its origin is not trusted.` |

---

## 4. ACCEPTANCE CHECKLIST

### 4.1 状态

- [ ] 六态互斥：加载 / 未登录 / 会话过期 / 已登录 / 空资料 / 读取失败各呈规定呈现
- [ ] 未登录不发起 `GET /api/profile`
- [ ] 会话过期表单一次性收起、输入不回填、焦点落 `Log in`
- [ ] 读取失败提供 `Retry`，不渲染表单

### 4.2 表单

- [ ] 头像上传成功回填地址并预览；失败保留原值并提示
- [ ] 昵称 / 简介实时计数，超限不吞字
- [ ] 标签最多 5 个，选满后其余禁用
- [ ] 标签清单失败不阻塞其他字段保存

### 4.3 保存

- [ ] 无改动时 `Save` 禁用 + `No unsaved changes.`
- [ ] 只保存改动字段，清空即清除
- [ ] 成功跳转广场 `/posts` 并同步顶栏昵称（无需刷新）
- [ ] 服务端 400 保留输入并给出可读提示

### 4.4 无障碍与响应式

- [ ] 状态文本 `role="status"`，错误 `role="alert"`
- [ ] Tab 顺序：`My profile` → `Upload image` → `Image URL` → `Display name` → `Bio` → 标签 → `Save`
- [ ] 断点与真相源 CSS 一致（见 5.3）
- [ ] 移动端头像行纵向、`Save` 占满宽度、无横向滚动

### 4.5 工程

- [ ] `npm --prefix D:\my-first-project\frontend run test -- app/me` 通过（未登录不发请求 / 顶栏同步 / 400 保留输入）
- [ ] `powershell -File harness\checks\08-spec-doc-breakpoints.ps1` 返回 0
- [ ] 无 `TODO` / `FIXME`

---

## 5. 技术约束

### 5.1 React + Next.js App Router

- `app/me/page.tsx` 为服务端外壳导出 `metadata`；`app/me/me-content.tsx` 首行 `'use client'`
- 会话与资料读取在 `useEffect` 中编排，按 `status` / `phase` 分态
- 顶栏同步经 `AuthProvider.setDisplayName`，不另起 provider

### 5.2 CSS Modules 与站点令牌

样式在 `frontend/app/me/me.module.css`，取色使用 `--wc-*`，留白由 `wc-container` 唯一承担，局部限宽用 `max-inline-size`。本轮无 Tailwind、shadcn/ui。

### 5.3 响应式（desktop-first）

真相源：`frontend/app/me/me.module.css`（下方断点须与该文件的 `@media` 一致，由 `harness/checks/08-spec-doc-breakpoints.ps1` 校验）

| 断点 | 布局 |
|---|---|
| 默认（宽屏） | `wc-container` 内单列，内容 `max-inline-size: 640px`；头像行横向 |
| `≤ 1024px` | 维持单列，表单 `gap` 收至 16px |
| `≤ 760px` | 头像行纵向，`Save` 占满宽度，标签胶囊换行 |

### 5.4 图片

- 头像使用原生 `<img>`，非 `next/image`；预览 `object-fit: cover`，`alt=""`（装饰性）
- 图片加载失败 `onError` 回退为首字符 / 人形占位，不显示破图
- 占位为静态色块，不做循环闪烁

### 5.5 与现状的差异

| # | 旧形态 | 本轮形态 | 验收边界 |
|---|---|---|---|
| 1 | 无个人中心页面 | 六态 `/me` 页面 | 不展示对外标识 / 邮箱 / 状态 |
| 2 | 资料只存在于顶栏 displayName | 四项资料可读写 | 昵称与 displayName 同源 |
| 3 | 无标签清单 | 服务端清单复选 | 清单为唯一真源 |

---

## 附录：实现位置与验收命令

| 项 | 路径 |
|---|---|
| 页面外壳 | `frontend/app/me/page.tsx` |
| 页面主体 | `frontend/app/me/me-content.tsx` |
| 页面样式 | `frontend/app/me/me.module.css` |
| 契约镜像 | `frontend/lib/contracts/profile.ts` |
| 数据客户端 | `frontend/lib/profile/profile-api.ts`、`types.ts`、`profile-input.ts` |
| 单元测试 | `frontend/app/me/me-content.test.tsx` |
| 入口 | `frontend/components/auth/account-menu.tsx` |

```powershell
npm --prefix D:\my-first-project\frontend run test -- app/me
powershell -File harness/checks/08-spec-doc-breakpoints.ps1
```

### 场景对应

| 主 spec Scenario | 对应验证 |
|---|---|
| 未登录访问不发起资料请求 | me-content.test.tsx 未登录用例 |
| 保存成功后跳转广场与顶栏同步 | me-content.test.tsx 跳转用例 |
| 保存失败保留输入 | me-content.test.tsx 400 保留输入用例 |
| 上传成功后回填并预览 | 媒体端点真实链路（联调阶段） |
| 上传失败保留原值 | 媒体端点真实链路（联调阶段） |
| 清单内的值可保存 | Mock 标签清单（联调切真接口） |
| 登录用户一键到达个人中心 | account-menu.test.tsx `My profile` 直链 |
