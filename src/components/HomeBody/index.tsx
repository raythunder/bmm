'use client'

import { actGetUserFavoriteTagIds, actSaveUserFavoriteTagIds } from '@/actions'
import { useIsClient, usePageUtil } from '@/hooks'
import {
  emitUserFavoriteTagIdsChanged,
  onUserFavoriteTagIdsChanged,
} from '@/lib/user-favorite-tags-sync'
import { runAction } from '@/utils/client'
import { Assets, PageRoutes } from '@cfg'
import { Divider } from '@heroui/react'
import { useSetState } from 'ahooks'
import Image from 'next/image'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import Banner from './components/Banner'
import BookmarkCard from './components/BookmarkCard'
import BookmarkContainer from './components/BookmarkContainer'
import FavoriteTagQuickAccess from './components/FavoriteTagQuickAccess'
import LoadMore from './components/LoadMore'
import QuickAddBookmark from './components/QuickAddBookmark'
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

function isSameTagIdList(a: TagId[], b: TagId[]) {
  if (a.length !== b.length) return false
  return a.every((id, idx) => id === b[idx])
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
    favoriteTagIds: [] as TagId[],
    hasMore: null as boolean | null,
  })

  useEffect(() => {
    setState({ tags: props.tags || [] })
  }, [props.tags, setState])

  useEffect(() => {
    const bookmarks = sortBookmarksByPinned(props.bookmarks)
    setState({ bookmarks })
  }, [props.bookmarks, setState])

  useEffect(() => {
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

  useEffect(() => {
    if (!isUserSpace || !state.favoriteTagIds.length) return
    const validTagIds = state.favoriteTagIds.filter((id) => state.tags.some((tag) => tag.id === id))
    if (validTagIds.length === state.favoriteTagIds.length) return
    updateFavoriteTagIds(validTagIds)
  }, [isUserSpace, state.favoriteTagIds, state.tags])

  useEffect(() => {
    if (!isUserSpace) return
    return onUserFavoriteTagIdsChanged((ids) => {
      const validTagIds = ids.filter((id) => state.tags.some((tag) => tag.id === id))
      setState((oldState) =>
        isSameTagIdList(validTagIds, oldState.favoriteTagIds)
          ? null
          : { favoriteTagIds: validTagIds }
      )
    })
  }, [isUserSpace, setState, state.tags])

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

  function updateFavoriteTagIds(ids: TagId[]) {
    const validTagIds = [...new Set(ids)].filter((id) => state.tags.some((tag) => tag.id === id))
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
      upsertBookmark(bookmark) {
        setState((oldState) => {
          const alreadyExists = oldState.bookmarks.some((item) => item.id === bookmark.id)
          const nextBookmarks = alreadyExists
            ? oldState.bookmarks.map((item) => (item.id === bookmark.id ? bookmark : item))
            : [bookmark, ...oldState.bookmarks]
          return {
            bookmarks: sortBookmarksByPinned(nextBookmarks),
          }
        })
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
        <TagPicker favoriteTagIds={state.favoriteTagIds} onToggleFavorite={toggleFavoriteTag} />
      </aside>
      <div className="xs:ml-56">
        <div className="flex flex-col px-6 pb-14">
          <Banner
            tags={state.tags}
            totalBookmarks={props.totalBookmarks}
            searchedTotalBookmarks={props.searchedTotalBookmarks}
          />
          {isUserSpace && <QuickAddBookmark />}
          {isUserSpace && !!state.favoriteTagIds.length && (
            <FavoriteTagQuickAccess
              tags={state.tags}
              favoriteTagIds={state.favoriteTagIds}
              onReorder={updateFavoriteTagIds}
            />
          )}
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
