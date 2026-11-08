# Design

## Context

见 `proposal.md` — Why。这里只记实施前必须钉死的现状与约束。

- **资料挂在 `accounts`**：`display_name VARCHAR(64) NOT NULL DEFAULT ''` 已存在且注册时可填；`ddl-auto=none`，建表只有 `schema.sql` 一份，且用 `CREATE TABLE IF NOT EXISTS` —— 已存在的本地库不会自动补列。
- **后端分层**：`web → service → dao → common`，`11` 号闸门机械校验 `dao/service` 不得 import `web`、`common` 不得 import 业务层；约定写明「一个端点一个 Controller」「服务层不写 HTTP 状态码」。
- **错误码**：认证线固定七个，`VALIDATION_FAILED` 已被 `web/media` 跨域引用；约定明确「跨域共用的码只在定义它的域里出现一次」，所以资料校验不新造枚举。
- **认证拦截**：`AuthInterceptor` 对 `/api/**` 默认拒绝，公开路由按「路径模式 + 方法集合」精确登记，`GET` 不登记就是 401；`OriginGuard` 覆盖 `POST/PUT/PATCH/DELETE`，装配顺序 `0` 先于认证的 `10`。
- **契约闸门**：`10-contract-check.ps1` 按 `$contractPairs` 逐组比对后端 `web/*/dto` 的 record 与前端 `lib/contracts/*.ts` 的同名 interface，双向比字段名、按映射表比类型；`List<X>` 只有在 `X` 也是同目录 record 时才映射为 `Array<X>`，映射表外类型 fail-closed。它还会读在飞 change 的 `design.md`「## 契约」表做三方比对，但只比对「至少有一侧已实现」的接口。
- **回跳契约**：`lib/auth/return-to.ts` 只接受规范 `/posts/{publicId}`，`wanderchain-auth-frontend` 的「恶意回跳被拒」把「其它路径」写成拒绝项 —— 扩白名单等于改一个已归档能力。
- **卡片现状**：`components/posts/post-card.tsx` 用 `<details>/<summary>` 渲染 `Author ID: 前6…后4`，展开是 26 位标识；`post-detail.tsx` 与 `post-comments.tsx` 是同一模式的另外两处，本 change 不动它们。
- **帖子契约不改**：`PostSummaryResponse` 已有 `authorPublicId`，足够用来查名片；改它要动 `wanderchain-posts`，能力数会从 2 变 3，撞 `14` 号闸门。

## Goals / Non-Goals

**Goals:**

- 四项资料在后端成形：一份加列的 DDL、四个端点、一组受 `10` 号闸门管辖的 DTO。
- 广场卡片的作者区从「标识」换成「昵称 + 头像」，且在任何状态下都不把 26 位标识漏给用户。
- 个人中心是可独立验收的最小闭环：进得去、改得动、改完顶栏与卡片都能看到。

**Non-Goals:**

- 不做详情页与评论区的作者展示（阶段 2 收口，见 Risks 第 1 条）。
- 不做关注、公开主页、我的帖子 / 我的收藏聚合。
- 不做资料历史版本、昵称唯一性、头像裁剪。
- 不给名片加服务端缓存：作者资料的读取量远低于帖子列表，缓存留在前端一次性的 Map。
- 不扩展登录回跳白名单。

## Decisions

### D1 三列加在 `accounts`，不建 `account_profiles`

`accounts` 追加 `avatar_url VARCHAR(512) NOT NULL DEFAULT ''`（镜像 `posts.cover_image` 的长度）、`bio VARCHAR(200) NOT NULL DEFAULT ''`、`interests VARCHAR(128) NOT NULL DEFAULT ''`。昵称沿用 `display_name`，不新增列。

- 理由：资料与账户一一对应、同生命周期；独立建表只买到「不改 accounts」，代价是一次 join、两处事务与两套 owner。
- 替代：`account_profiles` 一表一列一值。否决：本期字段固定为四个、没有历史版本需求，拆表是为假设中的未来预留。
- 替代：`interests` 用 JSON 列。否决：JSON 无法用简单 `CHECK` 约束取值，读写两侧都要解析；分列纯文本 + service 校验把复杂度留在该留的地方。

### D2 四个端点，两个公开

| 方法 | 路径 | 认证 | 响应 |
|---|---|---|---|
| `GET` | `/api/profile` | 需登录 | `ProfileResponse` |
| `PUT` | `/api/profile` | 需登录 | `ProfileResponse` |
| `GET` | `/api/profiles?publicIds=a,b` | 公开 | `ProfileCardListResponse` |
| `GET` | `/api/profile/interests` | 公开 | `InterestListResponse` |

公开的两个在 `AuthInterceptor.publicRoutes()` 里登记为 `GET`；`PUT /api/profile` 不登记，默认即受保护。批量端点接受 1 至 50 个逗号分隔的标识：缺失、空值、超过 50 一律 `400` + `VALIDATION_FAILED`；形状不合 26 位 ULID 的取值与不存在的取值一样被省略，不单独报错 —— 否则这个端点会变成「判断某个标识格式是否合法」的信道。

- 替代：把作者昵称头像并进 `GET /api/posts` 响应。否决：改 `wanderchain-posts` 的响应白名单会产生第三个能力 delta，且把「作者资料」耦合进「内容列表」。
- 替代：`GET /api/users/{publicId}` 单条名片。否决：一页 20 张卡就是 20 个请求，翻页还会重复请求同一作者。

### D3 部分更新用 PUT + 可空字段

`UpdateProfileRequest` 四个字段全部可空，`null` 表示「未提交、保持原值」，空串 / 空数组表示「清空」，昵称传空串按校验拒绝。请求体缺字段与字段为 `null` 是同一件事。

- 替代：全量 PUT（四个字段必须齐全）。否决：只想改简介也要先读再回传，读到的旧值会成为并发覆盖的窗口；spec 已把「未提交保持原值」写成 Scenario。
- 替代：`PATCH`。否决：语义上更贴合，但本仓库没有任何 PATCH 先例，`AuthInterceptor` 按「路径 + 方法」登记也会多一种写方法分支；部分更新的语义已由 spec 钉死，用 PUT 不会产生歧义。

### D4 昵称就是 `display_name`，`/api/auth/me` 不动

`PUT /api/profile` 改昵称即写 `accounts.display_name`；`MeResponse` 仍是 `publicId / email / displayName / status / createdAt` 五项。顶栏无需新增请求即可同步，因为它本来就读 `displayName`。

- 替代：新增 `nickname` 列并在 `/me` 里加字段。否决：同一概念两列必然漂移；且 `/me` 字段集合是 `wanderchain-auth` 的白名单，扩它要新增第三个能力 delta。

### D5 校验与标签清单集中在 `service/profile/support`

`ProfileRules` 负责四项归一与拒绝，`InterestCatalog` 持有标签清单常量。计长口径统一按 **code point**（与 `PostInputRules` 的标题一致）：昵称 `strip` 后 1–64、简介 ≤200、每个标签 1–16 且最多 5 个（先去重再判上限）。头像判定复制 `normalizeCoverImage` 的口径（`isAbsolute` + `host != null` + scheme ∈ `http/https`），不跨域调用它 —— 那是 `post` 域的私有支撑件，共用会把一次改动扩散到两个域。

标签清单的取值为空或含逗号会直接破坏 D6 的存储形式，因此单元测试必须钉住「清单非空、无重复、无半角逗号、去首尾空白后与原文等长」。

### D6 兴趣标签用分隔符列，不建关联表

`interests` 存去重后的标签，半角逗号分隔，保留用户首次出现顺序，空集合存空串。上限 5 × 16 + 4 个逗号 = 84 字符，列宽 128 留余量。

- 替代：`account_interests(account_id, tag, sort_order)` 关联表。否决：最多 5 个定长短值，一次 join 与一套级联维护换不到查询收益。
- 库里不加 `CHECK`：清单会演进，把取值写进 DDL 会让每次调整清单都变成一次 DDL 变更，形成第二个真源。边界由 `ProfileRules` 唯一裁定。

### D7 名片批量取数在前端列表层，不在卡片内

新增 `components/posts/use-author-cards.ts`：接收作者标识数组，去重、剔除已缓存的、按 ≤50 切块并发请求，合并进 `Map<publicId, card>`；每个标识带 `pending / ready / missing` 三态。`PostsContent` 在列表 `ready` 时把 `items.map(p => p.authorPublicId)` 交给它，结果经 `PostList` 传到卡片。

- 替代：卡片各自请求。否决：一页 20 张卡 20 个请求，翻页会重复请求同一作者。
- 替代：把名片塞进 `useInfinitePosts`。否决：那个 Hook 的职责是「游标分页 + 迟到隔离」，塞进第二个数据源会让它的代次逻辑同时管两种请求。

### D8 作者区三态，任何状态都不渲染 26 位标识

- `ready`：头像 + 昵称；没有头像时用统一占位图形，昵称是唯一文本。
- `pending`：固定尺寸中性占位块（`aria-hidden`），不出现任何标识文本。
- `missing`：占位图形 + `Author unavailable`；请求失败与「账户已注销」在这一层合并为同一呈现，失败批次在下一页或重试时重新请求，不标记为永久缺失。

`<details>/<summary>` 与 `authorPublicId` 的切片整体删除。作者区不承载跳转 —— 阶段 1 没有公开主页，标题链接仍是唯一详情入口。

- 替代：缺失时回退显示短标识。否决：spec 要求「任何状态下」都不渲染 26 位标识；回退会让降级路径成为泄露路径。

### D9 个人中心三态，未登录只给登录引导

`app/me/page.tsx`（外壳）+ `app/me/me-content.tsx`（客户端）。四种界面状态：会话确认中 → 骨架；未登录 → 登录引导（`/login`，**不带** `next`），且不发起 `GET /api/profile`；已登录且资料返回 → 表单；资料请求失败 → `role="alert"` + 重试。

入口放在 `components/auth/account-menu.tsx` 的登录态里，站点每页都有页头，因此 1 次点击可达（要求是 ≤2）。

- 替代：`/login?next=/me` 自动回跳。否决：`safeReturnTo` 只接受 `/posts/{publicId}`，会把用户送回 `/`，等于骗人；改白名单则撞既有 spec 与能力上限。

### D10 头像上传复用 `POST /api/media`

表单同时提供「上传图片」与「直接填地址」。上传走既有媒体端点（登录、5 MB、JPEG/PNG/WebP、内容判型、返回绝对地址），成功后回填 `avatarUrl` 并刷新预览；上传中禁用保存；失败保留字段原值。`GET /api/media/*` 已公开，头像因此可直接显示。

- 替代：新增 `POST /api/profile/avatar`。否决：第二套准入规则必然与 `wanderchain-media` 漂移，而它已经把这些口径写成了可验收要求。

### D11 闸门与文档同步，且明确 `06` 不改

- `10-contract-check.ps1` 的 `$contractPairs` 追加 profile 组：`BackendDirs = web/profile/dto`，`Frontend = lib/contracts/profile.ts`。dto 目录只放这 5 个 record，不放内部辅助 record。
- `08-spec-doc-breakpoints.ps1` 的 `$pairs` 登记新单元文档 `docs/specs/wanderchain/profile.md` ↔ `frontend/app/me/me.module.css`。
- `06-schema-check.ps1` **不改**：它只断言表名、索引名、约束名、生成列与 `created_at`，不校验列名；新列靠它每次 drop 重建 `wanderchain` 生效。
- `AGENTS.md` §7 补 profile 接口与目录树条目，`07` / `11` 号闸门要求文档跟得上仓库现状。

## 契约

类型写中性名（`string` / `number` / `boolean` / `Array<X>` / 另一个 record 名），供 `10-contract-check.ps1` 与后端 record、前端 interface 三方比对。

| 接口 | 字段 | 类型 |
|---|---|---|
| ProfileResponse | publicId | string |
| ProfileResponse | displayName | string |
| ProfileResponse | avatarUrl | string |
| ProfileResponse | bio | string |
| ProfileResponse | interests | Array<string> |
| UpdateProfileRequest | displayName | string |
| UpdateProfileRequest | avatarUrl | string |
| UpdateProfileRequest | bio | string |
| UpdateProfileRequest | interests | Array<string> |
| ProfileCardResponse | publicId | string |
| ProfileCardResponse | displayName | string |
| ProfileCardResponse | avatarUrl | string |
| ProfileCardListResponse | items | Array<ProfileCardResponse> |
| InterestListResponse | items | Array<string> |

## 交互规格

本节为 `interaction-agent` 在 propose 初稿上的修订版：保留原有状态划分与英文文案口径，补齐入口、异常面、键盘与响应式规则。硬约束沿用 D4 / D7 / D8 / D9 / D10（未推翻任何一条）；`## 契约` 的 14 个字段未增删；`specs/` 的 Scenario 未改。中文只出现在文档里。

**本节只写用户看到什么、怎么操作、状态如何变化、读屏听到什么。** 端点与状态码、组件内部数据结构、测试与闸门不在本节；凡出现「服务端拒绝」「登录失效」这类说法，指的都是用户能感知的那一类结果，映射成什么由实现方按 `## 契约` 与既有约定决定。

### 落位

| 面 | 落位 | 依据 |
|---|---|---|
| 登录态账户区 | `frontend/components/auth/account-menu.tsx` + `.module.css` | D9 |
| 个人中心 | `frontend/app/me/page.tsx`、`app/me/me-content.tsx`、`app/me/me.module.css` | D9 |
| 广场卡片作者区 | `frontend/components/posts/post-card.tsx` + `.module.css` | D8 |

本规格不新增文件，不决定端点、存储与状态管理。

### 1. 个人中心入口（账户区）

**登录态内新增一条文本链接 `My profile` → `/me`，位于昵称之后、`Log out` 之前；游客态与会话确认中都不出现。** spec 所称「账户菜单」指页头这一块登录态区域，入口是区域内的直接链接，不引入「先展开再点」的第二层。

- **1 次点击到达**（D9 的「1 次点击可达」）。**不做下拉菜单**：本阶段只有一个账户目的地，下拉会把主要路径变成 2 次点击，还要引入焦点管理与点击外部关闭两套新行为；阶段 2 / 3 出现第二个账户目的地（通知、私信）时再评估容器形态。
- 键盘：以链接形态呈现，Tab 可达、Enter 激活、被读屏识别为链接；焦点环沿用全局口径（2px `--wc-green`，与控件外沿留 3px）；可点击高度不小于 32px。
- 长昵称：昵称单行限宽（桌面约 16ch、≤760px 约 10ch）+ 省略号；截断只发生在显示层，不改变昵称本身，完整昵称始终可在 `/me` 的昵称字段看到。
- 悬浮：`My profile` 与 `Log out` 的 hover 沿用账户区现有口径（`--wc-ink-soft` → `--wc-green`）；昵称本身不是链接，不变色。

| 状态 | 条件 | 呈现 |
|---|---|---|
| 会话确认中 | 会话尚未确认 | 既有 96×34 占位块（无文本、读屏忽略）；不出现任何入口 |
| 游客 | 无账户 | 既有 `Log in / Sign up`；不出现 `My profile` |
| 已登录 | 有账户 | 昵称 + `My profile` + `Log out`；资料保存成功后昵称立即变新值，无需刷新 |

会话判定失败归访客态（既有行为），不单独做错误提示。

### 2. 个人中心 `/me`

路由 `/me`，页头照常存在（入口本身也在页头）。**不做重定向**：未登录就停在本页展示登录引导；去登录页时不携带返程地址（现有返程只支持帖子详情，D9）。标题区由 eyebrow `Account` + h1 `My profile` 组成，所有状态都显示。浏览器标签标题是 `My profile`，站点后缀由根布局统一追加（与 `Log in` 同构）；页内主内容承接站点顶部「跳过导航」链接的落点，与其它页一致。

#### 2.1 页面状态

| 状态 | 条件 | 呈现 | 界面行为 |
|---|---|---|---|
| 加载中 | 会话确认中，或已确认登录但资料未返回 | 骨架（头像圆形 + 四条字段块，静态色块、读屏忽略）+ 可见的 `role="status"` `Loading your profile…`；`aria-busy="true"`；不渲染表单 | 只显示骨架，不预填任何字段 |
| 未登录 | 会话确认完成且无账户 | 说明 `Log in to manage your profile.` + 链接 `Log in`（→ `/login`，不带返程地址）；不渲染表单 | 不出现骨架，也不出现标签区 |
| 会话过期 | 已登录进入后，任一次读取或保存被判定为登录失效 | 同未登录态，但在引导句之前先给一行 `role="alert"` `Your session has expired. Log in to continue.`；未保存输入不保留（已无法写入，不假装成功）；展开见 2.6 | 表单收起，回到登录引导 |
| 已登录 | 资料返回成功 | 四项表单，值取返回值 | 资料与标签同时就位后一次呈现完整表单，不出现半张表单 |
| 空资料 | 资料返回成功且四项全空 | 仍是完整表单：头像为人形占位、计数 `0 / 64` 与 `0 / 200`、无已选标签；不是空白页。任一字段改动后即可保存（昵称为空且未改动时不参与保存） | 不出现「暂无资料」空页；展开见 2.5 |
| 读取失败 | 资料读取失败且非登录失效 | `role="alert"` `Your profile could not load. Please try again.` + `Retry`；不渲染表单 | `Retry` 后回到加载中，表单不被部分填出 |

页面不展示对外标识、邮箱与账户状态（PRD §7 口径）。

#### 2.2 表单字段

单列布局：字段顺序即呈现顺序，也是 Tab 顺序：头像 → 昵称 → 简介 → 兴趣标签 → 保存。

**头像（`Avatar`）**

- 预览：72px 圆形。有地址且加载成功显示图片（装饰性图片，读屏跳过，字段标签已说明用途）；无地址或图片加载失败显示占位：昵称非空时为首字符圆形（取用户看到的第一个字符，emoji 不切半，拉丁转大写；底色 `--wc-sand-deep`、文字 `--wc-ink-soft`），昵称为空时为人形图形（`--wc-muted`）；占位整体 `aria-hidden="true"`，不出现破图与空白块。首字符取**当前输入值**而不是已保存值：改昵称的同时预览就跟着变，没保存也看得到效果；昵称被清空或只剩空白时立即回到人形。
- 占位不是错误态：不提供单独的重试按钮，也不把占位包在一层报错样式里；改地址、重新上传或重新进入页面即重试。
- 上传：`Upload image` 文件控件，只接受 JPEG / PNG / WebP 图片；选中即上传，不做二次确认。上传中该控件禁用并 `aria-busy="true"`，同时 `Save` 禁用；旁边显示 `role="status"` `Uploading…`。
- 上传成功：`Image URL` 回填返回地址，预览立即刷新（spec「上传成功后回填并预览」）。
- 上传失败：字段与预览保持原值（spec「上传失败保留原值」），`role="alert"` 显示可读原因；文案沿用上传控件既有口径（如 `That image is larger than 5 MB.`），不另写一套。可重新选择文件。
- 地址：`Image URL` 单行输入。输入过程中不刷新预览；失焦或提交时，非空的合法 `http(s)` 绝对地址才刷新预览，为空则回到占位，非法则保留上一张预览并在字段下提示 `Enter a full http(s) image address.`（`aria-invalid="true"`）。保存前按同一口径预检并阻止非法提交，最终判定以服务端结果为准（AC-08）。
- 清空：把地址清空并保存即清除头像（清空即清除，D3）。

**昵称（`Display name`）**

- 单行输入，实时计数 `{n} / 64`；计数以用户看到的字符为单位（中文与 emoji 各算 1 个）；输入不做硬截断，超限只提示不吞字——硬截断会让 32 个 emoji 就撞上限。
- 提交前预检：去首尾空白后为空 → 阻止提交 + `Display name is required.`；超过 64 → 阻止提交 + `Display name must be 64 characters or fewer.`。原值不做静默修剪，保存后以返回值为准回填。
- 昵称为空（含被清空、尚未输入）时，字段下显示一行提示 `Your posts show "Author unavailable" until you add a display name.`；填入昵称后消失。依据在 3 的缺失判据：卡片没有可显示的昵称时与「作者不可用」同一呈现，不提前告知，用户就会在自己的帖子上看到 `Author unavailable` 却不知道是自己没填名字。

**简介（`Bio`）**

- 多行输入框，允许换行（Q2 已定）；实时计数 `{n} / 200`，以用户看到的字符为单位（换行计 1）。Enter 在区域内只换行，不提交。
- 超过 200 时计数变为强调色（`--wc-accent`）并阻止提交，提示 `Bio must be 200 characters or fewer.`；输入不截断、不丢字。
- 换行原样提交与回显，不折叠空白、不做 Markdown。

**兴趣标签（`Interests`）**

- 带组标题 `Interests` 的标签组，清单由服务端提供；每项是真实勾选项（可聚焦、Space 切换，不用自造可点击块），以胶囊呈现（描边 `--wc-line`，选中 `--wc-green-soft` 背景）。
- 选满 5 个后其余项不可选，并显示 `You have selected the maximum of 5 interests.`；取消任一项后恢复可选。已选项可取消；无自动保存。
- 清单加载中：区块内 `role="status"` `Loading interests…`，其余字段可编辑。
- 清单加载失败：区块内 `role="alert"` `Interests could not load.` + `Retry`；已选标签以只读文本展示；标签区失败不阻塞其他字段保存。
- 清单演进：已保存但不在当前清单的值只读展示并提示 `Some saved interests are no longer available.`；用户一旦改动标签并保存，只提交当前清单内的已选值（明确移除，不留一个必然被拒的选项）。
- 取消全部标签并保存即清空兴趣，不弹确认——标签与其他字段一样，只在 `Save` 时生效。

#### 2.3 保存

- 按钮 `Save`（`.wc-button wc-button--primary`）；无未保存改动时禁用（沿用主按钮禁用样式），并在按钮下常驻一行低对比度说明 `No unsaved changes.`——只给一个点不动的按钮，用户会以为页面坏了；任一字段改动后这行消失、按钮可点；成功提示还在时也不重复显示这行——两者说的是同一个事实，没必要叠着说。改动来源包括四个字段与头像地址。
- 只保存用户改过的字段；未触碰的字段保持原值，清空即清除（D3）。标签清单暂不可用时，其他字段仍可保存。
- 提交中：`Save` 禁用、文案 `Saving…`、容器 `aria-busy="true"`；重复点击不会再触发一次保存。
- 成功：保存成功后立即跳转到广场 `/posts`——跳转本身是完成信号，落地即看到自己帖子的新昵称与头像，不显示保存提示。顶栏昵称在跳转前已同步为新值，无需刷新。目的地只有广场：用户详细页 `/users/{publicId}` 不在本次 change 范围。
- 跨页可见性：从本页保存后回到广场，作者区呈现新的昵称与头像，不要求用户刷新浏览器；作者区不得长期停在旧值。此事与 2.6 的「输入不回填」不冲突：跨页看得到的是已保存的值。
- 服务端拒绝输入（校验不通过）：输入全部保留（spec「保存失败保留输入」，AC-25）。按同一套规则回查当前输入：能归因到字段的，标在该字段（`aria-invalid="true"` + `aria-describedby` 指向错误文本），焦点移到第一个出错字段；不能归因的，表单顶部 `role="alert"` `Some fields are not valid. Check them and try again.`。不把服务端返回的技术信息当作提示语，避免中英混排。
- 登录失效：切到会话过期态（见 2.1），不重试保存；未保存输入随表单一起收起。
- 请求来源被拒绝：顶部 `role="alert"` `The request was rejected because its origin is not trusted.`，保持登录态与输入。
- 网络或服务异常：顶部 `role="alert"` `Profile could not be saved. Please try again.`，输入保留，`Save` 恢复可用。
- 字段错误在下一次提交或对应字段被修改时清除；成功提示在下一次编辑时清除。保存不弹确认框，离开页面不做未保存拦截（本轮不做）。

#### 2.4 响应式（desktop-first）

断点落在本页样式载体 `frontend/app/me/me.module.css`（登记在 `docs/specs/wanderchain/profile.md`）；本节只定三档行为，不复制成第二套断点声明。档位与站点既有口径对齐（页头 760、列表 1024）。

| 档 | 行为 |
|---|---|
| Desktop（> 1024px） | `wc-container` 内单列，内容宽度约 640px（不拉满，保持可读行宽）；头像行横向：72px 预览在左，上传与地址在右 |
| Tablet（761–1024px） | 同桌面单列，间距收紧；标签胶囊自然换行 |
| Mobile（≤ 760px，与页头折行同档） | 头像行改为纵向（预览在上，上传与地址在下）；`Save` 占满可用宽度；标签胶囊换行；不得出现横向滚动 |

容器横向留白只由 `wc-container` 承担，子元素不再各算一套宽度（styling-conventions 踩过的坑）。占位与骨架为静态色块，不做循环闪烁；系统开启减弱动效时，过渡降级为无动画。

#### 2.5 空资料态：完整表单，不是空页

四项全空不是「没有资料可看」，而是「四项都能开始填」。所以这一态不换版式，只换字段的初始值。

- 进入时**不自动聚焦**任何字段：移动端不自动弹键盘，读屏不跳过标题直接落进输入框。
- 字段顺序、标签、计数口径与常态一致：头像人形占位、`0 / 64`、`0 / 200`、标签全未选且全部可选。
- `Save` 初始不可点，按钮下是 `No unsaved changes.`（见 2.3）；任一字段一变即启用。
- 昵称从空白变为有值的那一刻，头像占位从人形变成首字符圆形（见 2.2），不需要保存才生效。
- 昵称为空时字段下有 `Your posts show "Author unavailable" until you add a display name.`——本态最容易踩的坑就在这里：存了简介与标签却没填昵称，用户在广场看到的自己就是「作者不可用」。
- **只填一项也能存**：例如只写简介，昵称未改动因而不参与保存，不触发「昵称必填」的拦截；保存成功后跳转到广场，昵称为空时作者区按 AC-34 显示 `Author unavailable`。
- 标签清单加载失败也不会让本态变成死路：其他字段照样能存（见 2.2）。
- 本态不出现：空页插画、「暂无资料」标题、资料完成度进度条、引导横幅。这四样都会把「开始填」变成「先看一段说明」。
- 窄屏与常态同一套规则（头像行纵向、`Save` 占满宽度）。

#### 2.6 登录失效态：表单收起，输入不回填

- 触发只有一种：已登录进入后，用户在页面上发起的一次读取或保存被判定为登录失效。不做后台定时检查，也不会在用户没操作时突然变脸。
- **一次性切换，不留残影**：四个字段、标签区、`Save`、骨架、字段级错误、上传中的 `Uploading…`、成功提示同时消失。`Saving…` 不允许留在按钮上——按钮本身已经不在了。
- 替换为三行，顺序固定：`role="alert"` 的 `Your session has expired. Log in to continue.` → 引导句 `Log in to manage your profile.` → `Log in` 链接。先讲发生了什么，再给下一步。
- **输入不保留**：已输入未保存的内容随表单一起丢弃，重新登录后也不会自动回填；不在离开前弹「是否保存草稿」——那一刻已经无法保存。
- 焦点落在 `Log in` 链接上：原焦点所在的控件已消失，不能让焦点掉回页面顶端或直接丢失；alert 由读屏自行播报一次，不再把焦点额外移到提示上造成重复播报。
- 本态**不提供 `Retry`**：再试一次也不会成功，给重试等于给一个必然失败的按钮。
- 页头同时回到游客态（`My profile` 消失）：页面说「已失效」而页头仍显示已登录，是这一态最容易出现的自相矛盾。
- 文案不承诺回跳：链接就是 `Log in`，旁边不写「登录后回到本页」——现有返程只支持帖子详情（D9），登录后落在首页。用户重新进入 `/me` 时看到的是服务端已保存的值，不是刚才丢掉的那份输入。
- 与「保存失败保留输入」的关系：spec 该条按其 Scenario 读作「提交被校验拒绝」；登录失效属于身份失效，保留输入只会让人以为还能再点一次。这处读法留待 spec 评审核对，我不擅自把两边表述改成一致。

### 3. 广场卡片作者区

位置不变：标签之后、`Created` 行之前。作者区只显示昵称与头像；不显示简介、兴趣标签、邮箱、账户状态。**任何状态下都不出现作者的对外标识**——包括可见文本、悬浮提示、读屏名称与任何附属属性。

| 状态 | 条件 | 呈现 |
|---|---|---|
| 已返回 | 名片命中且昵称非空白 | 24px 圆形头像 + 昵称；头像为装饰性图片（读屏跳过），昵称 `--wc-ink-soft`、12.5px |
| 已返回但无头像 | 头像地址为空，或图片加载失败 | 首字符圆形占位（拉丁转大写，`--wc-sand-deep` 底 / `--wc-ink-soft` 字，`aria-hidden="true"`）；昵称照常显示；仍算已返回，不进入缺失态 |
| 请求中 | 名片尚未返回 | 24px 中性圆形 + 72×12px 圆角短条，整组 `aria-hidden="true"`，无任何文本；不阻塞标题与详情链接 |
| 缺失 | 名片未返回该作者、作者已注销，或返回的昵称为空白 | 人形图形（`--wc-muted`，`aria-hidden="true"`）+ `Author unavailable`（逐字，不加句号）；无破图、无空白文本 |
| 请求失败 | 该批名片读取失败 | 与「缺失」同一呈现；不做每卡重试控件，翻页或下次刷新时自然重试（D8） |

- 作者区不承载跳转，不新增 Tab 停靠点；标题链接仍是唯一详情入口，键盘可达性保持现状（AC-31 / AC-33）。
- 长昵称：自然换行占多行，不用省略号截断；头像不被压缩，文本块可收缩到卡片宽度。中文 64 字与拉丁 64 字都不得截出半个字。
- 窄屏：随列表网格的 3 / 2 / 1 列变化（≤1024 两列、≤640 单列）；作者行在同一行内换行，不把昵称压成单字竖排，不隐藏头像或昵称。
- `Author ID:` 文本与展开行为整体删除；作者区不再存在可展开控件。
- 头像沿用列表既有的懒加载节奏；占位为静态色块，不做循环闪烁。

### 4. 键盘与焦点

- Tab 顺序：页头 `My profile` → `Upload image` → `Image URL` → `Display name` → `Bio` → 每个兴趣项 → `Save`；`Log in` / `Retry` 出现在各自状态的界面位置。
- 所有交互元素都具备真实控件语义（可聚焦、可回车或空格激活、被读屏识别为对应控件），不用自造可点击块。
- 单行输入内 Enter 等同于点击 `Save`（按表单常规语义）；`Bio` 内的 Enter 只换行。上传或提交进行中时 Enter 无效。
- 焦点环沿用全局口径（2px `--wc-green`，与控件外沿留 3px）；保存成功不抢走 `Save` 的焦点；校验失败时焦点移到第一个出错字段；读取失败后点 `Retry`，焦点留在按钮上。
- 进行中状态用 `aria-busy="true"` + 禁用；状态文本用 `role="status"`，错误用 `role="alert"`。
- 卡片作者区不可聚焦、不可点击，不改变卡片的 Tab 顺序。

### 5. 文案契约（逐字，英文）

| 面 | 文案 | 备注 |
|---|---|---|
| 账户区 | `My profile` | 链接名，与页面 h1 同文 |
| 页面 | `Account` / `My profile` | eyebrow / h1 |
| 加载 | `Loading your profile…` | `role="status"` |
| 未登录 | `Log in to manage your profile.` / `Log in` | 说明 / 链接（不带返程地址） |
| 会话过期 | `Your session has expired. Log in to continue.` | 复用站内既有句，不新造说法 |
| 读取失败 | `Your profile could not load. Please try again.` / `Retry` | alert / 复用 |
| 字段 | `Avatar` / `Image URL` / `Upload image` / `Display name` / `Bio` / `Interests` | 可见标签，不用 placeholder 代替 |
| 计数 | `{n} / 64` / `{n} / 200` | 按用户看到的字符算 |
| 上传 | `Uploading…` | `role="status"` |
| 校验 | `Display name is required.` / `Display name must be 64 characters or fewer.` / `Bio must be 200 characters or fewer.` / `Enter a full http(s) image address.` | 字段级 |
| 标签 | `Choose up to 5.` / `You have selected the maximum of 5 interests.` / `Loading interests…` / `Interests could not load.` / `Some saved interests are no longer available.` | 提示与区块状态 |
| 保存 | `Save` / `Saving…` / `Some fields are not valid. Check them and try again.` / `Profile could not be saved. Please try again.` | `Some fields…` 复用认证既有句；保存成功后无提示文案，直接跳转广场 |
| 禁用说明 | `No unsaved changes.` | 与禁用按钮同处，低对比度，不是错误 |
| 昵称为空 | `Your posts show "Author unavailable" until you add a display name.` | 仅当昵称输入为空时；句内复用 AC-34 同一字符串 |
| 来源被拒 | `The request was rejected because its origin is not trusted.` | 复用媒体 / 帖子既有句 |
| 卡片 | `Author unavailable` | Q4 定案，逐字；AC-34 与 E2E 断言同一字符串 |

上传失败文案沿用媒体上传既有口径（如 `That image is larger than 5 MB.`），本表不复制清单。

### 6. 与初稿的差异

- 新增入口形态（登录态直链，不做下拉）与对应待决项 Q-I1。
- 昵称 / 简介从「输入即硬截断」改为「计数提示 + 保存前阻止」，消除 emoji 被提前截掉。
- 头像图片加载失败回退为占位，仍是「已返回」态，与名片缺失区分。
- 新增标签清单加载失败、清单演进两条异常面，以及「未改动不保存」规则。
- 新增保存被拒、登录失效、来源被拒、网络异常四条分支与「只保存改动的字段」。
- 新增三档响应式与完整键盘契约，不留 TODO。
- 展开「空资料」与「登录失效」两态：前者明确仍是可保存的完整表单（含禁用按钮的说明行与昵称为空的后果提示），后者明确表单一次性收起、输入不回填、焦点落到登录链接。
- 补页面标题、跳过导航落点、保存后的跨页可见性、标签清空与头像占位的重试口径。
- 锁定 `Author unavailable` 逐字，不改写、不加句号。

## 视觉规范

本节是 `## 交互规格` 的视觉层补充。属临时授权产出（interaction-agent 日常职责之外），仍遵守既有边界：只引用 `globals.css` 的 `--wc-*` 令牌与既有 `.wc-*` / 组件类名，不出现十六进制色值、不发明令牌、不写端点与状态码、不写组件内部结构。视觉与交互冲突处就地注明，不改 `## 交互规格` 一字。

### 0. 通用口径

- 取色只经 `--wc-*`：正文 `--wc-ink`、次级正文 `--wc-ink-soft`、弱化与说明 `--wc-muted`、错误与告警文字 `--wc-accent`、告警底 `--wc-accent-soft`、选中底 `--wc-green-soft`。
- 中性占位与骨架填充统一用 `--wc-sand-deep`（与 `.cover` / `.preview` 占位底同源），静态色块、不循环闪烁。
- 圆角：圆形 / 胶囊 `border-radius: 999px`（与 `.login` / `.logout` 同口径）；输入框与占位条 `--wc-radius-sm`；引导 / 告警块 `--wc-radius-md`。
- 焦点环统一沿用全局 `:focus-visible`（2px `--wc-green`、`outline-offset: 3px`）；隐藏原生控件后用 `:focus-visible + label` 把焦点透出到可见胶囊 / 按钮（同 `post-editor` `.fileInput` 模式）。
- 表单控件沿用 `post-editor.module.css` 口径：字段标签 600 `--wc-ink`；输入 / 文本域 `padding: 10px 12px`、`1px solid var(--wc-line)`、`border-radius: var(--wc-radius-sm)`、`background: var(--wc-card)`、`color: var(--wc-ink)`；`[aria-invalid='true']` 描边 `--wc-accent`；`:disabled` 底 `--wc-sand-deep`、文字 `--wc-muted`。
- 断点只用 `@media (max-width: Npx)`（desktop-first）；局部限宽用 `max-inline-size`，不用 `max-width`（styling-conventions §响应式）。

### 1. 个人中心 `/me`

载体 `app/me/me.module.css`（`08` 登记在 `docs/specs/wanderchain/profile.md`）。断点集合 = `1024px`、`760px` 两档，与交互规格 2.4 三档一一对应。

#### 1.1 页面骨架与标题区

- 页内主内容 = `<main id="main-content">` 内 `.wc-container` 包一层单列：`max-inline-size: 640px`、`margin-inline: auto`、`display: flex`、`flex-direction: column`、`gap: 24px`。横向留白只由 `.wc-container` 承担，子元素不再写 `width: min(...)`（styling-conventions 踩坑）。
- 标题区：`display: flex; flex-direction: column; gap: 6px`。eyebrow `Account` 用全局 `.wc-eyebrow`（`--wc-accent`、12px、700、大写、`letter-spacing: 0.18em`）；h1 `My profile` 继承全局 h1（`--wc-font-display`、600、`line-height: 1.2`），加 `font-size: clamp(28px, 4vw, 40px)` 与 `overflow-wrap: anywhere`（同 `editor-page.module.css` 的 `.title`）。
- 标题区在所有状态都显示，加载 / 未登录 / 失败也不收。

#### 1.2 头像区（`Avatar`）

- 行容器：桌面 `display: flex; align-items: flex-start; gap: 16px`。左列 72px 预览，右列上传与地址（`display: flex; flex-direction: column; gap: 10px; flex: 1; min-inline-size: 0`）。
- 预览：`inline-size: 72px; block-size: 72px; border-radius: 999px; overflow: hidden; flex-shrink: 0`。有地址且加载成功显示 `<img>`：`inline-size/block-size: 100%; object-fit: cover; alt=""`（装饰性，读屏跳过）。
- 首字符占位（昵称非空）：`display: grid; place-items: center; background: var(--wc-sand-deep); color: var(--wc-ink-soft); font-size: 24px; font-weight: 600`，整体 `aria-hidden="true"`。
- 人形占位（昵称为空）：`display: grid; place-items: center; color: var(--wc-muted)`，图形 `inline-size/block-size: 32px`，整体 `aria-hidden="true"`。
- 上传控件 `Upload image`：沿用 `post-editor` 文件选择模式——原生 `input[type=file]` 隐藏（1px、opacity 0），可见 `label` 当按钮：`display: inline-flex; align-items: center; padding: 8px 14px; border: 1px solid var(--wc-line); border-radius: var(--wc-radius-sm); background: var(--wc-card); color: var(--wc-ink); font-weight: 600; cursor: pointer`。上传中禁用（`color: var(--wc-muted); cursor: not-allowed`）并旁挂 `role="status"` `Uploading…`（`--wc-muted`、14px）。
- 地址输入 `Image URL`：标签 `Image URL` 600 `--wc-ink`，输入框沿用通用输入口径（§0）；非法时 `aria-invalid="true"` 描边 `--wc-accent`，字段下 `--wc-accent` 14px 错误文案。

#### 1.3 表单字段与计数

- 表单 = `display: flex; flex-direction: column; gap: 20px`（同 `post-editor` `.form`）。
- 每个字段 = `display: flex; flex-direction: column; gap: 6px; min-inline-size: 0`。
- 标签 `Display name` / `Bio`：600 `--wc-ink`。
- 计数 `{n} / 64` 与 `{n} / 200`：字段下方一行，右对齐，`color: var(--wc-muted); font-size: 14px`；超限时文字转 `--wc-accent`（交互规格 2.2 对 Bio 明确，Display name 同口径）。
- `Bio` 用多行 `textarea`：同输入口径 + `resize: vertical; line-height: 1.7; font-family: var(--wc-font-sans)`（同 `post-editor` `.textarea`）。
- 字段级错误文案：`color: var(--wc-accent); font-size: 14px`；昵称为空的提示（`Your posts show "Author unavailable"…`）用说明样式 `color: var(--wc-muted); font-size: 14px`（不是错误，不转 accent）。

#### 1.4 兴趣标签胶囊

- 组标题 `Interests`：600 `--wc-ink`；组说明 `Choose up to 5.`：`--wc-muted`、14px。
- 标签组：`display: flex; flex-wrap: wrap; gap: 8px`。
- 每一项是真实 `input[type=checkbox]`（隐藏 1px）+ `label` 胶囊：
  - 胶囊基态：`display: inline-flex; align-items: center; padding: 6px 14px; border: 1px solid var(--wc-line); border-radius: 999px; color: var(--wc-ink-soft); font-size: 14px; cursor: pointer`。
  - 选中：`background: var(--wc-green-soft)`（交互规格已定），另加 `border-color: var(--wc-green)`、`color: var(--wc-ink)` 强化选中（视觉补充，交互规格未限描边与文字色）。
  - 禁用（选满 5 后其余项）：`color: var(--wc-muted); cursor: not-allowed; background: transparent`。
  - 焦点：隐藏 checkbox 用 `:focus-visible + label` 透出全局焦点环（2px `--wc-green`、3px）。
- 已保存但不在清单的标签：以只读胶囊展示（无 checkbox、不可聚焦、不可选），配 `Some saved interests are no longer available.` 提示（`--wc-muted`、14px）。

#### 1.5 骨架

- 加载态骨架由「头像圆形 + 四个字段块」组成，全部 `aria-hidden="true"`，静态色块不闪烁。
- 头像圆形：`inline-size/block-size: 72px; border-radius: 999px; background: var(--wc-sand-deep)`。
- 四个字段块：昵称 / 地址块 `block-size: 44px`、简介块 `block-size: 120px`、兴趣块 `block-size: 56px`、保存块 `block-size: 48px`，均 `inline-size: 100%; border-radius: var(--wc-radius-sm); background: var(--wc-sand-deep)`。
- 伴随 `role="status"` `Loading your profile…`：`--wc-muted`、14px，可见、读屏可播报。

#### 1.6 按钮态

- `Save` 使用 `.wc-button wc-button--primary`（品牌绿底、白字，随类定义）。
  - 可保存：常态。
  - 无未保存改动：加 `:disabled`（沿用 `.wc-button:disabled`：opacity 0.6、`cursor: not-allowed`、无位移），按钮下常驻 `No unsaved changes.`（`--wc-muted`、14px）。
  - 提交中：`:disabled` + 文案 `Saving…` + `aria-busy="true"`；`No unsaved changes.` 不出现。
- `Retry` / `Log in` 链接按具体状态取 `.wc-button wc-button--primary` 或文本链接。

#### 1.7 六态视觉

| 状态 | 视觉呈现 |
|---|---|
| 加载中 | 标题区 + 骨架（§1.5）+ `Loading your profile…`；无表单、无按钮 |
| 未登录 | 标题区 + 引导块（`border: 1px solid var(--wc-line); border-radius: var(--wc-radius-md); background: var(--wc-card); padding: 24px`，同 `editor-page` `.notice`）：说明 `Log in to manage your profile.`（`--wc-ink-soft`）+ `Log in` 主按钮 |
| 会话过期 | 同未登录，但引导块顶部先加一行 `role="alert"` `Your session has expired. Log in to continue.`（`background: var(--wc-accent-soft); color: var(--wc-accent); border-radius: var(--wc-radius-sm); padding: 10px 12px; font-size: 14px`），随后是引导句与 `Log in` 链接 |
| 已登录 | 标题区 + 完整四项表单（§1.2–1.4）+ `Save` |
| 空资料 | 与「已登录」同一版式：头像人形占位、`0 / 64`、`0 / 200`、无已选标签、`Save` 禁用 + `No unsaved changes.`；不是空白页 |
| 读取失败 | 标题区 + `role="alert"` `Your profile could not load. Please try again.`（告警样式同「会话过期」）+ `Retry` 主按钮；无表单 |

#### 1.8 三档响应式

- Desktop（> 1024px）：§1.1–1.7 的桌面态。
- Tablet（761–1024px）：`@media (max-width: 1024px)` 下维持单列，表单 `gap` 收至 16px，其余不动。
- Mobile（≤ 760px）：`@media (max-width: 760px)` 下——头像行改纵向（`flex-direction: column; align-items: stretch`，预览在上、上传与地址在下）；`Save` 占满可用宽度（按钮 `inline-size: 100%`）；标签胶囊换行；不得横向滚动（各输入 `min-inline-size: 0`）。

### 2. 账户区入口（`account-menu`）

载体 `components/auth/account-menu.module.css`。只改登录态结构：昵称 → `My profile` → `Log out` 三者并排。

- 行容器沿用 `.user`（`display: inline-flex; align-items: center; gap: 10px; font-size: 14px`）。
- 昵称 `.name`：`font-weight: 600`；单行限宽 `max-inline-size: 16ch`、`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`；`@media (max-width: 760px)` 下 `max-inline-size: 10ch`。
- `My profile` 链接：`display: inline-flex; align-items: center; min-block-size: 32px; color: var(--wc-ink-soft)`；hover `color: var(--wc-green)`（交互规格 1「`--wc-ink-soft` → `--wc-green`」）；焦点沿用全局 `:focus-visible`。
- `Log out` 沿用 `.logout`（`padding: 6px 12px; border: 1px solid var(--wc-line); border-radius: 999px; background: transparent; font-size: 13px`；hover `border-color: var(--wc-green); color: var(--wc-green)`）。
- 会话确认中复用既有 `.placeholder`（96×34 占位块，不出现入口）；游客态复用既有 `.login`（`Log in / Sign up`）。

### 3. 广场卡片作者区（`post-card`）

载体 `components/posts/post-card.module.css`，替换现有 `.author`（`<details>`）为不承载跳转的作者行。

- 行容器：`display: flex; align-items: center; gap: 8px; font-size: 12.5px; min-inline-size: 0`（字号沿用旧 `.author` 12.5px）。
- 头像：`inline-size: 24px; block-size: 24px; border-radius: 999px; overflow: hidden; flex-shrink: 0`；有图时 `<img loading="lazy" alt="">` + `object-fit: cover`。
- 首字符占位（无头像或加载失败）：`inline-size/block-size: 24px; border-radius: 999px; background: var(--wc-sand-deep); color: var(--wc-ink-soft); display: grid; place-items: center; font-size: 12px; aria-hidden="true"`；拉丁转大写。
- 昵称（已返回）：`color: var(--wc-ink-soft); overflow-wrap: anywhere`（长昵称自然换行，不省略、不截半个字；头像不压缩）。
- 请求中占位：24px 中性圆形（`inline-size/block-size: 24px; border-radius: 999px; background: var(--wc-sand-deep)`）+ 短条（`inline-size: 72px; block-size: 12px; border-radius: 999px; background: var(--wc-sand-deep)`），整组 `aria-hidden="true"`，无文本。
- 缺失 / 请求失败：人形图形（`inline-size/block-size: 24px; color: var(--wc-muted); aria-hidden="true"`）+ `Author unavailable`（`color: var(--wc-muted)`），不加句号、无破图。
- 响应式：作者行不新增断点，随列表网格 3 / 2 / 1 列（≤1024 两列、≤640 单列）在同一行内换行，不隐藏头像或昵称。

### 令牌缺口

- `--wc-*` 中性占位 / 骨架填充无专属语义令牌：本规范统一用 `--wc-sand-deep` 承载头像占位、字段骨架、卡片请求中占位（与 `.cover` / `.preview` 占位底同源）；`--wc-sand-deep` 语义是「深沙底」而非「占位」，若后续要区分「加载占位」与「内容底纹」，建议在 `:root` 增一个占位填充令牌。当前不阻塞、不改现有令牌。
- 品牌绿底上的白字无令牌（`.wc-button--primary` / `.login` / `.brand` 用硬编码白字）：本规范一律经 `.wc-button--primary` 类引用、不复述色值，未新增缺口；如后续要独立描述「品牌底反白字」，需补一个 `--wc-*` 反白字令牌。

## 后续批次与解锁条件

| 批次 | 范围 | 解锁条件 |
|---|---|---|
| 1（本次） | 四项资料 + 公开名片 + 广场卡片作者区 | — |
| 2 | 详情与评论作者区；消息通知（被赞 / 被评论 / 被回复）；收藏列表（当前「只进不出」） | 名片端点可用（通知需要「谁触发的」）；详情与评论共用同一份名片 Hook |
| 3 | 站内信（会话与消息）；公开主页 `/users/{publicId}` | 账户已可被识别；需要会话表与未读计数 |
| 4 | 实时推送、通知设置、全部已读、关注作者 | 通知的数据量与原语稳定后再评估 |

## Risks / Trade-offs

1. **[阶段 1 后跨页不一致]** 广场显示昵称头像，详情与评论仍渲染 26 位标识 → 明确写进 proposal 的「本次不做」，由阶段 2 收口；本 change 不改 `post-detail.tsx` / `post-comments.tsx`，验收时不得把这两处算作已达标。
2. **[名片成为新的失败面]** 列表已渲染但名片请求失败 → 作者区降级为 `Author unavailable`，不阻塞标题链接；失败批次在翻页或重试时重新请求，不把降级当成「账户已注销」。
3. **[分隔符]** 标签若含半角逗号会破坏解码 → 清单是服务端常量，单元测试钉住清单不含逗号与首尾空白；清单外取值一律 `400`。
4. **[旧库不会自动加列]** `CREATE TABLE IF NOT EXISTS` + `ddl-auto=none`，已存在的本地库启动后读写 `accounts` 会报未知列 → 加列后先跑 `06-schema-check.ps1` 重建；tasks 把这条写成前置。
5. **[昵称可重复]** 两张卡可能同名，作者不可区分 → 本期不做唯一性；若后续做「关注作者」，再评估是否需要区分位。
6. **[外链头像失效]** 第三方地址可能 404 或加载慢 → 前端 `onError` 回退占位，服务端不代抓取（spec 已定）。
7. **[公开批量端点被枚举]** 游客可读，一次 50 个 → 只返回昵称与头像，且形状非法与不存在都省略，不给「某标识是否存在」之外的额外信息；不提供按前缀搜索。

## Migration Plan

1. 人工审阅 proposal / delta / design / tasks；新的 apply 请求才授权实施。Q1 在标签任务开始前确认；Q2 / Q3 / Q4 / Q-I1 已在 Open Questions 定案，按结论实施。
2. 后端先加列并重建库（`06`），再落 `service/profile` 与 `web/profile`；前端契约随后镜像。无数据迁移，新列 `NOT NULL DEFAULT ''` 对旧行天然兼容。
3. 前端按「契约 → 客户端 → 个人中心 → 卡片作者区」推进；标识渲染在最后一步删除，避免中途两种展示长期并存。
4. 只走本次受影响的真实链路（注册 → 改资料 → 广场看到昵称头像）；完整验收（`spec-reviewer` + `test-agent` + `harness\run-all.ps1`）后置到用户需要时。
5. 回滚：撤两个子模块的提交与工作区 gitlink；新列可保留（旧代码不读），不做破坏性 DDL 回退。

## Open Questions

Q1 仍待产品给出标签清单；Q2 / Q3 / Q4 已由 `interaction-agent` 在本次「## 交互规格」修订时定案；Q-I1 为本 change 新增的入口形态决策，PRD 无对应条目（PRD 的 Q5–Q12 属阶段 2 / 3，编号不连续，勿混读）。已定项即实施口径，不再逐条询问；Q1 未获答复不得按默认倾向静默实现。

| 编号 | 待确认内容 | 级别 | 状态 | 结论 / 候选 | 影响与依据 |
|---|---|---|---|---|---|
| Q1 | 兴趣标签清单首版取值 | 一般 | 待定 | 12–20 个城市 + 主题词（如 `hiking` / `food` / `photography` / `budget travel`），英文以对齐现有界面口径 | 只影响常量内容，不改端点与校验；实施前给出清单即可 |
| Q2 | 简介是否允许换行 | 一般 | 已定 | 允许：多行 `textarea`，换行原样提交与回显，不折叠空白；计数按 code point 计 200，换行计 1 | 不改存储与校验；简介只有资料页消费 |
| Q3 | 无头像时的占位形态 | 一般 | 已定 | 名片已返回但无头像（或图片加载失败）：昵称首字符 + `--wc-sand-deep` 圆形底 + `--wc-ink-soft` 字，拉丁转大写；名片缺失：统一人形图形（`--wc-muted`）+ `Author unavailable`；请求中：中性占位块 `aria-hidden` | 呈现细节，交体验审查确认；规则同时适用于卡片与资料页预览 |
| Q4 | 名片缺失文案 | 一般 | 已定 | 逐字 `Author unavailable`；不加句号、不改写成 `No author info` 一类新说法——AC-34 与 E2E 断言引用同一字符串 | 文案，不改状态机；改它要同步改 AC-34 与 E2E |
| Q-I1 | 个人中心入口形态（本 change 新增） | 一般 | 已定 | `account-menu.tsx` 登录态内新增文本链接 `My profile`（昵称之后、`Log out` 之前），1 次点击到 `/me`；不做下拉菜单 | 唯一牵动账户区结构的决策：下拉会把主要路径变成 2 次点击，与 D9「1 次点击可达」冲突，并引入焦点管理与外点关闭；阶段 2 / 3 出现第二个账户目的地时再评估容器 |
