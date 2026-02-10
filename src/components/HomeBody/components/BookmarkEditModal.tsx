import {
  actAnalyzeWebsite,
  actExtractHtmlInfo,
  actQueryPublicBookmark,
  actQueryUserBookmark,
  actTryCreatePublicTags,
  actTryCreateUserTags,
  actUpdatePublicBookmark,
  actUpdateUserBookmark,
} from '@/actions'
import type { BookmarkEditorValue } from '@/components/BookmarkEditorFields'
import BookmarkEditorFields from '@/components/BookmarkEditorFields'
import MyModal from '@/components/MyModal'
import { z } from '@/lib/zod'
import { mapTagNamesToTagIds } from '@/utils'
import { ensureAiTagOptions, runAction } from '@/utils/client'
import { useSetState } from 'ahooks'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { fromZodError } from 'zod-validation-error'

const formSchema = z.object({
  url: z.string().min(1, { message: '请输入 URL' }).url({ message: '请输入有效的 URL' }),
  name: z.string().min(1, { message: '请输入名称' }),
  icon: z
    .string()
    .url({ message: '请输入有效的图标地址' })
    .or(z.string().refine((v) => !v)),
})

interface BookmarkForm {
  id: BookmarkId
  name: string
  url: string
  icon: string
  description: string
  relatedTagIds: TagId[]
  isPinned: boolean
}

interface Props {
  isOpen: boolean
  bookmark: SelectBookmark
  tags: SelectTag[]
  isUserSpace: boolean
  onClose: () => void
  onSaved: (bookmark: SelectBookmark) => void
  onTagsUpsert?: (tags: SelectTag[]) => void
}

function buildFormFromBookmark(bookmark: SelectBookmark): BookmarkForm {
  return {
    id: bookmark.id,
    name: bookmark.name,
    url: bookmark.url,
    icon: bookmark.icon || '',
    description: bookmark.description || '',
    relatedTagIds: bookmark.relatedTagIds || [],
    isPinned: !!bookmark.isPinned,
  }
}

export default function BookmarkEditModal(props: Props) {
  const router = useRouter()
  const [tagOptions, setTagOptions] = useState<SelectTag[]>(props.tags)
  const [form, setForm] = useSetState<BookmarkForm>(() => buildFormFromBookmark(props.bookmark))
  const initializedBookmarkIdRef = useRef<BookmarkId | null>(null)
  const [state, setState] = useSetState({
    saving: false,
    analyzing: false,
    invalidInfos: {
      url: '',
      name: '',
      icon: '',
    },
  })

  useEffect(() => {
    setTagOptions(props.tags)
  }, [props.tags])

  useEffect(() => {
    if (!props.isOpen) return
    const shouldInitForm =
      initializedBookmarkIdRef.current === null ||
      initializedBookmarkIdRef.current !== props.bookmark.id
    if (!shouldInitForm) return
    initializedBookmarkIdRef.current = props.bookmark.id
    setForm(buildFormFromBookmark(props.bookmark))
    setState({
      invalidInfos: {
        url: '',
        name: '',
        icon: '',
      },
    })
  }, [props.bookmark, props.bookmark.id, props.isOpen, setForm, setState])

  useEffect(() => {
    if (props.isOpen) return
    initializedBookmarkIdRef.current = null
  }, [props.isOpen])

  function validateItem(key: keyof typeof state.invalidInfos) {
    const res = formSchema.shape[key].safeParse(form[key])
    const info = res.success
      ? ''
      : fromZodError(res.error, { prefix: null, maxIssuesInMessage: 1 }).message
    setState((oldState) => ({
      invalidInfos: {
        ...oldState.invalidInfos,
        [key]: info,
      },
    }))
    return res.success
  }

  function validateAll() {
    return Object.keys(state.invalidInfos)
      .map((key) => validateItem(key as keyof typeof state.invalidInfos))
      .every(Boolean)
  }

  function onChangeForm(patch: Partial<BookmarkEditorValue>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  async function parseWebsite() {
    setState({ analyzing: true })
    try {
      const res = await runAction(actExtractHtmlInfo(form.url))
      if (!res.ok) return
      setForm(res.data)
    } finally {
      setState({ analyzing: false })
    }
  }

  async function aiAnalyzeWebsite() {
    if (!validateItem('url')) return
    setState({ analyzing: true })
    try {
      const { data } = await runAction(actAnalyzeWebsite(form.url))
      if (!data) return
      process.env.AI_DEBUG && console.log('AI 解析结果：', data)
      const createTagsAction = props.isUserSpace ? actTryCreateUserTags : actTryCreatePublicTags
      const aiTagRes = await ensureAiTagOptions({
        aiTagNames: data.tags,
        currentTags: tagOptions,
        createTagsAction,
      })
      setTagOptions(aiTagRes.tags)
      props.onTagsUpsert?.(aiTagRes.createdTags)
      let relatedTagIds = mapTagNamesToTagIds(aiTagRes.aiTagNames, aiTagRes.tags)
      if (!relatedTagIds.length) {
        const otherTag = aiTagRes.tags.find((tag) => tag.name === '其它')
        relatedTagIds = otherTag ? [otherTag.id] : []
      }
      setForm({
        name: data.title,
        icon: data.favicon,
        description: data.description,
        relatedTagIds,
      })
    } finally {
      setState({ analyzing: false })
    }
  }

  async function createTagByName(name: string) {
    const createTagsAction = props.isUserSpace ? actTryCreateUserTags : actTryCreatePublicTags
    const aiTagRes = await ensureAiTagOptions({
      aiTagNames: [name],
      currentTags: tagOptions,
      createTagsAction,
    })
    setTagOptions(aiTagRes.tags)
    props.onTagsUpsert?.(aiTagRes.createdTags)
    const [tagId] = mapTagNamesToTagIds(aiTagRes.aiTagNames, aiTagRes.tags)
    return tagId || null
  }

  async function onSave() {
    if (!validateAll()) return
    setState({ saving: true })
    const updateAction = props.isUserSpace
      ? actUpdateUserBookmark(form)
      : actUpdatePublicBookmark(form)
    const updateRes = await runAction(updateAction, { okMsg: '书签已更新' })
    if (!updateRes.ok) {
      setState({ saving: false })
      return
    }

    const queryAction = props.isUserSpace
      ? actQueryUserBookmark({ id: form.id })
      : actQueryPublicBookmark({ id: form.id })
    const queryRes = await runAction(queryAction, { errToast: { hidden: true } })
    if (queryRes.ok) {
      props.onSaved(queryRes.data)
    } else {
      props.onSaved({
        ...props.bookmark,
        ...form,
      })
    }
    props.onClose()
    router.refresh()
    setState({ saving: false })
  }

  return (
    <MyModal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="编辑站点"
      size="2xl"
      isDismissable={false}
      onOk={onSave}
      okButtonProps={{ color: 'primary', isLoading: state.saving || state.analyzing }}
    >
      <BookmarkEditorFields
        value={form}
        tags={tagOptions}
        invalidInfos={state.invalidInfos}
        loading={state.analyzing}
        enableHtmlParse
        enableIconApiPicker
        showIconPreview
        onChange={onChangeForm}
        onBlurValidate={validateItem}
        onAiAnalyze={aiAnalyzeWebsite}
        onCreateTag={createTagByName}
        onParseWebsite={parseWebsite}
      />
    </MyModal>
  )
}
