'use client'

import {
  actGetUserAiBatchUpdateJob,
  actPauseUserAiBatchUpdate,
  actStartUserAiBatchUpdate,
} from '@/actions'
import type { UserAiBatchJobDTO } from '@/lib/ai/user-ai-batch-types'
import { runAction } from '@/utils/client'
import { addToast, cn } from '@heroui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReButton, ReInput } from './re-export'

export interface UserAiBatchUpdateDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const statusLabelMap: Record<UserAiBatchJobDTO['status'], string> = {
  running: '运行中',
  pausing: '暂停中',
  paused: '已暂停',
  completed: '已完成',
  failed: '已失败',
}

const terminalStatuses = new Set<UserAiBatchJobDTO['status']>(['paused', 'completed', 'failed'])

export default function UserAiBatchUpdateDrawer(props: UserAiBatchUpdateDrawerProps) {
  const [job, setJob] = useState<UserAiBatchJobDTO | null>(null)
  const [concurrencyInput, setConcurrencyInput] = useState('3')
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [pausing, setPausing] = useState(false)

  const progressPercent = useMemo(() => {
    if (!job) return 0
    if (!job.totalCount) {
      return job.status === 'completed' ? 100 : 0
    }
    return Math.min(100, Math.round((job.processedCount / job.totalCount) * 100))
  }, [job])

  const isRunning = !!job && (job.status === 'running' || job.status === 'pausing')

  const fetchLatest = useCallback(async (silent = true) => {
    setLoading((old) => old || !silent)
    const res = await runAction(actGetUserAiBatchUpdateJob(), {
      errToast: { hidden: silent },
    })
    if (res.ok) {
      setJob(res.data)
      if (res.data) {
        setConcurrencyInput(String(res.data.concurrency))
      }
    }
    setLoading(false)
    return res
  }, [])

  useEffect(() => {
    if (!props.isOpen) return
    void fetchLatest(false)
  }, [fetchLatest, props.isOpen])

  useEffect(() => {
    if (!props.isOpen || !isRunning) return
    const timer = globalThis.setInterval(() => {
      void fetchLatest(true)
    }, 1500)
    return () => globalThis.clearInterval(timer)
  }, [fetchLatest, isRunning, props.isOpen])

  function validateConcurrency() {
    const concurrency = Number(concurrencyInput)
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) {
      addToast({
        color: 'warning',
        title: '并发数无效',
        description: '并发数只能是 1 到 5 的整数',
      })
      return null
    }
    return concurrency
  }

  async function startJob() {
    const concurrency = validateConcurrency()
    if (concurrency === null) return
    setStarting(true)
    const res = await runAction(actStartUserAiBatchUpdate({ concurrency }), {
      errToast: { hidden: false },
    })
    if (res.ok) {
      setJob(res.data)
      addToast({
        color: 'success',
        title: '任务已提交',
        description: '已开始批量更新“其它”标签站点',
      })
    }
    setStarting(false)
  }

  async function pauseJob() {
    if (!job) return
    setPausing(true)
    const res = await runAction(actPauseUserAiBatchUpdate({ jobId: job.id }), {
      errToast: { hidden: false },
    })
    if (res.ok) {
      setJob(res.data)
      addToast({
        color: 'primary',
        title: '已请求暂停',
        description: '进行中的任务完成后将自动暂停',
      })
    }
    setPausing(false)
  }

  const statusColorClass = (() => {
    if (!job) return 'bg-default-200 text-foreground-500'
    if (job.status === 'completed') return 'bg-success-100 text-success-700'
    if (job.status === 'failed') return 'bg-danger-100 text-danger-700'
    if (job.status === 'paused') return 'bg-warning-100 text-warning-700'
    return 'bg-primary-100 text-primary-700'
  })()

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[120] bg-black/45 transition-opacity',
          props.isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={props.onClose}
      />
      <aside
        role="dialog"
        aria-label="批量 AI 更新"
        className={cn(
          'bg-content1 border-default-200 fixed top-0 right-0 z-[130] h-full w-full max-w-md border-l p-5 shadow-2xl transition-transform',
          props.isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-foreground-700 text-xl font-semibold">批量 AI 更新</h3>
              <p className="text-foreground-500 mt-1 text-sm">自动更新标签包含“其它”的站点数据</p>
            </div>
            <button
              type="button"
              className="text-foreground-500 hover:text-foreground-700 rounded-md p-1 transition"
              onClick={props.onClose}
              aria-label="关闭抽屉"
            >
              <span className="icon-[tabler--x] text-xl" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="border-default-200 rounded-xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-foreground-600 text-sm font-medium">任务设置</p>
                <span className="text-foreground-400 text-xs">并发范围 1-5</span>
              </div>
              <div className="space-y-3">
                <ReInput
                  type="number"
                  label="并发数"
                  min={1}
                  max={5}
                  value={concurrencyInput}
                  onValueChange={setConcurrencyInput}
                />
                <div className="flex gap-2">
                  <ReButton
                    color="primary"
                    className="flex-1"
                    isLoading={starting}
                    isDisabled={isRunning}
                    onClick={startJob}
                  >
                    {isRunning ? '任务运行中' : '开始更新'}
                  </ReButton>
                  <ReButton
                    variant="flat"
                    className="flex-1"
                    isLoading={pausing}
                    isDisabled={!job || !isRunning || job.pauseRequested}
                    onClick={pauseJob}
                  >
                    {job?.pauseRequested ? '暂停请求中' : '暂停任务'}
                  </ReButton>
                </div>
              </div>
            </div>

            <div className="border-default-200 rounded-xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-foreground-600 text-sm font-medium">任务进度</p>
                <span
                  className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusColorClass)}
                >
                  {job ? statusLabelMap[job.status] : '暂无任务'}
                </span>
              </div>

              {!job && (
                <p className="text-foreground-400 text-sm">
                  尚未创建任务。点击“开始更新”后可查看执行进度。
                </p>
              )}

              {job && (
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-foreground-500">
                        已处理 {job.processedCount} / {job.totalCount}
                      </span>
                      <span className="text-foreground-700 font-medium">{progressPercent}%</span>
                    </div>
                    <div className="bg-default-200 h-2 rounded-full">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-[width]',
                          terminalStatuses.has(job.status) ? 'bg-success-500' : 'bg-primary'
                        )}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-default-100 rounded-lg px-3 py-2">
                      <p className="text-foreground-400 text-xs">成功</p>
                      <p className="text-success-600 text-lg font-semibold">{job.successCount}</p>
                    </div>
                    <div className="bg-default-100 rounded-lg px-3 py-2">
                      <p className="text-foreground-400 text-xs">失败</p>
                      <p className="text-danger-600 text-lg font-semibold">{job.failedCount}</p>
                    </div>
                    <div className="bg-default-100 rounded-lg px-3 py-2">
                      <p className="text-foreground-400 text-xs">并发</p>
                      <p className="text-foreground-700 text-lg font-semibold">{job.concurrency}</p>
                    </div>
                    <div className="bg-default-100 rounded-lg px-3 py-2">
                      <p className="text-foreground-400 text-xs">目标标签</p>
                      <p className="text-foreground-700 text-lg font-semibold">
                        {job.targetTagName}
                      </p>
                    </div>
                  </div>

                  {job.lastError && (
                    <div className="border-danger-200 bg-danger-50/60 rounded-lg border px-3 py-2">
                      <p className="text-danger-700 text-xs font-medium">最近错误</p>
                      <p className="text-danger-700 mt-1 text-sm break-all">{job.lastError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto pt-4">
            <ReButton
              variant="light"
              className="w-full"
              isDisabled={loading}
              onClick={() => void fetchLatest(false)}
            >
              刷新状态
            </ReButton>
          </div>
        </div>
      </aside>
    </>
  )
}
