import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

const EXPIRED_AUTH_MSG = '登录状态已失效，请重新登录后重试'
const AUTH_EXPIRED_ERROR_CODE = 'AUTH_EXPIRED'

export class AuthExpiredError extends Error {
  readonly code = AUTH_EXPIRED_ERROR_CODE

  constructor(msg = EXPIRED_AUTH_MSG) {
    super(msg)
    this.name = 'AuthExpiredError'
  }
}

/**
 * 确保当前登录态对应的用户记录仍存在于数据库中。
 * 常见场景：数据库被重置后，浏览器里旧 JWT 仍然有效。
 */
export async function assertUserExists(userId: UserId) {
  const user = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(schema.users.id, userId),
  })
  if (!user) throw new AuthExpiredError()
}

export { AUTH_EXPIRED_ERROR_CODE, EXPIRED_AUTH_MSG }
