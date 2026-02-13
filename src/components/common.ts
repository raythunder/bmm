import { ButtonProps, NavbarProps } from '@heroui/react'

export const IconButtonProps = {
  className: 'text-2xl text-foreground-600 xs:hover:text-foreground-800 outline-hidden',
  isIconOnly: true,
  variant: 'light',
} satisfies ButtonProps

export const NavBarProps = {
  maxWidth: 'full',
  className: 'fixed dark:bg-black/25 light:bg-white/35',
  isBlurred: true,
  isBordered: true,
} satisfies NavbarProps

export const TagPickerBox = {
  SCROLLER_ROLE: 'tag-picker-scroller',
  ONLY_MAIN: 'tag-picker-only-main-tags',
  TOP: 'tag-picker-last-scrollTop',
  FAVORITE_TAG_IDS_PREFIX: 'tag-picker-favorite-tag-ids',
  getFavoriteTagIdsStorageKey: (userId?: UserId | null) =>
    `${TagPickerBox.FAVORITE_TAG_IDS_PREFIX}:${userId || 'guest'}`,
  getFavoriteTagIds: (userId?: UserId | null) => {
    const key = TagPickerBox.getFavoriteTagIdsStorageKey(userId)
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]')
      if (!Array.isArray(raw)) return []
      const ids: TagId[] = []
      const existed = new Set<TagId>()
      for (const item of raw) {
        const value = Number(item)
        if (!Number.isInteger(value) || value <= 0) continue
        if (existed.has(value)) continue
        existed.add(value)
        ids.push(value)
      }
      return ids
    } catch {
      return []
    }
  },
  setFavoriteTagIds: (ids: TagId[], userId?: UserId | null) => {
    const key = TagPickerBox.getFavoriteTagIdsStorageKey(userId)
    const normalizedIds = [...new Set(ids.map((id) => Number(id)))].filter((value) =>
      Number.isInteger(value)
    )
    localStorage.setItem(key, JSON.stringify(normalizedIds))
  },
  getOnlyMain: () => localStorage.getItem(TagPickerBox.ONLY_MAIN) === 'true',
  setOnlyMain: (onlyMain: boolean) => {
    localStorage.setItem(TagPickerBox.ONLY_MAIN, onlyMain.toString())
  },
  getScrollTop: () => Number(localStorage.getItem(TagPickerBox.TOP) || 0),
  saveScrollTop: () => {
    const scroller = document.querySelector(`div[role="${TagPickerBox.SCROLLER_ROLE}"]`)
    localStorage.setItem(TagPickerBox.TOP, (scroller?.scrollTop || 0).toString())
  },
}
