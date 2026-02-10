import { db, schema } from '@/db'
import { getAuthedUserId } from '@/lib/auth'
import {
  parseStoredAiModelSettings,
  resolveActiveOpenAICompatibleConfig,
  validateAiModelSettings,
} from '@/lib/ai/model-settings'
import { eq } from 'drizzle-orm'

const UserAiModelController = {
  async get() {
    const userId = await getAuthedUserId()
    return this.getByUserId(userId)
  },
  async save(input: unknown) {
    const userId = await getAuthedUserId()
    const settings = validateAiModelSettings(input)
    await db
      .update(schema.users)
      .set({
        aiModelSettings: JSON.stringify(settings),
      })
      .where(eq(schema.users.id, userId))
    return settings
  },
  async getByUserId(userId: UserId) {
    const user = await db.query.users.findFirst({
      columns: { aiModelSettings: true },
      where: eq(schema.users.id, userId),
    })
    return parseStoredAiModelSettings(user?.aiModelSettings)
  },
  async resolveActiveOpenAIConfigByUserId(userId?: UserId) {
    if (!userId) return null
    const settings = await this.getByUserId(userId)
    return resolveActiveOpenAICompatibleConfig(settings)
  },
}

export default UserAiModelController
