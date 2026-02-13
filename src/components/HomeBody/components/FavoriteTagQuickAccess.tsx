import ClientIcon from '@/components/ClientIcon'
import { useOnClickTag } from '@/hooks/useOnClickTag'
import { getTagLinkAttrs } from '@/utils'
import { IconNames } from '@cfg'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@heroui/react'
import { MouseEvent, useMemo } from 'react'

const LONG_PRESS_DELAY_MS = 220

interface Props {
  tags: SelectTag[]
  favoriteTagIds: TagId[]
  onReorder: (ids: TagId[]) => void
}

export default function FavoriteTagQuickAccess(props: Props) {
  const { tags, favoriteTagIds, onReorder } = props
  const { onClickTag, selectedTags } = useOnClickTag({ tags })
  const selectedTagIdSet = useMemo(() => new Set(selectedTags.map((tag) => tag.id)), [selectedTags])

  const favoriteTags = useMemo(() => {
    return favoriteTagIds
      .map((id) => tags.find((tag) => tag.id === id))
      .filter(Boolean) as SelectTag[]
  }, [favoriteTagIds, tags])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: LONG_PRESS_DELAY_MS,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = Number(active.id)
    const overId = Number(over.id)
    if (!Number.isInteger(activeId) || !Number.isInteger(overId)) return

    const oldIndex = favoriteTagIds.findIndex((id) => id === activeId)
    const newIndex = favoriteTagIds.findIndex((id) => id === overId)
    if (oldIndex < 0 || newIndex < 0) return

    onReorder(arrayMove(favoriteTagIds, oldIndex, newIndex) as TagId[])
  }

  if (!favoriteTags.length) return null

  return (
    <section className="border-default-200 bg-content1/70 mb-6 rounded-2xl border px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="icon-[tabler--star-filled] text-yellow-500" />
          <span className="text-foreground-600 text-sm">收藏标签</span>
        </div>
        <span className="text-foreground-400 text-xs">长按可拖拽排序</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={favoriteTags.map((tag) => tag.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {favoriteTags.map((tag) => (
              <SortableFavoriteTag
                key={tag.id}
                tag={tag}
                isSelected={selectedTagIdSet.has(tag.id)}
                onClickTag={onClickTag}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}

function SortableFavoriteTag(props: {
  tag: SelectTag
  isSelected: boolean
  onClickTag: (arg: { tag: SelectTag; event?: MouseEvent<HTMLAnchorElement> }) => void
}) {
  const { tag, isSelected } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tag.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  }

  return (
    <a
      {...getTagLinkAttrs(tag)}
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-default-200 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 select-none',
        'bg-content2/70 text-foreground-600 cursor-pointer touch-none',
        'hover:bg-zinc-600/10 dark:hover:bg-zinc-800/80',
        isSelected && 'bg-zinc-600/10 dark:bg-zinc-800/80'
      )}
      onClick={(event) => {
        if (isDragging) {
          event.preventDefault()
          return
        }
        props.onClickTag({ tag, event })
      }}
      {...attributes}
      {...listeners}
    >
      <ClientIcon color={tag.color || undefined} icon={tag.icon || IconNames.TAG} />
      <span className="max-w-40 truncate text-sm">{tag.name}</span>
      <span className="icon-[tabler--grip-vertical] text-foreground-400 text-sm" />
    </a>
  )
}
