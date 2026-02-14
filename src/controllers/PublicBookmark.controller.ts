import { db, schema } from '@/db'
import { auth } from '@/lib/auth'
import { z } from '@/lib/zod'
import { getPinyin } from '@/utils'
import { DEFAULT_BOOKMARK_PAGESIZE } from '@cfg'
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'
import { createBookmarkFilterByKeyword } from './common'
import PublicTagController from './PublicTag.controller'
import { findManyBookmarksSchema } from './schemas'

const { publicBookmarkToTag, publicBookmarks } = schema

interface TagIdsExt {
  relatedTagIds: TagId[]
}
export type InsertPublicBookmark = Partial<TagIdsExt> & typeof publicBookmarks.$inferInsert
type SelectBookmark = TagIdsExt & typeof publicBookmarks.$inferSelect
export type { SelectBookmark as SelectPublicBookmark }

/**
 * 完全更新 PublicBookmarkToTag 表，使与 bId 关联关联的 tId 全是 tagIds 中的 id
 */
export async function fullSetBookmarkToTag(bId: BookmarkId, tagIds: TagId[]) {
  const task = [
    db
      .insert(publicBookmarkToTag)
      .values(tagIds.map((tId) => ({ bId: bId, tId })))
      .onConflictDoNothing(),
    db
      .delete(publicBookmarkToTag)
      .where(and(eq(publicBookmarkToTag.bId, bId), notInArray(publicBookmarkToTag.tId, tagIds))),
  ]
  await Promise.all(task)
  return
}

function isPublicVisibilityColumnMissingError(error: unknown) {
  if (!(error instanceof Error)) return false
  let current: unknown = error
  while (current instanceof Error) {
    const message = current.message
    if (
      message.includes('isPublic') &&
      (message.includes('no such column') || message.includes('does not exist'))
    ) {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}

function isDuplicatePublicVisibilityColumnError(error: unknown) {
  if (!(error instanceof Error)) return false
  let current: unknown = error
  while (current instanceof Error) {
    const message = current.message
    if (
      message.includes('isPublic') &&
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

async function runRawSql(statement: string) {
  const client = db.$client as any
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

export async function ensurePublicBookmarkVisibilityColumn() {
  try {
    await db
      .select({ isPublic: publicBookmarks.isPublic })
      .from(publicBookmarks)
      .limit(1)
  } catch (error) {
    if (!isPublicVisibilityColumnMissingError(error)) throw error
    try {
      if (process.env.DB_DRIVER === 'postgresql') {
        await runRawSql(
          'ALTER TABLE "publicBookmarks" ADD COLUMN IF NOT EXISTS "isPublic" boolean DEFAULT true'
        )
        await runRawSql(
          'UPDATE "publicBookmarks" SET "isPublic" = true WHERE "isPublic" IS NULL'
        )
      } else {
        await runRawSql('ALTER TABLE `publicBookmarks` ADD `isPublic` integer DEFAULT 1')
        await runRawSql('UPDATE `publicBookmarks` SET `isPublic` = 1 WHERE `isPublic` IS NULL')
      }
    } catch (migrationError) {
      if (!isDuplicatePublicVisibilityColumnError(migrationError)) throw migrationError
    }
  }
}

async function getPublicVisibilityFilter() {
  const session = await auth()
  if (session?.user?.id) return undefined
  return or(eq(publicBookmarks.isPublic, true), isNull(publicBookmarks.isPublic))
}

const PublicBookmarkController = {
  async insert(bookmark: InsertPublicBookmark) {
    await ensurePublicBookmarkVisibilityColumn()
    const { relatedTagIds, ...resetBookmark } = bookmark
    // 插入之前先检查当前用户是否有相同网址或名称的记录
    const count = await db.$count(
      publicBookmarks,
      or(eq(publicBookmarks.url, resetBookmark.url), eq(publicBookmarks.name, resetBookmark.name))
    )
    if (count > 0) throw new Error('书签已存在')
    resetBookmark.pinyin ||= getPinyin(resetBookmark.name)
    const rows = await db.insert(publicBookmarks).values(resetBookmark).returning()
    const id = rows[0].id
    if (relatedTagIds?.length) {
      await fullSetBookmarkToTag(id, relatedTagIds)
    }
    return rows[0]
  },
  async query(bookmark: Pick<SelectBookmark, 'id'>) {
    await ensurePublicBookmarkVisibilityColumn()
    const res = await db.query.publicBookmarks.findFirst({
      where: eq(publicBookmarks.id, bookmark.id),
      with: { relatedTagIds: true },
    })
    if (!res) throw new Error('书签不存在')
    return {
      ...res,
      relatedTagIds: res.relatedTagIds.map((el) => el.tId),
    }
  },
  async update(bookmark: Partial<SelectBookmark> & Pick<SelectBookmark, 'id'>) {
    await ensurePublicBookmarkVisibilityColumn()
    const { relatedTagIds, id, ...resetBookmark } = bookmark
    const tasks = []
    if (relatedTagIds?.length) {
      tasks.push(fullSetBookmarkToTag(id, relatedTagIds))
    }
    if (Object.keys(resetBookmark).length) {
      tasks.push(
        db
          .update(publicBookmarks)
          .set({
            ...resetBookmark,
            updatedAt: new Date(),
            pinyin: resetBookmark.name ? getPinyin(resetBookmark.name) : undefined,
          })
          .where(eq(publicBookmarks.id, id))
          .returning()
          .then((res) => res[0])
      )
    }
    const res = await Promise.all(tasks)
    return res.pop()
  },
  async delete(bookmark: Pick<SelectBookmark, 'id'>) {
    await ensurePublicBookmarkVisibilityColumn()
    const res = await db
      .delete(publicBookmarks)
      .where(eq(publicBookmarks.id, bookmark.id))
      .returning()
    return res
  },
  /**
   * 高级搜索书签列表
   */
  async findMany(query?: z.output<typeof findManyBookmarksSchema>) {
    await ensurePublicBookmarkVisibilityColumn()
    query ||= findManyBookmarksSchema.parse({})
    const { keyword, tagIds = [], tagNames, page, limit, sorterKey } = query
    const visibilityFilter = await getPublicVisibilityFilter()
    const getFilters = async () => {
      const filters = []
      if (visibilityFilter) {
        filters.push(visibilityFilter)
      }
      if (keyword) {
        filters.push(createBookmarkFilterByKeyword(publicBookmarks, keyword))
      }
      if (tagNames?.length) {
        const tags = await PublicTagController.getAll()
        for (const name of tagNames) {
          const tag = tags.find((el) => el.name === name)
          tag && tagIds.push(tag.id)
        }
      }
      if (tagIds.length) {
        const findTargetBIds = db
          .select({ bId: publicBookmarkToTag.bId })
          .from(publicBookmarkToTag)
          .where(inArray(publicBookmarkToTag.tId, tagIds))
          .groupBy(publicBookmarkToTag.bId)
          .having(sql`COUNT(DISTINCT ${publicBookmarkToTag.tId}) = ${tagIds.length}`)
        filters.push(inArray(publicBookmarks.id, findTargetBIds))
      }
      return filters.length ? and(...filters) : undefined
    }
    const filters = await getFilters()
    const [list, [{ total }]] = await Promise.all([
      await db.query.publicBookmarks.findMany({
        where: filters,
        with: { relatedTagIds: true },
        limit,
        offset: (page - 1) * limit,
        orderBy: (() => {
          const sort = sorterKey.startsWith('-') ? desc : asc
          const field = sorterKey.includes('update')
            ? publicBookmarks.updatedAt
            : sorterKey.includes('create')
              ? publicBookmarks.createdAt
              : null

          return field ? sort(field) : undefined
        })(),
      }),
      db.select({ total: count() }).from(publicBookmarks).where(filters),
    ])

    return {
      total,
      hasMore: total > page * limit,
      list: list.map((item) => ({
        ...item,
        relatedTagIds: item.relatedTagIds.map((el) => el.tId),
      })),
    }
  },
  async random() {
    await ensurePublicBookmarkVisibilityColumn()
    const visibilityFilter = await getPublicVisibilityFilter()
    const list = await db.query.publicBookmarks.findMany({
      with: { relatedTagIds: true },
      orderBy: sql`RANDOM()`,
      limit: DEFAULT_BOOKMARK_PAGESIZE,
      where: visibilityFilter,
    })
    return {
      list: list.map((item) => ({
        ...item,
        relatedTagIds: item.relatedTagIds.map((el) => el.tId),
      })),
    }
  },
  /** 获取所有书签数量 */
  async total() {
    await ensurePublicBookmarkVisibilityColumn()
    const visibilityFilter = await getPublicVisibilityFilter()
    if (!visibilityFilter) {
      return await db.$count(publicBookmarks)
    }
    return await db.$count(publicBookmarks, visibilityFilter)
  },
  /** 获取最近更新的 $DEFAULT_BOOKMARK_PAGESIZE 个书签 */
  async recent() {
    await ensurePublicBookmarkVisibilityColumn()
    const visibilityFilter = await getPublicVisibilityFilter()
    const res = await db.query.publicBookmarks.findMany({
      orderBy(fields, op) {
        return op.desc(fields.updatedAt)
      },
      with: { relatedTagIds: true },
      limit: DEFAULT_BOOKMARK_PAGESIZE,
      where: visibilityFilter,
    })
    return {
      list: res.map((item) => ({
        ...item,
        relatedTagIds: item.relatedTagIds.map((el) => el.tId),
      })),
    }
  },
  /** 根据关键词搜索书签 */
  async search(keyword: string) {
    await ensurePublicBookmarkVisibilityColumn()
    const visibilityFilter = await getPublicVisibilityFilter()
    const filters = visibilityFilter
      ? and(createBookmarkFilterByKeyword(publicBookmarks, keyword), visibilityFilter)
      : createBookmarkFilterByKeyword(publicBookmarks, keyword)
    const res = await db.query.publicBookmarks.findMany({
      where: filters,
      with: { relatedTagIds: true },
      limit: 100,
    })
    return {
      list: res.map((item) => ({
        ...item,
        relatedTagIds: item.relatedTagIds.map((el) => el.tId),
      })),
    }
  },
}

export default PublicBookmarkController
