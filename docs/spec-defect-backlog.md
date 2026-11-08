# 规格缺陷台账

> 性质：缺陷台账，不是规格，不产生 Requirement / Scenario，不进入 OpenSpec 变更流程。
> 来源：2026-11-08 全仓规格审查（`openspec/specs/` 下 22 个能力，约 2600 行已归档真相）。
> 状态：编号的唯一来源与批次编排记录；条目立项时按编号引用，不重写条目正文。

---

## 1. 总览

共 **40 条**，按缺陷性质分五组：

| 组 | 主题 | 条数 | P0 | P1 | P2 |
|---|---|---|---|---|---|
| A | 安全：越权 / 泄露 / 未限流 | 9 | 2 | 4 | 3 |
| B | 数据：类型 / 长度 / 索引 | 7 | 2 | 4 | 1 |
| C | 灰色地带：没说清 | 13 | 0 | 7 | 6 |
| D | 异常：空值 / 超长 / 并发 / 重复点击 | 6 | 0 | 3 | 3 |
| E | 验收标准：可量化 / 可测试 | 5 | 0 | 3 | 2 |
| **合计** | | **40** | **4** | **21** | **15** |

级别口径：P0 必须改（决定生产能不能上）；P1 下个 change 前改；P2 可排期。

**行号说明**：下表位置列取自 2026-11-08 审查时的主规格行号。此后归档与修订会让行号漂移，定位以「能力名 + 原文措辞」为准，行号只作线索。

---

## 2. 批次编排

| 批次 | change | 覆盖缺陷 | 状态 |
|---|---|---|---|
| 第 1 批 | `harden-source-rate-limit` | A1 + A2 | 规划完成（proposal / specs / design / tasks 齐全，`openspec validate` valid），实施未开始 |
| 第 1 批 | `add-post-count-columns` | B1（DDL 部分）+ B2 | 未创建 |
| 第 1 批 | `sync-interaction-counts` | B1（写侧计数同步） | 未创建 |
| 待编批 | 见 §4 的「建议归属」列 | 其余 36 条 | 待立项 / 待拍板 |

第 1 批只做 P0 四条决定的最小集合：A1、A2 决定「谁能被限流保护好」，B1、B2 决定「数据量上来还能不能查」。B1 同时含 DDL 与服务层写侧，按「按能力开 change」的拍板拆成两个 change，不合并。

---

## 3. 已拍板决策

| # | 决策 | 落点 |
|---|---|---|
| 1 | 按能力开 change，不把多条缺陷合并成一个大 change | §2 的三拆 |
| 2 | 代理链：前端转发 `X-Forwarded-For`，后端按可信代理网段取最后一跳 | A1 → `harden-source-rate-limit` |
| 3 | 全站写操作共用单一来源桶，60 次/分钟；`unknown` 独立桶 20 次/分钟 | A2 → 同上 |
| 4 | 排序用冗余计数列 + 覆盖索引，不在查询期做相关子查询聚合 | B1 → 后两个 change |

原审查建议的第 3 条「A4/A5/A6 + B5/B6 合并进一个 `fix/spec-hardening`」已被决策 1 取代：不合并，按能力各自立项。

---

## 4. 明细

### 4.1 A · 安全（9 条）

| 编号 | 级别 | 缺陷 | 位置 | 建议归属 | 状态 |
|---|---|---|---|---|---|
| A1 | P0 | 代理链断裂：前端不转发客户端 IP + 后端 `trusted-proxies` 为空，来源限流退化为全站单桶，20 次失败锁死全站登录 | auth:104、121-124；frontend-nextjs:27 | `harden-source-rate-limit` | 已归入 · 规划完成 |
| A2 | P0 | 除认证外全站写端点无频率限制；上传 5MB 无每账户配额，评论/投票可脚本刷量 | posts:29、72；post-interactions:10、87、135；media:11；profile:91 | `harden-source-rate-limit` | 已归入 · 规划完成 |
| A3 | P1 | 公开名片批量接口可被枚举爬取：免登录、一次 50 个、无限流、无 ULID 形状校验 | profile:67、74-77 | `wanderchain-profile` | 待立项 |
| A4 | P1 | 编辑/删除端点对草稿泄露存在性：详情对非作者草稿 404，编辑/删除却 403 | posts:48、116；post-interactions:34 | `wanderchain-posts` | 待立项 |
| A5 | P1 | 媒体上传未在自身 spec 声明继承来源校验，实现靠 `OriginGuard` 覆盖 `/api/**` 才碰巧成立 | media:11 | `wanderchain-media` | 待立项 |
| A6 | P1 | 头像/封面允许 `http://` 与任意外链，生产页面破图且把访客 IP/Referer 送给第三方 | profile:53；posts:231；media:35 | `wanderchain-profile` | 待立项 |
| A7 | P2 | `/me` 白名单写成「范围限于用户信息接口，其余端点另行确定」，给后续端点留了不设白名单的口子 | auth:148 | `wanderchain-auth` | 待立项 |
| A8 | P2 | 4xx 与 5xx 都要求含错误码，但固定错误码集合里没有 5xx 可用的码 | auth:406、410 | `wanderchain-auth` | 待立项 |
| A9 | P2 | 令牌只要求「带有效期」，无上限、未说是否滑动续期 | auth:191 | `wanderchain-auth` | 待立项 |

### 4.2 B · 数据（7 条）

| 编号 | 级别 | 缺陷 | 位置 | 建议归属 | 状态 |
|---|---|---|---|---|---|
| B1 | P0 | 按点赞数/评论数排序无任何存储支撑：无计数列，查询期用相关子查询 count，复杂度 O(N × 子查询) | posts:72、99-107 | `add-post-count-columns` + `sync-interaction-counts` | 待立项 |
| B2 | P0 | `database-baseline` 只固定 AI 会话四表，wanderchain 表结构（列类型/长度/索引/唯一约束）无规格；`attraction_comments` 建了表却无能力覆盖 | database-baseline:9-11、71 | `add-post-count-columns` | 待立项 |
| B3 | P1 | 「字符」口径不统一：评论写 UTF-16 代码单元，标题/昵称/简介/标签只写「字符」 | posts:231；profile:10、34；对照 post-interactions:10 | 跨能力（posts / profile / interactions） | 待立项 |
| B4 | P1 | URL 字段无长度上限：DB 是 `VARCHAR(512)`，超长写库抛异常变 500，而非 spec 承诺的 400 | posts:231；profile:53；media:35 | 跨能力（posts / profile / media） | 待立项 |
| B5 | P1 | 删帖回收封面未处理多帖共享同一封面：删 A 会把 B 的封面删掉 | media:90-92 | `wanderchain-media` | 待立项 |
| B6 | P1 | 编辑替换封面不回收旧文件，长期运行堆积孤儿文件 | media:90-92 | `wanderchain-media` | 待立项 |
| B7 | P2 | 「最多一条投票记录」与软删除历史冲突，应改为「最多一条有效投票记录」 | post-interactions:87；schema.sql:126 | `wanderchain-post-interactions` | 待立项 |

### 4.3 C · 灰色地带（13 条）

| 编号 | 级别 | 缺陷 | 位置 | 建议归属 | 状态 |
|---|---|---|---|---|---|
| C1 | P1 | 帖子列表的 `limit` 参数完全未写（实现有默认 20、上限 50），公开契约缺它就等于实现说了算 | posts:72 | `wanderchain-posts` | 待立项 |
| C2 | P1 | 非法 `sortBy` / `city` 行为未定义；attractions 的 `collection` 明确 400 而 `sortBy` 沉默，同文件内不一致 | posts:72；attractions:48 | 跨能力（posts / attractions） | 待立项 |
| C3 | P1 | 评论游标不绑定帖子，拿 A 帖游标请求 B 帖时分页语义错乱，行为未定义 | post-interactions:48、75-78 | `wanderchain-post-interactions` | 待立项 |
| C4 | P1 | 「空字符串按清空处理」与「昵称 1–64 字符、空白 400」在同一 spec 内给出相反答案 | profile:10、14、91 | `wanderchain-profile` | 待立项 |
| C5 | P1 | `/me` 字段集合「恰为五项」与 Scenario「是白名单的子集」不可能同时满足 | auth:148、153 | `wanderchain-auth` | 待立项 |
| C6 | P1 | 「两种结果 MUST NOT 让该帖出现在广场」把发布成功也包括进去，与帖子列表/广场规格直接冲突 | post-authoring:48 | `wanderchain-post-authoring` | 待立项 |
| C7 | P1 | 字段白名单含正文且要求列表/详情相等，但列表契约 `PostSummaryResponse` 没有 `content` | posts:183、187 | `wanderchain-posts` | 待立项 |
| C8 | P2 | 注销后重新注册写「返回 202」，与「创建账户并签发令牌」及前端按 200 实现矛盾 | auth:44、24；auth-frontend:117 | 跨能力（auth / auth-frontend） | 待立项 |
| C9 | P2 | 数值约束只写「默认/上限」不给值：5 MB 未说 `5*1024*1024` 还是 `5,000,000`、长缓存头无 max-age、等待预算无数值 | media:11、54；attractions:289 | 跨能力（media / attractions） | 待立项 |
| C10 | P2 | 昵称是否唯一未定义：重名则内容流无法区分，不重名则缺唯一约束与冲突错误码 | profile:10 | `wanderchain-profile` | 待拍板 |
| C11 | P2 | 标签清单删掉某项后，用户已保存的标签是保留、清空还是被拒，未定义 | profile:34、129 | `wanderchain-profile` | 待立项 |
| C12 | P2 | 搜索无 `q` 长度上限、无每组结果上限；全量扫描三类内容，内容量上来会返回上千条 | search:34、53 | `wanderchain-search` | 待立项 |
| C13 | P2 | 首页热门帖子仍读本地 Mock，与广场真实数据两套来源，用户会看到「首页有、广场没有」 | homepage:5、131 | `wanderchain-homepage` | 待拍板（过渡态到期条件） |

### 4.4 D · 异常（6 条）

| 编号 | 级别 | 缺陷 | 位置 | 建议归属 | 状态 |
|---|---|---|---|---|---|
| D1 | P1 | 后端写端点无并发与幂等要求，只靠前端防重复；双击/重试/多标签页可建出两条相同评论、两次投票、两次发帖 | post-interactions:8-10、87、135；post-authoring:119 | 跨能力（interactions / authoring） | 待立项 |
| D2 | P1 | 编辑并发无乐观锁：`PUT` 整体覆盖，`posts.version` 列存在但 spec 从未要求使用，后者静默覆盖前者 | posts:46-53、231 | `wanderchain-posts` | 待拍板（乐观锁 vs 最后写入者胜） |
| D3 | P1 | 只写「日配额在投递决策之前比对」，未要求检查与扣减原子，并发请求可超发 | auth:377 | `wanderchain-auth` | 待立项 |
| D4 | P2 | 写帖失败语义缺 404 场景：Requirement 列了「目标不存在」，Scenario 只有 401/403/400/网络 | post-authoring:95 | `wanderchain-post-authoring` | 待立项 |
| D5 | P2 | 上传未要求剥离 EXIF，用户照片的 GPS 会被原样公开 | media:11 | `wanderchain-media` | 待立项 |
| D6 | P2 | 已删除景点在 5 分钟缓存窗口内仍公开可见；spec 已明确属已知取舍，列出供产品确认 | attractions:29、43-44 | `wanderchain-attractions` | 待拍板（接受窗口 or 删除时主动失效） |

### 4.5 E · 验收标准（5 条）

| 编号 | 级别 | 缺陷 | 位置 | 建议归属 | 状态 |
|---|---|---|---|---|---|
| E1 | P1 | 「绕过统一包装即失败」的 THEN 是评审结论，不是可执行断言 | auth:165-168 | `wanderchain-auth` | 待立项 |
| E2 | P1 | 「明文只存在于内存」测试无法读取内存，命题不可观测 | auth:179-182 | `wanderchain-auth` | 待立项 |
| E3 | P1 | 「外链头像不触发外网请求」是不可直接观测的负向行为，账本已登记 deferred，spec 本身仍不可测 | profile:60-63；`docs/spec-evidence.json` | `wanderchain-profile` | 待立项 |
| E4 | P2 | 「不超过 2 次点击」未定义从哪页算起、如何计数，E2E 无法稳定断言 | profile:143 | `wanderchain-profile` | 待立项 |
| E5 | P2 | 「长缓存头」「等待预算」无阈值，验收时无法判定够不够长、在不在预算内 | media:54、61-64；attractions:289 | 跨能力（media / attractions） | 待立项 |

---

## 5. 待拍板项（需产品决策，不能按默认值落）

| 编号 | 待定问题 | 默认倾向 |
|---|---|---|
| C10 | 昵称是否唯一 | 允许重名 + 写明以 `publicId` 区分（不加唯一约束与冲突码，成本最低） |
| D2 | 编辑并发：乐观锁 409，还是承认最后写入者胜 | 加可选 `version` + 409 `POST_CONFLICT`（`version` 列已存在，不加等于白留） |
| D6 | 已删景点 5 分钟缓存窗口是否可接受 | 接受（已写入 spec 的已知取舍），暂不主动失效 |
| C13 | 首页热门帖子 Mock 的到期条件 | 并入后续 change 改为读 `GET /api/posts?sortBy=commentCount` |
| B2 | wanderchain 表结构基线的纳管程度 | 逐表固定列类型/长度/索引/唯一约束（与 `schema.sql` 现状一致，不发明新约束） |

---

## 6. 明确不做的

- **不把 40 条塞进一个 `spec-hardening` 大 change**：14 号闸门限制单 change 能力 ≤ 2、tasks ≤ 30、scenarios ≤ 60，40 条必然超限；且「改哪条、谁来改」会失去归属。
- **不在台账里重写缺陷正文**：台账只做编号、级别、归属、状态；正文以审查原文为准，避免两份表述漂移。
- **不为 P2 预设排期**：P2 多为产品取舍（C13、D5、D6），等业务需要时再立项，符合 AGENTS.md §9「不预先设想」。
- **不因为「审查报告已经写过」就跳过 change 的 propose**：每条 P1/P2 落地时仍需 proposal + delta spec + tasks，台账只提供立项依据。

---

## 7. 触发回看本文档的信号

1. 第 1 批 3 个 change 全部归档后，重新核对 A1/A2/B1/B2 是否真的闭环（而不是「change 归档了」就等于「缺陷修了」）。
2. 出现新的 P0 缺陷时，先判断是本文档漏收，还是审查口径失效——前者补条目，后者补审查方法。
3. 某个 P1 条目连续两个 change 都未立项时，明确降级为 P2 或写清「为什么不修」，不允许长期挂在「待立项」。
