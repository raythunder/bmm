import { z } from '@/lib/zod'

export const userAiBatchJobStatusValues = [
  'running',
  'pausing',
  'paused',
  'completed',
  'failed',
] as const

export const userAiBatchJobStatusSchema = z.enum(userAiBatchJobStatusValues)

export type UserAiBatchJobStatus = z.output<typeof userAiBatchJobStatusSchema>

export const startUserAiBatchJobInputSchema = z.object({
  concurrency: z
    .number()
    .int({ message: '并发数必须为整数' })
    .min(1, { message: '并发数最小为 1' })
    .max(5, { message: '并发数最大为 5' }),
})

export type StartUserAiBatchJobInput = z.output<typeof startUserAiBatchJobInputSchema>

export const pauseUserAiBatchJobInputSchema = z.object({
  jobId: z.number().int().positive(),
})

export type PauseUserAiBatchJobInput = z.output<typeof pauseUserAiBatchJobInputSchema>

export const userAiBatchJobSchema = z.object({
  id: z.number().int(),
  userId: z.string().min(1),
  status: userAiBatchJobStatusSchema,
  targetTagName: z.string().min(1),
  concurrency: z.number().int(),
  totalCount: z.number().int(),
  processedCount: z.number().int(),
  successCount: z.number().int(),
  failedCount: z.number().int(),
  pauseRequested: z.boolean(),
  lastError: z.string().nullable(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type UserAiBatchJobDTO = z.output<typeof userAiBatchJobSchema>
