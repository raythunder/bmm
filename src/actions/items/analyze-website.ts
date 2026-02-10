import { PublicTagController } from '@/controllers'
import { auth } from '@/lib/auth'
import UserTagController from '@/controllers/UserTag.controller'
import { logAiDebug } from '@/lib/ai/debug'
import { analyzeWebsite as handler } from '@/lib/ai'
import { z } from '@/lib/zod'
import { pageSpace } from '@/utils'
import { headers } from 'next/headers'
import { makeActionInput } from '../make-action'

const schema = z.url()

async function analyzeWebsite(url: z.input<typeof schema>) {
  const session = await auth()
  const userId = session?.user?.id
  const referer = (await headers()).get('referer')
  const space = pageSpace(referer)
  let tags: string[]
  if (space.isAdmin) {
    tags = await PublicTagController.getAllNames()
  } else if (space.isUser) {
    tags = await UserTagController.getAllNames()
  } else {
    if (session?.user?.isAdmin) {
      tags = await PublicTagController.getAllNames()
    } else {
      tags = await UserTagController.getAllNames()
    }
  }
  logAiDebug('action.analyzeWebsite.input', {
    referer,
    space,
    url,
    tagCount: tags.length,
    tags,
  })

  const result = await handler(url, tags, userId)

  logAiDebug('action.analyzeWebsite.output', result)
  return result
}

export const aiAnalyzeWebsiteInput = makeActionInput({
  handler: analyzeWebsite,
  schema,
})
