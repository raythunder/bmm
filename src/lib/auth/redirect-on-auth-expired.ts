import { PageRoutes } from '@cfg'
import { redirect } from 'next/navigation'
import { AuthExpiredError } from './assert-user-exists'

/**
 * 在服务端页面中统一处理登录过期：
 * - 登录态失效时直接跳转登录页
 * - 其他错误继续向上抛出，便于排查
 */
export async function withAuthExpiredRedirect<T>(run: () => Promise<T>) {
  try {
    return await run()
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      redirect(PageRoutes.LOGIN)
    }
    throw error
  }
}
