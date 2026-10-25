---
kind: external_dependency
name: 前端框架：Next.js 16 App Router + React 19
slug: nextjs
category: external_dependency
category_hints:
    - framework_behavior
scope:
    - '**'
---

### 角色与集成点
- 开发模式通过 `app/api/[...path]/route.ts` 的同源 API 代理转发到后端（默认 `http://localhost:8989`），生产模式优先反向代理，无代理时回退到构建期注入的 `BACKEND_URL`。
- 构建产物含 `.next/standalone`，支持独立 Node 进程启动。

### 稳定约束
- 代理读取运行期环境变量 `BACKEND_URL`，改值后重启进程即可切换后端，无需重新构建。
- 代理层只做透传：逐段 `encodeURIComponent` 拼接路径、`cache: 'no-store'`、上游状态码原样返回，网络失败映射 502。
- 测试用 `// @vitest-environment node` 隔离 Web `Request`/`Response`，不依赖真实后端进程。