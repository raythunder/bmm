'use client'

import { actSaveUserAiModelSettings } from '@/actions'
import MyModal from '@/components/MyModal'
import { ReButton, ReInput, ReTextarea } from '@/components'
import {
  aiModelSettingsSchema,
  normalizeAiModelSettings,
  type AiModelConfig,
  type AiModelSettings,
} from '@/lib/ai/model-settings'
import { runAction } from '@/utils/client'
import { cn, Divider, Select, SelectItem, addToast } from '@heroui/react'
import { useMemo, useState } from 'react'

interface Props {
  initialSettings: AiModelSettings
}

function createModelsDraftMap(configs: AiModelConfig[]) {
  return configs.reduce<Record<string, string>>((acc, config) => {
    acc[config.id] = config.models.join('\n')
    return acc
  }, {})
}

function createConfigId() {
  const random = Math.random().toString(36).slice(2, 10)
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `cfg_${Date.now()}_${random}`
}

function parseModelsInput(input: string) {
  const used = new Set<string>()
  const result: string[] = []
  for (const raw of input.split(/\n|,/)) {
    const model = raw.trim()
    if (!model || used.has(model)) continue
    used.add(model)
    result.push(model)
  }
  return result
}

function getFirstIssue(error: { issues: Array<{ message: string }> }) {
  const firstIssue = error.issues[0]
  return firstIssue?.message || '参数错误'
}

function applyDraftToConfig(config: AiModelConfig, draft?: string) {
  if (draft === undefined) return config
  const models = parseModelsInput(draft)
  const activeModel = models.includes(config.activeModel) ? config.activeModel : models[0] || ''
  return {
    ...config,
    models,
    activeModel,
  }
}

function applyModelDraftsToSettings(settings: AiModelSettings, drafts: Record<string, string>) {
  return {
    ...settings,
    configs: settings.configs.map((config) => applyDraftToConfig(config, drafts[config.id])),
  }
}

const inputClassNames = {
  inputWrapper: 'min-h-14 rounded-xl bg-default-100/70 px-4 shadow-none',
  input: 'text-foreground-700 text-base',
}

const textareaClassNames = {
  ...inputClassNames,
  inputWrapper: 'min-h-40 rounded-xl bg-default-100/70 px-4 py-3 shadow-none',
}

const selectClassNames = {
  trigger: 'min-h-14 rounded-xl bg-default-100/70 px-4 shadow-none',
  value: 'text-foreground-700 text-base',
}

export default function ClientPage(props: Props) {
  const initialSettings = useMemo(
    () => normalizeAiModelSettings(props.initialSettings),
    [props.initialSettings]
  )
  const [state, setState] = useState(() => ({
    settings: initialSettings,
    modelDraftByConfigId: createModelsDraftMap(initialSettings.configs),
    selectedConfigId: initialSettings.activeConfigId || initialSettings.configs[0]?.id || null,
    saving: false,
    deletingConfig: null as AiModelConfig | null,
  }))

  const selectedConfig =
    state.settings.configs.find((config) => config.id === state.selectedConfigId) || null

  function updateSettings(updater: (settings: AiModelSettings) => AiModelSettings) {
    setState((oldState) => {
      const nextSettings = updater(oldState.settings)
      const hasSelected = nextSettings.configs.some(
        (config) => config.id === oldState.selectedConfigId
      )
      const selectedConfigId = hasSelected
        ? oldState.selectedConfigId
        : nextSettings.configs[0]?.id || null
      return {
        ...oldState,
        settings: nextSettings,
        selectedConfigId,
      }
    })
  }

  function addConfig() {
    setState((oldState) => {
      const configCount = oldState.settings.configs.length
      const nextConfig: AiModelConfig = {
        id: createConfigId(),
        name: `配置 ${configCount + 1}`,
        baseUrl: '',
        apiKey: '',
        models: [],
        activeModel: '',
      }
      const configs = [...oldState.settings.configs, nextConfig]
      return {
        ...oldState,
        settings: {
          ...oldState.settings,
          configs,
          activeConfigId: oldState.settings.activeConfigId || nextConfig.id,
        },
        modelDraftByConfigId: {
          ...oldState.modelDraftByConfigId,
          [nextConfig.id]: '',
        },
        selectedConfigId: nextConfig.id,
      }
    })
  }

  function updateConfig(configId: string, patch: Partial<AiModelConfig>) {
    updateSettings((settings) => ({
      ...settings,
      configs: settings.configs.map((config) => {
        if (config.id !== configId) return config
        return { ...config, ...patch }
      }),
    }))
  }

  function updateModelDraft(configId: string, input: string) {
    setState((oldState) => ({
      ...oldState,
      modelDraftByConfigId: {
        ...oldState.modelDraftByConfigId,
        [configId]: input,
      },
    }))
  }

  function commitConfigModelsDraft(configId: string) {
    setState((oldState) => {
      const draft = oldState.modelDraftByConfigId[configId] || ''
      const settings = {
        ...oldState.settings,
        configs: oldState.settings.configs.map((config) => {
          if (config.id !== configId) return config
          return applyDraftToConfig(config, draft)
        }),
      }
      const nextConfig = settings.configs.find((config) => config.id === configId)
      return {
        ...oldState,
        settings,
        modelDraftByConfigId: {
          ...oldState.modelDraftByConfigId,
          [configId]: nextConfig ? nextConfig.models.join('\n') : draft,
        },
      }
    })
  }

  function removeConfig(configId: string) {
    setState((oldState) => {
      const configs = oldState.settings.configs.filter((config) => config.id !== configId)
      const activeConfigId = configs.some(
        (config) => config.id === oldState.settings.activeConfigId
      )
        ? oldState.settings.activeConfigId
        : configs[0]?.id || null
      const { [configId]: _dropped, ...modelDraftByConfigId } = oldState.modelDraftByConfigId
      return {
        ...oldState,
        settings: {
          ...oldState.settings,
          configs,
          activeConfigId,
        },
        modelDraftByConfigId,
        selectedConfigId: configs.some((config) => config.id === oldState.selectedConfigId)
          ? oldState.selectedConfigId
          : configs[0]?.id || null,
      }
    })
  }

  function openDeleteConfigConfirm(config: AiModelConfig) {
    setState((oldState) => ({ ...oldState, deletingConfig: config }))
  }

  function confirmDeleteConfig() {
    if (!state.deletingConfig) return
    removeConfig(state.deletingConfig.id)
    setState((oldState) => ({ ...oldState, deletingConfig: null }))
  }

  function setActiveConfig(configId: string) {
    updateSettings((settings) => ({
      ...settings,
      activeConfigId: configId,
      configs: settings.configs.map((config) => {
        if (config.id !== configId) return config
        return {
          ...config,
          activeModel: config.models.includes(config.activeModel)
            ? config.activeModel
            : config.models[0] || '',
        }
      }),
    }))
  }

  async function saveAll() {
    const settingsWithDrafts = applyModelDraftsToSettings(
      state.settings,
      state.modelDraftByConfigId
    )
    const parsed = aiModelSettingsSchema.safeParse(settingsWithDrafts)
    if (!parsed.success) {
      addToast({
        color: 'danger',
        title: '参数错误',
        description: getFirstIssue(parsed.error),
      })
      return
    }

    setState((oldState) => ({ ...oldState, saving: true }))
    const res = await runAction(actSaveUserAiModelSettings(parsed.data), {
      okMsg: '模型配置已保存',
    })
    if (res.ok) {
      const saved = normalizeAiModelSettings(res.data)
      setState((oldState) => ({
        ...oldState,
        settings: saved,
        modelDraftByConfigId: createModelsDraftMap(saved.configs),
        selectedConfigId: saved.configs.some((config) => config.id === oldState.selectedConfigId)
          ? oldState.selectedConfigId
          : saved.activeConfigId || saved.configs[0]?.id || null,
      }))
    }
    setState((oldState) => ({ ...oldState, saving: false }))
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-foreground-700 text-3xl font-semibold">模型设置</h1>
        <p className="text-foreground-500 mt-2 text-sm">
          管理 OpenAI 兼容模型配置。可创建多个配置，并指定一个激活配置和对应模型。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="border-foreground-200 rounded-2xl border p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-foreground-600 text-sm font-medium">配置列表</h2>
            <ReButton size="sm" variant="flat" onClick={addConfig}>
              新建配置
            </ReButton>
          </div>

          <div className="space-y-2">
            {state.settings.configs.map((config) => {
              const selected = config.id === state.selectedConfigId
              const active = config.id === state.settings.activeConfigId
              return (
                <div
                  key={config.id}
                  className={cn(
                    'border-foreground-200 rounded-xl border p-3 transition',
                    selected && 'border-primary bg-primary-50/40 dark:bg-primary-400/10'
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() =>
                      setState((oldState) => ({ ...oldState, selectedConfigId: config.id }))
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground-700 truncate text-sm font-medium">
                        {config.name || '未命名配置'}
                      </span>
                      {active && (
                        <span className="bg-success-100 text-success-700 rounded px-2 py-0.5 text-xs">
                          激活中
                        </span>
                      )}
                    </div>
                    <p className="text-foreground-400 mt-1 truncate text-xs">
                      {config.baseUrl || '未设置 Base URL'}
                    </p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    {!active && (
                      <ReButton size="sm" variant="flat" onClick={() => setActiveConfig(config.id)}>
                        设为激活
                      </ReButton>
                    )}
                    <ReButton
                      size="sm"
                      variant="light"
                      color="danger"
                      onClick={() => openDeleteConfigConfirm(config)}
                    >
                      删除
                    </ReButton>
                  </div>
                </div>
              )
            })}

            {!state.settings.configs.length && (
              <div className="text-foreground-400 border-foreground-200 rounded-xl border border-dashed p-4 text-sm">
                暂无配置，点击“新建配置”开始设置。
              </div>
            )}
          </div>

          <Divider className="my-4" />

          <Select
            aria-label="当前激活配置"
            label="当前激活配置"
            placeholder="请选择配置"
            selectedKeys={state.settings.activeConfigId ? [state.settings.activeConfigId] : []}
            onSelectionChange={(keys) => {
              const configId = String(keys.currentKey || '')
              if (configId) setActiveConfig(configId)
            }}
          >
            {state.settings.configs.map((config) => (
              <SelectItem key={config.id}>{config.name || '未命名配置'}</SelectItem>
            ))}
          </Select>
        </aside>

        <section className="border-foreground-200 bg-content1/40 rounded-2xl border p-6 md:p-8">
          {!selectedConfig && (
            <div className="text-foreground-400 py-10 text-center text-sm">
              请选择或新建一个配置
            </div>
          )}

          {selectedConfig && (
            <div>
              <div className="border-divider mb-6 flex items-center justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-foreground-700 text-2xl font-semibold">编辑配置</h2>
                  <p className="text-foreground-400 mt-1 text-sm">
                    调整当前配置的连接信息和模型列表
                  </p>
                </div>
                <ReButton
                  color="primary"
                  className="h-12 w-32"
                  isLoading={state.saving}
                  onClick={saveAll}
                >
                  保存
                </ReButton>
              </div>

              <div className="grid gap-6">
                <div className="space-y-2">
                  <p className="text-foreground-500 text-sm font-medium">配置名称</p>
                  <ReInput
                    aria-label="配置名称"
                    className="w-full"
                    classNames={inputClassNames}
                    value={selectedConfig.name}
                    onValueChange={(value) => updateConfig(selectedConfig.id, { name: value })}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-foreground-500 text-sm font-medium">OPENAI_BASE_URL</p>
                  <ReInput
                    aria-label="OPENAI_BASE_URL"
                    className="w-full"
                    classNames={inputClassNames}
                    value={selectedConfig.baseUrl}
                    onValueChange={(value) => updateConfig(selectedConfig.id, { baseUrl: value })}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-foreground-500 text-sm font-medium">OPENAI_API_KEY</p>
                  <ReInput
                    aria-label="OPENAI_API_KEY"
                    className="w-full"
                    classNames={inputClassNames}
                    type="password"
                    value={selectedConfig.apiKey}
                    onValueChange={(value) => updateConfig(selectedConfig.id, { apiKey: value })}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-foreground-500 text-sm font-medium">模型列表（每行一个）</p>
                  <ReTextarea
                    aria-label="模型列表（每行一个）"
                    className="w-full"
                    classNames={textareaClassNames}
                    minRows={6}
                    value={
                      state.modelDraftByConfigId[selectedConfig.id] ??
                      selectedConfig.models.join('\n')
                    }
                    onValueChange={(value) => updateModelDraft(selectedConfig.id, value)}
                    onBlur={() => commitConfigModelsDraft(selectedConfig.id)}
                  />
                </div>

                {state.settings.activeConfigId === selectedConfig.id && (
                  <div className="space-y-2">
                    <p className="text-foreground-500 text-sm font-medium">当前激活模型</p>
                    <Select
                      aria-label="当前激活模型"
                      className="w-full"
                      classNames={selectClassNames}
                      placeholder="请选择模型"
                      selectedKeys={selectedConfig.activeModel ? [selectedConfig.activeModel] : []}
                      onSelectionChange={(keys) =>
                        updateConfig(selectedConfig.id, {
                          activeModel: String(keys.currentKey || ''),
                        })
                      }
                    >
                      {selectedConfig.models.map((model) => (
                        <SelectItem key={model}>{model}</SelectItem>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      <MyModal
        isOpen={!!state.deletingConfig}
        onClose={() => setState((oldState) => ({ ...oldState, deletingConfig: null }))}
        onOk={confirmDeleteConfig}
        title="确认删除配置"
        okButtonProps={{ color: 'danger', children: '删除' }}
      >
        <p className="text-foreground-600 text-sm">
          确认删除配置「{state.deletingConfig?.name || '未命名配置'}」？
          <br />
          删除后需要点击“保存”才会真正生效。
        </p>
      </MyModal>
    </div>
  )
}
