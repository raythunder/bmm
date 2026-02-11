import { describe, expect, it } from 'vitest'
import { runConcurrentBatch } from './run-concurrent-batch'

describe('user ai batch runner', () => {
  it('respects concurrency limit', async () => {
    let currentConcurrent = 0
    let maxConcurrent = 0

    await runConcurrentBatch({
      items: [1, 2, 3, 4, 5, 6],
      limit: 3,
      shouldStop: () => false,
      worker: async () => {
        currentConcurrent += 1
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
        await new Promise((resolve) => setTimeout(resolve, 15))
        currentConcurrent -= 1
      },
      onItemDone: () => {},
    })

    expect(maxConcurrent).toBeLessThanOrEqual(3)
    expect(maxConcurrent).toBeGreaterThan(1)
  })

  it('isolates item errors and continues', async () => {
    const results: boolean[] = []

    await runConcurrentBatch({
      items: [1, 2, 3],
      limit: 2,
      shouldStop: () => false,
      worker: async (item) => {
        if (item === 2) {
          throw new Error('boom')
        }
      },
      onItemDone: (result) => {
        results.push(result.ok)
      },
    })

    expect(results).toHaveLength(3)
    expect(results.filter(Boolean)).toHaveLength(2)
    expect(results.filter((ok) => !ok)).toHaveLength(1)
  })

  it('stops dispatching new items after pause signal', async () => {
    let processed = 0

    await runConcurrentBatch({
      items: [1, 2, 3, 4, 5],
      limit: 2,
      shouldStop: () => processed >= 2,
      worker: async () => {
        processed += 1
      },
      onItemDone: () => {},
    })

    expect(processed).toBe(2)
  })
})
