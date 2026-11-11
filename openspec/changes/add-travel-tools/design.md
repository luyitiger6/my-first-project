# Design

## Context

现有约束决定了这次的形状：

- 后端 Spring Boot 3.5.5 / Java 17，`spring-boot-starter-web` 已带 Spring 6.1 的 `RestClient`，但**全仓至今没有任何出站 HTTP 调用**，这是第一次
- 前端已有 `/api/[...path]` 同源代理，逐段编码后只转发到配置的后端 origin；新增端点零改动即可透传
- `AuthInterceptor` 是「默认拒绝 + 代码内公开路由表」，新端点漏登记的结果是 401
- header 的 `actions` 已有三个元素（AI 助手、消息角标、账号菜单），760px 断点下整行换行
- 10 号闸门的契约表对 `Map` 类型 fail-closed：`Map<String, Double>` 无法映射，响应体要用列表表达

## Goals / Non-Goals

**Goals:**

- 两个工具端到端跑通，外部数据源可以在不改端点、DTO、前端的前提下替换
- 不新增任何后端第三方依赖
- 外部额度不会被自家流量打爆

**Non-Goals:**

- 不做 MCP Server / MCP Client
- 不做任意币种对、金额输入或双向换算器
- 不做自由城市输入、历史天气与多日预报
- 不把上次选择落库到账户，浏览器本地即可

## Decisions

### D1 出站调用统一走后端，前端不直连外部 API

汇率端点虽然无 key、支持 CORS、浏览器可直连，仍然绕后端一次。理由是**「数据源每天只更新一次」让服务端缓存收益极大**：缓存 24 小时后整站一天只打外部 1 次，而前端直连是每个用户每次打开都打一次，流量上去后 IP 限流变得不可控。天气则必须走后端才有地方放 key。

替代方案：汇率前端直连、天气走后端。被否决的原因是两套超时、错误与新鲜度语义，前端要维护两个外部域名的失败分支。

### D2 两个出站接口隔离数据源

`WeatherProvider` 与 `CurrencyProvider` 只暴露「按城市取天气」「取以 CNY 为基准的汇率表」，实现放 `impl/`。OpenWeatherMap 的 key 生效后新增一个实现、改一处装配即可切换，控制器、DTO、前端、缓存全部不动。

这也是本次 MCP 结论的落点：将来 AI 助手接入 LLM 时，这两个接口正好是 MCP tool 的实现载体。

### D3 缓存放进程内存，不放 Redis

缓存的目的不是性能，是**不透支外部额度**。进程重启丢缓存只意味着多打一次外部接口，代价可忽略；而内存实现让 service 单测不必依赖 Redis。

键与时长：汇率 `CNY` 一条、24 小时（与数据源更新频率对齐）；天气按城市 slug 一条、30 分钟。7 城 × 48 次 = 336 次/天，对 10000 次/天的额度留有充分余量。

替代方案：复用既有 Redis（景点榜单缓存同款做法）。被否决的原因是本次是实验性接入，单实例部署下没有共享缓存需求，多一个外部依赖就多一类测试失败面。

### D4 汇率响应体用列表而非 Map

`Map<String, Double>` 是这道题最自然的表达，但 10 号闸门的类型映射表对 `Map` fail-closed，契约表无法声明、三方比对直接跳过——等于这个响应体不受管治。

改用 `List<CurrencyRate>`，`CurrencyRate` 是 `{ code, value }` 的 record。契约表因此能逐个字段声明，且将来加币种不用改 DTO。

### D5 天气按经纬度查询，不按城市名

`q=Xi'an,CN` 需要处理撇号编码，且城市名匹配存在歧义（境外同名地点）。固定坐标没有这些问题。七个城市的坐标作为 `TravelProperties` 的配置项，与城市 slug 一一对应；配置里出现未知 slug 或缺少城市即启动失败，与项目既有「凭据/配置缺失即失败」的口径一致。

### D6 天气状况由后端映射成英文文案

Open-Meteo 返回的是 WMO weather code（0=晴、61=雨……）。映射表放后端支撑件而不是前端，理由是它是数据契约的一部分：前端只该拿到「可展示的英文文案」，不该知道上游用的是哪家的编码体系。切换数据源时只需新实现给出同样的文案集合。

### D7 公开路由表显式登记两条 GET

天气与汇率是未登录访客也该能用的工具。在 `AuthInterceptor` 的 `publicRoutes()` 增加：

```
/api/travel/weather  -> GET
/api/travel/currency -> GET
```

这两条同时也是「其余路径仍然默认拒绝」的对照：`/api/travel/*` 的任何非 GET 方法都不登记。

### D8 头部入口是非模态浮层，不锁页面滚动

与 AI 助手面板不同：AI 助手是模态对话框（锁滚动、焦点陷阱），天气与汇率是**随手查一下就走**的小工具，锁滚动反而打断浏览。所以采用非模态 popover：触发器带 `aria-expanded` 与 `aria-controls`，面板不用 `aria-modal`，不装焦点陷阱，但保留 Escape 关闭与焦点归还——这两条是键盘可用性的底线，不是模态专属。

面板用绝对定位挂在 header 内，窄屏下改为占满可用宽度。两个触发器只放图标不放文字，控制 `actions` 的宽度增长。

### D9 城市选择记在 localStorage

只作用于当前浏览器，不依赖登录态（spec 明写）。键前缀沿用项目的 `wanderchain.` 习惯；读到非法 slug 时回落 `beijing`，不抛错。

## 契约

### GET /api/travel/weather?city=<slug>

| 接口 | 字段 | 类型 |
|---|---|---|
| WeatherResponse | city | string |
| WeatherResponse | cityName | string |
| WeatherResponse | temperatureC | number |
| WeatherResponse | condition | string |
| WeatherResponse | windSpeedKph | number |
| WeatherResponse | observedAt | string |

### GET /api/travel/currency

| 接口 | 字段 | 类型 |
|---|---|---|
| CurrencyResponse | base | string |
| CurrencyResponse | updatedAt | string |
| CurrencyResponse | rates | Array<CurrencyRate> |
| CurrencyRate | code | string |
| CurrencyRate | value | number |

## Risks / Trade-offs

- **[Open-Meteo 无可用性承诺]** → 失败态显式呈现并给重试入口，不静默回落到旧值；provider 接口保证可换源
- **[天气缓存 30 分钟意味着最多滞后半小时]** → 界面展示观测时间，不声称「当前实况」
- **[汇率 24 小时缓存意味着可能滞后一天]** → 数据源本身每天只更新一次，界面展示更新日期，不出现实时性表述
- **[header 窄屏可能拥挤]** → 两个入口只放图标，`aria-label` 承担可读性；面板窄屏下占满宽度
- **[OpenWeatherMap key 当前返回 401]** → 本次以 Open-Meteo 落地，切换成本被 D2 压到一个实现类
- **[首次出站调用引入超时风险]** → `RestClient` 显式设置连接与读取超时，超时归一为失败态而不是挂住请求

## Migration Plan

无数据库变更、无数据迁移。上线即生效。

回滚：移除 header 的两个入口即回到现状；后端两个端点保留不影响任何既有链路，也可以单独下掉。

## Open Questions

| 问题 | 级别 | 影响的任务 | 默认倾向 |
|---|---|---|---|
| 天气状况的视觉表达用图形符号还是纯文案 | 一般 | 前端天气浮层 | 纯文案 + 一个中性图标位，待视觉定稿 |
| OpenWeatherMap key 生效后是否切换数据源 | 一般 | 不阻塞本次实施 | 先不切，Open-Meteo 额度更宽裕，切换留作后续独立动作 |
