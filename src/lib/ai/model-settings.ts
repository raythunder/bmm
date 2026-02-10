import { z } from '@/lib/zod'

export const aiModelConfigSchema = z.object({
  id: z.string().trim().min(1, { message: '配置 ID 不能为空' }),
  name: z.string().trim().min(1, { message: '配置名称不能为空' }).max(60),
  baseUrl: z.string().trim().url({ message: 'Base URL 格式不正确' }),
  apiKey: z.string().trim().min(1, { message: 'API Key 不能为空' }),
  models: z.array(z.string().trim().min(1, { message: '模型名称不能为空' })).min(1, {
    message: '至少配置一个模型',
  }),
  activeModel: z.string().trim().min(1, { message: '请选择当前模型' }),
})

export const aiModelSettingsSchema = z.object({
  activeConfigId: z.string().trim().nullable(),
  configs: z.array(aiModelConfigSchema),
})

export type AiModelConfig = z.output<typeof aiModelConfigSchema>
export type AiModelSettings = z.output<typeof aiModelSettingsSchema>

export interface ActiveOpenAICompatibleConfig {
  baseURL: string
  apiKey: string
  model: string
}

export function createEmptyAiModelSettings(): AiModelSettings {
  return {
    activeConfigId: null,
    configs: [],
  }
}

function normalizeModels(models: string[]) {
  const result: string[] = []
  const used = new Set<string>()
  for (const rawModel of models) {
    const model = rawModel.trim()
    if (!model || used.has(model)) continue
    used.add(model)
    result.push(model)
  }
  return result
}

function normalizeConfig(config: AiModelConfig): AiModelConfig {
  const models = normalizeModels(config.models)
  const activeModel = models.includes(config.activeModel.trim()) ? config.activeModel.trim() : ''
  return {
    ...config,
    id: config.id.trim(),
    name: config.name.trim(),
    baseUrl: config.baseUrl.trim(),
    apiKey: config.apiKey.trim(),
    models,
    activeModel: activeModel || models[0] || '',
  }
}

export function normalizeAiModelSettings(input: AiModelSettings): AiModelSettings {
  const configs: AiModelConfig[] = []
  const usedIds = new Set<string>()
  for (const item of input.configs) {
    const config = normalizeConfig(item)
    if (!config.id || usedIds.has(config.id)) continue
    usedIds.add(config.id)
    configs.push(config)
  }

  if (!configs.length) {
    return createEmptyAiModelSettings()
  }

  const activeConfigId = configs.some((config) => config.id === input.activeConfigId)
    ? input.activeConfigId
    : configs[0].id

  return {
    activeConfigId,
    configs,
  }
}

export function parseStoredAiModelSettings(raw: string | null | undefined) {
  if (!raw) return createEmptyAiModelSettings()
  try {
    const parsed = JSON.parse(raw)
    return sanitizeAiModelSettings(parsed)
  } catch {
    return createEmptyAiModelSettings()
  }
}

export function sanitizeAiModelSettings(input: unknown) {
  const parsed = aiModelSettingsSchema.safeParse(input)
  if (!parsed.success) return createEmptyAiModelSettings()
  return normalizeAiModelSettings(parsed.data)
}

export function validateAiModelSettings(input: unknown) {
  const parsed = aiModelSettingsSchema.parse(input)
  const normalized = normalizeAiModelSettings(parsed)
  return aiModelSettingsSchema.parse(normalized)
}

export function resolveActiveOpenAICompatibleConfig(
  settings: AiModelSettings
): ActiveOpenAICompatibleConfig | null {
  if (!settings.activeConfigId) return null
  const config = settings.configs.find((item) => item.id === settings.activeConfigId)
  if (!config) return null
  const model = config.models.find((item) => item === config.activeModel)
  if (!model) return null
  return {
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    model,
  }
}
