import { expect, test } from './support/fixtures'
import {
  ME_BODY,
  MOBILE_VIEWPORT,
  UNAUTHENTICATED_BODY,
  expectNoHorizontalOverflow,
  gotoPath,
  saveEvidenceScreenshot,
  stubAuthApi,
  stubPostsApi,
  stubProfilePagesApi,
  waitForUrl,
  type RecordedProfileRequest,
} from './support/helpers'

/**
 * 个人中心的浏览器验收：未登录分流、四项资料回填、保存后跳转与顶栏同步、
 * 服务端拒绝时输入保留。
 *
 * `/api/profile**` 与 `/api/auth/me` 全部桩掉，用真实 DTO 形状驱动界面；
 * 断言的是前端契约与状态机，后端行为由 backend 的单元与容器装配测试负责，
 * 因此不依赖 8989、MySQL 与 Redis。
 */

/** 头像必须是绝对 http(s)：本地校验不认 data URI，保存类用例会卡在表单校验上。 */
const AVATAR = 'https://cdn.example.com/me.png'

const PROFILE = {
  publicId: ME_BODY.publicId,
  displayName: 'Editor Lan',
  avatarUrl: AVATAR,
  bio: 'City walk enthusiast.',
  interests: ['hiking'],
}

/** 标签清单是资料就绪后的第二轮请求，勾选状态由它与资料的并集决定。 */
const CATALOG = ['hiking', 'food', 'photography']

const NOT_STUBBED = { status: 404, body: { code: 'PROFILE_NOT_FOUND', message: 'not stubbed' } }

test.describe('个人中心', () => {
  test('未登录：只给登录入口，不发资料请求', async ({ page }) => {
    const requests: RecordedProfileRequest[] = []
    await stubProfilePagesApi(page, (request) => {
      requests.push(request)
      return NOT_STUBBED
    })
    await stubAuthApi(page, { '/api/auth/me': { status: 401, body: UNAUTHENTICATED_BODY } })

    await gotoPath(page, '/me')

    await expect(page.getByText('Log in to manage your profile.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Log in', exact: true })).toHaveAttribute('href', '/login')
    // 未登录时不得拿空会话去换资料，也不该顺带请求标签清单。
    expect(requests.filter((request) => request.pathname.startsWith('/api/profile'))).toHaveLength(0)
  })

  test('已登录：四项资料按真实 DTO 回填，兴趣勾选来自标签清单', async ({ page }) => {
    await stubAuthApi(page, { '/api/auth/me': { body: ME_BODY } })
    await stubProfilePagesApi(page, (request) => {
      if (request.pathname === '/api/profile/interests') return { body: { items: CATALOG } }
      if (request.pathname === '/api/profile') return { body: PROFILE }
      return NOT_STUBBED
    })

    await gotoPath(page, '/me')

    await expect(page.getByLabel('Display name')).toHaveValue('Editor Lan')
    await expect(page.getByLabel('Image URL')).toHaveValue(AVATAR)
    await expect(page.getByLabel('Bio')).toHaveValue('City walk enthusiast.')
    await expect(page.getByRole('checkbox', { name: 'hiking' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'food' })).not.toBeChecked()
  })

  test('改昵称保存：只提交改动字段，跳转广场并同步顶栏昵称', async ({ page }) => {
    const writes: RecordedProfileRequest[] = []
    await stubAuthApi(page, { '/api/auth/me': { body: ME_BODY } })
    await stubProfilePagesApi(page, (request) => {
      if (request.method === 'PUT') {
        writes.push(request)
        return { body: { ...PROFILE, displayName: 'New Name' } }
      }
      if (request.pathname === '/api/profile/interests') return { body: { items: CATALOG } }
      return { body: PROFILE }
    })
    // 保存成功会跳到广场：列表端点也桩掉，断言不被真后端拖住。
    await stubPostsApi(page, () => ({ body: { items: [], nextCursor: null } }))

    await gotoPath(page, '/me')
    const nameInput = page.getByLabel('Display name')
    await expect(nameInput).toHaveValue('Editor Lan')
    await nameInput.fill('New Name')
    await page.getByRole('button', { name: 'Save' }).click()

    await waitForUrl(page, (url) => url.pathname === '/posts')
    // 只提交发生改动的字段，其余 null 表示「未提交、保持原值」。
    expect(writes).toHaveLength(1)
    expect(writes[0]?.body).toEqual({
      displayName: 'New Name',
      avatarUrl: null,
      bio: null,
      interests: null,
    })
    // 跳转前已同步 AuthProvider：顶栏昵称不用等资料重读。
    await expect(page.locator('header').getByText('New Name', { exact: true })).toBeVisible()
  })

  test('保存被服务端拒绝：提示可读错误且输入不丢', async ({ page }) => {
    await stubAuthApi(page, { '/api/auth/me': { body: ME_BODY } })
    await stubProfilePagesApi(page, (request) => {
      if (request.method === 'PUT') {
        return { status: 400, body: { code: 'VALIDATION_FAILED', message: 'Some fields are not valid.' } }
      }
      if (request.pathname === '/api/profile/interests') return { body: { items: CATALOG } }
      return { body: PROFILE }
    })

    await gotoPath(page, '/me')
    const nameInput = page.getByLabel('Display name')
    await expect(nameInput).toHaveValue('Editor Lan')
    await nameInput.fill('Retained Name')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Some fields are not valid. Check them and try again.')).toBeVisible()
    await expect(nameInput).toHaveValue('Retained Name')
  })

  test.describe('窄屏', () => {
    test.use({ viewport: MOBILE_VIEWPORT, reducedMotion: 'reduce' })

    test('375px：表单可操作且无横向滚动', async ({ page }, testInfo) => {
      await stubAuthApi(page, { '/api/auth/me': { body: ME_BODY } })
      await stubProfilePagesApi(page, (request) => {
        if (request.pathname === '/api/profile/interests') return { body: { items: CATALOG } }
        return { body: PROFILE }
      })

      await gotoPath(page, '/me')
      await expect(page.getByLabel('Display name')).toHaveValue('Editor Lan')
      await expect(page.getByRole('checkbox', { name: 'hiking' })).toBeChecked()
      await expectNoHorizontalOverflow(page, '个人中心')
      await saveEvidenceScreenshot(page, testInfo, 'profile-me-mobile')
    })
  })
})
