'use client'

import { actSaveSystemSettings, actSaveUserAiModelSettings } from '@/actions'
import MyModal from '@/components/MyModal'
import { ReButton, ReInput, ReTextarea } from '@/components'
import {
  aiModelSettingsSchema,
  normalizeAiModelSettings,
  type AiModelConfig,
  type AiModelSettings,
} from '@/lib/ai/model-settings'
import {
  normalizeSystemSettings,
  systemSettingsSchema,
  type SystemSettings,
} from '@/lib/system-settings'
import { runAction } from '@/utils/client'
import { cn, Divider, Select, SelectItem, Switch, Tab, Tabs, addToast } from '@heroui/react'
import { useMemo, useState } from 'react'

interface Props {
  initialSettings: AiModelSettings
  initialSystemSettings: SystemSettings
  isAdmin: boolean
}

type SettingsTabKey = 'ai-models' | 'system'

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
  const initialAiModelSettings = useMemo(
    () => normalizeAiModelSettings(props.initialSettings),
    [props.initialSettings]
  )
  const initialSystemSettings = useMemo(
    () => normalizeSystemSettings(props.initialSystemSettings),
    [props.initialSystemSettings]
  )

  const [state, setState] = useState(() => ({
    activeTab: 'ai-models' as SettingsTabKey,
    aiModelSettings: initialAiModelSettings,
    systemSettings: initialSystemSettings,
    modelDraftByConfigId: createModelsDraftMap(initialAiModelSettings.configs),
    selectedConfigId:
      initialAiModelSettings.activeConfigId || initialAiModelSettings.configs[0]?.id || null,
    savingAiModel: false,
    savingSystem: false,
    deletingConfig: null as AiModelConfig | null,
  }))

  const selectedConfig =
    state.aiModelSettings.configs.find((config) => config.id === state.selectedConfigId) || null

  function updateAiModelSettings(updater: (settings: AiModelSettings) => AiModelSettings) {
    setState((oldState) => {
      const nextSettings = updater(oldState.aiModelSettings)
      const hasSelected = nextSettings.configs.some(
        (config) => config.id === oldState.selectedConfigId
      )
      const selectedConfigId = hasSelected
        ? oldState.selectedConfigId
        : nextSettings.configs[0]?.id || null
      return {
        ...oldState,
        aiModelSettings: nextSettings,
        selectedConfigId,
      }
    })
  }

  function addConfig() {
    setState((oldState) => {
      const configCount = oldState.aiModelSettings.configs.length
      const nextConfig: AiModelConfig = {
        id: createConfigId(),
        name: `配置 ${configCount + 1}`,
        baseUrl: '',
        apiKey: '',
        models: [],
        activeModel: '',
      }
      const configs = [...oldState.aiModelSettings.configs, nextConfig]
      return {
        ...oldState,
        aiModelSettings: {
          ...oldState.aiModelSettings,
          configs,
          activeConfigId: oldState.aiModelSettings.activeConfigId || nextConfig.id,
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
    updateAiModelSettings((settings) => ({
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
        ...oldState.aiModelSettings,
        configs: oldState.aiModelSettings.configs.map((config) => {
          if (config.id !== configId) return config
          return applyDraftToConfig(config, draft)
        }),
      }
      const nextConfig = settings.configs.find((config) => config.id === configId)
      return {
        ...oldState,
        aiModelSettings: settings,
        modelDraftByConfigId: {
          ...oldState.modelDraftByConfigId,
          [configId]: nextConfig ? nextConfig.models.join('\n') : draft,
        },
      }
    })
  }

  function removeConfig(configId: string) {
    setState((oldState) => {
      const configs = oldState.aiModelSettings.configs.filter((config) => config.id !== configId)
      const activeConfigId = configs.some(
        (config) => config.id === oldState.aiModelSettings.activeConfigId
      )
        ? oldState.aiModelSettings.activeConfigId
        : configs[0]?.id || null
      const { [configId]: _dropped, ...modelDraftByConfigId } = oldState.modelDraftByConfigId
      return {
        ...oldState,
        aiModelSettings: {
          ...oldState.aiModelSettings,
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
    updateAiModelSettings((settings) => ({
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

  async function saveAiModelSettings() {
    const settingsWithDrafts = applyModelDraftsToSettings(
      state.aiModelSettings,
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

    setState((oldState) => ({ ...oldState, savingAiModel: true }))
    const res = await runAction(actSaveUserAiModelSettings(parsed.data), {
      okMsg: '模型配置已保存',
    })
    if (res.ok) {
      const saved = normalizeAiModelSettings(res.data)
      setState((oldState) => ({
        ...oldState,
        aiModelSettings: saved,
        modelDraftByConfigId: createModelsDraftMap(saved.configs),
        selectedConfigId: saved.configs.some((config) => config.id === oldState.selectedConfigId)
          ? oldState.selectedConfigId
          : saved.activeConfigId || saved.configs[0]?.id || null,
      }))
    }
    setState((oldState) => ({ ...oldState, savingAiModel: false }))
  }

  async function saveSystemSettings() {
    if (!props.isAdmin) return
    const parsed = systemSettingsSchema.safeParse(state.systemSettings)
    if (!parsed.success) {
      addToast({
        color: 'danger',
        title: '参数错误',
        description: getFirstIssue(parsed.error),
      })
      return
    }

    setState((oldState) => ({ ...oldState, savingSystem: true }))
    const res = await runAction(actSaveSystemSettings(parsed.data), {
      okMsg: '系统配置已保存',
    })
    if (res.ok) {
      setState((oldState) => ({
        ...oldState,
        systemSettings: normalizeSystemSettings(res.data),
      }))
    }
    setState((oldState) => ({ ...oldState, savingSystem: false }))
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-foreground-700 text-3xl font-semibold">系统设置</h1>
        <p className="text-foreground-500 mt-2 text-sm">
          管理 AI 模型与站点级配置，后续可在此扩展更多系统能力。
        </p>
      </div>

      <Tabs
        selectedKey={state.activeTab}
        onSelectionChange={(key) =>
          setState((oldState) => ({ ...oldState, activeTab: String(key) as SettingsTabKey }))
        }
      >
        <Tab key="ai-models" title="AI 模型设置">
          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="border-foreground-200 rounded-2xl border p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-foreground-600 text-sm font-medium">配置列表</h2>
                <ReButton size="sm" variant="flat" onClick={addConfig}>
                  新建配置
                </ReButton>
              </div>

              <div className="space-y-2">
                {state.aiModelSettings.configs.map((config) => {
                  const selected = config.id === state.selectedConfigId
                  const active = config.id === state.aiModelSettings.activeConfigId
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
                          <ReButton
                            size="sm"
                            variant="flat"
                            onClick={() => setActiveConfig(config.id)}
                          >
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

                {!state.aiModelSettings.configs.length && (
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
                selectedKeys={
                  state.aiModelSettings.activeConfigId ? [state.aiModelSettings.activeConfigId] : []
                }
                onSelectionChange={(keys) => {
                  const configId = String(keys.currentKey || '')
                  if (configId) setActiveConfig(configId)
                }}
              >
                {state.aiModelSettings.configs.map((config) => (
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
                      isLoading={state.savingAiModel}
                      onClick={saveAiModelSettings}
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
                        onValueChange={(value) =>
                          updateConfig(selectedConfig.id, { baseUrl: value })
                        }
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
                        onValueChange={(value) =>
                          updateConfig(selectedConfig.id, { apiKey: value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-foreground-500 text-sm font-medium">
                        模型列表（每行一个）
                      </p>
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

                    {state.aiModelSettings.activeConfigId === selectedConfig.id && (
                      <div className="space-y-2">
                        <p className="text-foreground-500 text-sm font-medium">当前激活模型</p>
                        <Select
                          aria-label="当前激活模型"
                          className="w-full"
                          classNames={selectClassNames}
                          placeholder="请选择模型"
                          selectedKeys={
                            selectedConfig.activeModel ? [selectedConfig.activeModel] : []
                          }
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
        </Tab>

        {props.isAdmin && (
          <Tab key="system" title="系统配置">
            <section className="border-foreground-200 bg-content1/40 mt-6 rounded-2xl border p-6 md:p-8">
              <div className="border-divider mb-6 flex items-center justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-foreground-700 text-2xl font-semibold">注册设置</h2>
                  <p className="text-foreground-400 mt-1 text-sm">
                    控制登录页是否展示注册入口，并决定是否允许账号注册。
                  </p>
                </div>
                <ReButton
                  color="primary"
                  className="h-12 w-32"
                  isLoading={state.savingSystem}
                  onClick={saveSystemSettings}
                >
                  保存
                </ReButton>
              </div>

              <div className="space-y-3">
                <Switch
                  aria-label="是否开放注册"
                  isSelected={state.systemSettings.allowRegister}
                  onValueChange={(allowRegister) =>
                    setState((oldState) => ({
                      ...oldState,
                      systemSettings: {
                        ...oldState.systemSettings,
                        allowRegister,
                      },
                    }))
                  }
                >
                  开放注册
                </Switch>
                <p className="text-foreground-500 text-sm">
                  关闭后，登录页将隐藏“去注册”入口，服务端也会拒绝新的注册请求。
                </p>
              </div>
            </section>
          </Tab>
        )}
      </Tabs>

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
