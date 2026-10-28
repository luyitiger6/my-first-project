# Tasks

## 1. 持久化结构与配置

- [x] 1.1 在 `backend/src/main/resources/schema.sql` 建账户表：未注销账户邮箱唯一（软删除下用 `active_email` 生成列参与唯一键）、令牌版本、密码哈希、状态 CHECK 三值、注销时间；验证空库执行后表存在、重复执行无副作用、且插入两条相同有效邮箱必定失败
- [x] 1.2 在同一个 `schema.sql` 建会话与吊销表：账户外键（`ON DELETE RESTRICT`）、`jti` 唯一索引、过期时间、吊销时间；验证 `jti` 唯一索引存在、引用不存在账户的插入被外键拒绝
- [x] 1.3 接入 Redis 客户端（`127.0.0.1:6606`，独立 db index 3，凭据走环境变量），把图形码 2 分钟、注册码与重置码 5 分钟的 TTL 提取为外部配置；验证 Redis 可连、db 3 可选中、凭据正确。键前缀 `wc:` 与「缓存不可达时链路失败」分别随 4.1 的首个缓存键、8.5 的集成验收落地。实测 db 3 两次出现 48 个瞬时键、数分钟后清空，独占性不成立——与其它项目共用该 index，隔离依赖 `wc:` 前缀
- [x] 1.4 引入 Spring Data JPA 与 MySQL 驱动，数据源指向 `127.0.0.1:8806` 的 schema `wanderchain`（凭据走环境变量，不触碰 `green-note` 与 `ai_chat_gate`），`spring.sql.init.mode=always` + `ddl-auto=none`；验证应用在该库上启动、两表由 `schema.sql` 建出、`mvn dependency:tree` 中无 flyway 残留
- [x] 1.5 把限流参数（账户连续失败 5 次后要求图形码、来源 10 分钟 20 次、`Retry-After` 60 秒）、重发冷却、比对失败上限提取为外部配置，并验证缺失配置时启动报错而不是取隐式默认值。实测发现 Spring Boot 的 Binder 会把解析不出的 `${...}` 原样保留、`@NotBlank` 拦不住，已在 `AuthProperties` 紧凑构造器中显式拦截，并有 4 条绑定回归测试
- [x] 1.6 把 `V1__init_ai_chat.sql` 搬到 `db/ai-chat/schema.sql`，并把 `06-flyway.ps1` 改写为 `06-schema-check.ps1`（执行器从 `flyway:migrate` 换成 mysql 客户端，断言清单不变），在同一闸门内新增 `wanderchain` 库的 auth 表断言；验证两个 schema 各建各的表、重复执行均无副作用
- [x] 1.7 新增 `harness\checks\09-redis-check.ps1`：只验连通与选中的 db index（不写业务键、不建容器），并同步 AGENTS.md §6 目录地图与 `<!-- harness-checks: ... -->` 标记；验证 Redis 不可达时闸门 exit 1、`07-doc-consistency` 仍通过
- [x] 1.8 为 `database-baseline` 写 delta：把「后端运行期不依赖数据库」改为「后端 MUST 依赖数据库与缓存」，把「结构 SHALL 仅通过版本化迁移变更」改为「由受版本控制的 DDL 脚本定义」；验证 `openspec validate --strict` 通过
- [x] 1.9 改写 AGENTS.md §6/§7/§9 与 `<!-- harness-checks: ... -->` 标记（06 改名、09 新增、运行期依赖表述），验证 `07-doc-consistency` 通过

## 2. 用户状态机与凭证哈希

- [x] 2.1 定义含三值的状态枚举与允许迁移表，验证覆盖「未定义迁移被拒绝」的单测通过
- [x] 2.2 实现具名迁移方法（注销），验证每条迁移的单测覆盖合法与非法两种入口
- [x] 2.3 实现密码 bcrypt 哈希与校验，验证持久化记录中不存在明文密码的单测通过（`common/security/PasswordHasher` 接口 + `BcryptPasswordHasher` 强度 10；`Account.passwordMatches` 以「传入校验器」方式比对，哈希不出实体（D5）；`BcryptPasswordHasherTest` 4 例验证盐内嵌、同明文两次哈希不同、非法输入返回 false，`AccountTest.passwordIsPersistedAsHashOnly` 反射读 `passwordHash` 断言不含明文）
- [x] 2.4 实现账户维度连续失败计数（成功登录清零、计满后要求图形码）与来源维度限流窗口（超阈返回 429），用小阈值验证「达阈值后要求图形码」「成功登录后不再要求」「来源超阈 429」三个单测（`service/auth/LoginThrottle`：账户键 `wc:login:fail:acct:<id>` 只由成功登录清零，TTL 30 天仅防键堆积；来源键 `wc:login:fail:src:<key>` TTL 取 `source-window`；INCR 与 PEXPIRE 合成一个 Lua 脚本保证原子，避免进程中断后该来源被永久拒绝；邮箱不存在时用 `recordSourceFailure` 只占来源额度。`LoginThrottleTest` 4 例连真实 Redis、阈值取 2/3，覆盖达阈值要求图形码、成功清零、来源超阈携带 Retry-After、单来源撞多账户共用额度。spec 第 104 行的「递增的等待」不在本任务，随 5.3 登录端点落地）
- [ ] 2.5 验证 `deleted` 为终态：对已注销账户执行登录、取码、注册的组合，单测断言状态不被改写；同时验证同一邮箱可注册出新账户（新对外标识），旧账户行保持 `deleted`
- [ ] 2.6 断言本变更无任何端点会置入 `email_unverified`：遍历端点清单用合法输入调用，库内状态无新建或变更；并用测试夹具造出该状态验证登录返回 `403` + `EMAIL_UNVERIFIED` 且状态不变

## 3. 令牌签发与即时失效（JWT + 服务端校验点）

- [x] 3.1 实现 JWT 签发（HS256，载荷含 `sub`/`ver`/`jti`/`iat`/`exp`，绝对 7 天，密钥走外部配置），以 `Set-Cookie: HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` 下发（生产加 `Secure`），验证响应体不含令牌、cookie 属性齐备、缺密钥时启动失败（`service/auth/TokenIssuer` 用 `sub=publicId`、`ver=tokenVersion`、`jti=UUID`，逐次签发唯一；签发时刻由调用方传入，测试才能断言 exp−iat 恰为 `session-ttl`；密钥短于 256 位时构造即抛 `WeakKeyException`。`service/auth/AuthCookie` 是 cookie 的唯一写入点，属性一次写齐，`Secure` 由新增配置项 `wanderchain.auth.cookie-secure` 决定而不按 profile 猜。`TokenIssuerTest` 4 例 + `AuthCookieTest` 3 例；「缺密钥启动失败」沿用 1.5 的 `AuthPropertiesBindingTest`（本次新增「缺 cookie-secure 也失败」，共 5 例）；「响应体不含令牌」在本任务只证到「写 cookie 不产生 body」，端到端断言随 5.3 登录端点)
- [x] 3.2 实现受保护请求从 cookie 读取令牌并做三步校验（验签与过期、`jti` 未被吊销、账户 `active` 且 `ver` 一致），验证被篡改、过期、已吊销、未携带 cookie 四类请求均返回 401（`dao/auth/entity/AuthSession` + `AccountRepository`/`AuthSessionRepository`；`TokenVerifier` 三步任一不过均返回 empty 且不区分原因，避免变成探测面；`AuthInterceptor` 只读 cookie，失败抛 `BizException(UNAUTHENTICATED)` 由 GlobalExceptionHandler 统一成 `{code,message}`。`TokenVerifierTest` 7 例逐条只破坏一步（有效/篡改/过期/会话未登记/已吊销/账户已注销/版本落后），`AuthInterceptorTest` 5 例用 MockMvc 断言四类 401 与有效令牌 200；探针控制器是测试夹具，真实端点随 5.6。两个测试类都用 `@Transactional` 回滚，实测测试后 `accounts`/`auth_sessions` 各 0 行）
- [x] 3.3 实现注销与密码重置时令牌版本自增，验证该账户全部旧令牌在下一次请求即被拒（`Account.revokeAllTokens()` 是唯一自增入口，`delete()` 内部调用它，密码重置走同一条路；`TokenVerifier` 第三步比对 `ver`，不匹配即拒，因此不需要逐条吊销旧会话。`AccountTest` 新增 2 例（注销自增、重置路径自增），`TokenVerifierTest.rejectsTokensAfterVersionBump` 由反射夹具改为调用真实具名方法）
- [x] 3.4 实现登出：吊销当前 `jti` 并清除认证 cookie（同名 cookie 置空 + `Max-Age=0`），验证登出后该令牌不可再访问、同账户其他令牌不受影响（`service/auth/VerifiedToken` 让校验结果同时带出账户与 `jti`——登出要吊销「当前这一张」，只传 `Account` 的话控制器只能再解析一遍 cookie；`AuthCookie.clear` 下发的清除 cookie 与下发时逐项属性一致，少一项就会被浏览器当成另一个 cookie，原件留在原地；`service/auth/LogoutService` 按 `jti` 查会话，已吊销或不存在直接返回，登出幂等。`LogoutTest` 3 例：只吊销当前令牌（同账户另一张仍可用）、响应带清除 cookie、第二次登出被拦为 401；`AuthCookieTest` 新增第 4 例断言清除 cookie 的属性。真实登出端点随 5.6）
- [x] 3.5 实现写请求的来源校验（`Origin` 优先，缺失时回退 `Referer`，两者皆缺则拒绝），不匹配时返回 `403` + `CROSS_SITE_REJECTED` 且先于凭证判定；验证跨站 POST 被拒、同源通过、缺失两条拒绝（spec 所说的「已登记站点来源」落地为新增配置项 `wanderchain.auth.allowed-origins`（`@NotEmpty`，缺项即启动失败）——它是登记清单而不是推导结果，子域改了没登记就自动被拒。`service/auth/OriginGuard` 只拦 POST/PUT/PATCH/DELETE，GET 放行；`Referer` 先拆出 scheme://authority 再比，解析失败按不可信处理；`Origin: null`（沙箱 iframe）同样拒。顺序由 `OriginGuard.ORDER=0` 与 `AuthInterceptor.ORDER=10` 两个常量确定，`config/WebMvcConfig` 是生产装配点：来源校验覆盖 `/api/**`，认证拦截器按「默认保护 + 排除 6 个公开路径」覆盖 `/api/auth/**`——忘排除的后果是 401 而不是少一道保护。`OriginGuardTest` 14 例：跨站 403 且探针计数为 0、同源与 127.0.0.1 两种写法通过、未登记子域被拒、Referer 回退与跨站 Referer 与非法 Referer、两头部均缺、`Origin: null`、跨站 + 无效凭证返回 CROSS_SITE_REJECTED 而同源 + 无效凭证才轮到 401（对照组证明两个拦截器都在且顺序正确）、四类写方法同等对待、GET 豁免、归一化；`AuthPropertiesBindingTest` 新增第 6 例「缺 allowed-origins 启动失败」。「同源写请求通过」在本任务只证到拦截器层，经 Next 代理的端到端链路随 8.1——前端 `route.ts` 当前不转发 `Origin`/`Referer`/`Cookie`，接入时需一并补）

## 4. 注册验证码链路（图形码 + 邮箱注册码）

- [x] 4.1 实现图形码生成端点（JDK 手绘 4 位字符、不加重度扭曲与干扰线、高对比度，`captchaId` 不携带邮箱，答案摘要入缓存），验证同一 `captchaId` 只能校验一次、答错即作废（`service/auth/CaptchaService` 用 `BufferedImage` 手绘 120×40 图，逐位微幅上下浮动、不旋转不加干扰线；字符集剔除了 0/O、1/I/L 五个看不清时最容易混的字符，可读性优先于字符集大小。答案用 `service/auth/CodeHasher`（HMAC-SHA256 + 服务端密钥，`purpose` 前缀做域分离）摘要后才进 `wc:captcha:<uuid>`，键与值都不含明文；校验走 `GETDEL`（`getAndDelete`）在一次往返里完成读+删，拆成 GET 再 DEL 的话两个并发请求能读到同一个答案，而「一次性」正是这套码唯一的防刷手段。`CaptchaTest` 9 例：UUID + PNG 魔数、缓存只有 64 位 hex 摘要、答对后同一 id 即废、答错即废（之后连正确答案也不认）、未知 id 不抛异常、大小写与空白宽容、TTL 取配置、过期失效、端点免认证（同时验证 `WebMvcConfig` 的公开路径排除清单生效）。测试用包级 `issue(answer)` 指定答案——生产路径的答案生成后立刻被摘要、图片无文本，否则只能穷举 4 位组合）
- [x] 4.2 实现注册码换发端点：先校验图形码，再生成 6 位数字、HMAC 绑定邮箱后写入缓存 5 分钟，验证图形码错误时返回 400 与 `CAPTCHA_INVALID` 且不投递（`service/auth/RegisterCodeService`：先消费图形码再发码——反过来一个错图形码也能触发投递，这道门槛就退化成装饰。键 = `wc:code:register:` + 邮箱的 HMAC 摘要（键就是那个邮箱，所以 A 的码拿去提交 B 必然落空，绑定不需要额外字段）；值 = 6 位码的 HMAC 摘要，补零到 6 位（前导零是码的一部分）。投递走 `VerificationCodeSender` 端口，`OutboxVerificationCodeSender` 是模拟实现（D8：进程内 outbox，无任何 HTTP 端点能读出明文）。`RegisterCodeTest` 7 例：202 + 投递一条 6 位码 + 缓存只留摘要、错图形码 400 且零投递零留痕、图形码用掉即废、缓存值不含明文且键不含邮箱、邮箱先规范化、空邮箱 `VALIDATION_FAILED` 且不消耗图形码（无效请求不该烧掉一次性凭证）、跨站请求先被 `OriginGuard` 拦下且图形码不被消耗。全部请求带 `Origin`——这是写请求，生产装配里来源校验就挂在这条路径上。「只在非生产 profile 生效」与日配额随 4.8、4.9）
- [x] 4.3 实现注册提交时的缓存比对（超过存活时间、一次性、失败计数上限），验证过时码、重复使用、超限作废三个测试均不创建账户（`RegisterCodeService.verify`：比对与删除放在一个 Lua 脚本里，返回三态——`-1` 键不存在、`0` 存在但不匹配、`1` 匹配且已删除；分两步（GET 再 DEL）的话两个并发提交能拿到同一个「匹配」。只有 `0` 会记失败：没发过码的邮箱进来就拒绝，不给它凭空长出一个计数键。失败计数同样是脚本写的（`INCR` 与首次 `PEXPIRE` 一次完成），分两步时进程死在中间会让计数键永不过期。达 `maxVerifyAttempts` 时主键与计数键一起删——码作废，必须重新走图形码换发。发码时顺手清掉计数键，上一次的失败不拖累新码。`RegisterCodeVerifyTest` 9 例：码对且此后同码失效、过期（`PEXPIRE 1ms` 后轮询到键消失）拒绝且不留计数、错一次拒绝但码还在（一次手滑不该让用户重走图形码）、失败达上限后连正确码也进不去、重新发码清零计数、没发过码不产生计数、空输入不消耗仍然有效的码、邮箱大小写与空白、码带首尾空白。「不创建账户」这半句在服务层无法证——本任务只证到「拒绝 + 缓存键已抹掉」，端到端断言随 5.1 的注册端点补）
- [x] 4.4 验证比对成功后在同一次处理内删除该缓存键（不依赖 TTL），并验证重复提交同一码仍被拒绝（`deletesKeyInSameCallWithoutWaitingForTtl`：发码后先断言剩余 TTL > 1 秒，`verify` 返回后键已不在——「删了」与「过期了」在 `hasKey` 看来是同一件事，只有 TTL 能区分；`repeatedSubmissionIsRejectedWithoutCountingAsFailure`：重复提交不仅被拒，也不记一次失败——键已不在时 Lua 返回 `-1`，根本不进计数分支，否则用户手抖重发一次就白丢一次机会。两条断言都落在 `RegisterCodeVerifyTest`，共 11 例）
- [x] 4.5 验证重新发码使旧码主动失效、且冷却窗口内重发返回 429 与 `Retry-After` 且不生成新码（冷却键 `wc:cooldown:register:` + 邮箱摘要，TTL = `resend-cooldown`（60 秒），包级 `cooldownKeyOf` 供测试夹具使用。顺序是「先查、后设，且设在图形码通过之后」：先设的话一个填错的图形码就把用户锁在冷却里 60 秒；只在图形码之后才查，又会让「白烧一张图形码」成为探测冷却状态的门票。落键用 `setIfAbsent` —— 并发重发时只让一个落下。`Retry-After` 取剩余毫秒向上取整，「还要等几秒」向下取整会让客户端踩在秒边界上提前到达。重新发码使旧码失效是覆盖写的自然结果，不靠额外删除。`RegisterCodeCooldownTest` 5 例（走 HTTP：`Retry-After` 是响应头，只有穿过 `GlobalExceptionHandler` 才算真的发得出去）：冷却内 429 + `Retry-After` 在 1~60 且主键摘要未变、冷却命中不烧图形码、图形码填错不启动冷却、冷却按邮箱计、冷却到期后重发且旧码失效。夹具在 `@BeforeEach` 主动重置三个键而不是只靠事后清理——冷却键一旦漏登记会以 60 秒寿命跨过好几个测试方法，让下一个测试在第一个请求就 429，那种失败现场极难归因（本轮就是这么踩到的）。连带修正 `RegisterCodeTest.consumesCaptchaOnFirstUse`：同邮箱再提会先撞冷却，改换一个邮箱才看得到「图形码已被消耗」这件事本身）
- [x] 4.6 验证反复调 `GET /api/auth/captcha` 均返回新 `captchaId`、各张图形码在各自存活时间内独立可校验，且不影响已发出的邮箱注册码（「旧 `captchaId` 立即失效」在本任务处修订为「并存」：该端点纯无状态，请求里没有任何字段能说明「这是刚刚刷新页面的那个人」，服务端无从知道该作废哪一张；强制作废需下发 cookie 记住当前 `captchaId`，为一个收益接近零的约束引入服务端会话状态，且会让两个标签页互相作废对方的图形码。spec 的 Scenario 与 design D9 已同步修订并写明理由。`CaptchaRefreshTest` 4 例：连调两次拿到不同 UUID 且两个键都在缓存里、响应是 `data:image/png;base64,` 形式、并存的两张各自能换码（这条只能在服务层验——走 HTTP 拿到的图形码没有答案，答案生成后立刻被摘要且图里无文本）、先发码再刷两次后摘要不变且码仍可校验）
- [ ] 4.7 定义发信端口并实现一个模拟发码程序（写入 outbox 或投递记录表），验证不联网即可跑通「取图形码 → 换注册码 → 注册」全链路
- [x] 4.8 验证模拟实现仅在非生产 profile 生效、且不存在任何返回验证码的 HTTP 接口，用启动测试与端点清单断言两者（`OutboxVerificationCodeSender` 加 `@Profile("!prod")`：生产环境缺真实实现时 `RegisterCodeService` 注入不到 `VerificationCodeSender`，应用直接启动失败——一个看上去能用、却在用户填完表单后才暴露「码没发出去」的认证服务，比启不来糟得多。`SimulatedSenderGuardTest` 4 例：`prod` profile 下真实启动一次并断言异常栈含 `VerificationCodeSender`（用 `SpringApplicationBuilder` + `WebApplicationType.NONE`，不占端口；能启动成功反而说明护栏失手）、`/api/auth` 端点清单白名单（当前恰好两个：`GET /api/auth/captcha`、`POST /api/auth/register-code`，将来多加一个就会红）、换发注册码的响应体为空、图形码响应不含已发出的码。用清单而不是逐个体检响应体：清单是白名单，能拦住「悄悄加一个读码端点」这类新增）
- [x] 4.9 实现邮箱发码日配额（默认 5 封/自然日，注册码与重置码合并计数，键用邮箱摘要 + 日期，冷却与图形码错误不计数），验证「用尽后 429 + `Retry-After` 指向次日零点」「跨日重置」「不区分注册状态」「键不含明文」四条断言（`service/auth/EmailQuotaGuard`：键 `wc:quota:email:` + 邮箱摘要 + `yyyy-MM-dd`；摘要而非明文，因为缓存键会出现在运维工具、慢查询日志与 `KEYS` 输出里。日期进键而不是滚动 24 小时——「每天 N 次」若实现成滚动窗口，用户永远算不出要等到什么时候，自然日边界才能让 `Retry-After` 给出确定时刻。比对与自增在同一个 Lua 脚本里，超限时不增计数（否则计数会涨到没人看得懂的数值）。注册码与重置码共用同一前缀，因此天然合并计数。`Clock` 通过包级构造器注入，让「跨日」与「次日零点」可被固定时钟断言。配额校验位于图形码校验之后、冷却落键之前：spec 要求「图形码错误或冷却命中的请求 MUST NOT 消耗配额」，代价是配额耗尽时图形码已被烧掉，但把配额提到图形码之前就等于允许任何人用任意答案探测「这个邮箱今天发了几封」。`EmailQuotaTest` 6 例：用尽后 429 + `Retry-After` 且不再投递、固定时钟下 10:00 的 `Retry-After` 等于 14 小时、跨日后额度重置、图形码填错不消耗配额、冷却命中不消耗配额（计数仍为 1 且第二张图形码还在，证明拦住它的是冷却）、键不含明文邮箱但带当天日期。「不区分注册状态」随 5.2 的防枚举一起验——那需要「已注册邮箱不投递」的分支）

## 5. Web 接入层与错误契约

- [x] 5.1 实现注册端点：比对注册码通过后直接建 `active` 账户并签发令牌（首次注册即自动登录），验证码错或过时返回 400 与 `INVALID_CODE` 且不建账户（实施时定下两处规格空白：① `publicId` 用手写 26 字符 ULID——48 位毫秒时间戳编 10 字符 + 80 位随机编 16 字符，Crockford Base32 去 I/L/O/U，零依赖且与 schema 的 `CHAR(26)` 逐字一致；同一毫秒不保证单调递增，因为同一毫秒内的排序不是对外标识的需求。② `displayName` 收可选入参，缺省取邮箱 `@` 前那一段，按码点截到 64——`varchar(64)` 计字符而 `String.length()` 计 UTF-16 单元，在 emoji 中间切断会留下半字符。校验顺序是契约：邮箱与密码格式（`common/security/PasswordRules`，8–72 字节且按 UTF-8 计数，因为 bcrypt 只读前 72 字节）→ 验码 → 查重；格式校验放最前，密码不合格时不该白白烧掉用户手里那张码。已注册邮箱预查后抛同一个 `INVALID_CODE`，与 `AccountRepository.findByEmailAndDeletedAtIsNull` 同口径——判定条件用 `deletedAt` 而不是 `status`，否则会出现「查询说邮箱空闲、插入却撞 `uk_accounts_active_email`」的 500；真正堵住「已注册邮箱拿码」的是 5.2 的不投递。`RegisterTest` 12 例（码对建 active 账户 + 令牌能被 `TokenVerifier` 验回 + 会话行落库、响应体检索不到令牌、码错/码过时不建账户且无 cookie、同码用两次只建一个账户、7 字节与 73 字节密码均 400 且 7 字节那条随后能用同一码注册成功、8 个汉字 24 字节可注册、大写带空白邮箱落库为小写、`displayName` 缺省与显式两种、已注册邮箱二次注册与码错误同形且只有一个账户行）+ `UlidTest` 7 例（时间前缀反解、Crockford 字符集、首字符 0-7、字典序即时间序、同毫秒 1000 个不重复、超出 48 位与负时间戳被拒）。`SimulatedSenderGuardTest` 的端点清单白名单同步加入 `POST /api/auth/register`——4.8 的护栏按设计先拦住了这次新增）
- [x] 5.2 实现防枚举：已注册邮箱请求注册码返回 202 但不投递；已注册邮箱提交注册的响应与「注册码错误」逐字段相等，验证两个测试通过（`RegisterCodeService` 增加 `AccountRepository` 依赖，在 `setIfAbsent(cooldownKey)` 之后、生成码之前判「已注册即 return」——**这个位置就是这条 Requirement 的全部**：若提前到冷却键之前，已注册邮箱就能在冷却窗口内反复请求、每次都拿不到 429，等于免费探测「这个邮箱注册没注册」；只有「图形码 → 配额 → 冷却」三道消耗与未注册邮箱完全相同，两条路径才不可区分。已注册邮箱照常烧掉一张图形码、占用一次日配额、落下 60 秒冷却，代价与真实发码一致，只省掉了写码与投递。查重条件用 `findByEmailAndDeletedAtIsNull`，与 `uk_accounts_active_email` 的生成列 `IF(deleted_at IS NULL, email, NULL)` 同口径——用 `status` 判定会让已注销邮箱永远收不到码，用户看到的却是「发码成功」。提交注册这一侧不动：5.1 已经在验码之后查重并抛 `INVALID_CODE`，本轮只补上「已注册邮箱拿不到码」这个前提。`RegisterEnumerationTest` 5 例：已注册邮箱 202 且响应体为空串、投递记录为空、码键不存在；已注册邮箱仍落冷却键且配额计数为 `"1"`（钉住「消耗相同」这一点，删掉它的话把 return 提到冷却键之前也能通过前一条）；未注册邮箱照常投递（**对照组是本类的一半**——只断言「已注册不投递」而不断言「未注册投递」的话，一个把发信整段删掉的实现同样能通过）；已注册邮箱提交注册的响应 body 与「码错误」**字符串逐字相等**（不是状态码相同即可：少一个字段、多一句提示，就等于把结论写在响应里）；已注销邮箱可重新走完整注册并拿到新 `publicId`，旧行仍为 `DELETED`。`02-test` 133 例全绿，`run-all` 十道闸门全 PASS）
- [x] 5.3 实现登录端点与「先凭证后状态」判定顺序，验证三态分别返回 200/401/403 的测试通过（判定落在控制流里而不靠注释约定：`account == null || !account.passwordMatches(...)` 合并成同一个 `UNAUTHENTICATED` 出口，`switch (account.status())` 只在凭证通过之后才执行，控制器里一行状态分支也没有，否则「先凭证后状态」就有了第二个可改坏的地方。账户查询用 `findByEmailAndDeletedAtIsNull`，`deleted` 因此落在「查不到」分支，与「邮箱不存在」「密码错误」三者同形；`case DELETED` 保留为防御分支——当前不可达，但日后谁放宽查询口径也不会顺带漏掉「已注销仍是 401」。过期时间只有一个来源：`LoginResponse.expiresAt`、cookie 的 `Max-Age` 与令牌 `exp` 都取自同一个 `IssuedToken.expiresAt()`。**实施时修订一处规格矛盾**：spec 的「激活账户登录成功」Scenario 原写「响应体包含访问令牌」，与同一 spec 的「令牌 MUST 通过 `Set-Cookie` 下发、登录与注册响应体 MUST NOT 包含令牌明文」直接冲突；5.1 已落地的 `RegisterResponse` 与 design 的端点表都选了后者，故按后者校正该 Scenario，理由记入 proposal。本轮不接限流与图形码（D3 的第 0 步）：来源维度限流要 sourceKey、账户维度要 captcha 入参，属 5.4 / 5.9 的接线范围，届时扩展 `login(...)` 签名；账户不存在时的等价哈希属 5.5。`LoginTest` 4 例走 HTTP 而非直调 service——三态里有两条是「响应不可区分」，只有穿过 `GlobalExceptionHandler` 与真实序列化才算数：`active` 200 + `Set-Cookie` 四项齐备（`HttpOnly`、`SameSite=Lax`、`Path=/`、`Max-Age`）+ 响应体检索不到令牌但含 `publicId` 与邮箱 + `expiresAt` 距 now 落在 `[ttl-5s, ttl]` + 令牌能被 `TokenVerifier` 验回且会话行按 `jti` 落库；`email_unverified` 403 与 `EMAIL_UNVERIFIED`、无 cookie、状态不变；`deleted` 401 与 `UNAUTHENTICATED`、无 cookie；不存在邮箱与密码错误两次响应 **body 字符串逐字相等**（不是状态码相同即可：少一个字段、多一句提示，结论就写进响应里了）。`SimulatedSenderGuardTest` 的端点清单白名单同步加入 `POST /api/auth/login`。`02-test` 137 例全绿（5.2 之后 133 + 本轮 4））
- [ ] 5.4 验证密码错误时未验证账户返回 401 而非 403、且来源限流 429 先于密码比对发生的两个测试通过
- [ ] 5.5 验证账户不存在也执行一次等价哈希校验，用调用计时或校验次数断言防止时间侧信道
- [ ] 5.6 实现当前用户、登出、注销端点（均从 cookie 读取令牌），验证非 active 账户持有效令牌访问返回 401 的测试通过
- [ ] 5.7 实现统一错误结构与固定错误码集合（`429` 附带 `Retry-After`），断言 `deleted` 与凭证错误的响应体逐字段相等、且所有错误码属于该七个值的集合
- [ ] 5.8 实现入参规范化（邮箱 trim + 小写）与密码长度校验（8–72 字节），验证 7/73 字节密码返回 400 且不建账户、大小写变体不会产生第二个账户
- [ ] 5.9 实现来源识别：只采信已登记代理链追加的那一跳、直达请求的转发头不采信、取不到时归入「未知来源」单桶、IPv6 按 `/64` 聚合；验证「伪造转发头不扩容」「未知来源不被放行」「同前缀共用额度」「单来源撞多账户共用额度」四条断言

## 6. 响应安全边界（覆盖用户信息接口）

- [ ] 6.1 实现全局响应包装作为唯一出站通道，验证不经包装的端点写响应无法通过编译或被拦下
- [ ] 6.2 为 `GET /api/auth/me` 建立字段白名单与递归字段路径收集器，验证白名单覆盖 `/me` 全部已返回字段
- [ ] 6.3 断言 `/me` 响应字段路径差集为空、且不含 `password_hash`、`salt`、`verification_code`
- [ ] 6.4 断言 `/me` 响应原文不含已存储的密码哈希字面值，并用一个刻意构造的用例证明该断言会失败
- [ ] 6.5 断言错误响应不含字段值、哈希片段与堆栈信息，验证 4xx/5xx 分支的测试通过（对应 Req 9，不属于 `/me` 字段白名单范围）

## 7. 密码找回（复用两层码链路）

- [ ] 7.1 实现重置码换发端点：复用图形码校验与 6 位码生成，写入缓存 5 分钟；对未注册或已注销邮箱返回 202 但不投递，验证响应体与正常情形逐字段相等
- [ ] 7.2 实现重置密码端点：比对重置码、更新密码哈希、同一次处理内删除缓存键，并验证新密码可立即登录、旧密码被拒
- [ ] 7.3 验证重置成功后该账户全部旧令牌在下一次请求即被拒
- [ ] 7.4 验证重置码一次性、过期、比对失败超限三条分支均不修改密码
- [ ] 7.5 验证重置请求任意次数都不会使账户进入不可登录状态（状态全程保持 `active`）
- [ ] 7.6 验证重置码与注册码共享同一日配额：当天注册用尽的邮箱当天无法再请求重置码，且两个端点的 `Retry-After` 指向同一时刻

## 8. 集成验收

- [ ] 8.1 在真实数据库与 Redis 上跑通「取图形码 → 换注册码 → 注册（收 cookie） → 登录 → 登出（清 cookie） → 重置密码」全链路，验证每一步的响应码、cookie 属性与契约一致
- [ ] 8.2 跑通「连续失败达阈值 → 要求图形码 → 来源超阈 429 → 用正确凭证仍可登录成功」全链路，验证账户状态全程不变、前端同源代理透传 429
- [ ] 8.3 执行 `powershell -File harness\run-all.ps1`，退出码为 0
- [ ] 8.4 用 `powershell -File harness\checks\02-test.ps1` 单独复跑，确认契约测试随之执行且非 0 退出码可被检出
- [ ] 8.5 验证缓存不可达时注册与登录链路整体失败而非静默放行：把 Redis 指向不可达端口，断言请求返回 5xx、不创建账户、不签发令牌

## Workflow follow-up

- 归档前处理 `openspec/specs/database-baseline/spec.md` 中与本变更方向相反的要求，避免主 spec 与实现互相矛盾。
- 依赖用户确认后，再运行 `/opsx:archive` 完成归档。
