import { actGetUserFavoriteTagIds, actSaveUserFavoriteTagIds } from '@/actions'
import { usePageUtil } from '@/hooks'
import {
  emitUserFavoriteTagIdsChanged,
  onUserFavoriteTagIdsChanged,
} from '@/lib/user-favorite-tags-sync'
import ReInput from '@/components/re-export/ReInput'
import { runAction } from '@/utils/client'
import { testTagNameOrPinyin } from '@/utils'
import { ScrollShadow, Switch, cn } from '@heroui/react'
import { useMount, useSetState, useUpdateEffect } from 'ahooks'
import { isEqual } from 'lodash'
import { CSSProperties, useLayoutEffect, useMemo, useRef } from 'react'
import { TagPickerBox } from './common'
import TagPickerItem from './TagPickerItem'

interface Props {
  tags: SelectTag[]
  className?: string
  style?: CSSProperties
  onCloseMenu: () => void
}
export function MobileTagPicker(props: Props) {
  const { tags } = props
  const pageUtil = usePageUtil()
  const isUserSpace = pageUtil.isUserSpace

  const scrollDivRef = useRef<null | HTMLDivElement>(null)
  const [state, setState] = useSetState({
    filterTagInput: '',
    onlyMain: false,
    inputWrapperCls: '',
    showTags: tags,
    favoriteTagIds: [] as TagId[],
  })
  const favoriteTagIdSet = useMemo(() => new Set(state.favoriteTagIds), [state.favoriteTagIds])

  function isSameTagIdList(a: TagId[], b: TagId[]) {
    if (a.length !== b.length) return false
    return a.every((id, idx) => id === b[idx])
  }

  function updateFavoriteTagIds(ids: TagId[]) {
    const validTagIds = [...new Set(ids)].filter((id) => tags.some((tag) => tag.id === id))
    if (isSameTagIdList(validTagIds, state.favoriteTagIds)) return
    setState({ favoriteTagIds: validTagIds })
    emitUserFavoriteTagIdsChanged(validTagIds)
    if (!isUserSpace) return
    void runAction(actSaveUserFavoriteTagIds(validTagIds), {
      errToast: { title: '收藏标签保存失败' },
      onOk(nextIds) {
        setState((oldState) =>
          isSameTagIdList(nextIds, oldState.favoriteTagIds) ? null : { favoriteTagIds: nextIds }
        )
        emitUserFavoriteTagIdsChanged(nextIds)
      },
    })
  }

  function toggleFavoriteTag(tagId: TagId) {
    const exists = state.favoriteTagIds.includes(tagId)
    const nextTagIds = exists
      ? state.favoriteTagIds.filter((id) => id !== tagId)
      : state.favoriteTagIds.concat(tagId)
    updateFavoriteTagIds(nextTagIds)
  }

  useLayoutEffect(() => {
    let showTags = []
    if (state.filterTagInput) {
      // 输入了关键词，从所有标签中过滤
      showTags = tags.filter((tag) => testTagNameOrPinyin(state.filterTagInput, tag))
    } else {
      showTags = state.onlyMain ? tags.filter((tag) => tag.isMain) : tags
    }
    if (!isEqual(showTags, state.showTags)) {
      setState({ showTags })
    }
    // 每次进入不同的 /tag/$slug，元素滚动位置都会丢失，这里手动恢复
    const lastPosition = TagPickerBox.getScrollTop()
    if (lastPosition > 0) {
      scrollDivRef.current?.scrollTo({ top: lastPosition })
    }
  }, [state.filterTagInput, state.onlyMain, tags, state.showTags, setState])

  useMount(() => {
    setState({ onlyMain: TagPickerBox.getOnlyMain() })
  })

  useUpdateEffect(() => {
    TagPickerBox.setOnlyMain(state.onlyMain)
  }, [state.onlyMain])

  useLayoutEffect(() => {
    if (!isUserSpace) return
    void (async () => {
      const res = await runAction(actGetUserFavoriteTagIds(), {
        errToast: { hidden: true },
      })
      if (!res.ok) return
      setState((oldState) =>
        isSameTagIdList(res.data, oldState.favoriteTagIds) ? null : { favoriteTagIds: res.data }
      )
    })()
  }, [isUserSpace, setState])

  useLayoutEffect(() => {
    if (!isUserSpace) return
    return onUserFavoriteTagIdsChanged((ids) => {
      const validTagIds = ids.filter((id) => tags.some((tag) => tag.id === id))
      setState((oldState) =>
        isSameTagIdList(validTagIds, oldState.favoriteTagIds)
          ? null
          : { favoriteTagIds: validTagIds }
      )
    })
  }, [isUserSpace, tags, setState])

  return (
    <div role="mobile-tag-picker" className="flex h-full flex-col" style={props.style}>
      <div className="flex-items-center my-4 shrink-0 gap-1 pr-4">
        <ReInput
          size="sm"
          classNames={{ inputWrapper: 'dark:bg-default-100/50' }}
          placeholder="过滤标签"
          isClearable
          value={state.filterTagInput}
          onValueChange={(v) => setState({ filterTagInput: v })}
        />
      </div>
      <div className="grow-0 overflow-auto">
        <ScrollShadow
          className="scrollbar-hide flex h-full flex-col gap-2"
          ref={scrollDivRef}
          role={TagPickerBox.SCROLLER_ROLE}
        >
          {state.showTags.map((tag) => (
            <TagPickerItem
              key={tag.id}
              tag={tag}
              tags={tags}
              onClick={props.onCloseMenu}
              isFavorite={favoriteTagIdSet.has(tag.id)}
              showFavoriteAction={isUserSpace}
              onToggleFavorite={toggleFavoriteTag}
            />
          ))}
        </ScrollShadow>
      </div>
      {!state.filterTagInput && (
        <div className="flex-items-center h-16 shrink-0 gap-4">
          <Switch
            key={Number(state.onlyMain)}
            isSelected={state.onlyMain}
            onValueChange={(v) => setState({ onlyMain: v })}
          />
          <span className={cn(state.onlyMain ? 'text-foreground-600' : 'text-foreground-400')}>
            仅展示主标签
          </span>
        </div>
      )}
    </div>
  )
}
