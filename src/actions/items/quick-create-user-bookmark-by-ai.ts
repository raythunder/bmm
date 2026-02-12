import { quickCreateUserBookmarkByAi } from '@/lib/ai/user-ai-quick-create'
import { z } from '@/lib/zod'
import { makeActionInput } from '../make-action'

const schema = z.object({
  url: z.url(),
})

async function quickCreateByAi(input: z.input<typeof schema>) {
  return quickCreateUserBookmarkByAi(input.url)
}

export const quickCreateUserBookmarkByAiInput = makeActionInput({
  handler: quickCreateByAi,
  schema,
})
