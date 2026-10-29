# 后端开发约定

适用范围：`backend/` 子模块（Spring Boot 3.5.5 / Java 17 / JPA / MySQL 8 / Redis / JWT）。
本文只写**本仓库特有的取向**；框架通用惯例不在此重述。

## 包结构与依赖方向

```
com.luyi.myfirst
├── Application.java            启动类
├── common/                     无业务归属的共享件
│   ├── enums/                  AccountStatus
│   ├── exception/              BaseError / BizException / AuthErrorEnum
│   ├── id/                     Ulid
│   ├── security/               PasswordHasher / BcryptPasswordHasher / PasswordRules
│   └── web/                    AuthResponseBody / AuthResponseGuard / ErrorResponse / GlobalExceptionHandler
├── config/                     AuthProperties / WebMvcConfig
├── dao/                        Account / AuthSession / *Repository / AccountStatusConverter
├── service/<域>/               接口 + impl/ + support/ + model/
└── web/<域>/                   Controller + dto/ + interceptor/
```

依赖方向**单向**，箭头右侧不得 import 左侧：

```
common  <--  config / dao  <--  service  <--  web
```

具体禁止项（由 `11-conventions-check.ps1` 机械校验）：

- `dao/` 不得 import `web/`
- `service/` 不得 import `web/`
- `common/` 不得 import `dao/` / `service/` / `web/`

`service/<域>/` 内按四档组织，职责固定：

| 目录 | 放什么 | 不放什么 |
|---|---|---|
| （根） | 对外接口，Controller 只依赖这一层 | 实现细节 |
| `impl/` | 接口的唯一实现 | 被多个实现共享的工具 |
| `support/` | 无业务语义的协作件（哈希、限流、令牌签发、来源解析） | 业务编排 |
| `model/` | 服务层内部的值对象（`LoginAttempt` / `LoginResult`） | 会被序列化的响应体 |

## Controller 的拆分粒度

**一个端点一个 Controller**。认证线现有九个：`LoginController`、`RegisterController`、`LogoutController`、`MeController`、`AccountController`、`CaptchaController`、`RegisterCodeController`、`PasswordResetCodeController`、`PasswordResetController`。

理由不是风格：端点级拆分让「一个端点的全部输入输出」在一屏内读完，`@RequestMapping` 前缀与拦截器口径集中在一处；合并成大 Controller 后，改一个端点要先确认没有共用字段。

控制器只做三件事：

1. 绑定请求体到 `dto/`
2. 取请求上下文（来源键、cookie、request attribute）——这是只有控制器能拿到的信息
3. 把服务层返回值包成响应

在此之外都算越界：

- **不写业务分支**。按状态分流是服务层的职责；控制器里出现 `if` 就意味着顺序有了第二个可以被改坏的地方。
- **不依赖 Repository**。数据访问只经服务层。
- **不拼装响应体**。见下一节的出站守卫。

## DTO 与响应

- 请求体与响应体都是 Java `record`，放在 `web/<域>/dto/`。
- **禁止把实体（`dao/` 下的类）作为响应体返回**。实体字段随表结构变，响应字段随契约变，两者必须能独立演进。
- 响应字段白名单以能力 spec 为准，不以「这个字段反正有用」为准。
- 字段名 `camelCase`，与前端 `lib/contracts/` 的镜像逐字一致，由 `10-contract-check.ps1` 比对。

### 标记接口不是基类

统一的出站约束在当前仓库用**标记接口**实现，不用基类：

```java
public interface AuthResponseBody { }
```

原因是硬约束而非偏好——响应体都是 record，**Java 的 record 不能继承类，但可以 `implements` 接口**。所以任何「所有响应都继承某个基类」的设计在 record 面前不成立，能写的只有标记接口。

标记的作用在类型而非方法：`AuthResponseGuard`（`ResponseBodyAdvice`）在唯一出站口按类型拦截，未标记的 `/api/auth/**` 响应体一律抛异常转 500。新增 DTO 忘记打标记会在测试里立刻炸，而不是悄悄写出一个任意形状。

两条边界（不要自行扩张）：

- 空体（`ResponseEntity<Void>`、204/202）不在约束内——没有响应体就没有可泄漏的字段。
- 非 `/api/auth/**` 的路径当前原样放行。全站化是另一个变更，不在本约定里顺手做。

## 异常收口

- 预期内的业务拒绝 → 抛 `BizException(错误码枚举实例, 消息)`。
- `GlobalExceptionHandler` **只**翻译 `BizException`，其它异常不兜底。让默认 500 暴露出来，比替它编一个看起来正常的错误码更容易在联调时被发现。
- 服务层**不写 HTTP 状态码**。状态码由错误码枚举携带，翻译发生在唯一的 advice 里。
- 禁止用 `IllegalArgumentException` / `NullPointerException` / 返回 `null` 表达业务拒绝：前者冒泡成 500 且没有错误码，前端无法区分「参数错」与「服务崩了」。

## 错误码命名空间

- 每个域一个枚举，`implements BaseError`，放在 `common/exception/`，与域同名（认证线即 `AuthErrorEnum`）。
- 认证线固定七个，不多不少：`UNAUTHENTICATED`、`EMAIL_UNVERIFIED`、`CROSS_SITE_REJECTED`、`INVALID_CODE`、`CAPTCHA_INVALID`、`RATE_LIMITED`、`VALIDATION_FAILED`。
- **新增错误码属于契约变更**：先改 spec，再改枚举，最后改前端映射。三步任一跳过都会留下一处无人知晓的漂移。
- 跨域共用的码只在定义它的域里出现一次；别的域引用它，不复制一份同名字面量。

## 分页

**尚未落地**（首个使用者是 posts 列表）。先定方向，避免各写一套：

- 列表端点默认 `limit=20`，上限 `100`；超上限按上限截断，不报错。
- 游标**不透明**（服务端编码，客户端不得解析或构造），响应返回 `nextCursor`，`null` 表示到底。
- 非法游标 → `400 + VALIDATION_FAILED`，不静默退回首页。
- 不使用 `offset` 分页：列表在翻页期间有插入时，offset 会跳行与重复。

引入时把这一节改为「现状」，并补一条能拦住「`limit` 超上限未截断」的测试——文档写成什么样都不会自己生效。

## 真源声明

- `AGENTS.md` — 三层分工、六条硬规则、闸门约定
- `docs/db-design-spec.md` — 数据库命名、主键策略、公共字段与数据类型（§2–§4）
- `openspec/specs/` — 各能力的可验收行为，含错误码固定集合与响应字段白名单

本文不重述以上内容。发现自己在抄规则时，先回到真源。

## 依赖现状

- `spring-boot-starter-web` — HTTP 层与内嵌容器
- `spring-boot-starter-data-jpa` — 持久化
- `spring-boot-starter-validation` — 请求参数校验
- `spring-boot-starter-data-redis` — 会话、限流桶与验证码存储
- `spring-security-crypto` — 只取 BCrypt，不引整个安全框架
- `mysql-connector-j` — JDBC 驱动
- `jjwt-api` — JWT 签发与校验的编译期 API
- `jjwt-impl` — JWT 运行时实现
- `jjwt-jackson` — JWT 声明的 JSON 编解码
- `spring-boot-starter-test` — 单元测试与容器装配测试

## 拟引入

- `spring-boot-starter-security` — **当前刻意不引**。鉴权已由自研 `HandlerInterceptor` 与 `AuthResponseGuard` 覆盖，引入它会同时带来过滤器链语义、默认登录页与 `SecurityContext` 三套并行机制。若要引入，先证明现有拦截器做不到的诉求，再单独立项。

## 机械守卫

- `11-conventions-check.ps1` — 分层依赖方向（`dao`/`service` 不得 import `web`，`common` 不得 import 业务层），以及本文四个固定小节与真源路径的有效性
- `10-contract-check.ps1` — 后端 DTO 与前端契约的字段名、类型一致
- `02-test.ps1` — 行为与容器装配，含出站守卫的「未标记即失败」用例
- `03-static-guard.ps1` — 禁止 `TODO` / `System.out` / `@Disabled`
