import { expect, test } from './support/fixtures'
import {
  MOBILE_VIEWPORT,
  UNAUTHENTICATED_BODY,
  businessAlerts,
  expectNoHorizontalOverflow,
  gotoPath,
  recordPostsRequests,
  saveEvidenceScreenshot,
  stubAuthApi,
  stubPostsApi,
} from './support/helpers'

/**
 * 帖子广场的浏览器验收。
 *
 * `/api/posts**` 全部由 `stubPostsApi` 桩掉：这里断言的是前端对后端的契约
 * （端点、方法、查询参数、请求体）与拿到真实 DTO 形状后的渲染结果；
 * 后端读法由 backend 的单元与容器装配测试负责，本文件不依赖 8989、MySQL 与 Redis。
 */

const FEED = '/api/posts'
/**
 * 这里的标识必须是 ULID 形状：详情路由用 `safeReturnTo` 校验
 * `[0-7][0-9A-HJKMNP-TV-Z]{25}`，含 I/L/O/U 或长度不符会被判成「帖子不存在」。
 */
const AUTHOR = '01JP0STAVTH0R000000000000A'

interface PostSummaryBody {
  publicId: string
  title: string
  coverImage: string
  tags: string[]
  status: 'published' | 'draft'
  authorPublicId: string
  createdAt: string
  updatedAt: string
  commentCount: number
  upVoteCount: number
  bookmarkCount: number
}

/** 1×1 透明 GIF：离线可加载，避免外链封面失败把 `<img>` 换成占位。 */
const INLINE_COVER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function postId(index: number): string {
  return `01JP0ST${index.toString().padStart(19, '0')}`
}

function summary(index: number, overrides: Partial<PostSummaryBody> = {}): PostSummaryBody {
  return {
    publicId: postId(index),
    title: `Post ${index}`,
    coverImage: INLINE_COVER,
    tags: ['Walking'],
    status: 'published',
    authorPublicId: AUTHOR,
    createdAt: '2026-10-11T16:30:00+08:00',
    updatedAt: '2026-10-11T16:30:00+08:00',
    commentCount: 2,
    upVoteCount: 7,
    bookmarkCount: 3,
    ...overrides,
  }
}

function detailBody(index: number): PostSummaryBody & { content: string } {
  return { ...summary(index), content: 'Body text from the server.' }
}

const NOT_STUBBED = { status: 404, body: { code: 'POST_NOT_FOUND', message: 'not stubbed' } }

test.describe('帖子广场 · 真实 feed', () => {
  test('三排序 Tab 各自下发后端排序词，limit 固定 20', async ({ page }) => {
    // When 打开 /posts 并依次切换 Latest / Hottest / Most discussed
    // Then 请求分别带 sortBy=publishedAt / upVoteCount / commentCount，且 limit 恒为 20
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, (request) => {
      if (request.method === 'GET' && request.pathname === FEED) {
        return {
          body: { items: [summary(1, { title: `Feed ${request.search.get('sortBy')}` })], nextCursor: null },
        }
      }
      return NOT_STUBBED
    })

    await gotoPath(page, '/posts')
    await expect(page.locator('[data-testid="post-card"]')).toHaveCount(1)

    const sortValues = () => requests.filter((item) => item.pathname === FEED).map((item) => item.search.get('sortBy'))
    await expect.poll(sortValues).toContain('publishedAt')

    await page.getByRole('tab', { name: 'Hottest' }).click()
    await expect(page).toHaveURL(/sortBy=hottest/)
    await expect.poll(sortValues).toContain('upVoteCount')
    await expect(page.locator('[data-testid="post-card"] h3')).toHaveText('Feed upVoteCount')

    await page.getByRole('tab', { name: 'Most discussed' }).click()
    await expect(page).toHaveURL(/sortBy=mostDiscussed/)
    await expect.poll(sortValues).toContain('commentCount')

    const feedRequests = requests.filter((item) => item.pathname === FEED)
    expect(feedRequests.length).toBeGreaterThanOrEqual(3)
    expect(feedRequests.every((item) => item.method === 'GET')).toBe(true)
    expect(feedRequests.every((item) => item.search.get('limit') === '20')).toBe(true)
  })

  test('卡片按真实 DTO 渲染标题、封面、标签、作者、时间与三列统计', async ({ page }, testInfo) => {
    // When feed 返回一条真实形状的 PostSummaryResponse
    // Then 卡片逐字段呈现，且详情链接保留当前排序
    await stubPostsApi(page, () => ({
      body: {
        items: [summary(1, { title: 'A walk through the old town', tags: ['Walking', 'Food'], upVoteCount: 7, commentCount: 2, bookmarkCount: 3 })],
        nextCursor: null,
      },
    }))

    await gotoPath(page, '/posts')
    const card = page.locator('[data-testid="post-card"]').first()

    await expect(card.locator('h3')).toHaveText('A walk through the old town')
    await expect(card.locator('h3 a')).toHaveAttribute('href', `/posts/${postId(1)}?sortBy=latest`)
    await expect(card.locator('img')).toHaveAttribute('src', INLINE_COVER)
    await expect(card.locator('ul[aria-label="Post tags"] > li')).toHaveText(['Walking', 'Food'])
    await expect(card.locator('summary')).toHaveText(`Author ID: ${AUTHOR.slice(0, 6)}…${AUTHOR.slice(-4)}`)
    await expect(card.locator('time')).toHaveAttribute('datetime', '2026-10-11T16:30:00+08:00')
    await expect(card).toContainText('Created Oct 11')
    await expect(card.locator('[aria-label="Post interactions"] > span')).toHaveText(['7', '2', '3'])
    await expect(card.locator('[aria-label="7 upvotes"]')).toBeVisible()
    await expect(card.locator('[aria-label="2 comments"]')).toBeVisible()
    await expect(card.locator('[aria-label="3 bookmarks"]')).toBeVisible()

    await saveEvidenceScreenshot(page, testInfo, 'feed-desktop')
  })

  test('游标分页按 cursor 继续请求，跨页按 publicId 去重并在到底后收尾', async ({ page }) => {
    // When 第一页带 nextCursor、第二页重复一条并收尾
    // Then 列表去重合并为 10 条，请求带 cursor-1，末尾提示到底
    const requests = recordPostsRequests(page)
    await stubPostsApi(page, (request) => {
      if (request.method !== 'GET' || request.pathname !== FEED) {
        return NOT_STUBBED
      }
      const cursor = request.search.get('cursor')
      if (cursor === null) {
        return {
          body: { items: Array.from({ length: 8 }, (_, index) => summary(index + 1)), nextCursor: 'cursor-1' },
        }
      }
      return {
        body: {
          // 第 8 条故意与第一页重复：去重后总数必须是 10。
          items: [summary(8), summary(9), summary(10)],
          nextCursor: null,
        },
      }
    })

    await gotoPath(page, '/posts')
    const cards = page.locator('[data-testid="post-card"]')
    await expect(cards).toHaveCount(8)

    await expect
      .poll(async () => {
        // 触底加载由 IntersectionObserver 驱动，逐轮滚到底直至第二页合并完成。
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        return cards.count()
      }, { timeout: 15_000 })
      .toBe(10)

    await expect(cards.locator('h3')).toHaveText(Array.from({ length: 10 }, (_, index) => `Post ${index + 1}`))
    await expect(page.locator('[role="status"]', { hasText: 'You have reached the end.' })).toBeVisible()
    expect(requests.some((item) => item.search.get('cursor') === 'cursor-1')).toBe(true)
  })

  test('首屏加载失败给出错误与重试，重试成功后渲染列表', async ({ page }) => {
    // When 首次 feed 返回 500，点击 Retry 后返回正常分页
    // Then 先出现错误提示，重试后列表就绪且错误消失
    let failing = true
    await stubPostsApi(page, () => {
      if (failing) {
        return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'boom' } }
      }
      return { body: { items: [summary(1)], nextCursor: null } }
    })

    await gotoPath(page, '/posts')
    await expect(businessAlerts(page)).toContainText('Posts could not load. Please try again.')

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.locator('[data-testid="post-card"]')).toHaveCount(1)
    await expect(businessAlerts(page)).toHaveCount(0)
  })

  test('切换排序后迟到的旧排序响应不覆盖列表', async ({ page }) => {
    // When 默认排序的响应被延迟 1.5s，期间切到 Hottest
    // Then 立即展示新排序结果，旧响应落地后也不得覆盖
    await stubPostsApi(page, (request) => {
      if (request.method !== 'GET' || request.pathname !== FEED) {
        return NOT_STUBBED
      }
      if (request.search.get('sortBy') === 'publishedAt') {
        return {
          body: { items: [summary(1, { title: 'Stale latest page' })], nextCursor: null },
          delayMs: 1500,
        }
      }
      return { body: { items: [summary(2, { title: 'Hottest page' })], nextCursor: null } }
    })

    await gotoPath(page, '/posts')
    await page.getByRole('tab', { name: 'Hottest' }).click()
    await expect(page.locator('[data-testid="post-card"] h3')).toHaveText('Hottest page')

    // 负向断言（「不会发生」）只能等一段时间再看，这是既有 E2E 对负向场景的既定做法。
    await page.waitForTimeout(1800)
    await expect(page.locator('[data-testid="post-card"] h3')).toHaveText('Hottest page')
  })

  test('首页「View all posts」入口带着最热排序进入广场', async ({ page }) => {
    // When 从首页热门帖子区块点 View all posts
    // Then 落到 /posts?sortBy=hottest，Tab 选中 Hottest，请求带 upVoteCount
    const requests = recordPostsRequests(page)
    await page.route('**/api/attractions**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) })
    })
    await stubPostsApi(page, () => ({ body: { items: [summary(1)], nextCursor: null } }))

    await gotoPath(page, '/')
    await page.getByRole('link', { name: 'View all posts' }).click()

    await expect(page).toHaveURL(/\/posts\?sortBy=hottest$/)
    await expect(page.getByRole('tab', { name: 'Hottest' })).toHaveAttribute('aria-selected', 'true')
    const sortValues = () => requests.filter((item) => item.pathname === FEED).map((item) => item.search.get('sortBy'))
    await expect.poll(sortValues).toContain('upVoteCount')
  })

  test('卡片详情链接进入真实详情路由', async ({ page }) => {
    // When 点击卡片标题
    // Then 落到 /posts/<publicId>?sortBy=latest 并渲染详情标题与游客入口
    await stubAuthApi(page, { '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY } })
    await stubPostsApi(page, (request) => {
      if (request.method !== 'GET') {
        return NOT_STUBBED
      }
      if (request.pathname === FEED) {
        return { body: { items: [summary(1, { title: 'A walk through the old town' })], nextCursor: null } }
      }
      if (request.pathname === `/api/posts/${postId(1)}`) {
        return { body: detailBody(1) }
      }
      if (request.pathname === `/api/posts/${postId(1)}/comments`) {
        return { body: { items: [], nextCursor: null } }
      }
      return NOT_STUBBED
    })

    await gotoPath(page, '/posts')
    await page.locator('[data-testid="post-card"] h3 a').first().click()

    await expect(page).toHaveURL(new RegExp(`/posts/${postId(1)}\\?sortBy=latest$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A walk through the old town')
    await expect(page.getByText('Body text from the server.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Log in to comment' })).toBeVisible()
  })
})

test.describe('帖子广场 · 窄屏', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('375px 下卡片与排序 Tab 保持可用且无横向滚动', async ({ page }, testInfo) => {
    // When 以 375×667 打开广场
    // Then 卡片可读、排序 Tab 仍在、页面不出现横向滚动
    await stubPostsApi(page, () => ({
      body: { items: [summary(1, { tags: ['Walking', 'Food'] }), summary(2)], nextCursor: null },
    }))

    await gotoPath(page, '/posts')
    await expect(page.locator('[data-testid="post-card"]')).toHaveCount(2)
    await expect(page.getByRole('tablist', { name: 'Sort posts' })).toBeVisible()
    await expectNoHorizontalOverflow(page, '帖子广场窄屏')

    await saveEvidenceScreenshot(page, testInfo, 'feed-narrow')
  })
})
