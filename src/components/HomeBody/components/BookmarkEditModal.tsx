import {
  actQueryPublicBookmark,
  actQueryUserBookmark,
  actUpdatePublicBookmark,
  actUpdateUserBookmark,
} from '@/actions'
import MyModal from '@/components/MyModal'
import { TagSelect } from '@/components'
import { ReInput, ReTextarea } from '@/components/re-export'
import { z } from '@/lib/zod'
import { runAction } from '@/utils/client'
import { FieldConstraints } from '@cfg'
import { Switch } from '@heroui/react'
import { useSetState } from 'ahooks'
import { useEffect } from 'react'
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
}

export default function BookmarkEditModal(props: Props) {
  const [form, setForm] = useSetState<BookmarkForm>(() => {
    return {
      id: props.bookmark.id,
      name: props.bookmark.name,
      url: props.bookmark.url,
      icon: props.bookmark.icon || '',
      description: props.bookmark.description || '',
      relatedTagIds: props.bookmark.relatedTagIds || [],
      isPinned: !!props.bookmark.isPinned,
    }
  })
  const [state, setState] = useSetState({
    saving: false,
    invalidInfos: {
      url: '',
      name: '',
      icon: '',
    },
  })

  useEffect(() => {
    if (!props.isOpen) return
    setForm({
      id: props.bookmark.id,
      name: props.bookmark.name,
      url: props.bookmark.url,
      icon: props.bookmark.icon || '',
      description: props.bookmark.description || '',
      relatedTagIds: props.bookmark.relatedTagIds || [],
      isPinned: !!props.bookmark.isPinned,
    })
    setState({
      invalidInfos: {
        url: '',
        name: '',
        icon: '',
      },
    })
  }, [props.bookmark, props.isOpen, setForm, setState])

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
    setState({ saving: false })
  }

  return (
    <MyModal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="编辑站点"
      size="2xl"
      onOk={onSave}
      okButtonProps={{ color: 'primary', isLoading: state.saving }}
    >
      <div className="flex-items-center w-full flex-col gap-4">
        <ReInput
          label="网址"
          type="url"
          isRequired
          maxLength={FieldConstraints.MaxLen.URL}
          isInvalid={!!state.invalidInfos.url}
          errorMessage={state.invalidInfos.url}
          value={form.url}
          onChange={(e) => setForm({ url: e.target.value })}
          onBlur={() => validateItem('url')}
        />
        <ReInput
          label="名称"
          isRequired
          maxLength={FieldConstraints.MaxLen.BOOKMARK_NAME}
          isInvalid={!!state.invalidInfos.name}
          errorMessage={state.invalidInfos.name}
          value={form.name}
          onValueChange={(v) => setForm({ name: v })}
          onBlur={() => validateItem('name')}
        />
        <ReInput
          label="图标地址"
          isInvalid={!!state.invalidInfos.icon}
          errorMessage={state.invalidInfos.icon}
          onBlur={() => validateItem('icon')}
          value={form.icon || ''}
          onValueChange={(v) => setForm({ icon: v })}
        />
        <ReTextarea
          label="描述"
          maxLength={FieldConstraints.MaxLen.BOOKMARK_DESC}
          value={form.description}
          onValueChange={(v) => setForm({ description: v })}
        />
        <div className="flex-items-center w-full flex-col gap-2">
          <label className="self-start text-sm">关联标签</label>
          <TagSelect
            tags={props.tags}
            value={form.relatedTagIds}
            onChange={(v) => setForm({ relatedTagIds: v })}
          />
        </div>
        <div className="flex-items-center w-full justify-between">
          <label className="text-sm">置顶书签</label>
          <Switch
            isSelected={form.isPinned || false}
            onValueChange={(v) => setForm({ isPinned: v })}
          />
        </div>
      </div>
    </MyModal>
  )
}
