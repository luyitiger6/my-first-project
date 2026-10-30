# Spec Delta

## Purpose

为 wanderchain 提供独立的帖子广场页面 `/posts`，让用户能够按最新、最热、最多讨论三种维度浏览全部已发布帖子，并通过无限滚动与图标化互动统计获得可延续的内容消费体验。

## ADDED Requirements

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

- **WHEN** 用户首次访问 `/posts` 且未携带 `sortBy` 参数
- **THEN** `latest` Tab 处于高亮态，列表按最新排序加载

#### Scenario: 切换排序重置列表

- **WHEN** 用户从 `latest` 切换到 `hottest`
- **THEN** 原列表清空，显示骨架屏，加载新排序下的第一页数据

#### Scenario: URL 同步当前排序

- **WHEN** 用户点击某个排序 Tab
- **THEN** 浏览器 URL 的 `sortBy` 查询参数更新为对应值

### Requirement: 帖子卡片展示

列表中的每个帖子卡片 SHALL 展示封面图、标题、摘要、作者、发布时间、点赞数、评论数与收藏数；互动统计 MUST 使用单色 outline 图标与数字组合，且数字按英文口径展示。

#### Scenario: 卡片字段完整

- **WHEN** 帖子列表渲染完成
- **THEN** 每张卡片同时包含标题、摘要、作者、发布时间、点赞/评论/收藏图标与数量

#### Scenario: 图标化统计行

- **WHEN** 用户查看帖子卡片
- **THEN** 互动统计以图标行形式出现在卡片底部，图标与数字横向排列且语义可辨识

#### Scenario: 零互动仍展示

- **WHEN** 某条帖子的点赞/评论/收藏数量均为 0
- **THEN** 卡片仍显示对应图标与数字 0，不隐藏该统计项

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

### Requirement: 数据契约与游标

`/posts` 页面 MUST 复用 `frontend/lib/home/repository.ts` 暴露的 feed 查询接口；接口签名 SHALL 接受 `sortBy` 与 `cursor` 参数，并返回 `{ items, nextCursor, hasMore }`；真实 API 未接入前用 Mock 仓储实现。

#### Scenario: 查询接口签名一致

- **WHEN** 调用 feed 查询接口时传入 `sortBy` 与 `cursor`
- **THEN** 接口返回带 `nextCursor` 与 `hasMore` 的分页结果，类型与组件消费侧一致

#### Scenario: 替换真实数据源不改组件

- **WHEN** 用真实 API 实现替换 Mock 仓储
- **THEN** `useInfinitePosts` 与列表组件无需修改

### Requirement: 首页入口链接

首页 `HotPosts` 区块头部 SHALL 增加「View all posts」文字链接，点击后导航至 `/posts?sortBy=hottest`。

#### Scenario: 入口存在且可点击

- **WHEN** 首页 `HotPosts` 区块渲染完成
- **THEN** 区块头部出现「View all posts」链接，点击后跳转至帖子广场并按最热排序
