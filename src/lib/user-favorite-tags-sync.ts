import { parseStoredFavoriteTagIds } from './user-favorite-tags'

const EVENT_NAME = 'bmm:user-favorite-tag-ids:changed'

export function emitUserFavoriteTagIdsChanged(ids: TagId[]) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: ids }))
}

export function onUserFavoriteTagIdsChanged(handler: (ids: TagId[]) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<unknown>
    handler(parseStoredFavoriteTagIds(customEvent.detail))
  }
  window.addEventListener(EVENT_NAME, listener)
  return () => window.removeEventListener(EVENT_NAME, listener)
}
