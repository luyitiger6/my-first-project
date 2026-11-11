# Tasks

## 1. backend 补真证据

- [x] 1.1 `WriteRateLimitInterceptorTest` 新增 `twoInterceptorsShareTheSameQuota`：两个实例共用一个 redis，B 耗尽后 A 被拦

## 2. 闸门 13 支持锚点与策略

- [x] 2.1 `Test-EvidenceRef` 解析 `<path>#<anchor>`，锚点在文件中找不到即 FAIL；纯标识符按词边界、其余按子串
- [x] 2.2 读取账本 `evidencePolicy.methodAnchorPatterns`：命中场景的 `test` 引用必须带锚点；缺省时行为不变

## 3. 账本补录

- [x] 3.1 顶层加 `evidencePolicy`
- [x] 3.2 `wanderchain-auth / 全站写操作来源限流 / 多实例共用同一额度` 改指 `WriteRateLimitInterceptorTest.java#twoInterceptorsShareTheSameQuota`
- [x] 3.3 `wanderchain-direct-messages / 未读计数与已读标记 / 已读与新消息并发时不丢` 补 `#markReadRecomputesByPosition`
- [x] 3.4 `wanderchain-post-interactions / 收藏写入同步帖子收藏数 / 重复收藏幂等` 补 `#repeatedBookmarkIsIdempotent`

## 4. 验证

- [ ] 4.1 新增后端用例通过
- [ ] 4.2 `13-spec-evidence-check.ps1` PASSED
- [ ] 4.3 `15-test-weakening-check.ps1` PASSED（只增不减）
