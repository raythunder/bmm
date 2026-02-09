const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on'])

function isAiDebugEnabledByEnv() {
  const value = (process.env.AI_DEBUG || '').trim().toLowerCase()
  return TRUTHY_VALUES.has(value)
}

export function shouldLogAiDebug() {
  return process.env.NODE_ENV !== 'production' || isAiDebugEnabledByEnv()
}

export function logAiDebug(scope: string, data?: unknown) {
  if (!shouldLogAiDebug()) return
  const prefix = `[AI_DEBUG][${scope}]`
  if (data === undefined) {
    console.log(prefix)
    return
  }
  console.log(prefix, data)
}
