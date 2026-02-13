import { actDeletePublicBookmark, actDeleteUserBookmark } from '@/actions'
import Favicon from '@/components/Favicon'
import MyModal from '@/components/MyModal'
import { useIsMobile, usePageUtil } from '@/hooks'
import { useOnClickTag } from '@/hooks/useOnClickTag'
import { runAction } from '@/utils/client'
import { getTagLinkAttrs } from '@/utils'
import { Chip, addToast, cn, Tooltip } from '@heroui/react'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import BookmarkEditModal from './BookmarkEditModal'
import { useHomePageContext } from '../ctx'

interface Props extends SelectBookmark {
  editable?: boolean
  allTags?: SelectTag[]
  onRemove?: () => void
  onEdit?: () => void
}

export default function BookmarkCard(props: Props) {
  const { tags, updateBookmark, removeBookmark, upsertTags } = useHomePageContext()
  const { onClickTag } = useOnClickTag({ tags })
  const isMobile = useIsMobile()
  const pageUtil = usePageUtil()
  const session = useSession()
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isAuthenticated = session.status === 'authenticated'
  const canEditInCurrentSpace =
    pageUtil.isUserSpace || (pageUtil.isPublicSpace && !!session.data?.user?.isAdmin)
  const showCopyAction = isAuthenticated
  const showEditAction = showCopyAction && canEditInCurrentSpace
  const showDeleteAction = showEditAction
  const alwaysShowActions = isMobile || editModalOpen || deleteConfirmOpen

  const generateLinkTitle = () => {
    const baseTitle = `${props.name} - ${props.description}`
    // 加入标签信息增强相关性
    const tagNames = props.relatedTagIds
      .map((id) => tags.find((tag) => tag.id === id)?.name)
      .filter(Boolean)
    return tagNames.length ? `${baseTitle} (标签: ${tagNames.join(', ')})` : baseTitle
  }

  async function onCopyUrl(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.stopPropagation()
    try {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(props.url)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = props.url
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      addToast({ color: 'success', title: '站点地址已复制' })
    } catch {
      addToast({ color: 'danger', title: '复制失败，请检查浏览器权限' })
    }
  }

  function onClickEdit(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.stopPropagation()
    setEditModalOpen(true)
  }

  function onClickDelete(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.stopPropagation()
    setDeleteConfirmOpen(true)
  }

  async function confirmDeleteBookmark() {
    setDeleting(true)
    const action = pageUtil.isUserSpace
      ? actDeleteUserBookmark({ id: props.id })
      : actDeletePublicBookmark({ id: props.id })
    const res = await runAction(action, {
      okMsg: '书签已删除',
      onOk() {
        removeBookmark(props.id)
      },
    })
    if (res.ok) {
      setDeleteConfirmOpen(false)
    }
    setDeleting(false)
  }

  function onClickCard(evt: React.MouseEvent<HTMLDivElement>) {
    if (editModalOpen || deleteConfirmOpen) return
    const target = evt.target as Node | null
    if (target && !evt.currentTarget.contains(target)) return
    window.open(props.url, '_blank')
  }

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col gap-3 rounded-2xl p-4 transition',
        'max-xs:gap-2 max-xs:rounded-xl max-xs:p-3 max-xs:dark:border-0 max-xs:dark:bg-foreground-200/20',
        'border-foreground-200 dark:border-opacity-60 border-2',
        'xs:hover:border-blue-500 xs:hover:shadow-lg xs:hover:shadow-blue-500/50'
      )}
      onClick={onClickCard}
    >
      {showDeleteAction && (
        <button
          type="button"
          aria-label={`删除站点 ${props.name}`}
          onClick={onClickDelete}
          className={cn(
            'text-danger-500 border-danger-200 hover:text-danger-600 hover:bg-danger-50/30 absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-full border transition active:scale-95',
            'max-xs:top-2 max-xs:right-2 max-xs:size-8',
            alwaysShowActions
              ? 'opacity-100'
              : 'pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100'
          )}
        >
          <span className="icon-[tabler--trash] text-base leading-none" />
        </button>
      )}
      <a
        className={cn('flex-items-center max-xs:gap-1.5 gap-2', showDeleteAction && 'pr-8')}
        href={props.url}
        target="_blank"
        rel="noopener noreferrer"
        title={generateLinkTitle()}
        onClick={(event) => event.stopPropagation()}
      >
        <Favicon
          src={props.icon}
          size={isMobile ? 24 : 28}
          showDefaultIcon
          alt={`${props.name}网站图标`}
        />
        <div className="grow truncate">
          <h3
            className="text-foreground-700 max-xs:text-sm xs:text-lg truncate"
            aria-label={`访问${props.name}`}
          >
            {props.name}
          </h3>
        </div>
      </a>
      {(() => {
        const desc = props.description
        if (!desc) return <div />
        if (isMobile) return null
        const node = (
          <p className="text-foreground-500 line-clamp-2 text-xs break-all" role="description">
            {desc}
          </p>
        )
        return (
          <Tooltip delay={300} content={<span className="break-all">{desc}</span>} className="w-80">
            {node}
          </Tooltip>
        )
      })()}
      <div
        className="scrollbar-hide max-xs:gap-1.5 flex max-w-full grow items-end gap-2 overflow-auto"
        aria-label="相关标签"
      >
        {props.relatedTagIds.map((id) => {
          const tag = tags.find((tag) => tag.id === id)
          if (!tag) return null
          return (
            <Chip
              key={tag.id}
              variant="flat"
              as="a"
              {...getTagLinkAttrs(tag)}
              onClick={(event) => onClickTag({ tag, event: event as any })}
              className="text-foreground-500 xs:hover:text-foreground-700 max-xs:py-0.5 h-fit cursor-pointer border-none py-1 text-xs transition active:opacity-50"
            >
              {tag.name}
            </Chip>
          )
        })}
      </div>
      {showCopyAction && (
        <div
          className={cn(
            'max-xs:gap-1 flex justify-end gap-2 transition',
            alwaysShowActions
              ? 'opacity-100'
              : 'pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100'
          )}
          aria-label="站点操作"
        >
          {showEditAction && (
            <button
              type="button"
              onClick={onClickEdit}
              className="flex-items-center text-foreground-500 border-foreground-200 hover:text-foreground-700 max-xs:px-1.5 max-xs:py-0.5 gap-1 rounded-lg border px-2 py-1 text-xs transition active:opacity-70"
            >
              <span className="icon-[tabler--edit] text-sm" />
              <span>编辑</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCopyUrl}
            className="flex-items-center text-foreground-500 border-foreground-200 hover:text-foreground-700 max-xs:px-1.5 max-xs:py-0.5 gap-1 rounded-lg border px-2 py-1 text-xs transition active:opacity-70"
          >
            <span className="icon-[tabler--copy] text-sm" />
            <span>复制</span>
          </button>
        </div>
      )}
      {showEditAction && (
        <BookmarkEditModal
          isOpen={editModalOpen}
          bookmark={props}
          tags={tags}
          isUserSpace={pageUtil.isUserSpace}
          onClose={() => setEditModalOpen(false)}
          onSaved={updateBookmark}
          onTagsUpsert={upsertTags}
        />
      )}
      <MyModal
        isOpen={deleteConfirmOpen}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        onOk={confirmDeleteBookmark}
        title="确认删除站点"
        okButtonProps={{
          color: 'danger',
          isLoading: deleting,
          children: '删除',
        }}
      >
        <p className="text-foreground-600 text-sm">
          确认删除站点「{props.name}」？此操作不可恢复。
        </p>
      </MyModal>
    </div>
  )
}
