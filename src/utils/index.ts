import { PageRoutes } from '@cfg'
import { pinyin } from 'pinyin-pro'

export function isValidUrl(url?: string) {
  try {
    return new URL(url || '')
  } catch (error) {
    return false
  }
}

export function robustUrl(url?: string) {
  if (!url) return false
  const list = [url, 'https://' + url, 'http://' + url]
  for (const url of list) {
    const inst = isValidUrl(url)
    if (inst) {
      return inst.href
    }
  }
  return false
}

export function to<T, U = Error>(
  promise: Promise<T>,
  errorExt?: object
): Promise<[U, undefined] | [null, T]> {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[U, undefined]>((err: U) => {
      if (errorExt) {
        const parsedError = Object.assign({}, err, errorExt)
        return [parsedError, undefined]
      }

      return [err, undefined]
    })
}

export function mergeResponseInit(
  init: ResponseInit | undefined,
  otherInit: Omit<ResponseInit, 'statusCode'>
) {
  const newInit: ResponseInit = { ...init }
  if (otherInit.status) {
    newInit.status = otherInit.status
  }
  if (otherInit.headers) {
    newInit.headers = mergeHeaders(init?.headers, otherInit.headers)
  }
  return newInit
}

export function mergeHeaders(headers: HeadersInit | undefined, otherHeaders: HeadersInit) {
  const newHeaders = new Headers(headers)
  // headers.set() will override existing keys
  if (Array.isArray(otherHeaders)) {
    otherHeaders.forEach(([key, value]) => newHeaders.set(key, value))
  } else if (otherHeaders instanceof Headers) {
    otherHeaders.forEach((value, key) => newHeaders.set(key, value))
  } else {
    for (const key in otherHeaders) {
      newHeaders.set(key, otherHeaders[key])
    }
  }
  return newHeaders
}

export function createQueryObject(url: string) {
  const params = new URL(url).searchParams
  return [...params.keys()].reduce(
    (prev, key) => {
      // prev[curr] = params.getAll(curr)
      if (params.has(key)) {
        prev[key] = params.get(key)!
      }
      return prev
    },
    {} as Record<string, string>
  )
}

export function testTagNameOrPinyin(
  input: string,
  tag: Partial<Pick<SelectTag, 'name' | 'pinyin'>>
) {
  const { name = '' } = tag
  let pinyin = tag.pinyin || ''
  if (!pinyin && name) {
    pinyin = getPinyin(name)
  }
  const reg = new RegExp(input, 'i')
  return (
    reg.test(name) ||
    reg.test(pinyin) ||
    reg.test(pinyin.replace(/\s/g, '')) ||
    // 博客(bo ke) -> bk ✅
    reg.test(
      pinyin
        .split(' ')
        .map((v) => v.charAt(0))
        .join('')
    )
  )
}

function normalizeTagName(input: string) {
  return input
    .normalize('NFKC')
    .replace(/^[\s"'`“”‘’]+|[\s"'`“”‘’]+$/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function sanitizeAiTagName(input: string) {
  return input
    .normalize('NFKC')
    .replace(/^[\s"'`“”‘’]+|[\s"'`“”‘’]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function isSubsequence(shortText: string, longText: string) {
  if (!shortText || !longText) return false
  let shortIndex = 0
  for (const char of longText) {
    if (char === shortText[shortIndex]) {
      shortIndex++
      if (shortIndex === shortText.length) return true
    }
  }
  return false
}

function getTextLength(text: string) {
  return [...text].length
}

function shouldAllowLooseMatch(left: string, right: string) {
  const shortLen = Math.min(getTextLength(left), getTextLength(right))
  const longLen = Math.max(getTextLength(left), getTextLength(right))
  if (shortLen < 3) return false
  return shortLen / longLen >= 0.6
}

function resolveTagId(
  normalizedName: string,
  normalizedTags: Array<{ id: TagId; normalizedName: string }>
) {
  const exact = normalizedTags.find((tag) => tag.normalizedName === normalizedName)
  if (exact) {
    return { matchedTagId: exact.id, matchType: 'exact' as const } as const
  }
  const partialMatches = normalizedTags.filter(
    (tag) =>
      shouldAllowLooseMatch(normalizedName, tag.normalizedName) &&
      (tag.normalizedName.includes(normalizedName) ||
        normalizedName.includes(tag.normalizedName) ||
        isSubsequence(normalizedName, tag.normalizedName) ||
        isSubsequence(tag.normalizedName, normalizedName))
  )
  if (partialMatches.length === 1) {
    return { matchedTagId: partialMatches[0].id, matchType: 'loose' as const } as const
  }
  return {
    matchedTagId: null as TagId | null,
    matchType: null as 'exact' | 'loose' | null,
    isAmbiguous: partialMatches.length > 1,
  } as const
}

export function sanitizeAiTagNames(tagNames: string[] | undefined) {
  if (!tagNames?.length) return []
  const normalizedNames = new Set<string>()
  const result: string[] = []

  for (const tagName of tagNames) {
    const cleanedName = sanitizeAiTagName(tagName || '')
    const normalizedName = normalizeTagName(cleanedName)
    if (!normalizedName || normalizedNames.has(normalizedName)) continue
    normalizedNames.add(normalizedName)
    result.push(cleanedName)
  }
  return result
}

/**
 * 返回 AI 标签中真正“未命中且不歧义”的名称列表，可用于自动创建标签。
 */
export function getUnmatchedTagNames(
  tagNames: string[] | undefined,
  tags: Array<Pick<SelectTag, 'id' | 'name'>>
) {
  if (!tagNames?.length || !tags.length) return sanitizeAiTagNames(tagNames)
  const normalizedTags = tags
    .map((tag) => ({
      id: tag.id,
      normalizedName: normalizeTagName(tag.name || ''),
    }))
    .filter((tag) => !!tag.normalizedName)

  const result: string[] = []
  for (const tagName of sanitizeAiTagNames(tagNames)) {
    const normalizedName = normalizeTagName(tagName)
    if (!normalizedName || getTextLength(normalizedName) < 2) continue
    const { matchType } = resolveTagId(normalizedName, normalizedTags)
    if (matchType === 'exact') continue
    result.push(tagName)
  }
  return result
}

/**
 * 将 AI 返回的标签名映射为数据库标签 ID
 * 匹配策略：先标准化后精确匹配，再做“唯一”的包含匹配，避免误命中。
 */
export function mapTagNamesToTagIds(
  tagNames: string[] | undefined,
  tags: Array<Pick<SelectTag, 'id' | 'name'>>
) {
  if (!tagNames?.length || !tags.length) return []

  const normalizedTags = tags
    .map((tag) => ({
      id: tag.id,
      normalizedName: normalizeTagName(tag.name || ''),
    }))
    .filter((tag) => !!tag.normalizedName)

  const found = new Set<TagId>()
  const result: TagId[] = []
  const push = (tagId: TagId) => {
    if (found.has(tagId)) return
    found.add(tagId)
    result.push(tagId)
  }

  for (const name of sanitizeAiTagNames(tagNames)) {
    const normalizedName = normalizeTagName(name)
    if (!normalizedName) continue

    const { matchedTagId } = resolveTagId(normalizedName, normalizedTags)
    if (matchedTagId) {
      push(matchedTagId)
    }
  }

  return result
}

export function getPinyin(word: string) {
  return pinyin(word, { toneType: 'none', nonZh: 'consecutive' })
}

/**
 * 是否为 serverless 运行环境
 */
export function isServerless() {
  return process.env.SERVERLESS || process.env.VERCEL
}

/**
 *
 * @param urlOrPath
 * @returns
 */
export function pageSpace(urlOrPath?: 'auto' | (string & {}) | null) {
  if (urlOrPath === 'auto') {
    urlOrPath = globalThis.location?.pathname
  }
  urlOrPath ??= ''
  if (urlOrPath.startsWith('http') && URL.canParse(urlOrPath)) {
    urlOrPath = new URL(urlOrPath).pathname
  }
  return {
    isAdmin: urlOrPath.startsWith(PageRoutes.Admin.INDEX),
    isUser: urlOrPath.startsWith(PageRoutes.User.INDEX),
  }
}

export async function testUrl(url: string, opts?: { timeout?: number }) {
  const [err] = await to(
    fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: AbortSignal.timeout(opts?.timeout || 5000),
    })
  )
  return !err
}

export function getTagLinkAttrs(tag: SelectTag): Pick<HTMLAnchorElement, 'href' | 'title'> {
  return {
    href: PageRoutes.Public.tags([tag.name]),
    title: [tag.name + '相关的网站', tag.name + '资源', tag.name + '网站推荐'].join(', '),
  }
}
