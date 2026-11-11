# Proposal

## Why

旅行者在一个陌生城市里最先要确认的两件事是「现在穿什么」和「这笔钱值多少」。wanderchain 目前把这两件事都推给了站外：用户看到北京三日行程，要另开一个标签页查天气；看到成都火锅人均 80 元，要自己算出合多少日元。

站点头部是每一页都可见的位置，把这两个高频小问题收在这里，用户不必离开社区内容。两个数据源当前都有零成本入口（汇率有无 key 的开放端点、天气可用无需注册的 Open-Meteo），后端已有同源代理与分层骨架，接入成本压到可以一次做完。

## What Changes

- 站点头部工具栏新增两个图标按钮：**天气** 与 **汇率**，点击各自展开一个轻量浮层，关闭后焦点归还触发按钮
- 新增两个后端读端点 `GET /api/travel/weather` 与 `GET /api/travel/currency`，前端经既有的 `/api/[...path]` 同源代理访问
- **天气**：覆盖 7 个既定城市（Beijing / Shanghai / Guangzhou / Chengdu / Xi'an / Hangzhou / Sanya），按经纬度查询，默认北京并记住上次选择；展示气温、天气状况与风速
- **汇率**：以 1 CNY 为基准，一次请求取全表，展示 JPY / USD / EUR / THB / HKD 五个币种
- 后端引入 `WeatherProvider` 与 `CurrencyProvider` 两个出站接口，先落 Open-Meteo 与 ExchangeRate-API 开放端点两个实现
- 汇率在服务端缓存 24 小时（数据源本身每天只更新一次），天气按「城市 × 30 分钟」缓存
- 汇率浮层底部提供 ExchangeRate-API 的署名链接（该端点条款要求署名）

**明确不做**：本次不引入 MCP Server，也不引入 MCP 客户端。外部 API 由后端 service 层直接以 HTTP 调用。理由见 design。

## Capabilities

### New Capabilities

- `wanderchain-travel-currency`: 以人民币为基准的常用币种汇率快速查询，包含头部入口、查询形态、数据新鲜度与署名义务的完整行为约束。
- `wanderchain-travel-weather`: 按城市查询当前天气的快速查询，包含头部入口、城市选择与记忆、经纬度查询口径与外部数据源失败时的降级表现。

### Modified Capabilities

无。本次不改变任何既有能力的需求。头部新增的入口与首页现有的「AI 助手入口」「账号入口」条款并行不冲突，均不需要改写。

## Impact

**后端**（`backend/` 子模块）

- 新增 `service/travel/` 包：出站接口、实现、模型与支撑件
- 新增 `web/travel/` 包：controller 与 dto
- 新增 `config/TravelProperties`：外部地址、缓存时长、城市坐标表，缺失即启动失败
- `web/auth/interceptor/AuthInterceptor` 的公开路由表新增两条 GET（默认拒绝语义下漏登记即 401）
- 出站调用使用 Spring 6.1 自带的 `RestClient`，不新增第三方依赖

**前端**（`frontend/` 子模块）

- `components/site/site-header.tsx` 的 `actions` 区挂两个入口；`actions` 已有三个元素，需要处理窄屏拥挤
- 新增 `components/travel/` 与 `lib/travel/`
- 新增 `lib/contracts/travel.ts`，并在 `harness/checks/10-contract-check.ps1` 的 `$contractPairs` 登记一组

**工程约束**

- 新增能力 2 个，正好触到 14 号闸门的「能力 ≤ 2」上限；汇率与天气必须在同一 change 内完成，不得再拆入第三个能力
- OpenWeatherMap 的 key 当前返回 401（新 key 未激活），本次以 Open-Meteo 先行跑通；切换只需新增一个 `WeatherProvider` 实现

**不做 MCP 的理由**

MCP 解决的是「异构 LLM 客户端如何发现并调用工具」，它的价值依赖一个不知道有哪些工具的模型作为调用方。本次的调用方是自家后端中写死的 service 代码，没有工具发现需求，引入 MCP 只会多一个进程、一套协议实现和一层重复的超时与错误映射。真正需要 MCP 的时机是 AI 助手接入 LLM 之后，那时再单独立项，`WeatherProvider` / `CurrencyProvider` 正好可以成为 MCP tool 的实现载体。
