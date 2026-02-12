'use client'

import { actQueryUserBookmark, actQuickCreateUserBookmarkByAi } from '@/actions'
import { ReButton, ReInput } from '@/components'
import { z } from '@/lib/zod'
import { runAction } from '@/utils/client'
import { FieldConstraints, IconNames } from '@cfg'
import { addToast } from '@heroui/react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useHomePageContext } from '../ctx'

const quickAddUrlSchema = z.url()
const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 2 * 60 * 1000

interface PendingBookmark {
  id: BookmarkId
  baselineUpdatedAtMs: number
  startAtMs: number
}

export default function QuickAddBookmark() {
  const { upsertBookmark } = useHomePageContext()
  const [urlInput, setUrlInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingBookmarks, setPendingBookmarks] = useState<PendingBookmark[]>([])
  const isPollingRef = useRef(false)

  useEffect(() => {
    if (!pendingBookmarks.length) return
    const timer = globalThis.setInterval(() => {
      if (isPollingRef.current) return
      isPollingRef.current = true
      void (async () => {
        const now = Date.now()
        const nextPending: PendingBookmark[] = []
        for (const item of pendingBookmarks) {
          if (now - item.startAtMs > POLL_TIMEOUT_MS) continue
          const res = await runAction(actQueryUserBookmark({ id: item.id }), {
            errToast: { hidden: true },
          })
          if (!res.ok) {
            nextPending.push(item)
            continue
          }
          upsertBookmark(res.data)
          const latestUpdatedAtMs = new Date(res.data.updatedAt).getTime()
          if (latestUpdatedAtMs <= item.baselineUpdatedAtMs) {
            nextPending.push(item)
          }
        }
        setPendingBookmarks(nextPending)
      })().finally(() => {
        isPollingRef.current = false
      })
    }, POLL_INTERVAL_MS)
    return () => globalThis.clearInterval(timer)
  }, [pendingBookmarks, upsertBookmark])

  async function submit() {
    const candidateUrl = urlInput.trim()
    const validatedUrl = quickAddUrlSchema.safeParse(candidateUrl)
    if (!validatedUrl.success) {
      addToast({
        color: 'warning',
        title: 'URL 无效',
        description: '请输入有效的网站链接',
      })
      return
    }

    if (validatedUrl.data.length > FieldConstraints.MaxLen.URL) {
      addToast({
        color: 'warning',
        title: 'URL 过长',
        description: `网址长度不能超过 ${FieldConstraints.MaxLen.URL} 字符`,
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await runAction(actQuickCreateUserBookmarkByAi({ url: validatedUrl.data }), {
        okMsg: '任务已提交，正在后台 AI 解析',
        errToast: { title: '提交失败' },
      })
      if (!res.ok) return
      upsertBookmark(res.data)
      setPendingBookmarks((old) => [
        ...old.filter((item) => item.id !== res.data.id),
        {
          id: res.data.id,
          baselineUpdatedAtMs: new Date(res.data.updatedAt).getTime(),
          startAtMs: Date.now(),
        },
      ])
      setUrlInput('')
    } finally {
      setSubmitting(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit()
  }

  return (
    <section className="border-default-200 bg-content1/70 mb-6 rounded-2xl border px-4 py-4">
      <form className="max-xs:flex-col flex items-end gap-3" onSubmit={onSubmit}>
        <ReInput
          type="url"
          value={urlInput}
          label="快速添加站点"
          placeholder="输入网站 URL，提交后自动 AI 解析并创建"
          isRequired
          maxLength={FieldConstraints.MaxLen.URL}
          classNames={{
            base: 'w-full',
          }}
          startContent={<span className={IconNames.SEARCH} />}
          onValueChange={setUrlInput}
        />
        <ReButton
          type="submit"
          color="primary"
          isLoading={submitting}
          isDisabled={!urlInput.trim()}
          startContent={<span className={IconNames.STARS} />}
          className="max-xs:w-full shrink-0"
        >
          AI 快速创建
        </ReButton>
      </form>
    </section>
  )
}
