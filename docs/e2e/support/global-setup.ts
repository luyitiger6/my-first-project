import { request, type FullConfig } from '@playwright/test'

/**
 * next dev 按路由做按需编译：第一次访问某个路由要等编译完成。
 * 预热全部路由，避免第一条用例把 30s 的单测预算耗在编译上。
 */
const ROUTES = ['/', '/search', '/login', '/register', '/community', '/attractions']

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) {
    throw new Error('[e2e] baseURL is not configured in playwright.config.ts')
  }

  const context = await request.newContext({ baseURL, timeout: 180_000 })
  try {
    for (const route of ROUTES) {
      const started = Date.now()
      const response = await context.get(route)
      if (!response.ok()) {
        throw new Error(`[e2e] warm-up failed for ${route}: HTTP ${response.status()}`)
      }
      await response.dispose()
      console.log(`[e2e] warmed up ${route} in ${Date.now() - started}ms`)
    }
  } finally {
    await context.dispose()
  }
}
