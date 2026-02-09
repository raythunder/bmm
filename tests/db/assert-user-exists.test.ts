import { db, schema } from '@/db'
import { EXPIRED_AUTH_MSG, assertUserExists } from '@/lib/auth/assert-user-exists'
import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, test } from 'vitest'

describe('assertUserExists', () => {
  let userId: UserId | null = null

  afterEach(async () => {
    if (!userId) return
    await db.delete(schema.users).where(eq(schema.users.id, userId))
    userId = null
  })

  test('用户存在时不抛错', async () => {
    const [user] = await db
      .insert(schema.users)
      .values({
        name: faker.person.fullName(),
        email: faker.internet.email(),
      })
      .returning()
    userId = user.id
    await expect(assertUserExists(user.id)).resolves.toBeUndefined()
  })

  test('用户不存在时抛出登录态失效错误', async () => {
    await expect(assertUserExists(faker.string.alphanumeric(21))).rejects.toThrowError(
      EXPIRED_AUTH_MSG
    )
  })
})
