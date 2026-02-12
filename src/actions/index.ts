'use server'

import {
  CredentialsController,
  SystemSettingsController,
  UserAiBatchJobController,
  PublicBookmarkController,
  PublicTagController,
  UserAiModelController,
  UserBookmarkController,
  UserTagController,
} from '@/controllers'
import {
  pauseUserAiBatchJobInputSchema,
  startUserAiBatchJobInputSchema,
} from '@/lib/ai/user-ai-batch-types'
import {
  aiAnalyzeRelatedTagsInput,
  aiAnalyzeWebsiteInput,
  checkGithubOAuthConfig,
  extractHtmlInfoInput,
  quickCreateUserBookmarkByAiInput,
} from './items'
import { makeAction as make } from './make-action'

/// PublicBookmark
export const actTotalPublicBookmarks = make(PublicBookmarkController.total, { guard: false })
export const actFindPublicBookmarks = make(PublicBookmarkController.findMany, { guard: false })
export const actInsertPublicBookmark = make(PublicBookmarkController.insert, { guard: 'admin' })
export const actQueryPublicBookmark = make(PublicBookmarkController.query, { guard: 'admin' })
export const actDeletePublicBookmark = make(PublicBookmarkController.delete, { guard: 'admin' })
export const actUpdatePublicBookmark = make(PublicBookmarkController.update, { guard: 'admin' })

/// PublicTag
export const actGetAllPublicTags = make(PublicTagController.getAll, { guard: false })
export const actInsertPublicTag = make(PublicTagController.insert, { guard: 'admin' })
export const actDeletePublicTag = make(PublicTagController.remove, { guard: 'admin' })
export const actUpdatePublicTag = make(PublicTagController.update, { guard: 'admin' })
export const actUpdatePublicTagSortOrders = make(PublicTagController.sort, { guard: 'admin' })
export const actTryCreatePublicTags = make(PublicTagController.tryCreateTags, { guard: 'admin' })

/// UserTag
export const actGetAllUserTags = make(UserTagController.getAll)
export const actInsertUserTag = make(UserTagController.insert)
export const actUpdateUserTag = make(UserTagController.update)
export const actDeleteUserTag = make(UserTagController.remove)
export const actUpdateUserTagSortOrders = make(UserTagController.sort)
export const actTryCreateUserTags = make(UserTagController.tryCreateTags)

/// UserBookmark
export const actTotalUserBookmarks = make(UserBookmarkController.total)
export const actFindUserBookmarks = make(UserBookmarkController.findMany)
export const actInsertUserBookmark = make(UserBookmarkController.insert)
export const actQueryUserBookmark = make(UserBookmarkController.query)
export const actDeleteUserBookmark = make(UserBookmarkController.delete)
export const actUpdateUserBookmark = make(UserBookmarkController.update)
export const actQuickCreateUserBookmarkByAi = make(quickCreateUserBookmarkByAiInput)
export const actSaveUserAiModelSettings = make(UserAiModelController.save)
export const actGetSystemSettings = make(SystemSettingsController.get, { guard: false })
export const actSaveSystemSettings = make(SystemSettingsController.save, { guard: 'admin' })
export const actStartUserAiBatchUpdate = make(UserAiBatchJobController.start, {
  schema: startUserAiBatchJobInputSchema,
})
export const actGetUserAiBatchUpdateJob = make(UserAiBatchJobController.getLatest)
export const actPauseUserAiBatchUpdate = make(UserAiBatchJobController.pause, {
  schema: pauseUserAiBatchJobInputSchema,
})

/// 解析网站、标签
export const actExtractHtmlInfo = make(extractHtmlInfoInput)
export const actAnalyzeWebsite = make(aiAnalyzeWebsiteInput)
export const actAnalyzeRelatedTags = make(aiAnalyzeRelatedTagsInput)

/// 账号认证
export const actRegisterUser = make(CredentialsController.create, { guard: false })
export const actVerifyUser = make(CredentialsController.verify, { guard: false })

export const actCheckGithubOAuthConfig = make(checkGithubOAuthConfig, { guard: false })
