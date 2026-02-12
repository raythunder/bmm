import { z } from '@/lib/zod'

export const systemSettingsSchema = z.object({
  allowRegister: z.boolean(),
})

export type SystemSettings = z.output<typeof systemSettingsSchema>

export function createDefaultSystemSettings(): SystemSettings {
  return {
    allowRegister: true,
  }
}

export function normalizeSystemSettings(input: unknown): SystemSettings {
  const parsed = systemSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return createDefaultSystemSettings()
  }
  return parsed.data
}
