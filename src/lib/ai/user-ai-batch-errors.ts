const USER_AI_BATCH_JOB_LAST_ERROR_MAX_LEN = 500

export function normalizeUserAiBatchJobErrorMessage(message: string) {
  const text = message.trim() || '未知错误'
  if (text.length <= USER_AI_BATCH_JOB_LAST_ERROR_MAX_LEN) return text
  return `${text.slice(0, USER_AI_BATCH_JOB_LAST_ERROR_MAX_LEN - 3)}...`
}
