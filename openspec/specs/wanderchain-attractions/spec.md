# wanderchain-attractions Specification

## Purpose
为面向境外用户的旅行社区提供可独立阅读的景点攻略：公开只读的景点列表与约束型榜单、景点详情，以及回答"能不能去、要不要预约、怎么付款、地址怎么给司机看"的决策字段。

## Requirements

### Requirement: 景点接口为公开只读

景点列表与详情 SHALL 无需登录即可访问；`publicId` 不存在或对应景点已删除时 MUST 返回 404 与统一错误体，MUST NOT 返回空对象或占位景点。

#### Scenario: 未登录可读列表与详情

- **WHEN** 未携带任何会话凭证请求景点列表与任一已发布景点的详情
- **THEN** 两个请求均返回成功响应体，不返回鉴权错误

#### Scenario: 未知 publicId 返回 404

- **WHEN** 请求一个格式正确但不存在的景点 `publicId`
- **THEN** 响应状态为 404，响应体为统一错误体且错误码表明资源不存在

#### Scenario: 已删除景点按不存在处理

- **WHEN** 请求一个已被软删除的景点 `publicId`
- **THEN** 响应状态为 404，且响应体不包含该景点的任何字段

### Requirement: 只呈现已发布景点

任何景点响应 MUST 只包含 `published` 状态的景点；草稿与已删除景点 MUST NOT 出现在列表、榜单或按 `publicId` 的检索结果中。列表与榜单结果若取自缓存，其可见性 MUST 以缓存写入时刻的数据为准，该数据的有效期 MUST 不超过读缓存有效期；越过有效期后 MUST 重新按当前数据判定可见性。

#### Scenario: 草稿不进入列表与榜单

- **WHEN** 数据中存在 `draft` 状态的景点，且其城市与浏览数本可进入列表或某个榜单
- **THEN** 该景点不出现在列表响应中，也不出现在任何榜单的成员中

#### Scenario: 已删除景点不进入列表

- **WHEN** 数据中存在已软删除的景点
- **THEN** 列表与全部榜单都不返回该景点

#### Scenario: 缓存失效后不再返回已删除景点

- **WHEN** 某个景点在缓存有效期内被软删除，且该景点原本已在缓存中
- **THEN** 有效期内的响应可能仍包含该景点；越过有效期后的首次响应 MUST 不再包含它

### Requirement: 列表的城市过滤、排序与条数上限

列表 SHALL 支持 `city` 与 `sortBy`：`city` 省略或为 `all` 时返回全部城市；`sortBy` 取 `hot`（默认，浏览数降序）、`rating`（评分降序）、`new`（发布时间降序），并列时 MUST 按 `publicId` 升序稳定返回。`limit` 默认 20、上限 50，超出上限的取值 MUST 被钳到上限而不是报错。

#### Scenario: 默认按浏览数降序

- **WHEN** 请求列表且未指定 `sortBy`
- **THEN** 返回条目按浏览数降序排列，浏览数相同则按 `publicId` 升序

#### Scenario: 按城市过滤

- **WHEN** 请求列表并指定某个城市 slug
- **THEN** 返回条目的城市全部等于该 slug，其它城市的景点不出现

#### Scenario: 省略 city 覆盖全部城市

- **WHEN** 请求列表且未指定 `city`，或 `city` 取值为 `all`
- **THEN** 返回条目覆盖全部城市的已发布景点

#### Scenario: limit 超上限被钳制

- **WHEN** 请求列表并指定 `limit` 大于 50
- **THEN** 返回条目数不超过 50，且响应状态为成功而不是参数错误

### Requirement: 约束型榜单为人工策展集合

榜单 SHALL 以固定键提供，本期为 `first-trip`、`no-booking`、`open-monday` 三个；请求指定 `collection` 时 MUST 只返回该榜单的策展成员，顺序 MUST 等于策展顺序，`limit` 仍然生效；`collection` 取白名单外的值 MUST 返回 400 与统一错误体。

#### Scenario: 榜单只返回策展成员

- **WHEN** 请求某个榜单，且库中存在满足该榜单约束但未被策展收录的景点
- **THEN** 该景点不出现在榜单响应中

#### Scenario: 榜单顺序等于策展顺序

- **WHEN** 某榜单收录 4 个景点
- **THEN** 返回顺序与策展顺序逐条一致，不按浏览数或评分重排

#### Scenario: 非法榜单键被拒绝

- **WHEN** 请求 `collection` 取白名单外的值
- **THEN** 响应状态为 400，响应体为统一错误体，且不返回任何景点

### Requirement: 列表项字段口径

列表与榜单的每个条目 MUST 只含列表展示所需字段，MUST NOT 含正文、门票说明或其它详情专属字段。

#### Scenario: 列表项字段集合固定

- **WHEN** 请求景点列表或任一榜单
- **THEN** 每个条目的字段集合恰为 `publicId`、`nameEn`、`nameCn`、`city`、`coverUrl`、`rating`、`viewCount`、`publishedAt`、`freeEntry`、`bookingRequired`、`openOnMonday`

#### Scenario: 列表不携带正文

- **WHEN** 请求景点列表
- **THEN** 响应中不出现正文字段或中文地址字段

### Requirement: 详情返回完整决策字段

景点详情 SHALL 在列表项字段之外返回详情专属字段，覆盖门票、开放时间、预约要求、支付方式、中英地址、交通、建议游览时长、核实时间与正文。

#### Scenario: 详情字段集合固定

- **WHEN** 请求一条已发布景点的详情
- **THEN** 除列表项字段外，还包含 `summaryEn`、`contentEn`、`ticketInfoEn`、`openingHoursEn`、`bookingInfoEn`、`paymentInfoEn`、`addressEn`、`addressCn`、`transitEn`、`suggestedDurationEn`、`verifiedAt`

#### Scenario: 中文地址只出现在详情

- **WHEN** 比较列表响应与同一景点的详情响应
- **THEN** 中文地址字段只出现在详情响应中

### Requirement: 景点列表页先榜单后列表

`/attractions` SHALL 先渲染约束型榜单区块、再渲染完整列表；榜单 MUST 展示榜单名、每榜一句英文说明与成员卡片，成员卡片 MUST 展示该榜单约束相关的事实徽标。

#### Scenario: 榜单区块先于完整列表

- **WHEN** 访问 `/attractions`
- **THEN** 三个榜单区块出现在完整列表之前，且每一榜都有榜单名与非空英文说明

#### Scenario: 榜单名称为固定英文串

- **WHEN** 任一榜单区块渲染完成
- **THEN** 其榜单名分别为 `First time in China`、`No booking needed`、`Open on Mondays`，不随城市或数据变化

#### Scenario: 成员卡片带约束徽标

- **WHEN** 榜单成员卡片渲染完成
- **THEN** 卡片展示与榜单约束对应的事实徽标，例如无需预约榜展示无需预约标识、周一开放榜展示周一开放标识

#### Scenario: 无成员时展示空态

- **WHEN** 某榜单在当前城市下没有成员
- **THEN** 该榜单展示英文空态文案，不出现空标题或报错

### Requirement: 景点详情页事实卡与缺失占位

`/attractions/{publicId}` SHALL 以事实卡分项展示门票、开放时间、预约要求、支付方式、英文地址、中文地址、公共交通与建议游览时长；任一字段缺失时 MUST 展示英文占位文案，MUST NOT 留空、MUST NOT 中断整页渲染。

#### Scenario: 事实卡分项齐全

- **WHEN** 打开一条字段完整的景点详情页
- **THEN** 事实卡分项展示门票、开放时间、预约要求、支付方式、地址、公共交通与建议游览时长

#### Scenario: 缺失字段显示英文占位

- **WHEN** 打开一条缺少门票说明的景点详情页
- **THEN** 门票一项展示英文占位文案，其余各项照常展示，页面不报错

#### Scenario: 中文地址标注用途

- **WHEN** 详情页展示中文地址
- **THEN** 该地址带有说明其供出租车司机查看的英文标注，界面其余文案仍为英文

### Requirement: 核实时间可见

景点详情页 MUST 以 `Checked <Mon YYYY>` 形式展示核实时间，例如 `Checked Aug 2026`；核实时间缺失的景点 MUST NOT 出现在列表与详情响应中。

#### Scenario: 详情展示核实时间

- **WHEN** 打开任一已发布景点的详情页
- **THEN** 页面出现形如 `Checked Aug 2026` 的核实时间文案

#### Scenario: 核实时间缺失不入库

- **WHEN** 某景点数据缺少核实时间
- **THEN** 该景点不出现在列表与详情响应中，也不出现在任何榜单中

### Requirement: 景点页的城市参数归一化

`/attractions` SHALL 接受查询参数 `city`，与首页同一归一化规则：缺失、为空或不在城市白名单内时 MUST 回落为 `all`，且 `all` MUST 展示为全城范围的英文表述。

#### Scenario: 城市参数生效

- **WHEN** 访问 `/attractions?city=beijing`
- **THEN** 完整列表与三个榜单都只展示北京的景点

#### Scenario: 非法城市回落

- **WHEN** 访问 `/attractions?city=atlantis`
- **THEN** 页面以 `all` 展示内容，不报错也不出现空页面

### Requirement: 景点页英文界面

景点列表页与详情页的界面文案 MUST 为英文，页面根元素 `lang` MUST 为 `en`；唯一允许出现的中文字符 MUST 限于中文地址字段及其英文标注。

#### Scenario: 界面文案为英文

- **WHEN** 渲染景点列表页与任一景点详情页
- **THEN** 页面可见文本中除中文地址字段外不含中文字符

#### Scenario: 数字与日期按英文口径

- **WHEN** 页面展示浏览数、评分与发布日期
- **THEN** 千分位与日期均按英文口径呈现，不出现「万」或「X 月 X 日」

### Requirement: 景点页的加载态、错误态与空态

数据请求进行中 MUST 展示加载态；接口失败 MUST 展示英文错误态且 MUST NOT 阻断同页其它区块；无匹配景点时 MUST 展示英文空态文案。

#### Scenario: 加载中展示加载态

- **WHEN** 页面数据请求尚未返回
- **THEN** 页面展示加载态，不展示空态或错误态

#### Scenario: 接口失败展示错误态

- **WHEN** 景点接口返回失败
- **THEN** 受影响区块展示英文错误态文案，页面其它区块仍正常渲染

#### Scenario: 无匹配展示空态

- **WHEN** 当前城市下没有任何已发布景点
- **THEN** 页面展示英文空态文案，不出现空白区域或报错

### Requirement: 景点封面图的按需出图

列表卡片封面与详情页主图 SHALL 声明与实际显示宽度一致的 `sizes` 并生成多档 `srcset`，MUST 保持懒加载与异步解码，加载中与加载失败时 MUST 维持声明的宽高比。

#### Scenario: 封面声明多档 srcset

- **WHEN** 景点卡片或详情主图渲染完成
- **THEN** 每张图同时带有 `srcset` 与 `sizes`，且 `srcset` 包含多个宽度档位

#### Scenario: 加载中布局不塌陷

- **WHEN** 封面仍在加载或请求失败
- **THEN** 容器保持声明的宽高比与背景占位，正文位置不发生跳动

### Requirement: 列表与榜单的读缓存陈旧窗口

列表与榜单结果 SHALL 在有效期内容忍复用，以避免每次请求都读库；有效期 MUST 由配置给出，默认 5 分钟。同一组请求参数在有效期内 MUST 返回同一份结果。

#### Scenario: 有效期内不反映库内改动

- **WHEN** 某组参数已产生缓存，且在有效期内直接改动库中景点的浏览数
- **THEN** 用同一组参数再次请求仍返回改动前的结果，不报错

#### Scenario: 有效期后反映库内改动

- **WHEN** 距上次写入已越过有效期，且期间库中景点数据发生改动
- **THEN** 用同一组参数请求返回改动后的结果

### Requirement: 缓存条目按请求参数区分

不同请求参数组合 MUST 落在不同的缓存条目上；MUST NOT 用同一份缓存应答城市、排序维度、榜单键或 `limit` 不同的请求。

#### Scenario: 城市不同不串数据

- **WHEN** 先后请求 `city=beijing` 与 `city=chengdu` 的列表
- **THEN** 两个响应各自只包含对应城市的景点

#### Scenario: 排序维度不同不串数据

- **WHEN** 先后请求 `sortBy=hot` 与 `sortBy=rating` 的列表
- **THEN** 两个响应各自按浏览数与按评分降序，第二者不返回第一者的顺序

#### Scenario: 榜单键不同不串数据

- **WHEN** 先后请求 `collection=first-trip` 与 `collection=open-monday`
- **THEN** 两个响应各自只包含对应榜单的策展成员

#### Scenario: limit 不同不串数据

- **WHEN** 先以 `limit=5` 请求，再以 `limit=50` 请求同一城市同一排序
- **THEN** 第二个响应的条目数按 `limit=50` 给出，不被先前的 5 条覆盖

### Requirement: 缓存不可用时仍按数据库结果可读

缓存不可用、缓存条目缺失或缓存内容无法解析时，列表与榜单 MUST 继续按数据库结果回应；MUST NOT 因缓存故障返回 5xx、空结果或错误体。

#### Scenario: 缓存服务不可用仍可读

- **WHEN** 缓存服务不可达时请求列表与任一榜单
- **THEN** 两个响应均为成功，且内容与直接查库的结果一致；服务侧只记录告警，不向调用方暴露缓存细节

#### Scenario: 缓存内容损坏被忽略

- **WHEN** 某个缓存条目的内容已无法解析成列表结果
- **THEN** 该次请求仍返回成功并按数据库结果给出，不返回 5xx

### Requirement: 并发未命中只有一个请求回源

同一缓存条目并发未命中时，在等待预算内 MUST 只有一个请求执行数据库查询并回写缓存，其余请求 MUST 取用该结果；等待预算耗尽时其余请求 MUST 各自查库以保证可用性，MUST NOT 无限阻塞。

#### Scenario: 并发未命中只回源一次

- **WHEN** 多个请求同时请求同一组尚未缓存的参数组合
- **THEN** 数据库查询只发生一次，所有请求返回内容一致的成功响应

#### Scenario: 等待预算耗尽仍返回结果

- **WHEN** 持有回源权的请求未能在等待预算内完成写入
- **THEN** 等待中的请求改为直接查库并返回成功，不出现超时错误或 5xx
