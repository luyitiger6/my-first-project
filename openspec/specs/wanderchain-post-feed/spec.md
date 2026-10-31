# wanderchain-post-feed Specification

## Purpose

为 wanderchain 提供独立的帖子广场页面 `/posts`，让用户能够按最新、最热、最多讨论三种维度浏览全部已发布帖子，并通过无限滚动与图标化互动统计获得可延续的内容消费体验。

## Requirements

### Requirement: 页面路由与布局

`/posts` 页面 SHALL 作为 Client Component 渲染，使用与首页一致的容器宽度、英文界面语言与全局设计令牌；页面 MUST NOT 在主布局之外发起初始数据请求。

#### Scenario: 独立入口可访问

- **WHEN** 用户访问 `/posts`
- **THEN** 页面渲染排序 Tab、帖子列表容器与底部触发器

#### Scenario: 容器宽度与首页一致

- **WHEN** 用户在桌面端访问 `/posts`
- **THEN** 内容区宽度与首页 `wc-container` 一致，左右留白不顶到视口边缘

### Requirement: 排序 Tab

页面 SHALL 在列表顶部提供三个排序选项：最新（`latest`）、最热（`hottest`）、最多讨论（`mostDiscussed`）；默认选中 `latest`；切换排序 MUST 重置列表并请求第一页。

#### Scenario: 默认选中最新

- **WHEN** 用户首次访问 `/posts` 且无 `sortBy` 参数
- **THEN** `latest` Tab 处于高亮态，列表按最新排序加载

#### Scenario: 切换排序重置列表

- **WHEN** 用户从 `latest` 切换到 `hottest`
- **THEN** 原列表清空，显示骨架屏，加载新排序下的第一页数据

#### Scenario: URL 同步当前排序

- **WHEN** 用户点击某个排序 Tab
- **THEN** 浏览器 URL 的 `sortBy` 查询参数更新为对应值

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

### Requirement: 无限滚动分页

列表 SHALL 使用 `IntersectionObserver` 监听底部触发器；当触发器进入视口且仍有下一页时，自动加载下一页并追加到列表；加载期间 MUST 展示骨架屏，无更多数据时 MUST 展示到底提示。

#### Scenario: 滚动到底加载下一页

- **WHEN** 用户滚动到列表底部且下一页存在
- **THEN** 自动请求下一页数据并追加到当前列表末尾

#### Scenario: 加载中展示骨架屏

- **WHEN** 下一页数据尚未返回
- **THEN** 列表底部显示若干骨架卡片，且不重复触发请求

#### Scenario: 无更多数据展示提示

- **WHEN** 最后一页加载完成且用户继续滚动
- **THEN** 列表底部显示英文到底提示，不再发起请求

#### Scenario: 空列表展示空态

- **WHEN** 当前排序下没有任何帖子
- **THEN** 列表区域展示英文空态文案，不展示骨架屏或到底提示

### Requirement: 错误态与重试

当首次加载或分页请求失败时，页面 SHALL 展示错误态并允许用户重试；重试 MUST 从失败的同一请求继续，不丢失已加载数据。

#### Scenario: 首次加载失败可重试

- **WHEN** 第一页数据请求失败
- **THEN** 页面展示错误文案与重试按钮，点击后重新加载第一页

#### Scenario: 分页失败不清空已有数据

- **WHEN** 第 N 页请求失败（N > 1）
- **THEN** 已加载的前 N-1 页数据保持可见，底部展示重试入口

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

### Requirement: 首页入口链接

首页 `HotPosts` 区块头部 SHALL 增加「View all posts」文字链接，点击后导航至 `/posts?sortBy=hottest`。

#### Scenario: 入口存在且可点击

- **WHEN** 首页 `HotPosts` 区块渲染完成
- **THEN** 区块头部出现「View all posts」链接，点击后跳转至帖子广场并按最热排序
