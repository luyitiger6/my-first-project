import { expect, test } from './support/fixtures'
import {
  MOBILE_VIEWPORT,
  expectNoHorizontalOverflow,
  gotoPath,
  saveEvidenceScreenshot,
  stubProfilePagesApi,
} from './support/helpers'

/**
 * 公开用户页的浏览器验收：资料四项与作者帖子并排渲染、资料 404 与列表失败
 * 彼此独立、昵称兜底、窄屏不溢出。
 *
 * `/api/profiles/{id}` 与 `/api/profiles/{id}/posts` 全部桩掉；断言的是前端契约
 * 与状态机，后端行为由 backend 的单元与容器装配测试负责，因此不依赖 8989。
 */

const MEMBER_ID = '01K7MEMBER0000000000000000'
const POST_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const USER_PATH = `/users/${MEMBER_ID}`

/** 头像留空：页面走字母占位，不依赖外网资源。 */
const PROFILE = {
  publicId: MEMBER_ID,
  displayName: 'Grace Lin',
  avatarUrl: '',
  bio: 'Slow travel, long walks.',
  interests: ['hiking', 'food'],
}

const POST = {
  publicId: POST_ID,
  title: 'A real route',
  coverImage: '',
  tags: ['Walking'],
  status: 'published',
  authorPublicId: MEMBER_ID,
  createdAt: '2026-10-11T16:30:00+08:00',
  updatedAt: '2026-10-11T16:30:00+08:00',
  commentCount: 0,
  upVoteCount: 0,
  bookmarkCount: 0,
}

const POSTS_PATH = `/api/profiles/${MEMBER_ID}/posts`

test.describe('公开用户页', () => {
  test('资料与作者帖子按真实 DTO 渲染，链接指向用户与帖子', async ({ page }, testInfo) => {
    await stubProfilePagesApi(page, (request) =>
      request.pathname === POSTS_PATH
        ? { body: { items: [POST], nextCursor: null } }
        : { body: PROFILE },
    )

    await gotoPath(page, USER_PATH)

    await expect(page.getByRole('heading', { name: 'Grace Lin' })).toBeVisible()
    await expect(page.getByText('Slow travel, long walks.')).toBeVisible()
    const interests = page.getByRole('list', { name: 'Interests' })
    await expect(interests.getByRole('listitem')).toHaveText(['hiking', 'food'])
    await expect(page.getByTestId('post-card')).toBeVisible()
    await expect(page.getByRole('link', { name: 'A real route' })).toHaveAttribute('href', `/posts/${POST_ID}`)
    // 卡片作者区恒指本页用户，不发批量名片请求。
    await expect(page.getByRole('link', { name: 'Grace Lin' }).first()).toHaveAttribute(
      'href',
      USER_PATH,
    )
    await saveEvidenceScreenshot(page, testInfo, 'profile-user-page')
  })

  test('资料不存在：只显示 User not found，不渲染列表区', async ({ page }) => {
    await stubProfilePagesApi(page, () => ({
      status: 404,
      body: { code: 'PROFILE_NOT_FOUND', message: '用户不存在' },
    }))

    await gotoPath(page, USER_PATH)

    await expect(page.getByRole('heading', { name: 'User not found' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Published posts' })).toHaveCount(0)
    await expect(page.getByText('No posts yet.')).toHaveCount(0)
  })

  test('列表失败不影响资料：错误提示可重试，重试后恢复', async ({ page }) => {
    let postsFail = true
    await stubProfilePagesApi(page, (request) => {
      if (request.pathname !== POSTS_PATH) return { body: PROFILE }
      return postsFail
        ? { status: 502, body: {} }
        : { body: { items: [POST], nextCursor: null } }
    })

    await gotoPath(page, USER_PATH)

    await expect(page.getByRole('heading', { name: 'Grace Lin' })).toBeVisible()
    await expect(page.getByText('Posts could not load. Please try again.')).toBeVisible()

    postsFail = false
    await page.getByRole('button', { name: 'Retry loading posts' }).click()

    await expect(page.getByTestId('post-card')).toBeVisible()
    // 重试只打列表端点，资料不被重新请求或重置。
    await expect(page.getByRole('heading', { name: 'Grace Lin' })).toBeVisible()
  })

  test('用户存在但没有已发布帖子：资料正常，列表空态', async ({ page }) => {
    await stubProfilePagesApi(page, (request) =>
      request.pathname === POSTS_PATH
        ? { body: { items: [], nextCursor: null } }
        : { body: PROFILE },
    )

    await gotoPath(page, USER_PATH)

    await expect(page.getByText('No posts yet.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Grace Lin' })).toBeVisible()
    await expect(page.getByTestId('post-card')).toHaveCount(0)
  })

  test('昵称为空按 Member 加标识后四位兜底', async ({ page }) => {
    await stubProfilePagesApi(page, (request) =>
      request.pathname === POSTS_PATH
        ? { body: { items: [], nextCursor: null } }
        : { body: { ...PROFILE, displayName: '   ' } },
    )

    await gotoPath(page, USER_PATH)

    await expect(page.getByRole('heading', { name: `Member ${MEMBER_ID.slice(-4)}` })).toBeVisible()
  })

  test.describe('窄屏', () => {
    test.use({ viewport: MOBILE_VIEWPORT, reducedMotion: 'reduce' })

    test('375px：资料与帖子卡片可读，无横向滚动', async ({ page }, testInfo) => {
      await stubProfilePagesApi(page, (request) =>
        request.pathname === POSTS_PATH
          ? { body: { items: [POST], nextCursor: null } }
          : { body: PROFILE },
      )

      await gotoPath(page, USER_PATH)
      await expect(page.getByRole('heading', { name: 'Grace Lin' })).toBeVisible()
      await expect(page.getByTestId('post-card')).toBeVisible()
      await expectNoHorizontalOverflow(page, '用户页')
      await saveEvidenceScreenshot(page, testInfo, 'profile-user-page-mobile')
    })
  })
})
