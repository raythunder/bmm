import { db, schema } from '@/db'
import { getAuthedUserId } from '@/lib/auth'
import { z } from '@/lib/zod'
import { getPinyin } from '@/utils'
import { DEFAULT_BOOKMARK_PAGESIZE } from '@cfg'
import { and, asc, desc, eq, inArray, notInArray, or, sql } from 'drizzle-orm'
import { createBookmarkFilterByKeyword } from './common'
import { findManyBookmarksSchema } from './schemas'
import { ensurePublicBookmarkVisibilityColumn } from './PublicBookmark.controller'
import PublicTagController from './PublicTag.controller'
import UserTagController from './UserTag.controller'

const { publicBookmarkToTag, publicBookmarks, userBookmarkToTag, userBookmarks, userTags } = schema

interface TagIdsExt {
  relatedTagIds: TagId[]
}
interface PublicVisibilityExt {
  isPublic?: boolean
}
type InsertBookmark = Partial<TagIdsExt> & Omit<typeof userBookmarks.$inferInsert, 'id' | 'userId'>
type SelectUserBookmark = TagIdsExt & PublicVisibilityExt & typeof userBookmarks.$inferSelect
type UserBookmarkWithTags = TagIdsExt & typeof userBookmarks.$inferSelect

/**
 * 完全更新 PublicBookmarkToTag 表，使与 bId 关联关联的 tId 全是 tagIds 中的 id
 */
async function fullSetBookmarkToTag(bId: BookmarkId, tagIds?: TagId[], userId?: UserId) {
  if (!tagIds?.length) return
  userId ||= await getAuthedUserId()
  tagIds = await UserTagController.filterUserTagIds(userId, tagIds)
  const task = [
    tagIds.length &&
      db
        .insert(userBookmarkToTag)
        .values(tagIds.map((tId) => ({ bId: bId, tId })))
        .onConflictDoNothing(),
    db
      .delete(userBookmarkToTag)
      .where(and(eq(userBookmarkToTag.bId, bId), notInArray(userBookmarkToTag.tId, tagIds))),
  ]
  await Promise.all(task)
}

async function attachPublicVisibility(bookmarks: UserBookmarkWithTags[]) {
  await ensurePublicBookmarkVisibilityColumn()
  const urls = [...new Set(bookmarks.map((bookmark) => bookmark.url).filter(Boolean))]
  if (!urls.length) return bookmarks.map((bookmark) => ({ ...bookmark, isPublic: false }))
  const rows = await db
    .select({ url: publicBookmarks.url, isPublic: publicBookmarks.isPublic })
    .from(publicBookmarks)
    .where(inArray(publicBookmarks.url, urls))
  const publicStatusMap = new Map(rows.map((row) => [row.url, row.isPublic]))
  return bookmarks.map((bookmark) => ({
    ...bookmark,
    isPublic:
      publicStatusMap.has(bookmark.url) && publicStatusMap.get(bookmark.url) !== false,
  }))
}

async function resolvePublicTagIdsFromUserTags(userId: UserId, tagIds: TagId[]) {
  if (!tagIds.length) return []
  const uniqueTagIds = [...new Set(tagIds)]
  const rows = await db.query.userTags.findMany({
    columns: { name: true },
    where: and(eq(userTags.userId, userId), inArray(userTags.id, uniqueTagIds)),
  })
  if (!rows.length) return []
  const names = [...new Set(rows.map((row) => row.name).filter(Boolean))]
  const publicTags = await PublicTagController.tryCreateTags(names)
  const idByName = new Map(publicTags.map((tag) => [tag.name, tag.id]))
  return names
    .map((name) => idByName.get(name))
    .filter((id): id is TagId => typeof id !== 'undefined')
}

async function replacePublicBookmarkTagIds(bId: BookmarkId, tagIds: TagId[]) {
  await db.delete(publicBookmarkToTag).where(eq(publicBookmarkToTag.bId, bId))
  if (!tagIds.length) return
  await db
    .insert(publicBookmarkToTag)
    .values(tagIds.map((tId) => ({ bId, tId })))
    .onConflictDoNothing()
}

async function syncPublicBookmarkVisibility(input: {
  userId: UserId
  bookmark: UserBookmarkWithTags
  isPublic: boolean
}) {
  await ensurePublicBookmarkVisibilityColumn()
  const { userId, bookmark, isPublic } = input
  if (!isPublic) {
    await db
      .update(publicBookmarks)
      .set({ isPublic: false, updatedAt: new Date() })
      .where(eq(publicBookmarks.url, bookmark.url))
    return
  }

  const publicTagIds = await resolvePublicTagIdsFromUserTags(userId, bookmark.relatedTagIds || [])
  const pinyin = bookmark.pinyin || getPinyin(bookmark.name)
  const existingPublicBookmark = await db.query.publicBookmarks.findFirst({
    where: eq(publicBookmarks.url, bookmark.url),
  })

  if (existingPublicBookmark) {
    await db
      .update(publicBookmarks)
      .set({
        name: bookmark.name,
        url: bookmark.url,
        icon: bookmark.icon,
        description: bookmark.description,
        pinyin,
        isPublic: true,
        updatedAt: new Date(),
      })
      .where(eq(publicBookmarks.id, existingPublicBookmark.id))
    await replacePublicBookmarkTagIds(existingPublicBookmark.id, publicTagIds)
    return
  }

  const rows = await db
    .insert(publicBookmarks)
    .values({
      name: bookmark.name,
      url: bookmark.url,
      icon: bookmark.icon,
      description: bookmark.description,
      pinyin,
      isPublic: true,
    })
    .returning()
  await replacePublicBookmarkTagIds(rows[0].id, publicTagIds)
}

function userLimiter(userId: UserId, bookmarkId?: BookmarkId) {
  if (!bookmarkId) return eq(userBookmarks.userId, userId)
  return and(eq(userBookmarks.id, bookmarkId), eq(userBookmarks.userId, userId))
}

const UserBookmarkController = {
  async insert(bookmark: InsertBookmark) {
    const userId = await getAuthedUserId()
    // 插入之前先检查当前用户是否有相同网址或名称的记录
    const count = await db.$count(
      userBookmarks,
      and(
        eq(userBookmarks.userId, userId),
        or(eq(userBookmarks.url, bookmark.url), eq(userBookmarks.name, bookmark.name))
      )
    )
    if (count > 0) throw new Error('已存在相同网址或名称的书签')
    bookmark.pinyin ||= getPinyin(bookmark.name)
    const rows = await db
      .insert(userBookmarks)
      .values({ ...bookmark, userId })
      .returning()
    await fullSetBookmarkToTag(rows[0].id, bookmark.relatedTagIds)
    return { ...rows[0], isPublic: false }
  },
  async query(bookmark: Pick<SelectUserBookmark, 'id'>) {
    const res = await db.query.userBookmarks.findFirst({
      where: userLimiter(await getAuthedUserId(), bookmark.id),
      with: { relatedTagIds: true },
    })
    if (!res) throw new Error('书签不存在')
    const [item] = await attachPublicVisibility([
      {
        ...res,
        relatedTagIds: res.relatedTagIds.map((el) => el.tId),
      },
    ])
    return item
  },
  async togglePublic(input: Pick<SelectUserBookmark, 'id'> & { isPublic: boolean }) {
    const userId = await getAuthedUserId()
    const target = await db.query.userBookmarks.findFirst({
      where: userLimiter(userId, input.id),
      with: { relatedTagIds: true },
    })
    if (!target) throw new Error('书签不存在')
    const bookmark = {
      ...target,
      relatedTagIds: target.relatedTagIds.map((el) => el.tId),
    }
    await syncPublicBookmarkVisibility({
      userId,
      bookmark,
      isPublic: input.isPublic,
    })
    return {
      ...bookmark,
      isPublic: input.isPublic,
    }
  },
  async updateByUserId(
    userId: UserId,
    bookmark: Partial<SelectUserBookmark> & Pick<SelectUserBookmark, 'id'>
  ) {
    const { relatedTagIds, id, isPublic, ...resetBookmark } = bookmark
    const tasks = []
    tasks.push(fullSetBookmarkToTag(id, relatedTagIds, userId))
    if (Object.keys(resetBookmark).length) {
      if (resetBookmark.name && !resetBookmark.pinyin) {
        resetBookmark.pinyin = getPinyin(resetBookmark.name)
      }
      tasks.push(
        db
          .update(userBookmarks)
          .set({
            ...resetBookmark,
            updatedAt: new Date(),
          })
          .where(userLimiter(userId, id))
          .returning()
      )
    }
    await Promise.all(tasks)
    if (typeof isPublic === 'boolean') {
      const target = await db.query.userBookmarks.findFirst({
        where: userLimiter(userId, id),
        with: { relatedTagIds: true },
      })
      if (!target) throw new Error('书签不存在')
      await syncPublicBookmarkVisibility({
        userId,
        bookmark: {
          ...target,
          relatedTagIds: target.relatedTagIds.map((el) => el.tId),
        },
        isPublic,
      })
    }
  },
  async update(bookmark: Partial<SelectUserBookmark> & Pick<SelectUserBookmark, 'id'>) {
    return UserBookmarkController.updateByUserId(await getAuthedUserId(), bookmark)
  },
  async delete(bookmark: Pick<SelectUserBookmark, 'id'>) {
    const res = await db
      .delete(userBookmarks)
      .where(userLimiter(await getAuthedUserId(), bookmark.id))
      .returning()
    if (res[0]?.url) {
      await db
        .update(publicBookmarks)
        .set({ isPublic: false, updatedAt: new Date() })
        .where(eq(publicBookmarks.url, res[0].url))
    }
    return res
  },
  /**
   * 高级搜索书签列表
   */
  async findMany(query?: z.output<typeof findManyBookmarksSchema>) {
    query ||= findManyBookmarksSchema.parse({})
    const { keyword, tagIds = [], tagNames, page, limit, sorterKey } = query
    const userId = await getAuthedUserId()
    const getFilters = async () => {
      const filters = [userLimiter(userId)]
      if (keyword) {
        filters.push(createBookmarkFilterByKeyword(userBookmarks, keyword))
      }
      if (tagNames?.length) {
        const tags = await UserTagController.getAll(userId)
        for (const name of tagNames) {
          const tag = tags.find((el) => el.name === name)
          tag && tagIds.push(tag.id)
        }
      }
      const newTagIds = await UserTagController.filterUserTagIds(userId, tagIds)
      if (newTagIds.length) {
        const findTargetBIds = db
          .select({ bId: userBookmarkToTag.bId })
          .from(userBookmarkToTag)
          .where(inArray(userBookmarkToTag.tId, newTagIds))
          .groupBy(userBookmarkToTag.bId)
          .having(sql`COUNT(DISTINCT ${userBookmarkToTag.tId}) = ${newTagIds.length}`)
        filters.push(inArray(userBookmarks.id, findTargetBIds))
      }
      return and(...filters)
    }
    const filters = await getFilters()
    const [total, list] = await Promise.all([
      db.$count(userBookmarks, filters),
      await db.query.userBookmarks.findMany({
        where: filters,
        with: { relatedTagIds: true },
        limit,
        offset: (page - 1) * limit,
        orderBy: (() => {
          const sort = sorterKey.startsWith('-') ? desc : asc
          const field = sorterKey.includes('update')
            ? userBookmarks.updatedAt
            : sorterKey.includes('create')
              ? userBookmarks.createdAt
              : null
          return field ? sort(field) : undefined
        })(),
      }),
    ])

    const withVisibility = await attachPublicVisibility(
      list.map((item) => ({
        ...item,
        relatedTagIds: item.relatedTagIds.map((el) => el.tId),
      }))
    )
    return {
      total,
      hasMore: total > page * limit,
      list: withVisibility,
    }
  },
  async random() {
    const list = await db.query.userBookmarks.findMany({
      with: { relatedTagIds: true },
      orderBy: sql`RANDOM()`,
      limit: DEFAULT_BOOKMARK_PAGESIZE,
      where: eq(userBookmarks.userId, await getAuthedUserId()),
    })
    const withVisibility = await attachPublicVisibility(
      list.map((item) => ({
        ...item,
        relatedTagIds: item.relatedTagIds.map((el) => el.tId),
      }))
    )
    return { list: withVisibility }
  },
  /** 获取所有书签数量 */
  async total() {
    const userId = await getAuthedUserId()
    const filters = eq(userBookmarks.userId, userId)
    return await db.$count(userBookmarks, filters)
  },
  /** 获取最近更新的 $DEFAULT_BOOKMARK_PAGESIZE 个书签 */
  async recent() {
    const res = await db.query.userBookmarks.findMany({
      where: eq(userBookmarks.userId, await getAuthedUserId()),
      orderBy(fields, op) {
        return op.desc(fields.updatedAt)
      },
      with: { relatedTagIds: true },
      limit: DEFAULT_BOOKMARK_PAGESIZE,
    })
    const withVisibility = await attachPublicVisibility(
      res.map((item) => ({
        ...item,
        relatedTagIds: item.relatedTagIds.map((el) => el.tId),
      }))
    )
    return { list: withVisibility }
  },
  /** 根据关键词搜索书签 */
  async search(keyword: string) {
    const res = await db.query.userBookmarks.findMany({
      where: and(
        createBookmarkFilterByKeyword(userBookmarks, keyword),
        eq(userBookmarks.userId, await getAuthedUserId())
      ),
      with: { relatedTagIds: true },
      limit: 100,
    })
    const withVisibility = await attachPublicVisibility(
      res.map((item) => ({
        ...item,
        relatedTagIds: item.relatedTagIds.map((el) => el.tId),
      }))
    )
    return { list: withVisibility }
  },
}

export default UserBookmarkController
