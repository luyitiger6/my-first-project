# Tasks

## 1. 建表脚本

- [x] 1.1 `backend/src/main/resources/schema.sql` 的 `posts` 建表语句新增 `up_vote_count`、`comment_count`、`bookmark_count` 三列（均 `INT NOT NULL DEFAULT 0`）与三条具名 CHECK（`ck_posts_up_vote_count`、`ck_posts_comment_count`、`ck_posts_bookmark_count`，均 `>= 0`）；验证：`Select-String -Path backend\src\main\resources\schema.sql -Pattern 'up_vote_count|comment_count|bookmark_count'` 同时命中列定义与 CHECK
- [x] 1.2 同文件 `posts` 新增 `idx_posts_up_vote_count`、`idx_posts_comment_count` 两条索引，形状 `(status, deleted_at, 计数列 DESC, id DESC)`；验证：两条 `KEY idx_posts_` 语句存在，且列顺序与 `idx_posts_feed` 逐项对照一致
- [x] 1.3 更新 `schema.sql` 头部注释，补「posts 新增三计数列，已有本地库需 drop 重建或手工 ALTER」；验证：注释中出现三列名与该约定

## 2. 建表闸门

- [x] 2.1 `harness/checks/06-schema-check.ps1` 的 wanderchain `Tables` 补 `post_comments`、`post_votes`、`post_bookmarks`；`Indexes` 补三表各自的唯一键/业务索引 9 个，再加 `idx_posts_up_vote_count`、`idx_posts_comment_count`；验证：`$expectations[$authDb]` 的 Tables 为 8 项，Indexes 覆盖 `schema.sql` 中 wanderchain 的全部具名索引
- [x] 2.2 同清单 `Constraints` 补 `fk_post_comments_*`（3）、`ck_post_comments_version`、`fk_post_votes_*`（2）、`ck_post_votes_direction`、`ck_post_votes_version`、`fk_post_bookmarks_*`（2）、`ck_post_bookmarks_version`，以及三条计数列 CHECK；`CreatedAt` 补三张表；验证：清单与 `schema.sql` 的命名约束逐项一一对应，无多无漏
- [x] 2.3 生成列断言改为「表+列」组合：`Generated = @('accounts.active_email', 'post_votes.active_account_id', 'post_bookmarks.active_account_id')`，查询改为 `SELECT CONCAT(table_name, '.', column_name) ... WHERE extra LIKE '%GENERATED%'`；验证：临时删掉 `post_bookmarks.active_account_id` 后闸门失败并指出该表该列，恢复后通过
- [x] 2.4 新增计数列存在性断言：`posts` 的 `up_vote_count`、`comment_count`、`bookmark_count` 存在且 `column_default = '0'`；验证：临时删掉任一列后闸门以非 0 退出，恢复后通过
- [x] 2.5 运行建表闸门；验证：`powershell -File harness\checks\06-schema-check.ps1` 退出码 0，摘要输出包含 `8 tables in wanderchain`

## 3. 集成验证

- [x] 3.1 change 工件自洽；验证：`openspec validate add-post-count-columns` 返回 valid，specs delta 的 Scenario 均使用 4 个 `#`
- [x] 3.2 后端在未映射计数列时行为不变；验证：`mvn -f backend/pom.xml test` 退出码 0（06 闸门重建本地库后执行，确认 `schema.sql` 新结构可被应用正常加载）

## Workflow follow-up

- 归档后把本 change 新增的 Scenario 登记进 `docs/spec-evidence.json`，并跑 `powershell -File harness\checks\13-spec-evidence-check.ps1`。
- 归档后跑 `powershell -File harness\checks\10-contract-check.ps1`，确认无 DTO 变更时契约闸门仍通过。
- `sync-interaction-counts` 实施前，本地已有库须按 `schema.sql` 头部注释重建或 `ALTER TABLE posts` 补三列。
