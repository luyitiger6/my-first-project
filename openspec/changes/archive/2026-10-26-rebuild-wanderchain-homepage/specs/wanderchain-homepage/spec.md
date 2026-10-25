# Spec Delta

## Purpose

为 wanderchain 提供可独立开发、独立测试、独立交付的首页：9 个前端单元以 Mock 数据契约占位，在不依赖任何后端服务的前提下完成布局、内容展示、城市切换、入口跳转与账号流程。

## ADDED Requirements

### Requirement: 契约与 Mock 数据层

首页各单元 SHALL 共享同一份类型契约与 Mock 数据源，包含城市白名单、内容卡片结构与仓储接口；Mock 仓储 MUST 按固定排序规则返回数据，组件 MUST NOT 内联业务数据。

#### Scenario: 契约覆盖三类内容

- **WHEN** 检查共享类型与 Mock 仓储
- **THEN** 编辑推荐、热门帖子、热门景点与城市列表均有类型定义与 Mock 实现

#### Scenario: 返回顺序确定

- **WHEN** 对同一 Mock 查询重复调用
- **THEN** 返回条目的顺序与内容完全一致

#### Scenario: 替换真实数据源不改组件

- **WHEN** 用相同响应形状的真实数据源替换 Mock 仓储
- **THEN** 组件与单元测试无需修改

### Requirement: Mock 认证（登录标识为邮箱）

首页 SHALL 提供前端自包含的账号能力：注册、登录、获取当前用户与退出；会话 MUST 只存在于前端，MUST NOT 发起网络请求；用户对象 MUST 携带 `user` 或 `admin` 角色。

#### Scenario: 注册后进入登录态

- **WHEN** 用户提交未注册的邮箱、密码与用户名完成注册
- **THEN** 会话建立并显示当前用户名

#### Scenario: 密码错误被拒绝

- **WHEN** 用户提交已注册邮箱与错误密码
- **THEN** 界面展示错误提示且不建立会话

#### Scenario: 刷新后会话保持

- **WHEN** 已登录用户刷新页面
- **THEN** 仍处于登录态并显示同一用户

#### Scenario: 未登录展示入口

- **WHEN** 访客打开首页
- **THEN** 头部展示登录入口而非用户名

#### Scenario: 角色字段可用

- **WHEN** 使用 admin 角色的 Mock 账号登录
- **THEN** 当前用户对象的角色为 `admin`

### Requirement: 首页骨架与区块编排

首页 SHALL 按固定顺序渲染功能导航、城市快速入口、编辑推荐、热门帖子、热门景点，并始终提供 AI 助手入口；任一区块失败或为空 MUST NOT 中断其他区块渲染。

#### Scenario: 区块顺序固定

- **WHEN** 首页渲染完成
- **THEN** 五个区块按功能导航、城市、编辑推荐、热门帖子、热门景点的顺序出现

#### Scenario: 单区块失败隔离

- **WHEN** 某个内容区块的数据源抛错
- **THEN** 该区块展示错误态，其余区块仍正常渲染

#### Scenario: 城市参数透传

- **WHEN** 访问 `/?city=shanghai`
- **THEN** 三个内容区块均以 `shanghai` 作为查询条件

#### Scenario: 城市参数缺失

- **WHEN** 访问 `/` 且未携带 `city` 参数
- **THEN** 三个内容区块均以 `all` 作为查询条件

### Requirement: 功能导航栏

首页 SHALL 展示旅游社区、景点攻略、AI 助手三张平台入口卡片，每张 MUST 含图标、标题与一句话描述，且点击后进入对应入口。

#### Scenario: 三张卡片齐全

- **WHEN** 首页渲染完成
- **THEN** 三张卡片分别展示旅游社区、景点攻略、AI 助手的标题与描述

#### Scenario: 入口可点击

- **WHEN** 用户点击任一卡片
- **THEN** 浏览器导航到该卡片对应的入口地址

#### Scenario: 移动端不溢出

- **WHEN** 视口宽度小于 768px
- **THEN** 卡片纵向排列且页面不出现横向滚动

### Requirement: AI 助手入口

首页 SHALL 同时提供悬浮按钮与顶部入口来唤起 AI 助手占位面板；打开与关闭 MUST 完全在前端完成，且 MUST NOT 发起任何网络请求。

#### Scenario: 悬浮按钮打开面板

- **WHEN** 用户点击右下角悬浮按钮
- **THEN** 占位面板打开并说明真实对话能力即将上线

#### Scenario: 顶部入口打开同一面板

- **WHEN** 用户点击顶部 AI 助手入口
- **THEN** 与悬浮按钮打开的是同一个占位面板

#### Scenario: 关闭方式

- **WHEN** 用户点击关闭按钮、按 Esc 或点击遮罩
- **THEN** 占位面板关闭

#### Scenario: 零网络请求

- **WHEN** 用户打开并关闭占位面板
- **THEN** 期间不发生任何 fetch 或 XHR 请求

### Requirement: 城市快速入口

首页 SHALL 展示 8 个 MVP 城市入口，包含 `all` 与 7 个城市；点击 SHALL 把城市 slug 写入 URL 查询参数 `city`，当前城市 MUST 高亮，非法或缺失值 MUST 回落为 `all`。

#### Scenario: 点击切换城市

- **WHEN** 用户点击某城市入口
- **THEN** URL 的 `city` 参数变为该城市 slug 且该入口高亮

#### Scenario: 直接访问带参数高亮

- **WHEN** 用户直接访问 `/?city=beijing`
- **THEN** 北京入口处于高亮态

#### Scenario: 非法城市回落

- **WHEN** 用户访问 `/?city=atlantis`
- **THEN** 页面以 `all` 展示内容且 `all` 入口高亮

#### Scenario: 刷新后保持

- **WHEN** 用户选中城市后刷新页面
- **THEN** 城市选择保持不变

### Requirement: 编辑推荐区块

首页 SHALL 展示编辑精选卡片，按 `sort_order` 升序、并列时按 `id` 升序排列，并按城市过滤；无匹配数据时 MUST 展示空态。

#### Scenario: 按 sort_order 排序

- **WHEN** 编辑推荐区块渲染完成
- **THEN** 卡片顺序与 `sort_order` 升序一致，并列项按 `id` 升序

#### Scenario: 城市过滤

- **WHEN** 用户选中非 `all` 的城市
- **THEN** 区块只展示该城市或全城通用（`all`）的精选卡片

#### Scenario: 空态

- **WHEN** 该城市没有精选卡片
- **THEN** 区块展示空态文案且不报错

### Requirement: 热门帖子区块

首页 SHALL 展示最多 10 条已发布帖子，排序为评论数降序、浏览数降序、发布时间降序；非 `published` 状态的帖子 MUST NOT 出现。

#### Scenario: 最多 10 条

- **WHEN** Mock 数据中已发布帖子多于 10 条
- **THEN** 区块只展示排序后的前 10 条

#### Scenario: 三级排序

- **WHEN** 两条帖子评论数不同
- **THEN** 评论数多者在前；评论数相同则浏览数多者在前；两者都相同则发布时间晚者在前

#### Scenario: 只含已发布

- **WHEN** Mock 数据中存在草稿或已删除帖子
- **THEN** 区块不展示这些帖子

### Requirement: 热门景点区块

首页 SHALL 展示最多 5 个已发布景点，排序为浏览数降序、发布时间降序；非 `published` 状态的景点 MUST NOT 出现。

#### Scenario: 最多 5 条

- **WHEN** Mock 数据中已发布景点多于 5 个
- **THEN** 区块只展示排序后的前 5 个

#### Scenario: 排序正确

- **WHEN** 两个景点浏览数不同
- **THEN** 浏览数多者在前；浏览数相同则发布时间晚者在前

#### Scenario: 只含已发布

- **WHEN** Mock 数据中存在草稿或已删除景点
- **THEN** 区块不展示这些景点
