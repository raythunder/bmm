'use client'

import { FieldConstraints, IconNames } from '@cfg'
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Switch,
  cn,
} from '@heroui/react'
import Favicon from './Favicon'
import TagSelect from './TagSelect'
import { ReInput, ReTextarea } from './re-export'
import { isValidUrl } from '@/utils'

export interface BookmarkEditorValue {
  url: string
  name: string
  icon: string
  description: string
  relatedTagIds: TagId[]
  isPinned: boolean
}

export interface BookmarkEditorInvalidInfos {
  url: string
  name: string
  icon: string
}

interface Props {
  value: BookmarkEditorValue
  tags: SelectTag[]
  invalidInfos: BookmarkEditorInvalidInfos
  loading?: boolean
  enableHtmlParse?: boolean
  enableIconApiPicker?: boolean
  showIconPreview?: boolean
  onChange: (patch: Partial<BookmarkEditorValue>) => void
  onBlurValidate: (key: keyof BookmarkEditorInvalidInfos) => void
  onAiAnalyze: () => void
  onCreateTag?: (name: string) => Promise<TagId | null | undefined> | TagId | null | undefined
  onParseWebsite?: () => void
}

export default function BookmarkEditorFields(props: Props) {
  const hasValidUrl = !!isValidUrl(props.value.url)

  function renderAnalyzeAction() {
    if (props.enableHtmlParse && props.onParseWebsite) {
      return (
        <Dropdown placement="right-start">
          <DropdownTrigger>
            <Button
              isIconOnly
              size="sm"
              isLoading={props.loading}
              className={cn('bg-transparent text-xl', !hasValidUrl && 'scale-0')}
            >
              <span className={cn('bg-linear-to-r from-pink-500 to-violet-500', IconNames.STARS)} />
            </Button>
          </DropdownTrigger>
          <DropdownMenu>
            <DropdownItem key="parse" onClick={props.onParseWebsite}>
              解析 HTML
            </DropdownItem>
            <DropdownItem key="ai" onClick={props.onAiAnalyze}>
              AI 智能解析
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      )
    }
    return (
      <Button
        isIconOnly
        size="sm"
        isLoading={props.loading}
        onClick={props.onAiAnalyze}
        className={cn('bg-transparent text-xl', !hasValidUrl && 'scale-0')}
      >
        <span className={cn('bg-linear-to-r from-pink-500 to-violet-500', IconNames.STARS)} />
      </Button>
    )
  }

  function renderIconDropdown() {
    if (!props.enableIconApiPicker || !hasValidUrl) return null
    const { host } = new URL(props.value.url)
    const list = [
      { name: 'Google', src: 'https://www.google.com/s2/favicons?domain=' + host },
      { name: 'DuckDuckGo', src: `https://icons.duckduckgo.com/ip3/${host}.ico` },
      { name: 'Yandex', src: `https://favicon.yandex.net/favicon/${host}` },
      { name: '令川', src: 'https://api.lcll.cc/favicon?host=' + host },
      { name: 'Favicon.im', src: `https://favicon.im/${host}` },
      { name: 'Xinac', src: `https://api.xinac.net/icon/?url=${host}` },
      { name: '流浪猫', src: `https://api.cxr.cool/ico/?url=${host}` },
    ]
    return (
      <Dropdown placement="right-start">
        <DropdownTrigger>
          <Button isIconOnly size="sm" className={cn('bg-transparent', !hasValidUrl && 'scale-0')}>
            <span className="icon-[tabler--api] text-2xl" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu>
          <DropdownSection title="第三方 API 获取图标">
            {list.map((item) => (
              <DropdownItem
                key={item.name}
                textValue={item.name}
                onClick={() => props.onChange({ icon: item.src })}
              >
                <div className="flex-items-center justify-between">
                  <span>{item.name}</span>
                  <Favicon
                    size={20}
                    src={item.src}
                    showSpinner
                    className="border"
                    disableLazyLoading
                    showErrorIconOnFailed
                  />
                </div>
              </DropdownItem>
            ))}
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>
    )
  }

  return (
    <div className="flex-items-center w-full flex-col gap-4">
      <ReInput
        label="网址"
        type="url"
        isRequired
        maxLength={FieldConstraints.MaxLen.URL}
        isInvalid={!!props.invalidInfos.url}
        errorMessage={props.invalidInfos.url}
        endContent={renderAnalyzeAction()}
        value={props.value.url}
        onChange={(e) => props.onChange({ url: e.target.value })}
        onBlur={() => props.onBlurValidate('url')}
      />
      <ReInput
        label="名称"
        isRequired
        maxLength={FieldConstraints.MaxLen.BOOKMARK_NAME}
        isInvalid={!!props.invalidInfos.name}
        errorMessage={props.invalidInfos.name}
        value={props.value.name}
        onValueChange={(v) => props.onChange({ name: v })}
        onBlur={() => props.onBlurValidate('name')}
      />
      <ReInput
        label="图标地址"
        classNames={props.showIconPreview ? { inputWrapper: 'pl-0' } : undefined}
        isInvalid={!!props.invalidInfos.icon}
        errorMessage={props.invalidInfos.icon}
        onBlur={() => props.onBlurValidate('icon')}
        value={props.value.icon || ''}
        onValueChange={(v) => props.onChange({ icon: v })}
        startContent={
          props.showIconPreview ? (
            props.value.icon ? (
              <Favicon
                className="ml-1.5"
                src={props.value.icon}
                showSpinner
                showErrorIconOnFailed
              />
            ) : (
              <span className="w-1.5" />
            )
          ) : undefined
        }
        endContent={renderIconDropdown()}
      />
      <ReTextarea
        label="描述"
        maxLength={FieldConstraints.MaxLen.BOOKMARK_DESC}
        value={props.value.description || ''}
        onValueChange={(v) => props.onChange({ description: v })}
      />
      <div className="flex-items-center w-full flex-col gap-2">
        <label className="self-start text-sm">关联标签</label>
        <TagSelect
          tags={props.tags}
          value={props.value.relatedTagIds}
          onCreateTag={props.onCreateTag}
          onChange={(v) => props.onChange({ relatedTagIds: v })}
        />
      </div>
      <div className="flex-items-center w-full justify-between">
        <label className="text-sm">置顶书签</label>
        <Switch
          isSelected={props.value.isPinned || false}
          onValueChange={(v) => props.onChange({ isPinned: v })}
        />
      </div>
    </div>
  )
}
