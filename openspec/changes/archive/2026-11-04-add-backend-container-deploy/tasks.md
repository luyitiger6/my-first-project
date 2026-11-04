# Tasks

## 1. 容器镜像

- [x] 1.1 新增 `backend/Dockerfile`（Alpine 3.20 + apk 阿里云源装 headless JRE，非 root，`EXPOSE 8989`）与 `backend/.dockerignore`（只放行 `target/*.jar`）。当前环境拉不到 maven 官方镜像（加速器 403、公共代理 10~100 KB/s），构建改在宿主机 `mvn package`，镜像只做运行层。验证：镜像构建成功，体积 321MB。
- [x] 1.2 新增 `frontend/Dockerfile.k8s` 与 `frontend/.dockerignore.k8s`：`node:24-alpine` 同样拉不下来，改用 `alpine:3.20` + apk nodejs（20.15.1），COPY 宿主机构建的 standalone 产物；原 `frontend/Dockerfile` 保持不动。验证：镜像 85.7MB，容器内 `/app/frontend/server.js` 与 `.next`、`public` 齐备。

## 2. docker-compose

- [x] 2.1 `backend/docker-compose.yml`：单服务 `backend`，`8989:8989`，`extra_hosts` 指向 `host.docker.internal:host-gateway`，数据源与 Redis 经 `SPRING_*` 覆盖，`media` 绑宿主机目录。
- [x] 2.2 验证：`docker compose up -d` 后容器 Up，`curl http://localhost:8989/api/attractions?limit=2` 返回 200 与景点数据，日志显示 `Started Application in 6.646 seconds`（若环境变量未生效会连 `127.0.0.1` 直接启动失败）。

## 3. 后端 Deployment

- [x] 3.1 `backend/k8s/deployment.yaml`：Secret（数据源用户名/密码、Redis 密码、JWT）+ Deployment（1 副本，`hostAliases` 命中 kind 网关，`emptyDir` 挂 `/app/media`，env 覆盖数据源、Redis、来源白名单、媒体地址）+ Service（ClusterIP 8989）。
- [x] 3.2 验证：`kind load docker-image wanderchain-backend:demo` 后 Pod `1/1 Running`、零重启，`kubectl exec ... wget /api/attractions` 返回景点 JSON。

## 4. 前端 Deployment

- [x] 4.1 `frontend/k8s/deployment.yaml`：Deployment（1 副本，`BACKEND_URL=http://wanderchain-backend:8989`、`PORT=3000`）+ Service（ClusterIP 3000）。
- [x] 4.2 验证：Pod `1/1 Running`、零重启，日志 `Next.js 16.4.3` + `Ready in 0ms`。

## 5. Ingress 入口

- [x] 5.1 helm 安装 ingress-nginx（`controller.service.type=ClusterIP`），`kubectl get ingressclass` 出现 `nginx`，控制器 Pod Running。
- [x] 5.2 `deploy/k8s/ingress.yaml`：host `wanderchain.dev.local`，`path: /` 且 `pathType: Prefix` 导向前端 3000，注解 `proxy-body-size: 8m`（封面图上限 5MB，控制器默认 1m 会在入口 413）。
- [x] 5.3 用 `kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 19080:80` 暴露入口（8080 被 VMware NAT、9080 被 NahimicService 占用）。验证：首页 200 且返回 24393 字节、`/posts` 200、`/api/attractions` 200；写请求带 `Origin: http://wanderchain.dev.local:19080` 返回 401，带 `Origin: http://evil.example` 返回 403 `CROSS_SITE_REJECTED`——白名单覆盖确实生效。

## 6. 需要用户本人完成

数据库（`127.0.0.1:8806/wanderchain`）原本一张账号都没有，浏览器验证前必须先有账号。已用 `backend/tools/SeedPostsAccounts.java` 播种两个本地演示账号（只存在于本机库，未写入 User/Machine 环境变量，不是真实凭据）：

| 别名 | 邮箱 | 密码 |
|---|---|---|
| A | `wc-posts-a-0123456789abcdef0123456789abcdef@example.test` | `WcDemo!2026A` |
| B | `wc-posts-b-0123456789abcdef0123456789abcdef@example.test` | `WcDemo!2026B` |

- [ ] 6.1 用管理员 PowerShell 追加 hosts 后，浏览器访问 `http://wanderchain.dev.local:19080`：

  ```powershell
  Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "127.0.0.1 wanderchain.dev.local"
  ```

  入口是 `kubectl port-forward` 的前台进程，会话结束就断。浏览器报连不上时先单独开一个窗口重跑：

  ```powershell
  kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 19080:80
  ```

- [ ] 6.2 在浏览器里用 A 账号登录，发一条帖子再删掉，确认界面渲染、登录态与封面图地址在域名下都正常。

  命令行已经替这一段验到「服务端全通」：用 `curl --resolve wanderchain.dev.local:19080:127.0.0.1`（不动 hosts）走完 LOGIN 200 → `/api/auth/me` 200（Cookie 往返有效）→ 发帖 201 → 列表 200 含新帖 → 详情 200 → 删除 204 → 再查 404。剩下没验的只有「浏览器里点出来的界面样子」。

## Workflow follow-up

- 提交 `backend`、`frontend` 子模块并推送，再回工作区提交 `deploy/` 与新的 gitlink 及本次 change 目录。
- 归档该 change（`/opsx:archive`）。
