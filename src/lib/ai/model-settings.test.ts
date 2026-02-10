import { describe, expect, it } from 'vitest'
import {
  normalizeAiModelSettings,
  resolveActiveOpenAICompatibleConfig,
  validateAiModelSettings,
} from './model-settings'

describe('ai model settings', () => {
  it('normalizes active config and active model', () => {
    const settings = normalizeAiModelSettings({
      activeConfigId: 'missing',
      configs: [
        {
          id: 'cfg-1',
          name: '默认',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'key-1',
          models: ['glm-4-flash', 'glm-4-flash', ''],
          activeModel: 'missing-model',
        },
      ],
    })

    expect(settings.activeConfigId).toBe('cfg-1')
    expect(settings.configs[0].models).toEqual(['glm-4-flash'])
    expect(settings.configs[0].activeModel).toBe('glm-4-flash')
  })

  it('resolves runtime config from active config', () => {
    const runtimeConfig = resolveActiveOpenAICompatibleConfig({
      activeConfigId: 'cfg-2',
      configs: [
        {
          id: 'cfg-1',
          name: 'A',
          baseUrl: 'https://a.example.com/v1',
          apiKey: 'a-key',
          models: ['a-model'],
          activeModel: 'a-model',
        },
        {
          id: 'cfg-2',
          name: 'B',
          baseUrl: 'https://b.example.com/v1',
          apiKey: 'b-key',
          models: ['b-model-1', 'b-model-2'],
          activeModel: 'b-model-2',
        },
      ],
    })

    expect(runtimeConfig).toEqual({
      baseURL: 'https://b.example.com/v1',
      apiKey: 'b-key',
      model: 'b-model-2',
    })
  })

  it('validates required fields', () => {
    expect(() =>
      validateAiModelSettings({
        activeConfigId: 'cfg-1',
        configs: [
          {
            id: 'cfg-1',
            name: '配置',
            baseUrl: '',
            apiKey: '',
            models: [],
            activeModel: '',
          },
        ],
      })
    ).toThrowError()
  })
})
