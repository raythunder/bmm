'use client'

import {
  actAnalyzeWebsite,
  actExtractHtmlInfo,
  actInsertPublicBookmark,
  actInsertUserBookmark,
  actTryCreatePublicTags,
  actTryCreateUserTags,
  actUpdatePublicBookmark,
  actUpdateUserBookmark,
} from '@/actions'
import type { BookmarkEditorValue } from '@/components/BookmarkEditorFields'
import BookmarkEditorFields from '@/components/BookmarkEditorFields'
import { SlugPageLayout } from '@/components'
import { usePageUtil, useSlug } from '@/hooks'
import { z } from '@/lib/zod'
import { mapTagNamesToTagIds } from '@/utils'
import { ensureAiTagOptions, runAction } from '@/utils/client'
import { PageRoutes } from '@cfg'
import { useSetState, useUpdateEffect } from 'ahooks'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { fromZodError } from 'zod-validation-error'

const formSchema = z.object({
  url: z.string().min(1, { message: '请输入 URL' }).url({ message: '请输入有效的 URL' }),
  name: z.string().min(1, { message: '请输入名称' }),
  icon: z
    .string()
    .url({ message: '请输入有效的图标地址' })
    .or(z.string().refine((v) => !v)),
})

type Bookmark = Pick<
  BookmarkEditorValue,
  'url' | 'name' | 'icon' | 'description' | 'relatedTagIds' | 'isPinned'
>

export interface BookmarkSlugPageProps {
  bookmark: SelectBookmark | null
  tags: SelectTag[]
  afterSave: () => Promise<void>
}

export default function BookmarkSlugPage(props: BookmarkSlugPageProps) {
  const slug = useSlug()
  const pageUtil = usePageUtil()
  const router = useRouter()

  const [bookmark, setBookmark] = useSetState<Bookmark>({
    url: '',
    name: '',
    icon: '',
    description: '',
    relatedTagIds: [],
    isPinned: false,
  })
  const [invalidInfos, setInvalidInfos] = useSetState<z.infer<typeof formSchema>>({
    url: '',
    name: '',
    icon: '',
  })
  const [state, setState] = useState({ loading: false })
  const [tagOptions, setTagOptions] = useState(props.tags)

  useUpdateEffect(() => {
    if (!props.bookmark) return
    setBookmark({
      ...props.bookmark,
      icon: props.bookmark.icon || '',
      description: props.bookmark.description || '',
      relatedTagIds: props.bookmark.relatedTagIds || [],
      isPinned: !!props.bookmark.isPinned,
    })
  }, [props.bookmark])
  useUpdateEffect(() => {
    setTagOptions(props.tags)
  }, [props.tags])
  useUpdateEffect(() => {
    !state.loading && validateAll()
  }, [state.loading])

  function validateItem(key: keyof typeof invalidInfos) {
    const res = formSchema.shape[key].safeParse(bookmark[key])
    const info = res.success
      ? ''
      : fromZodError(res.error, { prefix: null, maxIssuesInMessage: 1 }).message
    setInvalidInfos((s) => ({ ...s, [key]: info }))
    return res.success
  }

  function validateAll() {
    return Object.keys(invalidInfos)
      .map((key) => validateItem(key as any))
      .every((v) => v)
  }

  function onChangeBookmark(patch: Partial<BookmarkEditorValue>) {
    setBookmark((prev) => ({ ...prev, ...patch }))
  }

  async function parseWebsite() {
    setState({ loading: true })
    const res = await runAction(actExtractHtmlInfo(bookmark.url))
    setState({ loading: false })
    if (!res.ok) return
    setBookmark(res.data)
  }

  async function aiAnalyzeWebsite() {
    setState({ loading: true })
    try {
      const { data } = await runAction(actAnalyzeWebsite(bookmark.url))
      if (!data) return
      process.env.AI_DEBUG && console.log('AI 解析结果：', data)
      const createTagsAction = pageUtil.isAdminSpace ? actTryCreatePublicTags : actTryCreateUserTags
      const aiTagRes = await ensureAiTagOptions({
        aiTagNames: data.tags,
        currentTags: tagOptions,
        createTagsAction,
      })
      setTagOptions(aiTagRes.tags)
      let relatedTagIds = mapTagNamesToTagIds(aiTagRes.aiTagNames, aiTagRes.tags)
      if (!relatedTagIds.length) {
        const otherTag = aiTagRes.tags.find((tag) => tag.name === '其它')
        relatedTagIds = otherTag ? [otherTag.id] : []
      }
      setBookmark({
        name: data.title,
        icon: data.favicon,
        description: data.description,
        relatedTagIds,
      })
    } finally {
      setState({ loading: false })
    }
  }

  async function createTagByName(name: string) {
    const createTagsAction = pageUtil.isAdminSpace ? actTryCreatePublicTags : actTryCreateUserTags
    const aiTagRes = await ensureAiTagOptions({
      aiTagNames: [name],
      currentTags: tagOptions,
      createTagsAction,
    })
    setTagOptions(aiTagRes.tags)
    const [tagId] = mapTagNamesToTagIds(aiTagRes.aiTagNames, aiTagRes.tags)
    return tagId || null
  }

  async function onSave() {
    if (!validateAll()) return
    const action = slug.isNew
      ? pageUtil.isAdminSpace
        ? actInsertPublicBookmark(bookmark)
        : actInsertUserBookmark(bookmark)
      : pageUtil.isAdminSpace
        ? actUpdatePublicBookmark({ ...bookmark, id: slug.number! })
        : actUpdateUserBookmark({ ...bookmark, id: slug.number! })
    await runAction(action, {
      okMsg: slug.isNew ? '书签已创建' : '书签已更新',
      async onOk() {
        await props.afterSave()
        const route = pageUtil.isAdminSpace
          ? PageRoutes.Admin.bookmarkSlug('list')
          : PageRoutes.User.bookmarkSlug('list')
        router.push(route)
        console.log({ route })
        // debugger
      },
    })
  }

  return (
    <SlugPageLayout onSave={onSave}>
      <BookmarkEditorFields
        value={bookmark}
        tags={tagOptions}
        invalidInfos={invalidInfos}
        loading={state.loading}
        enableHtmlParse
        enableIconApiPicker
        showIconPreview
        onChange={onChangeBookmark}
        onBlurValidate={validateItem}
        onAiAnalyze={aiAnalyzeWebsite}
        onCreateTag={createTagByName}
        onParseWebsite={parseWebsite}
      />
    </SlugPageLayout>
  )
}
