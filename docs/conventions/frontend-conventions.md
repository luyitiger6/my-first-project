# 前端开发约定

适用范围：`frontend/` 子模块（Next.js App Router / React 19 / TypeScript / CSS Modules / Vitest）。
本文只写**本仓库特有的取向**；框架通用惯例不在此重述。

## 目录组织

```
frontend/
├── app/                        路由与页面级样式
│   ├── layout.tsx              根布局：语言、标题、全局样式、AuthProvider
│   ├── page.tsx                首页（城市筛选 + 若干内容区块）
│   ├── login/ register/        认证页面
│   ├── community/ attractions/ 板块占位页
│   ├── search/                 搜索页
│   ├── api/[...path]/route.ts  同源 API 代理（运行期 BACKEND_URL）
│   └── *.module.css            页面级样式（home / auth / search）
├── components/<domain>/        按业务域分组，不按技术类型分组
│   ├── auth/                   Provider、表单、账号菜单
│   ├── home/                   首页各区块 + 数据 hook
│   └── site/                   页头、页脚、占位页
└── lib/
    ├── contracts/              前后端字段契约（同一份契约在前端侧的落地）
    ├── auth/                  认证端点函数与错误翻译
    ├── home/                  类型、城市白名单、mock 数据、仓储
    └── search/                查询解析
```

三条归属规则：

1. **`app/` 只放路由与页面**。能被两个页面复用的东西下沉到 `components/` 或 `lib/`。
2. **`components/` 按业务域分组**，不建 `components/ui/`、`components/common/` 这类按技术类型的目录。跨域复用先确认真的跨域，再决定放 `site/`。
3. **`lib/` 放可单测的纯逻辑**。组件里出现的、不依赖 DOM 的判断逻辑应当能搬到 `lib/` 并被单测覆盖。

## 组件三件套

一个组件由**同名同目录**的三个文件组成：

| 文件 | 职责 |
|---|---|
| `<name>.tsx` | 结构与交互 |
| `<name>.module.css` | 该组件独占的样式 |
| `<name>.test.tsx` | 该组件的单测（Vitest + jsdom） |

现状与缺口的区别要说清：

- 有状态的业务组件（`home/` 与 `auth/` 下的区块）基本都是三件齐备。
- `components/site/` 下三个布局组件目前只有 `.tsx` 与 `.module.css`，没有单测。
- 纯逻辑件（`use-section-data.ts`、`hash-anchor-restorer.tsx`、`section-boundary.tsx`）有测试但不一定有样式，这是正常的——它们不产出自己的视觉。

**新增组件最终按三件齐备交付，MVP 实施时先落结构与样式**。前端单元测试、E2E 及相应测试文档的编写和运行时机以 `AGENTS.md` §10 的快速 MVP 规则为准，不逐功能穿插，不因测试文件尚未补齐阻塞真实后端联通；最终需要验收时集中处理。既有测试保留，未跑项不记为通过。补齐无关既有缺口不在本约定范围，需要时单独立项。

## 状态归属

按「谁能看见它」决定放哪一层，不要凭手感：

| 可见范围 | 放哪 | 例 |
|---|---|---|
| 跨页面、跨整棵树的身份状态 | 全局 Provider（`components/auth/auth-provider.tsx`） | 当前账号、登录态、登出 |
| 单个页面内的筛选与选择 | 该页面的 `page.tsx` 或页面级容器 | 首页的城市筛选 |
| 只影响本组件的开关与输入 | 组件内 `useState` | 弹窗开合、表单输入 |

判定顺序是从上往下：先问「另一个页面要不要读它」，要就往上提一层；再问「这个页面的另一个区块要不要读它」。两问都否，就留在组件里。

**不要**为了省 props 把页面状态塞进全局 Provider——全局状态每多一项，所有消费者都要多考虑一次它什么时候变。

## API 封装两层

```
lib/contracts/<域>.ts      字段契约：interface，契约定稿后在前端侧的落地
        ^
lib/<域>/<域>-api.ts       端点函数：发请求、解析响应、把失败翻译成可展示的错误
```

- **契约层**只声明形状，不含请求逻辑，可以被前后端契约闸门逐字段比对。
- **端点层**只调端点，不含形状声明；错误统一翻译（网络失败、HTTP 失败、业务错误码各有明确分支）。
- 组件**不直接 `fetch`**。绕过端点层意味着错误处理与 cookie 语义各写一遍。

### 契约顺序：先定契约，两端各自落地

契约**不属于任何一方**。它先落成在本次 change 的 `design.md` 的「## 契约」一节，然后两端各自翻译：

```
design.md 的「## 契约」表          ← 形状声明的唯一真源
     ├─→ 后端 → web/*/dto/*.java  （record 组件）
     └─→ 前端 → lib/contracts/*.ts（interface 字段）
                    ↓
     10-contract-check.ps1 验证两侧一致，且都等于契约表
```

表格三列，类型写中性名（`string` / `number` / `boolean` / `Array<X>` / 另一个 record 名），不写 Java 也不写 TS：

```markdown
## 契约

| 接口 | 字段 | 类型 |
|---|---|---|
| RegisterRequest | email | string |
| AccountView | accountId | string |
| AccountView | createdAt | string |
```

**为什么不是「后端定、前端镜像」**：那样前端拿不到「应该是什么」，只有「后端现在是什么」。后端改一个字段名，前端只能事后跟。契约定稿后两端同时开工——这是前后端能并行的唯一前提。

**顺序不能反**：先写前端类型再让后端照着写，等于用前端的猜测定义后端契约；先写后端再让前端镜像，等于后端单方面拥有解释权。两种都是串行，只是先后不同。

`lib/contracts/` 因此不是「后端 DTO 的镜像」，而是**同一份契约在前端侧的落地**。

边界要说清：

- **契约表本身没有机械校验**。闸门能验「两侧一致且等于表格」，验不了「表格写得对」——表格错了，两侧照着错，闸门照样绿。所以它必须在 ② 定规格时由人类放行，这是它唯一的把关点。
- **不涉及接口变化的 change 可以不写**「## 契约」。此时 `lib/contracts/` 沿用已有形状，不得顺手扩张。
- 当前仓库**没有**泛型的统一响应包装（形如 `ApiResponse<T>` 的东西）。若将来引入，包装本身就是契约的一部分，先写进契约表，再两端落地。

## 路由分组

**尚未使用**。`login/` 与 `register/` 目前平铺在 `app/` 下。

启用条件很具体：当这两个页面需要共享一个 layout（共同的侧栏、共同的跳转守卫、共同的路由级 loading）时才建分组目录。只为了「看起来整齐」而分组，会多出一层不承载任何东西的目录。

## 真源声明

- `AGENTS.md` — 三层分工、七条硬规则、闸门约定
- `docs/conventions/backend-conventions.md` — 后端分层、DTO 与响应格式；接口形状的契约表落在本次 change 的 design.md，两侧各自实现
- `openspec/specs/` — 各能力的可验收行为（含错误码与响应字段白名单）

## 依赖现状

- `next` — 框架与 App Router
- `react` — 运行时
- `react-dom` — 渲染
- `typescript` — 类型检查
- `vitest` — 单测运行器
- `vite` — 测试与构建的底层打包器
- `@vitejs/plugin-react` — Vitest 的 React 转换
- `jsdom` — 组件测试的 DOM 环境
- `@testing-library/react` — 组件渲染与查询
- `@testing-library/jest-dom` — DOM 断言扩展
- `@testing-library/user-event` — 用户交互模拟
- `@types/node` — Node 类型
- `@types/react` — React 类型
- `@types/react-dom` — React DOM 类型

## 拟引入

暂无仓库级拟引入项。端到端测试依赖挂在**工作区根**而不在本子模块内（docs/e2e 目录与根 package.json），因此不出现在上面的清单里；编辑器等具体选型由对应能力的变更裁决，不在本文件预先承诺。

## 机械守卫

- `10-contract-check.ps1` — 契约表（`design.md` 的「## 契约」）↔ 后端 DTO ↔ `lib/contracts/` 三方字段名与类型一致
- `04-frontend.ps1` — `npm ci` → `next build` → `vitest run`，构建与单测都过才算过
- `03-static-guard.ps1` — 禁止前端 `TODO` 与跳过写法（`it.skip` 等）
- `11-conventions-check.ps1` — 本文四个固定小节与真源路径的有效性
