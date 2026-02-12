import { db, schema } from '@/db'
import { getAuthedUserId } from '@/lib/auth'
import { startUserAiBatchRunner, isUserAiBatchJobRunning } from '@/lib/ai/user-ai-batch-runner'
import type {
  PauseUserAiBatchJobInput,
  StartUserAiBatchJobInput,
  UserAiBatchJobDTO,
} from '@/lib/ai/user-ai-batch-types'
import { and, desc, eq } from 'drizzle-orm'

const TARGET_TAG_NAME = '其它'

function getJobTable() {
  const table = schema.userAiBatchJobs
  if (!table) {
    throw new Error('未找到 userAiBatchJobs 数据表，请先完成数据库迁移')
  }
  return table
}

function toDto(row: typeof schema.userAiBatchJobs.$inferSelect): UserAiBatchJobDTO {
  return {
    ...row,
    lastError: row.lastError || null,
    startedAt: row.startedAt || null,
    finishedAt: row.finishedAt || null,
  }
}

async function getLatestByUserId(userId: UserId) {
  const table = getJobTable()
  return db.query.userAiBatchJobs.findFirst({
    where: eq(table.userId, userId),
    orderBy: [desc(table.createdAt), desc(table.id)],
  })
}

async function markStaleRunningJobFailed(job: typeof schema.userAiBatchJobs.$inferSelect) {
  const table = getJobTable()
  const [nextJob] = await db
    .update(table)
    .set({
      status: 'failed',
      lastError: '后台任务执行器已中断（服务可能重启），请重新启动任务',
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(table.id, job.id))
    .returning()
  return nextJob || job
}

async function normalizeLatestJob(
  job: typeof schema.userAiBatchJobs.$inferSelect | null | undefined
) {
  if (!job) return null
  if ((job.status === 'running' || job.status === 'pausing') && !isUserAiBatchJobRunning(job.id)) {
    return markStaleRunningJobFailed(job)
  }
  return job
}

async function getTargetBookmarks(userId: UserId, tagName: string) {
  const { userBookmarks, userBookmarkToTag, userTags } = schema
  const targetTag = await db.query.userTags.findFirst({
    columns: { id: true },
    where: and(eq(userTags.userId, userId), eq(userTags.name, tagName)),
  })
  if (!targetTag) return []

  const rows = await db
    .select({
      id: userBookmarks.id,
      url: userBookmarks.url,
    })
    .from(userBookmarks)
    .innerJoin(userBookmarkToTag, eq(userBookmarkToTag.bId, userBookmarks.id))
    .where(
      and(
        eq(userBookmarks.userId, userId),
        eq(userBookmarkToTag.tId, targetTag.id),
        eq(userBookmarks.aiHtmlFetchFailed, false)
      )
    )

  return rows
}

const UserAiBatchJobController = {
  async start(input: StartUserAiBatchJobInput) {
    const userId = await getAuthedUserId()
    const table = getJobTable()
    const latestJob = await normalizeLatestJob(await getLatestByUserId(userId))
    if (latestJob && (latestJob.status === 'running' || latestJob.status === 'pausing')) {
      return toDto(latestJob)
    }

    const targets = await getTargetBookmarks(userId, TARGET_TAG_NAME)
    const now = new Date()

    if (!targets.length) {
      const [job] = await db
        .insert(table)
        .values({
          userId,
          status: 'completed',
          targetTagName: TARGET_TAG_NAME,
          concurrency: input.concurrency,
          totalCount: 0,
          processedCount: 0,
          successCount: 0,
          failedCount: 0,
          pauseRequested: false,
          startedAt: now,
          finishedAt: now,
          updatedAt: now,
        })
        .returning()
      return toDto(job)
    }

    const [job] = await db
      .insert(table)
      .values({
        userId,
        status: 'running',
        targetTagName: TARGET_TAG_NAME,
        concurrency: input.concurrency,
        totalCount: targets.length,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        pauseRequested: false,
        startedAt: now,
        finishedAt: null,
        updatedAt: now,
      })
      .returning()

    startUserAiBatchRunner({
      jobId: job.id,
      userId,
      targetTagName: TARGET_TAG_NAME,
      concurrency: input.concurrency,
      bookmarks: targets,
    })

    return toDto(job)
  },

  async getLatest() {
    const userId = await getAuthedUserId()
    const latestJob = await normalizeLatestJob(await getLatestByUserId(userId))
    return latestJob ? toDto(latestJob) : null
  },

  async pause(input: PauseUserAiBatchJobInput) {
    const userId = await getAuthedUserId()
    const table = getJobTable()
    const job = await db.query.userAiBatchJobs.findFirst({
      where: and(eq(table.id, input.jobId), eq(table.userId, userId)),
    })
    if (!job) {
      throw new Error('任务不存在')
    }
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'paused') {
      throw new Error('任务已结束，无法暂停')
    }
    const [nextJob] = await db
      .update(table)
      .set({
        pauseRequested: true,
        status: 'pausing',
        updatedAt: new Date(),
      })
      .where(eq(table.id, job.id))
      .returning()
    return toDto(nextJob || job)
  },
}

export default UserAiBatchJobController
