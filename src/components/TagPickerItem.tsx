import { usePageUtil } from '@/hooks'
import { useOnClickTag } from '@/hooks/useOnClickTag'
import { getTagLinkAttrs } from '@/utils'
import { IconNames, PageRoutes } from '@cfg'
import { cn } from '@heroui/react'
import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import ClientIcon from './ClientIcon'

interface Props {
  tag: SelectTag
  tags: SelectTag[]
  onClick?: () => void
  showFavoriteAction?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (tagId: TagId) => void
}

export default function TagPickerItem({
  tag,
  tags,
  onClick,
  showFavoriteAction,
  isFavorite,
  onToggleFavorite,
}: Props) {
  const pageUtil = usePageUtil()
  const session = useSession()
  const { selectedTags, onClickTag } = useOnClickTag({ tags })
  const isSelected = useMemo(() => {
    return selectedTags.map((t) => t.id).includes(tag.id)
  }, [selectedTags, tag.id])
  const canEditTag = useMemo(() => {
    if (pageUtil.isAdminSpace || pageUtil.isUserSpace) return true
    return !!session.data?.user?.isAdmin
  }, [pageUtil.isAdminSpace, pageUtil.isUserSpace, session.data?.user?.isAdmin])
  const editTagHref = useMemo(() => {
    if (!canEditTag) return ''
    if (pageUtil.isAdminSpace || (pageUtil.isPublicSpace && session.data?.user?.isAdmin)) {
      return PageRoutes.Admin.tagSlug(tag.id)
    }
    return PageRoutes.User.tagSlug(tag.id)
  }, [
    canEditTag,
    pageUtil.isAdminSpace,
    pageUtil.isPublicSpace,
    session.data?.user?.isAdmin,
    tag.id,
  ])
  const showEditAction = canEditTag
  const canToggleFavorite = !!showFavoriteAction && !!onToggleFavorite

  return (
    <div className="group relative mr-4">
      <a
        {...getTagLinkAttrs(tag)}
        className={cn(
          'inline-flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-base',
          'xs:hover:bg-zinc-600/10 xs:dark:hover:bg-zinc-800/80',
          (showEditAction || canToggleFavorite) && 'pr-8',
          showEditAction && canToggleFavorite && 'pr-14',
          isSelected && 'max-xs:bg-blue-800/10! bg-zinc-600/10 dark:bg-zinc-800/80'
        )}
        onClick={(e) => {
          onClick?.()
          onClickTag({ event: e, tag })
        }}
      >
        <ClientIcon color={tag.color || undefined} icon={tag.icon || IconNames.TAG} />
        <span className="text-foreground-600 grow truncate">{tag.name}</span>
      </a>
      {canToggleFavorite && (
        <button
          type="button"
          title={isFavorite ? `取消收藏 ${tag.name}` : `收藏 ${tag.name}`}
          className={cn(
            'hover:text-foreground-700 hover:bg-default-200 absolute top-1/2 right-8 z-10 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md transition',
            'max-xs:opacity-100 xs:opacity-0 xs:group-hover:opacity-100',
            isFavorite ? 'text-yellow-500' : 'text-foreground-400'
          )}
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onToggleFavorite(tag.id)
          }}
        >
          <span className={cn(isFavorite ? 'icon-[tabler--star-filled]' : 'icon-[tabler--star]')} />
        </button>
      )}
      {showEditAction && (
        <a
          href={editTagHref}
          title={`编辑标签 ${tag.name}`}
          className={cn(
            'text-foreground-400 hover:text-foreground-700 hover:bg-default-200 absolute top-1/2 right-1 z-10 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md transition',
            'max-xs:opacity-100 xs:opacity-0 xs:group-hover:opacity-100'
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="icon-[tabler--edit] text-sm" />
        </a>
      )}
    </div>
  )
}
