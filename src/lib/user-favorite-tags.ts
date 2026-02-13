function normalizeFavoriteTagIds(input: unknown) {
  if (!Array.isArray(input)) return []
  const used = new Set<TagId>()
  const ids: TagId[] = []
  for (const item of input) {
    const value = Number(item)
    if (!Number.isInteger(value) || value <= 0) continue
    if (used.has(value)) continue
    used.add(value)
    ids.push(value)
  }
  return ids
}

export function parseStoredFavoriteTagIds(raw: unknown) {
  if (!raw) return []
  if (Array.isArray(raw)) return normalizeFavoriteTagIds(raw)
  if (typeof raw !== 'string') return []
  try {
    return normalizeFavoriteTagIds(JSON.parse(raw))
  } catch {
    return []
  }
}

export function stringifyFavoriteTagIds(ids: TagId[]) {
  return JSON.stringify(normalizeFavoriteTagIds(ids))
}
