import { db, schema } from '@/db'
import { getAuthedUserId } from '@/lib/auth'
import { parseStoredFavoriteTagIds, stringifyFavoriteTagIds } from '@/lib/user-favorite-tags'
import { and, desc, eq, inArray, notInArray, or } from 'drizzle-orm'

const { userTagToTag, userTags, users } = schema

/** 在 SelectTag 基础上扩展了 `{ relatedTagIds: id[] }` */
type SelectUserTag = typeof userTags.$inferSelect & {
  relatedTagIds: TagId[]
}

/**
 * 忽略当前标签关系，创建、删除标签关系
 * - ids 为 undefined 时，不执行任何修改
 * - ids 为 [] 时，删除所有关系
 */
async function upsertRelations(userId: UserId, id: TagId, ids?: TagId[]) {
  if (!ids) return
  ids = await UserTagController.filterUserTagIds(userId, ids)
  ids = ids.filter((_id) => id !== _id)
  const relations = ids
    .map((_id) => [
      { a: id, b: _id },
      { b: id, a: _id },
    ])
    .flat()
  const tasks = [
    relations.length && db.insert(userTagToTag).values(relations).onConflictDoNothing(),
    db
      .delete(userTagToTag)
      .where(
        or(
          and(eq(userTagToTag.a, id), notInArray(userTagToTag.b, ids)),
          and(eq(userTagToTag.b, id), notInArray(userTagToTag.a, ids))
        )
      ),
  ]
  await Promise.all(tasks)
}

function isFavoriteTagIdsColumnMissingError(error: unknown) {
  if (!(error instanceof Error)) return false
  let current: unknown = error
  while (current instanceof Error) {
    const message = current.message
    if (
      message.includes('favoriteTagIds') &&
      (message.includes('no such column') || message.includes('does not exist'))
    ) {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}

function isDuplicateFavoriteTagIdsColumnError(error: unknown) {
  if (!(error instanceof Error)) return false
  let current: unknown = error
  while (current instanceof Error) {
    const message = current.message
    if (
      message.includes('favoriteTagIds') &&
      (message.includes('duplicate column') ||
        message.includes('already exists') ||
        message.includes('duplicate_column'))
    ) {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}

async function ensureFavoriteTagIdsColumn() {
  const client = db.$client as any
  const runRawSql = async (statement: string) => {
    if (typeof client.execute === 'function') {
      await client.execute(statement)
      return
    }
    if (typeof client.unsafe === 'function') {
      await client.unsafe(statement)
      return
    }
    throw new Error('当前数据库驱动不支持执行原始 SQL')
  }

  try {
    if (process.env.DB_DRIVER === 'postgresql') {
      await runRawSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "favoriteTagIds" text')
      return
    }
    await runRawSql('ALTER TABLE `user` ADD `favoriteTagIds` text')
  } catch (error) {
    if (isDuplicateFavoriteTagIdsColumnError(error)) return
    throw error
  }
}

async function getStoredFavoriteTagIds(userId: UserId) {
  try {
    const user = await db.query.users.findFirst({
      columns: { favoriteTagIds: true },
      where: eq(users.id, userId),
    })
    return parseStoredFavoriteTagIds(user?.favoriteTagIds)
  } catch (error) {
    if (!isFavoriteTagIdsColumnMissingError(error)) throw error
    await ensureFavoriteTagIdsColumn()
    const user = await db.query.users.findFirst({
      columns: { favoriteTagIds: true },
      where: eq(users.id, userId),
    })
    return parseStoredFavoriteTagIds(user?.favoriteTagIds)
  }
}

async function setStoredFavoriteTagIds(userId: UserId, ids: TagId[]) {
  try {
    await db
      .update(users)
      .set({ favoriteTagIds: stringifyFavoriteTagIds(ids) })
      .where(eq(users.id, userId))
  } catch (error) {
    if (!isFavoriteTagIdsColumnMissingError(error)) throw error
    await ensureFavoriteTagIdsColumn()
    await db
      .update(users)
      .set({ favoriteTagIds: stringifyFavoriteTagIds(ids) })
      .where(eq(users.id, userId))
  }
}

// 操作用户标签时的限制工具
function limiter(userId: UserId, tagId?: TagId) {
  if (!tagId) return eq(userTags.userId, userId)
  return and(eq(userTags.id, tagId), eq(userTags.userId, userId))
}

type InsertUserTag = Partial<SelectTag> & Pick<SelectTag, 'name'>
type UpdateUserTag = Partial<SelectTag> & Pick<SelectTag, 'id'>

const UserTagController = {
  async getAll(userId?: string) {
    userId ||= await getAuthedUserId()
    const tags = await db.query.userTags.findMany({
      where: limiter(userId),
      with: { relatedTagIds: { columns: { b: true } } },
      orderBy: [desc(userTags.sortOrder), desc(userTags.createdAt)],
      limit: 999,
    })
    return tags.map((tag) => ({
      ...tag,
      relatedTagIds: tag.relatedTagIds.map((el) => el.b),
    }))
  },

  async insert(tag: InsertUserTag) {
    const userId = await getAuthedUserId()
    // 插入之前先检查当前用户是否有相同名称的记录
    const existingTag = await db.query.userTags.findFirst({
      where: and(limiter(userId), eq(userTags.name, tag.name)),
    })
    if (existingTag) throw new Error('已存在相同名称的标签')
    const { relatedTagIds, ...resetTag } = tag
    const rows = await db
      .insert(userTags)
      .values({ ...resetTag, userId })
      .returning()
    await upsertRelations(userId, rows[0].id, relatedTagIds)
    return rows[0]
  },

  async update(tag: UpdateUserTag) {
    const userId = await getAuthedUserId()
    const { id, relatedTagIds, ...resetTag } = tag
    await db
      .update(userTags)
      .set({ ...resetTag, updatedAt: new Date() })
      .where(limiter(userId, id))
    await upsertRelations(userId, id, relatedTagIds)
  },

  async remove(tag: Pick<SelectUserTag, 'id'>) {
    const userId = await getAuthedUserId()
    const res = await db.delete(userTags).where(limiter(userId, tag.id)).returning()
    if (res.length) {
      const oldFavoriteTagIds = await getStoredFavoriteTagIds(userId)
      const nextFavoriteTagIds = oldFavoriteTagIds.filter((id) => id !== tag.id)
      if (oldFavoriteTagIds.length !== nextFavoriteTagIds.length) {
        await setStoredFavoriteTagIds(userId, nextFavoriteTagIds)
      }
    }
    return res
  },

  async getFavoriteTagIds() {
    const userId = await getAuthedUserId()
    const storedIds = await getStoredFavoriteTagIds(userId)
    const favoriteTagIds = await UserTagController.filterUserTagIds(userId, storedIds)
    if (favoriteTagIds.length !== storedIds.length) {
      await setStoredFavoriteTagIds(userId, favoriteTagIds)
    }
    return favoriteTagIds
  },

  async saveFavoriteTagIds(ids: TagId[]) {
    const userId = await getAuthedUserId()
    const favoriteTagIds = await UserTagController.filterUserTagIds(userId, ids || [])
    await setStoredFavoriteTagIds(userId, favoriteTagIds)
    return favoriteTagIds
  },

  /** 获取所有标签的名称 */
  async getAllNames() {
    return (await this.getAll()).map(({ name }) => name)
  },

  async sort(orders: { id: TagId; order: SelectTag['sortOrder'] }[]) {
    const userId = await getAuthedUserId()
    const tasks = orders.map((el) => {
      return db.update(userTags).set({ sortOrder: el.order }).where(limiter(userId, el.id))
    })
    await Promise.all(tasks)
  },

  /** 根据标签名称列表，尝试创建每个标签，并返回每个标签的 id */
  async tryCreateTags(names: string[], userId?: UserId) {
    userId ||= await getAuthedUserId()
    const res = await db
      .insert(userTags)
      .values(names.map((name) => ({ name, userId, isMain: true })))
      .returning()
      .onConflictDoNothing()
    if (res.length === names.length) return res
    // 有些标签已经创建过了，执行查询
    const existsNames = names.filter((name) => !res.some((tag) => tag.name === name))
    const existsTags = await db.query.userTags.findMany({
      where: and(inArray(userTags.name, existsNames), limiter(userId)),
    })
    return res.concat(existsTags)
  },

  /** 当前过滤函数确保返回的标签 id 列表属于指定用户  */
  async filterUserTagIds(userId: UserId, ids: TagId[]) {
    const tags = await UserTagController.getAll(userId)
    return [...new Set(ids)].filter((id) => tags.some((tag) => tag.id === id))
  },
}

export default UserTagController
