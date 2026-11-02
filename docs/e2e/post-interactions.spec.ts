import { expect, test } from './support/fixtures'
import {
  ME_BODY,
  MOBILE_VIEWPORT,
  UNAUTHENTICATED_BODY,
  businessAlerts,
  expectNoHorizontalOverflow,
  gotoPath,
  recordPostsRequests,
  saveEvidenceScreenshot,
  stubAuthApi,
  stubPostsApi,
  type RecordedPostsRequest,
  type PostsStubResponse,
} from './support/helpers'

/**
 * 帖子详情的浏览器验收：详情分区、身份分流、投票/收藏、评论/回复/分页/删除。
 *
 * `/api/posts**` 与 `/api/auth/me` 全部桩掉，用真实 DTO 形状驱动界面；
 * 这里断言前端契约与状态机，后端行为由 backend 测试负责，因此不依赖 8989、MySQL 与 Redis。
 *
 * 标识必须写成 ULID 形状：详情路由用 `safeReturnTo` 校验
 * `[0-7][0-9A-HJKMNP-TV-Z]{25}`，含 I/L/O/U 或长度不符会直接被判成「帖子不存在」。
 */

const POST_ID = '01JP0ST0000000000000000001'
const COMMENT_ID = '01JC0MMENT0000000000000000'
const NEW_COMMENT_ID = '01JC0MMENT0000000000000001'
const AUTHOR = '01JP0STAVTH0R000000000000A'
const OWNER = ME_BODY.publicId
const INLINE_COVER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const BASE = `/api/posts/${POST_ID}`

const NOT_STUBBED = { status: 404, body: { code: 'POST_NOT_FOUND', message: 'not stubbed' } }

function postBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    publicId: POST_ID,
    title: 'A walk through the old town',
    content: 'Body text from the server.',
    coverImage: INLINE_COVER,
    tags: ['Walking'],
    status: 'published',
    authorPublicId: AUTHOR,
    createdAt: '2026-10-11T16:30:00+08:00',
    updatedAt: '2026-10-11T16:30:00+08:00',
    commentCount: 0,
    upVoteCount: 7,
    bookmarkCount: 3,
    ...overrides,
  }
}

function commentBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    publicId: COMMENT_ID,
    postPublicId: POST_ID,
    parentPublicId: null,
    authorPublicId: OWNER,
    content: 'Comment from the server',
    createdAt: '2026-10-11T16:30:00+08:00',
    updatedAt: '2026-10-11T16:30:00+08:00',
    ...overrides,
  }
}

interface StubOptions {
  detail?: (request: RecordedPostsRequest) => PostsStubResponse
  comments?: (request: RecordedPostsRequest) => PostsStubResponse
  personal?: (request: RecordedPostsRequest) => PostsStubResponse
  write?: (request: RecordedPostsRequest) => PostsStubResponse
}

/** 详情页四个读取端点与三类写端点的统一桩；个别用例覆盖需要的分支。 */
function stubDetailPage(options: StubOptions = {}) {
  return (request: RecordedPostsRequest): PostsStubResponse => {
    if (request.method === 'GET' && request.pathname === BASE) {
      return options.detail?.(request) ?? { body: postBody() }
    }
    if (request.method === 'GET' && request.pathname === `${BASE}/comments`) {
      return options.comments?.(request) ?? { body: { items: [], nextCursor: null } }
    }
    if (request.method === 'GET' && request.pathname === `${BASE}/interactions/me`) {
      return options.personal?.(request) ?? { body: { voteDirection: null, bookmarked: false } }
    }
    if (request.method !== 'GET') {
      if (options.write) return options.write(request)
      if (request.pathname === `${BASE}/comments`) {
        return { status: 201, body: commentBody({ publicId: NEW_COMMENT_ID }) }
      }
      if (request.pathname === `${BASE}/comments/${COMMENT_ID}`) return { status: 204 }
      if (request.pathname === `${BASE}/votes`) {
        return request.method === 'DELETE'
          ? { status: 204 }
          : { status: 201, body: { publicId: '01JV0TE0000000000000000001', postPublicId: POST_ID, authorPublicId: OWNER, direction: 'up', createdAt: '2026-10-11T16:30:00+08:00', updatedAt: '2026-10-11T16:30:00+08:00' } }
      }
      if (request.pathname === `${BASE}/bookmarks`) {
        return request.method === 'DELETE'
          ? { status: 204 }
          : { status: 201, body: { publicId: '01JB00KMARK000000000000000', postPublicId: POST_ID, authorPublicId: OWNER, createdAt: '2026-10-11T16:30:00+08:00', updatedAt: '2026-10-11T16:30:00+08:00' } }
      }
    }
    return NOT_STUBBED
  }
}

async function openDetailAsGuest(page: import('@playwright/test').Page): Promise<void> {
  await stubAuthApi(page, { '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY } })
  await gotoPath(page, `/posts/${POST_ID}`)
}

async function openDetailAsUser(page: import('@playwright/test').Page): Promise<void> {
  await stubAuthApi(page, { '/api/auth/me': { status: 200, body: ME_BODY } })
  await gotoPath(page, `/posts/${POST_ID}`)
}

test.describe('帖子详情 · 桌面端', () => {
  test('游客可读正文，互动入口只引导登录且不发写请求', async ({ page }) => {
    // When 游客打开详情并点击 Upvote
    // Then 正文可读、提示登录，点击后展开登录引导，全程没有写请求
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, stubDetailPage())
    await openDetailAsGuest(page)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A walk through the old town')
    await expect(page.getByText('Body text from the server.')).toBeVisible()
    await expect(page.getByText('Log in to vote, bookmark, or join the conversation.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Log in to comment' })).toBeVisible()

    await page.getByRole('button', { name: 'Upvote' }).click()
    await expect(
      page.getByText('Log in to continue. Your previous action will not be submitted automatically.'),
    ).toBeVisible()

    expect(requests.filter((item) => item.method !== 'GET')).toHaveLength(0)
  })

  test('登录用户看到服务端选中态，取消投票发 DELETE 并按校准结果重读', async ({ page }) => {
    // When 服务端已确认 up 投票，用户点击 Upvote
    // Then 先发 DELETE /votes，再重读详情与本人状态，界面回落到未选中与 7 赞成
    let voteDirection: 'up' | null = 'up'
    let upVotes = 8
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, (request) => {
      if (request.pathname === `${BASE}/votes` && request.method === 'DELETE') {
        voteDirection = null
        upVotes = 7
        return { status: 204 }
      }
      if (request.pathname === `${BASE}/interactions/me`) {
        return { body: { voteDirection, bookmarked: false } }
      }
      if (request.pathname === BASE && request.method === 'GET') {
        return { body: postBody({ upVoteCount: upVotes }) }
      }
      return stubDetailPage()(request)
    })
    await openDetailAsUser(page)

    const upvote = page.getByRole('button', { name: 'Upvote' })
    await expect(upvote).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[aria-label="8 upvotes"]')).toBeVisible()

    await upvote.click()
    await expect(upvote).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('[aria-label="7 upvotes"]')).toBeVisible()
    await expect(page.getByText('Saved. Server data refreshed.')).toBeVisible()

    const deletes = requests.filter((item) => item.method === 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].pathname).toBe(`${BASE}/votes`)
  })

  test('帖子不存在时显示未找到，且不再请求评论与个人状态', async ({ page }) => {
    // When 详情返回 404
    // Then 页面给出未找到，评论与互动状态请求都不发
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, stubDetailPage({ detail: () => ({ status: 404, body: { code: 'POST_NOT_FOUND', message: 'gone' } }) }))
    await openDetailAsGuest(page)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Post not found')
    expect(requests.some((item) => item.pathname === `${BASE}/comments`)).toBe(false)
    expect(requests.some((item) => item.pathname === `${BASE}/interactions/me`)).toBe(false)
  })

  test('详情读取失败给出错误分区，重试成功后渲染正文', async ({ page }) => {
    // When 首次详情 500，点击 Retry reading post 后成功
    // Then 先出现错误分区，重试后正文可读
    let failing = true
    await stubPostsApi(page, stubDetailPage({
      detail: () => failing
        ? { status: 500, body: { code: 'INTERNAL_ERROR', message: 'boom' } }
        : { body: postBody() },
    }))
    await openDetailAsGuest(page)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Post could not load')
    failing = false
    await page.getByRole('button', { name: 'Retry reading post' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A walk through the old town')
    await expect(businessAlerts(page)).toHaveCount(0)
  })

  test('写成功但校准失败时提示不要重复提交，并锁住互动', async ({ page }) => {
    // When 投票 201，随后校准读详情 500
    // Then 提示刷新失败但写入已提交，上游按钮全部锁住
    let detailCalls = 0
    await stubPostsApi(page, stubDetailPage({
      detail: () => {
        detailCalls += 1
        return detailCalls === 1
          ? { body: postBody() }
          : { status: 500, body: { code: 'INTERNAL_ERROR', message: 'refresh failed' } }
      },
    }))
    await openDetailAsUser(page)

    await page.getByRole('button', { name: 'Upvote' }).click()

    await expect(businessAlerts(page)).toContainText('Submitted, but refresh failed.')
    await expect(page.getByRole('button', { name: 'Upvote' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Bookmark' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Check server data' })).toBeVisible()
  })

  test('写结果未知时要求先核对，后续点击不再发请求', async ({ page }) => {
    // When 投票返回 503（结果未知）
    // Then 提示结果未知、锁住互动，写请求只发过一次
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, stubDetailPage({
      write: (request) => request.pathname === `${BASE}/votes`
        ? { status: 503, body: { code: 'UNAVAILABLE', message: 'gateway down' } }
        : NOT_STUBBED,
    }))
    await openDetailAsUser(page)

    await page.getByRole('button', { name: 'Upvote' }).click()

    await expect(businessAlerts(page)).toContainText('The write result is unknown.')
    await expect(page.getByRole('button', { name: 'Upvote' })).toBeDisabled()
    expect(requests.filter((item) => item.method === 'POST' && item.pathname === `${BASE}/votes`)).toHaveLength(1)
  })

  test('发表评论使用去空白后的正文与空父级，成功后校准出评论与清空输入', async ({ page }) => {
    // When 输入带首尾空白的评论文本提交
    // Then 请求体 content 已去空白、parentPublicId 为 null，列表重读并清空输入
    let created = false
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, stubDetailPage({
      comments: () => ({ body: created
        ? { items: [commentBody({ publicId: NEW_COMMENT_ID, content: 'Hello there' })], nextCursor: null }
        : { items: [], nextCursor: null } }),
      write: (request) => {
        if (request.pathname === `${BASE}/comments` && request.method === 'POST') {
          created = true
          return { status: 201, body: commentBody({ publicId: NEW_COMMENT_ID, content: 'Hello there' }) }
        }
        return NOT_STUBBED
      },
    }))
    await openDetailAsUser(page)

    const input = page.getByRole('textbox', { name: 'Your comment' })
    await input.fill('  Hello there  ')
    await page.getByRole('button', { name: 'Post comment' }).click()

    await expect(page.getByText('Hello there')).toBeVisible()
    await expect(input).toHaveValue('')

    const posts = requests.filter((item) => item.method === 'POST' && item.pathname === `${BASE}/comments`)
    expect(posts).toHaveLength(1)
    expect(posts[0].body).toEqual({ content: 'Hello there', parentPublicId: null })
  })

  test('回复入口带出父级目标，提交体携带 parentPublicId', async ({ page }) => {
    // When 点击某条根评论的 Reply 并提交
    // Then 输入框上方显示被回复对象，请求体 parentPublicId 指向该评论
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, stubDetailPage({
      comments: () => ({ body: { items: [commentBody({ content: 'Parent comment' })], nextCursor: null } }),
    }))
    await openDetailAsUser(page)

    await page.getByRole('button', { name: 'Reply' }).click()
    await expect(page.getByText(`Replying to comment ID: ${COMMENT_ID}`)).toBeVisible()

    await page.getByRole('textbox', { name: 'Your reply' }).fill('Thanks for sharing')
    await page.getByRole('button', { name: 'Post reply' }).click()

    await expect
      .poll(() => requests.filter((item) => item.method === 'POST' && item.pathname === `${BASE}/comments`).map((item) => item.body))
      .toEqual([{ content: 'Thanks for sharing', parentPublicId: COMMENT_ID }])
  })

  test('评论分页按 cursor 续读并追加到列表', async ({ page }) => {
    // When 第一页带 nextCursor，点击 Load more comments
    // Then 第二次请求带 cursor，列表同时包含两页内容并提示到底
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, stubDetailPage({
      comments: (request) => request.search.get('cursor') === null
        ? { body: { items: [commentBody({ content: 'First page comment' })], nextCursor: 'comment-cursor-1' } }
        : { body: { items: [commentBody({ publicId: NEW_COMMENT_ID, content: 'Second page comment' })], nextCursor: null } },
    }))
    await openDetailAsUser(page)

    await expect(page.getByText('First page comment')).toBeVisible()
    await page.getByRole('button', { name: 'Load more comments' }).click()

    await expect(page.getByText('Second page comment')).toBeVisible()
    await expect(page.getByText('You have reached the end of the comments.')).toBeVisible()
    expect(requests.some((item) => item.search.get('cursor') === 'comment-cursor-1')).toBe(true)
  })

  test('本人评论删除需行内确认，取消不发请求、确认后才 DELETE', async ({ page }) => {
    // When 点击 Delete 后先取消，再确认删除
    // Then 取消时不发请求；确认后发出唯一一次 DELETE 并重读出空列表
    let deleted = false
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, stubDetailPage({
      comments: () => ({ body: { items: deleted ? [] : [commentBody()], nextCursor: null } }),
      write: (request) => {
        if (request.method === 'DELETE' && request.pathname === `${BASE}/comments/${COMMENT_ID}`) {
          deleted = true
          return { status: 204 }
        }
        return NOT_STUBBED
      },
    }))
    await openDetailAsUser(page)

    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Delete this comment? Its replies will remain.')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    expect(requests.filter((item) => item.method === 'DELETE')).toHaveLength(0)

    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Confirm delete' }).click()

    await expect(page.getByText('No comments yet.')).toBeVisible()
    const deletes = requests.filter((item) => item.method === 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].pathname).toBe(`${BASE}/comments/${COMMENT_ID}`)
  })

  test('Escape 取消删除确认且不发请求', async ({ page }) => {
    // When 打开删除确认后按 Escape
    // Then 确认面板收起，DELETE 请求没有发出
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, stubDetailPage({
      comments: () => ({ body: { items: [commentBody()], nextCursor: null } }),
    }))
    await openDetailAsUser(page)

    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Delete this comment? Its replies will remain.')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByText('Delete this comment? Its replies will remain.')).toHaveCount(0)
    expect(requests.filter((item) => item.method === 'DELETE')).toHaveLength(0)
  })
})

test.describe('帖子详情 · 窄屏与 reduced-motion', () => {
  test.use({ viewport: MOBILE_VIEWPORT, reducedMotion: 'reduce' })

  test('375px 且 reduced-motion 下评论输入可用、无横向滚动', async ({ page }, testInfo) => {
    // When 375×667 且偏好减少动效时打开详情并输入评论
    // Then 输入与计数正常、页面不出现横向滚动
    await stubPostsApi(page, stubDetailPage())
    await openDetailAsUser(page)

    const input = page.getByRole('textbox', { name: 'Your comment' })
    await input.fill('Nice walk')
    await expect(page.getByText('9/2000')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Post comment' })).toBeEnabled()
    await expectNoHorizontalOverflow(page, '帖子详情窄屏')

    await saveEvidenceScreenshot(page, testInfo, 'detail-narrow')
  })
})
