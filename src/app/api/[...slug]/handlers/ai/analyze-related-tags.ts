import { PublicTagController } from '@/controllers'
import { analyzeRelatedTags } from '@/lib/ai'
import { auth } from '@/lib/auth'
import { z } from '@/lib/zod'

export async function handleAnalyzeRelatedTags(req: Request) {
  const session = await auth()
  const schema = z.object({
    tag: z.string(),
  })
  const res = schema.parse(await req.json())
  return await analyzeRelatedTags(
    res.tag,
    await PublicTagController.getAllNames(),
    session?.user?.id
  )
}
