'use client'

import { ReInput } from '@/components'
import { usePageUtil } from '@/hooks'
import { IconNames, PageRoutes } from '@cfg'
import { cn, Kbd } from '@heroui/react'
import { useDebounceEffect, useEventListener, useMemoizedFn, useSetState } from 'ahooks'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function SearchInput(props: BaseComponentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routes = usePageUtil().isUserSpace ? PageRoutes.User : PageRoutes.Public
  const [state, setState] = useSetState({
    input: searchParams.get('keyword') || '',
    focusInput: false,
    isComposing: false,
  })
  const inputRef = useRef<null | HTMLDivElement>(null)

  const handleSearch = useMemoizedFn(() => {
    const keyword = state.input.trim()
    if (keyword === (searchParams.get('keyword') || '')) return
    router.push(keyword ? routes.search(keyword) : routes.INDEX)
  })

  // 按下回车键，执行搜索
  useEventListener(
    'keydown',
    (e) => {
      const keyboardEvent = e as KeyboardEvent
      if (keyboardEvent.key !== 'Enter') return
      if (keyboardEvent.isComposing || state.isComposing) return
      handleSearch()
    },
    { target: inputRef }
  )

  useEventListener('keydown', (e) => {
    if (e.key === '/') {
      setTimeout(() => {
        inputRef.current!.querySelector('input')?.focus()
      })
    }
  })

  useDebounceEffect(() => {
    if (state.isComposing) return
    handleSearch()
  }, [state.input, state.isComposing], {
    wait: 500,
    leading: false,
    trailing: true,
  })

  useEffect(() => {
    if (pathname !== routes.SEARCH) return
    const timer = globalThis.setTimeout(() => {
      inputRef.current?.querySelector('input')?.focus()
    }, 0)
    return () => globalThis.clearTimeout(timer)
  }, [pathname, routes.SEARCH])

  return (
    <ReInput
      value={state.input}
      placeholder={state.focusInput ? '可根据网站名称、拼音、简介搜索' : '搜索网站'}
      fullWidth={false}
      classNames={{
        base: props.className,
        inputWrapper: 'dark:bg-default-100/50',
      }}
      baseRef={inputRef}
      startContent={<span className={cn(IconNames.SEARCH, 'text-xl')} />}
      endContent={
        !state.focusInput && !state.input && <Kbd className="b dark:bg-default-100/80 px-3">/</Kbd>
      }
      onClear={state.input ? () => router.push(routes.INDEX) : undefined}
      onValueChange={(v) => setState({ input: v })}
      onFocusChange={(v) => setState({ focusInput: v })}
      onCompositionStart={() => setState({ isComposing: true })}
      onCompositionEnd={() => setState({ isComposing: false })}
    />
  )
}
