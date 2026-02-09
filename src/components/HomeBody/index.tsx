'use client'

import { useIsClient, usePageUtil } from '@/hooks'
import { Assets, PageRoutes } from '@cfg'
import { Divider } from '@heroui/react'
import { useSetState } from 'ahooks'
import Image from 'next/image'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import Banner from './components/Banner'
import BookmarkCard from './components/BookmarkCard'
import BookmarkContainer from './components/BookmarkContainer'
import LoadMore from './components/LoadMore'
import TagPicker from './components/TagPicker'
import { HomeBodyContext, HomeBodyProvider } from './ctx'

interface Props {
  tags: SelectTag[]
  bookmarks: SelectBookmark[]
  totalBookmarks: number
  searchedTotalBookmarks?: number
}

function sortBookmarksByPinned(bookmarks: SelectBookmark[]) {
  return [...bookmarks].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })
}

export default function HomeBody(props: Props) {
  const pathname = usePathname()
  const params = useParams()
  const isClient = useIsClient()
  const isUserSpace = usePageUtil().isUserSpace
  const [state, setState] = useSetState({
    tags: props.tags || [],
    bookmarks: props.bookmarks || [],
    selectedTags: [] as SelectTag[],
    hasMore: null as boolean | null,
  })

  useEffect(() => {
    setState({ tags: props.tags || [] })
  }, [props.tags, setState])

  useEffect(() => {
    const bookmarks = sortBookmarksByPinned(props.bookmarks)
    setState({ bookmarks })
  }, [props.bookmarks, setState])

  // 根据 slug 更新 selectedTags
  useEffect(() => {
    const slug = decodeURIComponent(params.slug as string)
    const selectedTags = slug
      .split('+')
      .map((tagName) => state.tags.find((tag) => tag.name === tagName))
      .filter(Boolean) as SelectTag[]
    setState({ selectedTags })
  }, [params.slug, setState, state.tags])

  const bookmarks = state.bookmarks
  const isSearchPage = pathname === (isUserSpace ? PageRoutes.User : PageRoutes.Public).SEARCH

  const homeBodyCtx = useMemo<HomeBodyContext>(() => {
    return {
      tags: state.tags,
      bookmarks: state.bookmarks,
      upsertTags(tags) {
        setState((oldState) => ({
          tags: tags.reduce(
            (acc, tag) => {
              const index = acc.findIndex((item) => item.id === tag.id)
              if (index < 0) {
                return acc.concat(tag)
              }
              acc[index] = {
                ...acc[index],
                ...tag,
                relatedTagIds: acc[index].relatedTagIds || tag.relatedTagIds || [],
              }
              return [...acc]
            },
            [...oldState.tags]
          ),
        }))
      },
      updateBookmark(bookmark) {
        setState((oldState) => ({
          bookmarks: sortBookmarksByPinned(
            oldState.bookmarks.map((item) => {
              if (item.id !== bookmark.id) return item
              return bookmark
            })
          ),
        }))
      },
      removeBookmark(id) {
        setState((oldState) => ({
          bookmarks: oldState.bookmarks.filter((item) => item.id !== id),
        }))
      },
    }
  }, [setState, state.bookmarks, state.tags])

  const showEnd = isClient && !!bookmarks.length && state.hasMore === false

  return (
    <HomeBodyProvider value={homeBodyCtx}>
      <aside className="max-xs:hidden fixed top-16 bottom-0 w-56 pl-6">
        <TagPicker />
      </aside>
      <div className="xs:ml-56">
        <div className="flex flex-col px-6 pb-14">
          <Banner
            tags={state.tags}
            totalBookmarks={props.totalBookmarks}
            searchedTotalBookmarks={props.searchedTotalBookmarks}
          />
          <BookmarkContainer>
            {bookmarks.map((bookmark) => {
              return <BookmarkCard {...bookmark} key={bookmark.id} />
            })}
          </BookmarkContainer>
          {!bookmarks.length && isClient && !state.hasMore && (
            <div className="flex-center grow flex-col">
              <Image width={128} height={128} src={Assets.BOX_EMPTY_PNG} alt="empty" priority />
              <p className="text-foreground-500 mt-4 text-sm">
                {isSearchPage ? '要不，换个关键词再试试？' : '暂无相关内容'}
              </p>
            </div>
          )}
          {showEnd && (
            <div className="flex-center mt-12">
              <Divider orientation="vertical" className="h-3" />
              <span className="text-foreground-400 xs:mx-8 mx-4 text-xs">END</span>
              <Divider orientation="vertical" className="h-3" />
            </div>
          )}
          <LoadMore
            key={globalThis.location?.href}
            onChange={(newData, hasMore) => {
              const ids = bookmarks.map((item) => item.id)
              setState({
                hasMore,
                bookmarks: bookmarks.concat(newData.filter((item) => !ids.includes(item.id))),
              })
            }}
          />
        </div>
      </div>
    </HomeBodyProvider>
  )
}
