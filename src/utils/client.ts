/**
 * @file 放置只能在客户端使用的函数（如操作 localStorage 的函数）。
 */

'use client'

import { ActionResult } from '@/actions/make-action'
import { PageRoutes } from '@cfg'
import { addToast } from '@heroui/react'
import { getUnmatchedTagNames, sanitizeAiTagNames } from './index'

function jumpToLogin() {
  const path = globalThis.location?.pathname || PageRoutes.INDEX
  const query = globalThis.location?.search || ''
  const callbackUrl = encodeURIComponent(path + query)
  globalThis.location.href = `${PageRoutes.LOGIN}?callbackUrl=${callbackUrl}`
}

/**
 * 客户端执行 Action，并处理 Action 结果，自动 toast 展示错误信息，返回 ok 和 data?
 */
export async function runAction<U extends any[], Data>(
  actionRes: ActionResult<U, Data>,
  opts: {
    okMsg?: string
    errToast?: { title?: string; hidden?: boolean }
    onOk?: (data: Data) => void | Promise<void>
  } = {}
) {
  const res = await actionRes
  if (res.error) {
    if (res.error.code === 'AUTH_EXPIRED') {
      jumpToLogin()
      return { ok: false, message: res.error.msg } as const
    }
    if (!opts.errToast?.hidden) {
      addToast({
        color: 'danger',
        title: opts.errToast?.title || '操作失败',
        description: res.error.msg,
      })
    }
    return { ok: false, message: res.error.msg } as const
  }
  if (opts.okMsg) {
    addToast({
      color: 'success',
      title: '操作成功',
      description: opts.okMsg,
    })
  }
  opts.onOk?.(res.data)
  return { ok: true, data: res.data } as const
}

function mergeTags(
  currentTags: SelectTag[],
  nextTags: Array<Pick<SelectTag, 'id' | 'name'> & Partial<SelectTag>>
) {
  const merged = [...currentTags]
  for (const nextTag of nextTags) {
    const normalizedTag = {
      ...nextTag,
      relatedTagIds: nextTag.relatedTagIds || [],
    } as SelectTag
    const targetIndex = merged.findIndex((tag) => tag.id === nextTag.id)
    if (targetIndex < 0) {
      merged.push(normalizedTag)
      continue
    }
    merged[targetIndex] = {
      ...merged[targetIndex],
      ...normalizedTag,
      relatedTagIds: merged[targetIndex].relatedTagIds || normalizedTag.relatedTagIds,
    }
  }
  return merged
}

export async function ensureAiTagOptions(params: {
  aiTagNames: string[] | undefined
  currentTags: SelectTag[]
  createTagsAction: (
    names: string[]
  ) => ActionResult<any[], Array<Pick<SelectTag, 'id' | 'name'> & Partial<SelectTag>>>
}) {
  const aiTagNames = sanitizeAiTagNames(params.aiTagNames)
  const missingTagNames = getUnmatchedTagNames(aiTagNames, params.currentTags)
  if (!missingTagNames.length) {
    return {
      aiTagNames,
      tags: params.currentTags,
      createdTags: [] as SelectTag[],
    }
  }

  const createRes = await runAction(params.createTagsAction(missingTagNames), {
    errToast: { title: '自动创建标签失败' },
  })
  if (!createRes.ok) {
    return {
      aiTagNames,
      tags: params.currentTags,
      createdTags: [] as SelectTag[],
    }
  }
  const createdTags = mergeTags([], createRes.data)
  const tags = mergeTags(params.currentTags, createdTags)
  return {
    aiTagNames,
    tags,
    createdTags,
  }
}
