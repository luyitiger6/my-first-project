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
├── dao/<域>/                   entity/ + repository/ + converter/
├── service/<域>/               接口 + impl/ + support/ + model/
└── web/<域>/                   Controller + dto/ + interceptor/
```

业务层的依赖方向**单向**，箭头表示左侧依赖右侧，不得反向依赖：

```
web  -->  service  -->  dao  -->  common
```

这是分层方向示意，不代表现有闸门自动覆盖所有依赖关系；机械校验范围以下列禁止项为准。

具体禁止项（由 `11-conventions-check.ps1` 机械校验）：

- `dao/` 不得 import `web/`
- `service/` 不得 import `web/`
- `common/` 不得 import `dao/` / `service/` / `web/`

### 总则：简单平铺，复杂按需聚合

包结构首先服务于阅读和维护。简单功能放在所属模块已有的职责目录中；当功能形成边界清晰的一组文件，继续平铺已经不利于定位时，才按功能聚合为子包。不能仅因为“它是一个子功能”就再复制一套目录。

本项目顶层按技术层组织，层内按业务模块组织：`dao/<域>`、`service/<域>`、`web/<域>`。`auth` 与 `post` 是业务模块；`post/interaction` 是帖子模块内的功能分组，不因此成为独立部署或独立构建的模块。

### 1. 简单功能默认平铺

- 多个服务接口可以在同一个模块包根并列，分别将实现、模型、辅助类放入已有职责目录；平铺不等于合并成一个大 Service。
- 当前 `auth` 保持这种结构，不为登录、注册、验证码各建一套嵌套目录。
- 没有明确的聚合收益时保持平铺；不为了未来可能增长提前拆包。

以下目录树为代表性节选，不是每个模块必须照抄的模板：

```text
service/auth/
├── LoginService.java
├── RegisterService.java
├── impl/
│   ├── LoginServiceImpl.java
│   └── RegisterServiceImpl.java
├── model/
│   ├── LoginAttempt.java
│   └── Registration.java
└── support/
    ├── EmailNormalizer.java
    └── EmailCodeFlow.java
```

### 2. 复杂功能按需聚合

考虑增加功能子包时，需要同时说明：
- 功能边界是什么，哪些文件主要服务于它；
- 当前平铺会造成什么实际定位或维护困难；
- 聚合如何改善这些困难，跨功能共享类型仍归哪里。

接口、实现、模型、支撑件形成相对完整的一组时，可放在同一功能子包下。当前 `post/interaction` 保留为这种组织方式的例子；不由此自动继续拆出 `comment/impl/model`、`vote/impl/model` 等更深目录。

以下同样是目录节选：

```text
service/post/
├── PostService.java
├── impl/
│   └── PostServiceImpl.java
├── model/
│   ├── PostCommand.java
│   └── PostView.java
├── support/
│   └── PostReadAccess.java
└── interaction/
    ├── PostInteractionService.java
    ├── impl/
    │   └── PostInteractionServiceImpl.java
    ├── model/
    │   ├── CommentView.java
    │   ├── VoteView.java
    │   └── BookmarkView.java
    └── support/
        └── CommentCursor.java
```

不设置“达到几个文件就必须分包”的阈值；有独立接口、有若干张表、未来可能拆走，都不是单独的充分理由。每增加一层功能目录，都要重新说明实际收益，不能机械递归套用结构。

### 3. 目录职责统一，目录形状不必一致

| 位置 | 职责 |
|---|---|
| `service/<域>/` 或经审阅的功能包根 | 服务接口；Controller 依赖接口而非实现 |
| 该服务包的 `impl/` | 接口实现与业务编排 |
| 该服务包的 `model/` | 服务调用的入参、结果与值对象，例如 Command、View、Result、Page |
| 该服务包的 `support/` | 辅助校验、游标、限流等协作件；不是第二个业务编排入口 |
| `dao/<域>/entity/` | 持久化实体；仓储与持久化转换放在同层对应职责目录 |
| `web/<域>/dto/` 或对应功能包的 `dto/` | HTTP 请求与响应契约；Controller 留在所属 web 包 |

- 目录按实际类型创建，不为凑齐 `impl/model/support` 建空壳。
- service 层分子包不意味着 dao、web 各层必须同步复制相同包树；各层按自己的文件归属组织。
- 多个功能共同使用的服务类型优先留在该模块共同的职责目录，不复制多份，也不因同模块共享就搬进全局 `common`。
- `auth` 平铺与 `post/interaction` 聚合可以并存。统一的是职责和分包依据，不是所有模块目录深度完全相同。

### 4. 类型按所属边界放置

`model` 在这里表示服务层的数据载体，不是所有模型的总目录，也不只允许 Service 实现类引用。Controller 调用服务时可以使用这些类型；HTTP 请求与响应仍使用 web 层 DTO。

例如：持久化对象位于 `dao/post/entity/Post`，服务详情结果位于 `service/post/model/PostView`，HTTP 响应位于 `web/post/dto/PostResponse`。保持既有转换及字段白名单，不将实体直接用作响应，也不将服务入参和结果搬入 Controller 包而造成 service 对 web 的反向依赖。

本项目没有一个同时包含 dao、service、web 的统一 `post/` 根目录，因此不另建跨层的 `post/model` 作为杂物包。其他项目采用模块优先布局或独立契约模块可以有不同放置方式；本规则不把当前目录方案推广为唯一正确架构，也不要求为简单数据机械新增一套 BO。

### 5. 新增或加深功能子包先说明理由

在相应 change 的设计中，用简短说明和目录示例写清：功能边界、代表性类型、平铺的实际问题、聚合收益、共享类型位置。沿用项目的人工审阅后实施流程；不能把“已写进设计”或“已归档”本身当作用户明确批准的证据。

没有实际收益依据时保持平铺。已有代码不因为新增这条规则就批量搬迁；需要调整时，在涉及该结构的变更中单独说明影响，不在其他功能开发中顺手重排。

分包粒度与聚合收益由人工审阅；现有闸门的覆盖边界见本文“机械守卫”小节。

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

- 请求体与响应体都是 Java `record`，放在 `web/<域>/dto/`；采用功能子包时，放在对应 web 功能包的 `dto/`，不与服务层 `model/` 混放。
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

本文不完整复制以上真源的规则正文；分包粒度的操作说明与目录示例在本文集中维护，其他约定通过索引引用，不另存平行版本。

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

- `11-conventions-check.ps1` — 约定索引、四个固定小节、真源与闸门路径、依赖描述的自洽性，以及列出的分层 import 禁止项（`dao`/`service` 不得 import `web`，`common` 不得 import `dao`/`service`/`web`）；不判断业务复杂度、子包深度或聚合收益
- `10-contract-check.ps1` — 后端 DTO 与前端契约的字段名、类型一致
- `02-test.ps1` — 行为与容器装配，含出站守卫的「未标记即失败」用例
- `03-static-guard.ps1` — 禁止 `TODO` / `System.out` / `@Disabled`

人工审阅范围：分包粒度、共享类型归属与聚合收益在对应 change 的设计审阅中判断。闸门通过只证明其实际覆盖的检查通过，不能代替分包合理性判断，也不能当作用户批准某项设计的证据。
