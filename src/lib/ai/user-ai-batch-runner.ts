import UserBookmarkController from '@/controllers/UserBookmark.controller'
import UserTagController from '@/controllers/UserTag.controller'
import { db, schema } from '@/db'
import { runConcurrentBatch } from '@/lib/ai/run-concurrent-batch'
import { getUnmatchedTagNames, mapTagNamesToTagIds, sanitizeAiTagNames } from '@/utils'
import { eq, sql } from 'drizzle-orm'
import { analyzeWebsite } from '.'

interface BatchTargetBookmark {
  id: BookmarkId
  url: string
}

interface StartUserAiBatchRunnerOptions {
  jobId: number
  userId: UserId
  targetTagName: string
  concurrency: number
  bookmarks: BatchTargetBookmark[]
}

const activeJobs = new Map<number, Promise<void>>()

function getJobTable() {
  const table = schema.userAiBatchJobs
  if (!table) {
    throw new Error('未找到 userAiBatchJobs 数据表，请先完成数据库迁移')
  }
  return table
}

async function getJob(jobId: number) {
  return db.query.userAiBatchJobs.findFirst({
    where: eq(getJobTable().id, jobId),
  })
}

async function markFatal(jobId: number, message: string) {
  const table = getJobTable()
  await db
    .update(table)
    .set({
      status: 'failed',
      lastError: message,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(table.id, jobId))
}

async function shouldStopDispatch(jobId: number) {
  const job = await getJob(jobId)
  if (!job) return true
  if (job.status === 'failed' || job.status === 'completed' || job.status === 'paused') return true
  if (job.pauseRequested) return true
  return false
}

async function markTaskProgress(jobId: number, input: { ok: boolean; message?: string }) {
  const table = getJobTable()
  if (input.ok) {
    await db
      .update(table)
      .set({
        processedCount: sql`${table.processedCount} + 1`,
        successCount: sql`${table.successCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(table.id, jobId))
    return
  }

  await db
    .update(table)
    .set({
      processedCount: sql`${table.processedCount} + 1`,
      failedCount: sql`${table.failedCount} + 1`,
      lastError: input.message || '未知错误',
      updatedAt: new Date(),
    })
    .where(eq(table.id, jobId))
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '未知错误'
}

async function processSingleBookmark(params: {
  bookmark: BatchTargetBookmark
  userId: UserId
  targetTagName: string
  loadTags: (force?: boolean) => Promise<SelectTag[]>
}) {
  const tags = await params.loadTags()
  const analyzed = await analyzeWebsite(
    params.bookmark.url,
    tags.map((tag) => tag.name),
    params.userId
  )

  const aiTagNames = sanitizeAiTagNames(analyzed.tags)
  const missingTagNames = getUnmatchedTagNames(aiTagNames, tags)
  if (missingTagNames.length) {
    await UserTagController.tryCreateTags(missingTagNames, params.userId)
    await params.loadTags(true)
  }

  const latestTags = await params.loadTags()
  let relatedTagIds = mapTagNamesToTagIds(aiTagNames, latestTags)

  if (!relatedTagIds.length) {
    let otherTag = latestTags.find((tag) => tag.name === params.targetTagName)
    if (!otherTag) {
      await UserTagController.tryCreateTags([params.targetTagName], params.userId)
      const refreshedTags = await params.loadTags(true)
      otherTag = refreshedTags.find((tag) => tag.name === params.targetTagName)
    }
    relatedTagIds = otherTag ? [otherTag.id] : []
  }

  await UserBookmarkController.updateByUserId(params.userId, {
    id: params.bookmark.id,
    name: analyzed.title,
    icon: analyzed.favicon,
    description: analyzed.description,
    relatedTagIds,
  })
}

async function finalizeJob(jobId: number) {
  const table = getJobTable()
  const job = await getJob(jobId)
  if (!job) return
  if (job.status === 'failed' || job.status === 'completed') return

  await db
    .update(table)
    .set({
      status: job.pauseRequested || job.status === 'pausing' ? 'paused' : 'completed',
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(table.id, jobId))
}

async function runUserAiBatchRunner(options: StartUserAiBatchRunnerOptions) {
  if (!options.bookmarks.length) {
    await finalizeJob(options.jobId)
    return
  }

  let tagCache: SelectTag[] | null = null
  const loadTags = async (force = false) => {
    if (!tagCache || force) {
      tagCache = await UserTagController.getAll(options.userId)
    }
    return tagCache
  }

  await runConcurrentBatch({
    items: options.bookmarks,
    limit: options.concurrency,
    shouldStop: () => shouldStopDispatch(options.jobId),
    worker: (bookmark) =>
      processSingleBookmark({
        bookmark,
        userId: options.userId,
        targetTagName: options.targetTagName,
        loadTags,
      }),
    onItemDone: (result) => markTaskProgress(options.jobId, result),
  })

  await finalizeJob(options.jobId)
}

export function isUserAiBatchJobRunning(jobId: number) {
  return activeJobs.has(jobId)
}

export function startUserAiBatchRunner(options: StartUserAiBatchRunnerOptions) {
  if (activeJobs.has(options.jobId)) return

  const runner = runUserAiBatchRunner(options)
    .catch(async (error) => {
      await markFatal(options.jobId, getErrorMessage(error))
    })
    .finally(() => {
      activeJobs.delete(options.jobId)
    })
  activeJobs.set(options.jobId, runner)
}
