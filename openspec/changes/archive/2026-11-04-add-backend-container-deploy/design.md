# Design

## Context

后端是 Spring Boot 3.5.5 / Java 17 的单体应用，监听 8989，运行期硬依赖宿主机的 MySQL 8806 与 Redis 6606（不存在内存兜底）。`application.yml` 里数据源地址与 Redis 主机是字面量 `127.0.0.1`，只有用户名、密码、JWT 密钥走 `${}` 占位符。

本地已有一个 kind 集群（KubeSphere v4.1.1），节点为 Docker 容器，集群网络 `172.29.0.0/16`，网关 `172.29.0.1` 即宿主机。已实测节点可连到该网关的 8806 与 6606。

## Goals / Non-Goals

**Goals:**

- 后端能在容器里以 8989 原样启动，不修改任何 Java 代码与 `application.yml`。
- docker-compose 一条命令起单容器；Kubernetes 一份清单起 Deployment 1 副本 + Service。
- 两种形态连同一套宿主机依赖，配置差异全部收敛到环境变量。

**Non-Goals:**

- 不把 MySQL / Redis 搬进集群，不做 Helm chart，不做多环境 values。
- 不做镜像仓库、不做 CI 推送流水线。
- 不改前端代理、不改 `application.yml` 里的 `allowed-origins`（集群侧用环境变量覆盖）、不做 TLS。域名只用于本地 hosts 解析，不申请证书。

## Decisions

### D1 依赖连接：`host.docker.internal` + Pod `hostAliases`

compose 用 `extra_hosts: ["host.docker.internal:host-gateway"]`；Deployment 用 `hostAliases` 把 `host.docker.internal` 指向 kind 网关。配置里只出现主机名，网关 IP 只在清单中出现一次，换集群时改一行即可。

**备选**：把 MySQL/Redis 也部署进集群——自包含但要迁移现有数据，且演示目标并不包括数据层；直接在 env 里写 `172.29.0.1`——少一层解析，但 IP 会散落在多个环境变量里。

### D2 配置覆盖：只用环境变量，不碰 `application.yml`

`SPRING_DATASOURCE_URL`、`SPRING_DATASOURCE_USERNAME`、`SPRING_DATASOURCE_PASSWORD`、`SPRING_DATA_REDIS_HOST`、`SPRING_DATA_REDIS_PORT`、`SPRING_DATA_REDIS_PASSWORD`、`WANDERCHAIN_JWT_SECRET`、`WANDERCHAIN_MEDIA_ROOT`，全部由 Spring 的宽松绑定接管。

**备选**：把 yml 里的 `127.0.0.1` 也改成 `${...}` 占位符——会动到生产配置，且缺省值一多就重新引入「改配置被代码兜底掩盖」的老问题；挂载外部 `application-prod.yml`——多一份配置真源，迟早与仓库里的那份漂移。

`wanderchain.auth.allowed-origins` 是列表型配置，环境变量覆盖要按下标写 `_0`、`_1`。演示环境换了域名，浏览器的写请求 Origin 不再命中默认的两项，所以必须覆盖：`WANDERCHAIN_AUTH_ALLOWEDORIGINS_0=http://wanderchain.dev.local:19080` 与 `_1=http://localhost:3000`。列表型注入是**整体替换**而非追加，两项都要写全，漏一项就等于删一项。

已验证：带 `Origin: http://wanderchain.dev.local:19080` 的 POST 返回 401（过来源校验、卡在未登录），带 `Origin: http://evil.example` 的同一请求返回 403 `CROSS_SITE_REJECTED`。

### D3 镜像分发：`kind load docker-image`

本地构建 `wanderchain-backend:demo`，直接 load 进 kind 节点，`imagePullPolicy: IfNotPresent`。

**备选**：推 Docker Hub 或私有仓库——演示不需要，多一套凭据与网络依赖；在集群内用 BuildKit 构建——需要额外组件，收益为零。

### D4 构建在宿主机，镜像里不放 Maven

当前环境拉不到 maven 官方镜像：`daemon.json` 里唯一的加速器 `jrlhsx3y.mirror.aliyuncs.com` 返回 403，公共镜像代理实测只有 40~70 KB/s（500MB 的 maven 镜像要数小时），而宿主机到 Maven Central 有 666 KB/s。

所以构建放在宿主机执行 `mvn -f backend/pom.xml package -DskipTests`，Dockerfile 只做运行层：`alpine:3.20` + apk 阿里云源装 `openjdk17-jre-headless` + COPY jar。

**取舍**：Dockerfile 不再自包含，必须先有 jar 才能 `docker build`。这与「多阶段构建」的最终效果一致——镜像里同样没有 Maven、JDK 与源码，体积反而更小。

`-DskipTests` 不违反「禁止伪造绿灯」：那条禁令约束的是**验收流程**（不许 `@Disabled`、不许注释断言、不许拿 `-DskipTests` 骗过闸门），不是禁止构建产物时跳过测试。构建环境里没有 MySQL / Redis，跑测试必然全红；测试的判定权在 `harness/checks/02-test.ps1`。

前端同理，但多一个坑：`node:24-alpine` 拉不下来，改用 `Alpine 3.20` + apk `nodejs`（3.20 仓库为 20.15.1，满足 Next.js 16 的 Node 20.9+），产物取自宿主机 `npm run build`。standalone 落在 `.next/standalone/frontend/`，比常见示例多一层项目目录，`public` 与 `.next/static` 必须跟着落到这一层，否则静态资源 404。

`Dockerfile.k8s` 要 COPY `.next`，而根 `.dockerignore` 正排除它。当前 buildx 不支持 `--ignorefile`，所以构建前把 `.dockerignore` 临时改名、用 `.dockerignore.k8s` 顶上，构建完立刻还原——三步必须在同一条命令里，中途失败也要还原，否则后续构建会拿到错误的忽略规则。

### D5 运行身份与媒体目录

容器以非 root 用户 `app` 运行（与前端 Dockerfile 的做法一致）。`WANDERCHAIN_MEDIA_ROOT=/app/media`，Kubernetes 侧挂 `emptyDir`。

**取舍**：`emptyDir` 在 Pod 重建后丢失已上传封面图。演示可接受；要持久化需换 PVC，属于 Non-Goal。

### D6 入口：单域名 Ingress，全部导向前端

`wanderchain.dev.local` 的 `/` 全部落到前端 Service，后端不建 Ingress 规则。

这样浏览器全程同源：本地开发是 `localhost:3000` 单源，集群里是 `wanderchain.dev.local` 单源，形态一致，出问题时能对照。

**备选**：Ingress 按路径分流、`/api` 直接给后端。这会让前端 Route Handler 彻底失效，而它不只是转发：它逐段 `encodeURIComponent` 拼接、把多条 `Set-Cookie` 逐条回传（`getSetCookie()`，用 `get()` 合并会导致属性错位）、透传 `cache-control` / `etag` / `retry-after`。绕过它等于让集群链路与本地链路变成两套。NodePort 也不采用：它要求用节点 IP 访问，反而破坏「一个域名」的目标。

### D7 先装 ingress-nginx，再 apply Ingress

`kubectl get ingressclass` 当前返回空，Ingress 对象不会被任何控制器接管，apply 进去就是一张废纸。所以顺序固定为：装控制器 → 确认 IngressClass 就绪 → apply 业务清单。

kind 节点没有把 80/443 映射到宿主机（节点容器只发布了 30880 / 18088 / 18443 / 62921，其中 18088→节点 80 已被 KubeSphere 控制台的 NodePort 占住），宿主机侧 80 也已被 Docker Desktop 的 WSL 中继占用。实测结论：宿主机**无法直接访问节点 IP**（6443/30880 均不可达），因此控制器不启用 hostPort，入口统一走 `kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 19080:80`，访问地址为 `http://wanderchain.dev.local:19080`。

端口选 19080 是实测排障的结果：8080 被 VMware NAT（`vmnat`）占着，9080 被 `NahimicService` 占着，两个「看起来该空闲」的端口都有人。端口带进域名是这条路径的固定代价，已同步写入后端 `allowed-origins` 与 `media.public-base-url`——三处必须是同一个串，少一个端口写请求就 403。

### D8 不配 CORS，改后端的来源白名单

前端 Route Handler 把 `origin`、`referer`、`cookie` 三个头原样转发给后端（`FORWARDED_REQUEST_HEADERS`），后端 `OriginGuard` 拿 `origin` 与 `wanderchain.auth.allowed-origins` 比对。当前白名单只有 `http://localhost:3000` 与 `http://127.0.0.1:3000`。

换域名后的后果不对称：GET 不受影响（来源校验只拦写方法），**写请求全部 403 `CROSS_SITE_REJECTED`**。所以必须在集群侧把新域名注入白名单，经 `WANDERCHAIN_AUTH_ALLOWEDORIGINS_0` / `_1` 覆盖，不改仓库里的 `application.yml`——本地开发仍用 localhost。

**不把 CORS 配在 Ingress**：浏览器只与前端的单一源通信，前端到后端是服务端之间的调用，链路上不存在跳域，CORS 响应头没有作用点。若在 Ingress 开启 CORS，白名单会与后端 `allowed-origins` 形成两份真源；预检由 Ingress 应答、实际写请求由后端拒绝，排查要在两层之间来回看。将来确有跳域需求时，应在后端复用同一份白名单，而不是叠加一层。

## Risks / Trade-offs

- **kind 网关 IP 变化** → 集群重建后 `hostAliases` 的 IP 会失效；清单注释里给出取值命令 `docker network inspect kind --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}'`，改一行即可恢复。
- **域名与白名单不一致** → 写请求 403 而页面正常，故障具有欺骗性；部署后的验证必须包含一次写操作（发帖或评论），不能只看首页能不能打开。
- **集群没有 Ingress Controller** → Ingress apply 成功但无流量，`kubectl get ingress` 看不到 ADDRESS；先装 controller 并确认 IngressClass 出现。
- **Pod 用 MySQL root 账号** → 演示用，与宿主机现有凭据一致；生产应换专用账号并收紧授权。
- **`emptyDir` 丢封面图** → 已在 D5 声明为可接受，持久化留待真实需求。
- **镜像只含 amd64** → kind 节点同为 amd64，无影响；跨架构场景需加 `--platform`。

## Migration Plan

1. 宿主机出产物：`mvn -f backend/pom.xml package -DskipTests`；`cd frontend; npm run build`
2. 构建镜像：`docker build -t wanderchain-backend:demo backend/`；前端先按 D4 替换 `.dockerignore`，再 `docker build -f Dockerfile.k8s -t wanderchain-frontend:demo frontend/`
3. `kind load docker-image wanderchain-backend:demo --name kubesphere` 与前端镜像同理
4. 安装 ingress-nginx（`controller.service.type=ClusterIP`），确认 IngressClass `nginx` 就绪
5. `kubectl apply -f backend/k8s/deployment.yaml`、`-f frontend/k8s/deployment.yaml`、`-f deploy/k8s/ingress.yaml`
6. `kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 19080:80`——这是随会话存在的前台进程，断开后入口就不通，重跑即可
7. 管理员权限把 `127.0.0.1 wanderchain.dev.local` 写进 hosts（指向宿主机，不是节点 IP）；浏览器验一次读与一次写——只有写请求能证明来源白名单生效
8. 回滚：按相反顺序 `kubectl delete -f ...`；compose 侧 `docker compose down`

## Open Questions

无。演示所需的边界（副本数、端口、依赖拓扑、暴露方式）已全部在上面的决策里定死。
