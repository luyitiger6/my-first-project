# Design

## Context

动机见 `proposal.md`。补两条只有动手时才需要交代的现状约束：

- `README.md` 与 `AGENTS.md` 同时受 `05-scaffold-check` 的改名演练间接约束：`scaffold/rename.mjs` 只改这两份文档里的展示名与 slug，演练结束后会扫描旧身份残留。新增措辞不能引入新的 `AIWorkSpace` / `ai-workspace` 之外的旧身份写法，否则改名演练会失败。
- `07-doc-consistency` 会把 `AGENTS.md` 里 `<!-- harness-checks: ... -->` 那一行与 `harness/checks/*.ps1` 的实际文件集合逐项比对。改 §6 目录树时这行必须逐字节不动，否则闸门直接退出码 1。

## Goals / Non-Goals

**Goals:**

- README 里出现的每个环境变量、每个闸门文件名、每条运行期依赖描述，都能在仓库里被指到出处（脚本或 `application.yml`）。
- `AGENTS.md` 的 backend 目录树覆盖到 `service/auth` 与 `web/auth` 这一层，读树就能判断业务逻辑在哪，不必展开文件。

**Non-Goals:**

- 不让 README 变成第二份 AGENTS.md。README 面向人（怎么跑起来），AGENTS.md 面向 agent（怎么改代码）；重叠处只留一句结论，展开留给 AGENTS.md。
- 不建立「文档与脚本自动比对」的新闸门。本变更只消当前欠账，不治根因。

## Decisions

### D1 凭据说明按「谁读它」分三组，不按端口分

`SCHEMA_DB_*` / `SCHEMA_REDIS_*` 是闸门自用的变量，`WANDERCHAIN_*` 是应用启动与 `02-test` 用的变量，两套名字在脚本里已经固定。按读者分组，使用者能直接判断「我要跑哪一步、该配哪些」；按端口分组会把两套变量混成一张表，还是得翻脚本才知道谁需要谁。

- **备选：只保留 `WANDERCHAIN_*`，让闸门读同一组** —— 否决。那要改 `06-schema-check.ps1` / `09-redis-check.ps1`，超出本变更「不动闸门」的边界，且会让闸门与应用争抢同一份凭据。

### D2 §设计取舍 保留条目，但把「原则」改写成「可验证的事实」

原来的「运行期不接数据库/缓存」是一句原则，原则过时了没人会发现。改写成「依赖哪两个实例、连不上会怎样」这种一验证就露馅的描述，下次再漂移时更容易被抓住。

- **备选：删掉 §设计取舍** —— 否决。它是人理解「为什么这么搭」的入口，删了 README 就只剩命令。

### D3 目录树写「一句话职责」，不写文件清单

已有节点就是这个粒度（`config/ AuthProperties（wanderchain.auth 配置项）`），新增节点沿用。`service/auth` 下三个子目录各给一句职责，不逐个列类名——类还会继续增加（5.3 之后还有登录、登出、重置密码），列类名必然二次过期。

- **备选：列全量类名** —— 否决，理由同上；真要查类，`impl/` 和 `support/` 的目录名已经把「它是不是业务能力」说清楚了。

## Risks / Trade-offs

- [README 修完还会再漂] → 本次只清欠账。根因是「文档与脚本之间没有机器校验」，而 `07-doc-consistency` 目前只查闸门清单与技术栈 token，不查环境变量名。扩不扩另开变更，本次明确不做。
- [改 AGENTS.md 撞 `07-doc-consistency`] → tasks 2.4 要求逐字节确认标记行未变，tasks 3.1 单独复跑该闸门取证。
- [措辞引入改名演练残留] → tasks 3.3 跑全量闸门，其中 `05-scaffold-check` 会兜住这类残留。

## Open Questions

<!-- 无。 -->
