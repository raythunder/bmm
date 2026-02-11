interface RunConcurrentBatchOptions<T> {
  items: T[]
  limit: number
  shouldStop: () => Promise<boolean> | boolean
  worker: (item: T) => Promise<void>
  onItemDone: (params: { ok: boolean; message?: string }) => Promise<void> | void
  getErrorMessage?: (error: unknown) => string
}

const defaultGetErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '未知错误'
}

export async function runConcurrentBatch<T>(options: RunConcurrentBatchOptions<T>) {
  let index = 0
  const workerCount = Math.max(1, Math.min(options.limit, options.items.length || 1))
  const getErrorMessage = options.getErrorMessage || defaultGetErrorMessage

  const workers = Array.from({ length: workerCount }).map(async () => {
    while (true) {
      if (await options.shouldStop()) return
      const currentIndex = index++
      const item = options.items[currentIndex]
      if (item === undefined) return
      try {
        await options.worker(item)
        await options.onItemDone({ ok: true })
      } catch (error) {
        await options.onItemDone({ ok: false, message: getErrorMessage(error) })
      }
    }
  })

  await Promise.all(workers)
}
