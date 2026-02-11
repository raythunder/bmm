import { describe, expect, it } from 'vitest'
import {
  pauseUserAiBatchJobInputSchema,
  startUserAiBatchJobInputSchema,
  userAiBatchJobStatusSchema,
} from './user-ai-batch-types'

describe('user ai batch types', () => {
  it('validates start input concurrency range', () => {
    expect(startUserAiBatchJobInputSchema.safeParse({ concurrency: 3 }).success).toBe(true)
    expect(startUserAiBatchJobInputSchema.safeParse({ concurrency: 0 }).success).toBe(false)
    expect(startUserAiBatchJobInputSchema.safeParse({ concurrency: 6 }).success).toBe(false)
  })

  it('validates pause input', () => {
    expect(pauseUserAiBatchJobInputSchema.safeParse({ jobId: 1 }).success).toBe(true)
    expect(pauseUserAiBatchJobInputSchema.safeParse({ jobId: 0 }).success).toBe(false)
  })

  it('validates status enum', () => {
    expect(userAiBatchJobStatusSchema.safeParse('running').success).toBe(true)
    expect(userAiBatchJobStatusSchema.safeParse('unknown').success).toBe(false)
  })
})
