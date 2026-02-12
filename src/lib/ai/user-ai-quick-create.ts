import UserBookmarkController from '@/controllers/UserBookmark.controller'
import UserTagController from '@/controllers/UserTag.controller'
import { getAuthedUserId } from '@/lib/auth'
import { getUnmatchedTagNames, mapTagNamesToTagIds, sanitizeAiTagNames } from '@/utils'
import { FieldConstraints } from '@cfg'
import { analyzeWebsite } from '.'

const QUICK_CREATE_DEFAULT_TAG_NAME = '其它'
const activeQuickCreateTasks = new Map<BookmarkId, Promise<void>>()

function truncateText(value: string, maxLen: number) {
  return value.trim().slice(0, maxLen)
}

export function buildQuickCreateFallbackTitle(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.host || parsed.origin || url
  } catch {
    return url
  }
}

async function runQuickCreateTask(params: {
  bookmarkId: BookmarkId
  userId: UserId
  url: string
  fallbackTitle: string
}) {
  let tags = await UserTagController.getAll(params.userId)
  try {
    const analyzed = await analyzeWebsite(
      params.url,
      tags.map((tag) => tag.name),
      params.userId
    )
    const aiTagNames = sanitizeAiTagNames(analyzed.tags)
    const missingTagNames = getUnmatchedTagNames(aiTagNames, tags)
    if (missingTagNames.length) {
      await UserTagController.tryCreateTags(missingTagNames, params.userId)
      tags = await UserTagController.getAll(params.userId)
    }

    let relatedTagIds = mapTagNamesToTagIds(aiTagNames, tags)
    if (!relatedTagIds.length) {
      const otherTag = tags.find((tag) => tag.name === QUICK_CREATE_DEFAULT_TAG_NAME)
      relatedTagIds = otherTag ? [otherTag.id] : []
    }

    await UserBookmarkController.updateByUserId(params.userId, {
      id: params.bookmarkId,
      name:
        truncateText(analyzed.title || '', FieldConstraints.MaxLen.BOOKMARK_NAME) || params.fallbackTitle,
      icon: truncateText(analyzed.favicon || '', FieldConstraints.MaxLen.URL),
      description: truncateText(analyzed.description || '', FieldConstraints.MaxLen.BOOKMARK_DESC),
      relatedTagIds,
      aiHtmlFetchFailed: false,
    })
  } catch (error) {
    console.error('AI 快速创建后台任务失败', error)
  }
}

function startQuickCreateTask(params: {
  bookmarkId: BookmarkId
  userId: UserId
  url: string
  fallbackTitle: string
}) {
  if (activeQuickCreateTasks.has(params.bookmarkId)) return
  const task = runQuickCreateTask(params).finally(() => {
    activeQuickCreateTasks.delete(params.bookmarkId)
  })
  activeQuickCreateTasks.set(params.bookmarkId, task)
}

export async function quickCreateUserBookmarkByAi(url: string) {
  const userId = await getAuthedUserId()
  const fallbackTitle = truncateText(
    buildQuickCreateFallbackTitle(url),
    FieldConstraints.MaxLen.BOOKMARK_NAME
  )
  const [defaultTag] = await UserTagController.tryCreateTags([QUICK_CREATE_DEFAULT_TAG_NAME], userId)
  const relatedTagIds = defaultTag ? [defaultTag.id] : []

  const created = await UserBookmarkController.insert({
    url,
    name: fallbackTitle,
    icon: '',
    description: '',
    relatedTagIds,
    isPinned: false,
    aiHtmlFetchFailed: false,
  })
  const bookmark = await UserBookmarkController.query({ id: created.id })

  startQuickCreateTask({
    bookmarkId: bookmark.id,
    userId,
    url,
    fallbackTitle,
  })

  return bookmark
}
