import { db, schema } from '@/db'
import { faker } from '@faker-js/faker'
import { getAuthedUserId } from '@/lib/auth'
import { startUserAiBatchRunner } from '@/lib/ai/user-ai-batch-runner'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import UserAiBatchJobController from './UserAiBatchJob.controller'

vi.mock('@/lib/auth', () => ({
  getAuthedUserId: vi.fn(),
}))

vi.mock('@/lib/ai/user-ai-batch-runner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/user-ai-batch-runner')>()
  return {
    ...actual,
    isUserAiBatchJobRunning: vi.fn(() => false),
    startUserAiBatchRunner: vi.fn(),
  }
})

const { users, userTags, userBookmarks, userBookmarkToTag } = schema

describe('UserAiBatchJobController.start', () => {
  let userId = ''
  let skippedBookmarkId = 0
  let normalBookmarkId = 0

  beforeEach(async () => {
    userId = `test-user-${faker.string.alphanumeric(12)}`
    vi.mocked(getAuthedUserId).mockResolvedValue(userId as UserId)

    await db.insert(users).values({
      id: userId,
      email: `${userId}@example.com`,
    })

    const [targetTag] = await db
      .insert(userTags)
      .values({
        userId,
        name: '其它',
      })
      .returning({
        id: userTags.id,
      })

    const [skippedBookmark] = await db
      .insert(userBookmarks)
      .values({
        userId,
        name: `skip-${faker.string.alphanumeric(8)}`,
        url: `https://skip-${faker.string.alphanumeric(8)}.example.com`,
        aiHtmlFetchFailed: true,
      })
      .returning({ id: userBookmarks.id })

    const [normalBookmark] = await db
      .insert(userBookmarks)
      .values({
        userId,
        name: `ok-${faker.string.alphanumeric(8)}`,
        url: `https://ok-${faker.string.alphanumeric(8)}.example.com`,
      })
      .returning({ id: userBookmarks.id })

    skippedBookmarkId = skippedBookmark.id
    normalBookmarkId = normalBookmark.id

    await db.insert(userBookmarkToTag).values([
      {
        bId: skippedBookmarkId,
        tId: targetTag.id,
      },
      {
        bId: normalBookmarkId,
        tId: targetTag.id,
      },
    ])
  })

  afterEach(async () => {
    vi.mocked(getAuthedUserId).mockReset()
    vi.mocked(startUserAiBatchRunner).mockReset()
    await db.delete(users).where(eq(users.id, userId))
  })

  test('should skip bookmarks that failed to fetch html in previous tasks', async () => {
    const job = await UserAiBatchJobController.start({ concurrency: 1 })

    expect(job.totalCount).toBe(1)

    const runnerMock = vi.mocked(startUserAiBatchRunner)
    expect(runnerMock).toHaveBeenCalledTimes(1)

    const [payload] = runnerMock.mock.calls[0] || []
    expect(payload?.bookmarks).toHaveLength(1)
    expect(payload?.bookmarks[0]?.id).toBe(normalBookmarkId)
    expect(payload?.bookmarks.map((item) => item.id)).not.toContain(skippedBookmarkId)
  })
})
