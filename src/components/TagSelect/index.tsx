import { testTagNameOrPinyin } from '@/utils'
import { Chip, cn, ScrollShadow } from '@heroui/react'
import { Icon } from '@iconify/react'
import { useSetState, useThrottleFn } from 'ahooks'
import RcSelect from 'rc-select'
import 'rc-select/assets/index.css'
import { ReactNode, useEffect, useMemo } from 'react'
import style from './style.module.css'

type ValueType = TagId[]

interface Props {
  tags: SelectTag[]
  value?: ValueType
  excludeTagIds?: ValueType
  endContent?: ReactNode
  onCreateTag?: (name: string) => Promise<TagId | null | undefined> | TagId | null | undefined
  onChange?: (value: ValueType) => void
}

function normalizeTagName(input: string) {
  return input
    .normalize('NFKC')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * 标签下拉选择器
 * - NextUI 的 Select 不支持输入筛选，因此这里基于 RcSelect 手动实现
 * - 这个组件会把已选中的标签在下拉列表中过滤掉
 */
export default function TagSelect(props: Props) {
  const { tags } = props
  const canCreateTag = !!props.onCreateTag
  const [state, setState] = useSetState({
    open: false,
    value: [] as ValueType,
    keyword: '',
    creating: false,
  })

  const mergedValue = props.value || state.value

  const filteredOptions = useMemo(() => {
    return tags
      .filter((tag) => !mergedValue.includes(tag.id))
      .filter((tag) => !(props.excludeTagIds || []).includes(tag.id))
      .map((tag) => ({
        // ...item,
        label: tag.name,
        value: tag.id,
        icon: tag.icon,
        pinyin: tag.pinyin,
      }))
  }, [tags, mergedValue, props.excludeTagIds])

  const setOpen = useThrottleFn((open) => setState({ open }), {
    wait: 200,
    leading: true,
    trailing: false,
  })

  function onValueChange(value: ValueType) {
    setState({ value })
    props.onChange?.(value)
  }

  function onRemoveTag(target: ValueType[number]) {
    const value = mergedValue.filter((v) => v !== target)
    onValueChange(value)
  }

  const createTagName = useMemo(() => normalizeTagName(state.keyword), [state.keyword])
  const shouldShowCreateTag = useMemo(() => {
    if (!props.onCreateTag) return false
    if (!createTagName) return false
    return !tags.some(
      (tag) => normalizeTagName(tag.name).toLowerCase() === createTagName.toLowerCase()
    )
  }, [createTagName, props.onCreateTag, tags])

  async function onCreateTag() {
    if (!props.onCreateTag || !shouldShowCreateTag || state.creating) return
    setState({ creating: true })
    try {
      const createdTagId = await props.onCreateTag(createTagName)
      if (createdTagId !== null && createdTagId !== undefined) {
        const nextValue = [...new Set([...mergedValue, createdTagId])]
        onValueChange(nextValue)
      }
      setState({ keyword: '' })
    } finally {
      setState({ creating: false })
    }
  }

  useEffect(() => {
    const div = document.querySelector<HTMLDivElement>(
      'div[role="tag-select"] .rc-select-selection-overflow'
    )
    if (!props.endContent || !div) return
    div.style.width = 'calc(100% - 2rem)'
  }, [props.endContent])

  return (
    <div role="tag-select" className="w-full">
      <div
        className={cn(
          'rounded-medium bg-default-50 text-foreground-400 relative w-full cursor-not-allowed overflow-hidden p-4 py-3 text-center text-xs',
          (tags.length || canCreateTag) && 'hidden'
        )}
      >
        暂不可用，请先创建一些标签
      </div>
      <div
        className={cn(
          'rounded-medium bg-default-100 relative w-full overflow-hidden',
          style.rcSelectWrapper,
          !tags.length && !canCreateTag && 'hidden'
        )}
      >
        <RcSelect<ValueType, (typeof filteredOptions)[number]>
          mode="multiple"
          showSearch
          maxCount={6}
          animation="slide-up2"
          open={state.open}
          options={filteredOptions}
          value={mergedValue}
          searchValue={state.keyword}
          getPopupContainer={(triggerNode) => triggerNode.ownerDocument.body}
          virtual={false}
          dropdownClassName={style.rcSelectDropdown}
          onChange={onValueChange}
          onSearch={(keyword) => setState({ keyword })}
          onDropdownVisibleChange={setOpen.run}
          onInputKeyDown={(evt) => {
            if (evt.key !== 'Enter') return
            if (!shouldShowCreateTag) return
            evt.preventDefault()
            void onCreateTag()
          }}
          filterOption={(input, opt) => {
            return testTagNameOrPinyin(input, { name: opt?.label, pinyin: opt?.pinyin })
          }}
          dropdownRender={(menu) => (
            <div className="pb-1">
              {shouldShowCreateTag && (
                <button
                  type="button"
                  className="text-foreground-600 hover:bg-default-200 mx-2 mb-1 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={state.creating}
                  onMouseDown={(evt) => evt.preventDefault()}
                  onClick={() => void onCreateTag()}
                >
                  <span className="icon-[tabler--plus] text-base" />
                  <span>创建标签「{createTagName}」</span>
                </button>
              )}
              <ScrollShadow className="h-[300px]">{menu}</ScrollShadow>
            </div>
          )}
          notFoundContent={<div className="mt-20">暂无内容</div>}
          optionRender={(opt) => (
            <div className="text-foreground-800 flex-items-center gap-2">
              {opt.data.icon && <Icon icon={opt.data.icon} />}
              <span>{opt.label}</span>
            </div>
          )}
          tagRender={(opt) => (
            <Chip size="sm" color="warning" onClose={() => onRemoveTag(opt.value)}>
              {tags.find((t) => t.id === opt.value)?.name}
            </Chip>
          )}
        />
        <span className="flex-center absolute top-1/2 right-2 size-8 -translate-y-1/2 p-1">
          {props.endContent}
        </span>
      </div>
    </div>
  )
}
