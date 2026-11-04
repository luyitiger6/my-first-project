# Proposal

## Why

后端目前只能在本机用 `mvn spring-boot:run` 启动，没有任何容器化产物：既无法放进本地 kind 集群（KubeSphere）做演示，也没有验证过「不改代码、只靠环境变量覆盖配置」这条容器化路径是否成立。

本次补两份交付物：一份容器编排（docker-compose），一份 Kubernetes 部署清单（前后端各一个单副本 Deployment + Service + 统一 Ingress 入口），让整套系统能在容器里跑起来，并通过一个域名访问。

## What Changes

- 新增 `backend/Dockerfile`：多阶段构建，Maven 阶段产出可执行 jar，JRE 17 阶段以非 root 用户运行，暴露 8989。
- 新增 `backend/.dockerignore`：排除 `target/`、`media/`、`.git/`，避免把本机构建产物和已上传封面打进镜像。
- 新增 `backend/docker-compose.yml`：单服务 `backend`，端口映射 `8989:8989` 保持现状；运行期依赖的 MySQL(8806) 与 Redis(6606) 仍用宿主机上已在跑的实例，compose 不重复拉起。
- 新增 `backend/k8s/deployment.yaml`：Deployment（1 副本）+ Service（ClusterIP:8989）+ Secret（数据库、Redis、JWT 三项凭据）。镜像从本地 kind 集群加载，不走远程仓库。
- 新增 `frontend/k8s/deployment.yaml`：前端 Deployment（1 副本）+ Service（ClusterIP:3000），复用既有 `frontend/Dockerfile` 的 standalone 产物，`BACKEND_URL` 指向集群内的后端 Service。
- 新增 `deploy/k8s/ingress.yaml`：单域名 `wanderchain.dev.local` 的入口，`/` 全部导向前端 Service。后端不对外暴露，浏览器始终同源。
- 集群侧补装 ingress-nginx：当前集群没有 Ingress Controller（`kubectl get ingressclass` 为空），Ingress 清单 apply 之前必须先装。
- 集群侧覆盖 `allowed-origins`：域名换掉后浏览器的写请求 Origin 不再命中白名单，经 `WANDERCHAIN_AUTH_ALLOWEDORIGINS_0/_1` 注入，不改仓库里的 `application.yml`。
- **不改任何 Java 代码、不改 `application.yml`、不改 API 契约**。数据源地址、Redis 地址、凭据与来源白名单全部通过 Spring 的宽松绑定用环境变量覆盖（`SPRING_DATASOURCE_URL`、`SPRING_DATA_REDIS_HOST`、`WANDERCHAIN_*`）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。

本次属于 tooling 交付：只新增构建与部署工件，不改变任何 API 语义、页面行为与数据模型，因此 `.openspec.yaml` 标记 `skip_specs: true`，不新增能力规格。

## Impact

- **受影响的仓库**：`backend` 子模块（Dockerfile、.dockerignore、docker-compose.yml、k8s/deployment.yaml）、`frontend` 子模块（k8s/deployment.yaml）、工作区根（deploy/k8s/ingress.yaml）。
- **不受影响**：`openspec/specs/` 既有 18 项能力、`harness/` 十二道闸门。新增文件不在 03 静态红线的扫描范围（它只看 `backend/src/**/*.java` 与 `frontend/**/*.{ts,tsx}`）。
- **运行期依赖不变**：容器仍需能访问宿主机的 MySQL 8806 与 Redis 6606，不存在内存兜底；连不上时启动即失败，与当前行为一致。
- **端口不变**：后端容器与服务均监听 8989，前端监听 3000，宿主机侧对外只经 Ingress 的 80。
- **已知边界**：集群内连宿主机依赖用 `hostAliases` 把 `host.docker.internal` 指向 kind 网络网关（当前为 `172.29.0.1`）。kind 集群重建后网关可能变化，需按清单注释里的命令重新取值。
- **已知边界**：换域名后后端的来源白名单必须同步覆盖，否则写请求会全部返回 403 `CROSS_SITE_REJECTED`，而页面浏览不受影响——故障表现具有欺骗性。
