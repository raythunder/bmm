import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import UserAiModelController from '@/controllers/UserAiModel.controller'

function getOpenAICompatibleConfigFromEnv() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('请配置环境变量 OPENAI_API_KEY')
  }
  if (!process.env.OPENAI_BASE_URL) {
    throw new Error('请配置环境变量 OPENAI_BASE_URL')
  }
  if (!process.env.OPENAI_MODEL) {
    throw new Error('请配置环境变量 OPENAI_MODEL')
  }
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL,
  }
}

export async function getOpenAICompatibleModel(userId?: UserId) {
  const runtimeConfig =
    (await UserAiModelController.resolveActiveOpenAIConfigByUserId(userId)) ||
    getOpenAICompatibleConfigFromEnv()

  const provider = createOpenAICompatible({
    apiKey: runtimeConfig.apiKey,
    baseURL: runtimeConfig.baseURL,
    name: 'openai-compatible',
  })
  return provider(runtimeConfig.model)
}
