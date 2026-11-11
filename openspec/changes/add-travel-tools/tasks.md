# Tasks

## 1. 子模块与配置基线

- [ ] 1.1 在 `backend/` 与 `frontend/` 各自从 `main` 切出 `feat/travel-tools-20261111`，与工作区分支对应；验证：三个仓库执行 `git branch --show-current` 均输出该分支名

- [ ] 1.2 新增 `config/TravelProperties`：两个外部地址、连接与读取超时、两档缓存时长、七个城市坐标表；在 `application.yml` 增加 `wanderchain.travel` 段，不写任何 key；验证：`mvn -q compile` 通过，且把任一必需项从 yml 删掉后应用启动失败

## 2. 出站提供者

- [ ] 2.1 新增 `service/travel/WeatherProvider` 接口与 `impl/OpenMeteoWeatherProvider`：按经纬度取当前天气，`RestClient` 显式设置连接与读取超时；验证：单测覆盖成功响应解析、非 2xx、超时三类，超时归一为业务异常而非抛出底层异常

- [ ] 2.2 新增 `service/travel/support/WeatherConditionMapper`：WMO weather code 映射为英文文案；验证：单测覆盖 0、1-3、45/48、51-57、61-67、71-77、80-82、95-99 各段与未知 code 的兜底文案

- [ ] 2.3 新增 `service/travel/CurrencyProvider` 接口与 `impl/ExchangeRateCurrencyProvider`：请求 `latest/CNY` 并裁剪为 JPY/USD/EUR/THB/HKD 五项；验证：单测覆盖正常裁剪、缺币种、`result` 非 `success` 三种响应

## 3. 服务层与缓存

- [ ] 3.1 新增 `service/travel/support/TravelCache`：内存 TTL 缓存，键以前缀区分两类数据；验证：单测覆盖命中、过期后回源、并发读写不抛异常

- [ ] 3.2 新增 `common/exception/TravelErrorEnum`：非法城市与外部源失败两个错误码，实现 `BaseError`；验证：非法城市请求经 `GlobalExceptionHandler` 返回 400 且错误体形状与既有接口一致

- [ ] 3.3 新增 `service/travel/WeatherService` 与 impl：城市白名单校验，缓存 30 分钟，provider 异常归一为 `TravelErrorEnum`；验证：service 单测覆盖缓存命中不调 provider、过期后回源、provider 抛错转业务异常、非法 slug 拒绝

- [ ] 3.4 新增 `service/travel/CurrencyService` 与 impl：缓存 24 小时，输出币种顺序固定；验证：service 单测覆盖 24 小时内不重复调用 provider、返回顺序与固定清单一致

## 4. Web 层

- [ ] 4.1 新增 `web/travel/dto/` 三个 record：`WeatherResponse`、`CurrencyResponse`、`CurrencyRateResponse`；验证：字段名与类型与 `design.md` 的「## 契约」表逐字一致

- [ ] 4.2 新增 `web/travel/TravelController`：两个 GET 端点，响应沿用既有 `ApiResponse` 形状；验证：controller 单测断言两个端点的响应字段集合与契约表一致

- [ ] 4.3 在 `AuthInterceptor.publicRoutes()` 登记 `/api/travel/weather` 与 `/api/travel/currency` 两条 GET；验证：单测断言 `isPublicRoute("GET", 两条路径)` 为 true、`POST` 同一路径为 false

## 5. 前端契约与客户端

- [ ] 5.1 新增 `lib/contracts/travel.ts`：`WeatherResponse`、`CurrencyResponse`、`CurrencyRate` 三个 interface；验证：与 `design.md` 契约表逐字段一致，字段名与类型无出入

- [ ] 5.2 新增 `lib/travel/travel-api.ts`：两个请求封装经 `/api/travel/*` 发出，非 2xx 与网络异常归一为可展示的失败结果；验证：单测覆盖成功解析、非 2xx、网络抛错三条路径

## 6. 前端组件

- [ ] 6.1 新增 `components/travel/travel-popover.tsx`：非模态浮层基座，触发器带 `aria-expanded`/`aria-controls`，支持 Escape 关闭与焦点归还，不设 `aria-modal`、不锁页面滚动；验证：单测覆盖开合、Escape、焦点归还三个行为

- [ ] 6.2 新增 `components/travel/weather-tool.tsx`：城市下拉限七个城市、默认 beijing、localStorage 记忆、展示城市名/气温/状况/风速/观测时间、失败态与重试；验证：单测覆盖首次默认北京、切换后重开沿用、切换城市失败时不残留旧城市数据

- [ ] 6.3 新增 `components/travel/currency-tool.tsx`：固定五币种、按数量级取两位或四位小数、展示更新日期、署名链接带 `rel="noopener noreferrer"` 与新标签、失败态与重试；验证：单测覆盖 `23.7139 -> 23.71`、`0.149528 -> 0.1495`、署名链接属性、失败态不展示数值

- [ ] 6.4 在 `site-header.tsx` 的 `actions` 挂两个图标入口，处理窄屏宽度；验证：单测确认两个入口存在且分别打开对应浮层

## 7. 集成与工程登记

- [ ] 7.1 在 `harness/checks/10-contract-check.ps1` 的 `$contractPairs` 增加 travel 一组（后端目录 `web/travel/dto`、前端 `lib/contracts/travel.ts`）；验证：`powershell -File harness\checks\10-contract-check.ps1` 退出码 0，且输出行数从 6 组增至 7 组

- [ ] 7.2 后端编译与受影响的单测；验证：`mvn -q test` 退出码 0

- [ ] 7.3 前端类型检查与受影响的单测；验证：`npx tsc --noEmit` 与 `npm test` 退出码 0

- [ ] 7.4 真实链路走通：启动后端与前端，在站点头部各打开一次天气与汇率浮层；验证：天气四项与汇率五项均可见，署名链接可打开

## Workflow follow-up

- 归档前在 `docs/spec-evidence.json` 为 `wanderchain-travel-currency` 与 `wanderchain-travel-weather` 的两个能力补登记，每条 Scenario 归入 verified 或带 reason/registeredOn/unlock 三字段的 deferred。
- 归档后按 `AGENTS.md` §4 集中跑一次完整验收（`harness\run-all.ps1`）。
