# Spec Delta

## REMOVED Requirements

### Requirement: 帖子卡片展示

**Reason**: 旧卡片强制展示真实列表接口没有的摘要和作者显示名，不能以 Mock 字段假冒真实帖子数据。
**Migration**: 由新增“真实帖子卡片与详情入口”承接真实字段展示、图标统计与零值场景；首页 Mock 卡片不迁移。

### Requirement: 数据契约与游标

**Reason**: 旧契约绑定首页 Mock 模型，数字 ID、英文摘要和时间字段与真实 API 不兼容；“替换真实数据源不改组件”的承诺无法保持。
**Migration**: 广场迁往帖子域真实分页契约，显式适配消费侧并保留排序、游标、分页重试与状态隔离；首页仓储继续独立。

## ADDED Requirements

### Requirement: 真实帖子卡片与详情入口

广场卡片 SHALL 展示真实接口的标题、可用封面、标签、作者对外标识、创建时间以及点赞、评论、收藏数。互动统计 MUST 使用单色 outline 图标与英文数字，零值不隐藏；卡片 SHALL 提供基于 `publicId` 的详情链接。页面 MUST NOT 编造摘要、作者姓名、城市或浏览数，MUST NOT 将 Mock 数字 ID 用于真实请求。

#### Scenario: 真实卡片字段完整

- **WHEN** 广场列表请求成功
- **THEN** 每张卡片呈现后端标题、标签、作者标识、创建时间和三项统计，封面存在时显示封面，不读取 Mock 英文字段

#### Scenario: 图标化统计行

- **WHEN** 用户查看真实帖子卡片
- **THEN** 卡片底部以横向图标加数字展示赞成票、评论、收藏，语义可辨识

#### Scenario: 零互动仍展示

- **WHEN** 某条帖子的三项统计均为 0
- **THEN** 卡片仍展示三个图标及数字 0

#### Scenario: 点击进入真实详情

- **WHEN** 用户激活某张卡片的标题或详情链接
- **THEN** 导航到 `/posts/{publicId}`，标识来自该真实列表项，链接可由键盘操作

#### Scenario: 封面不可用

- **WHEN** 后端封面为空或图片加载失败
- **THEN** 卡片展示非破图的占位或无图布局，标题与详情链接仍可用

### Requirement: 真实广场查询与游标适配

广场 MUST 请求同源 `GET /api/posts`，不以 Mock 兜底。UI 排序 `latest/hottest/mostDiscussed` SHALL 分别映射为 HTTP `publishedAt/upVoteCount/commentCount`；游标 SHALL 原样透传，是否还有下一页 MUST 仅从 `nextCursor` 非空推导。分页 SHALL 保留已加载项并按 `publicId` 去重，排序切换 MUST 清空旧游标和数据并忽略旧请求。

#### Scenario: 三种排序发出对应请求

- **WHEN** 用户选择 `latest`、`hottest` 或 `mostDiscussed`
- **THEN** 分别以对应 HTTP 排序值请求真实接口，URL 继续使用 UI 排序词，不混用两套词表

#### Scenario: 翻页使用真实游标

- **WHEN** 上一页返回非空 `nextCursor`
- **THEN** 下一页原样使用该值，不解析或构造游标，不引入 offset

#### Scenario: 排序切换隔离迟到结果

- **WHEN** 用户切换排序，旧排序请求晚于新排序返回
- **THEN** 旧结果不覆盖新列表、不追加到新排序，也不覆盖新游标

#### Scenario: 无更多数据不重复请求

- **WHEN** 接口返回 `nextCursor=null`
- **THEN** 空列表显示空态，非空列表显示到底提示，均不继续翻页

#### Scenario: 重试不丢失已有页

- **WHEN** 真实接口的下一页请求失败并由用户重试
- **THEN** 已有列表保持可见，重试相同排序和游标，不用 Mock 数据替代

#### Scenario: 返回广场重新校准统计

- **WHEN** 用户在详情页完成互动后返回广场
- **THEN** 保留合法 UI 排序并重新读取列表，不把旧卡片统计当作最新结果

#### Scenario: 首页入口和数据边界保持

- **WHEN** 用户点击首页的 `View all posts`
- **THEN** 仍进入 `/posts?sortBy=hottest` 并读取真实最热列表，首页 Mock 卡片不被自动改造或链接到虚构真实标识
