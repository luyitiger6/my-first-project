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
    ├── contracts/              前后端字段契约（镜像后端 DTO）
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

**新增组件按三件齐备写**。补齐既有缺口不在本约定范围，需要时单独立项。

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
lib/contracts/<域>.ts      字段契约：interface，逐字镜像后端 DTO
        ^
lib/<域>/<域>-api.ts       端点函数：发请求、解析响应、把失败翻译成可展示的错误
```

- **契约层**只声明形状，不含请求逻辑，可以被前后端契约闸门逐字段比对。
- **端点层**只调端点，不含形状声明；错误统一翻译（网络失败、HTTP 失败、业务错误码各有明确分支）。
- 组件**不直接 `fetch`**。绕过端点层意味着错误处理与 cookie 语义各写一遍。

### 契约镜像顺序

**先改后端 DTO，再到 `lib/contracts/` 镜像，最后更新 `10-contract-check.ps1` 的受管清单。**

反过来先写前端类型，等于用前端猜测定义后端契约：编译能过、测试能过，联调时才炸，且炸的时候没人知道哪边是对的。

当前仓库**没有**泛型的统一响应包装（形如 `ApiResponse<T>` 的东西）。端点层各自声明返回类型；若将来引入统一包装，必须先在后端把包装落地，再来镜像——`10-contract-check.ps1` 只能比对存在的东西。

## 路由分组

**尚未使用**。`login/` 与 `register/` 目前平铺在 `app/` 下。

启用条件很具体：当这两个页面需要共享一个 layout（共同的侧栏、共同的跳转守卫、共同的路由级 loading）时才建分组目录。只为了「看起来整齐」而分组，会多出一层不承载任何东西的目录。

## 真源声明

- `AGENTS.md` — 三层分工、六条硬规则、闸门约定
- `docs/conventions/backend-conventions.md` — 后端 DTO 与响应格式，本文件的前端契约镜像它
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

- `10-contract-check.ps1` — 后端 DTO 与 `lib/contracts/` 的字段名、类型逐字一致
- `04-frontend.ps1` — `npm ci` → `next build` → `vitest run`，构建与单测都过才算过
- `03-static-guard.ps1` — 禁止前端 `TODO` 与跳过写法（`it.skip` 等）
- `11-conventions-check.ps1` — 本文四个固定小节与真源路径的有效性
