import { useState } from 'react'
import {
  AddApiProviderOptions,
  AppSettings,
  ApprovalPolicy,
  CodexConfig,
  CodexConfigPatch,
  PermissionMode,
  QuickCommand,
  SandboxMode,
  ShellKind,
  ShortcutActionId,
} from '../../../shared/types'
import { formatShortcut } from '../../../shared/shortcuts'
import {
  IconClose,
  IconFolder,
  IconPlus,
  IconTrash,
} from './Icons'
import { Field } from './ui'

const SHELL_OPTIONS: { value: ShellKind; label: string }[] = [
  { value: 'cmd', label: 'CMD' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'pwsh', label: 'PowerShell 7' },
  { value: 'wsl', label: 'WSL' },
]

const PERMISSION_MODES: {
  value: PermissionMode
  title: string
  desc: string
  danger?: boolean
}[] = [
  {
    value: 'default',
    title: '默认模式',
    desc: 'Codex 默认策略：按需确认，工作区可写沙箱。',
  },
  {
    value: 'plan',
    title: '计划模式',
    desc: '只读沙箱，不能修改文件；仅受信任命令自动执行，其余需确认。适合先看方案再动手。',
  },
  {
    value: 'auto',
    title: '自动模式',
    desc: '自动接受全部操作，不再逐个询问，仍在工作区可写沙箱内。',
  },
  {
    value: 'auto-unsafe',
    title: '完全自动',
    desc: '跳过所有确认且关闭沙箱。风险极高，仅限隔离/可还原环境。',
    danger: true,
  },
  {
    value: 'custom',
    title: '自定义',
    desc: '手动组合审批策略与沙箱级别。',
  },
]

const SHORTCUT_ITEMS: { id: ShortcutActionId; label: string }[] = [
  { id: 'commandPalette', label: '命令面板' },
  { id: 'newTerminal', label: '新建终端' },
  { id: 'closeTerminal', label: '关闭当前终端' },
  { id: 'nextTab', label: '下一个标签' },
  { id: 'prevTab', label: '上一个标签' },
  { id: 'toggleSidebar', label: '开关历史侧栏' },
  { id: 'openSettings', label: '打开设置' },
]

function ShortcutInput({
  value,
  onCommit,
}: {
  value: string
  onCommit: (combo: string) => void
}) {
  const [capturing, setCapturing] = useState(false)
  return (
    <button
      type="button"
      className={`shortcut-input ${capturing ? 'capturing' : ''}`}
      onClick={() => setCapturing(true)}
      onKeyDown={(event) => {
        if (!capturing) return
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'Escape') {
          setCapturing(false)
          return
        }
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return
        const combo = formatShortcut({
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          key: event.key,
        })
        if (combo) {
          onCommit(combo)
          setCapturing(false)
        }
      }}
      onBlur={() => setCapturing(false)}
    >
      {capturing ? '请按下组合键…' : value}
    </button>
  )
}

export function SettingsModal({
  settings,
  codexConfig,
  onSettingsChange,
  onConfigChange,
  onAddProvider,
  onClearHistory,
  onClose,
}: {
  settings: AppSettings
  codexConfig: CodexConfig | null
  onSettingsChange: (patch: Partial<AppSettings>) => void
  onConfigChange: (patch: CodexConfigPatch) => void
  onAddProvider: (opts: AddApiProviderOptions) => Promise<unknown>
  onClearHistory: () => void
  onClose: () => void
}) {
  const [shortcutError, setShortcutError] = useState('')
  const [apiName, setApiName] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [apiError, setApiError] = useState('')

  const updateQuickCommand = (
    id: string,
    patch: Partial<QuickCommand>,
  ) => {
    onSettingsChange({
      quickCommands: settings.quickCommands.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })
  }

  const removeQuickCommand = (id: string) => {
    onSettingsChange({
      quickCommands: settings.quickCommands.filter((item) => item.id !== id),
    })
  }

  const addQuickCommand = () => {
    onSettingsChange({
      quickCommands: [
        ...settings.quickCommands,
        {
          id: `custom-${Date.now()}`,
          label: '自定义命令',
          command: 'echo hello',
        },
      ],
    })
  }

  const commitShortcut = (id: ShortcutActionId, combo: string) => {
    const conflict = SHORTCUT_ITEMS.find(
      (item) => item.id !== id && settings.shortcuts[item.id] === combo,
    )
    if (conflict) {
      setShortcutError(`「${combo}」已被「${conflict.label}」占用`)
      return
    }
    setShortcutError('')
    onSettingsChange({
      shortcuts: { ...settings.shortcuts, [id]: combo },
    })
  }

  const submitApi = async () => {
    setApiError('')
    try {
      await onAddProvider({
        name: apiName,
        baseUrl: apiBaseUrl,
        bearerToken: apiToken || undefined,
      })
      setApiName('')
      setApiBaseUrl('')
      setApiToken('')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog settings-dialog">
        <div className="dialog-title-row">
          <div className="dialog-title">设置</div>
          <button
            type="button"
            className="icon-btn"
            title="关闭"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>
        <div className="settings-body">
          <section className="settings-section">
            <h3>权限与安全</h3>
            <p className="settings-hint">
              每个终端窗口的权限相互独立；新建窗口默认使用这里选择的模式。
              当前终端的权限可在右栏单独调整；切换运行中的 Codex 会重启会话并应用新权限。
            </p>
            <div className="permission-modes">
              {PERMISSION_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={`permission-card ${
                    settings.permissions.mode === mode.value
                      ? 'selected'
                      : ''
                  } ${mode.danger ? 'danger' : ''}`}
                >
                  <input
                    type="radio"
                    name="permission-mode"
                    checked={settings.permissions.mode === mode.value}
                    onChange={() =>
                      onSettingsChange({
                        permissions: {
                          ...settings.permissions,
                          mode: mode.value,
                        },
                      })
                    }
                  />
                  <span className="permission-card-main">
                    <span className="permission-card-title">{mode.title}</span>
                    <span className="permission-card-desc">{mode.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            {settings.permissions.mode === 'custom' && (
              <div className="custom-permissions">
                <Field label="审批策略">
                  <select
                    className="select"
                    value={settings.permissions.customApproval}
                    onChange={(event) =>
                      onSettingsChange({
                        permissions: {
                          ...settings.permissions,
                          customApproval: event.target
                            .value as ApprovalPolicy,
                        },
                      })
                    }
                  >
                    <option value="untrusted">仅受信任命令自动执行</option>
                    <option value="on-request">按需询问（默认）</option>
                    <option value="never">从不询问</option>
                  </select>
                </Field>
                <Field label="沙箱级别">
                  <select
                    className="select"
                    value={settings.permissions.customSandbox}
                    onChange={(event) =>
                      onSettingsChange({
                        permissions: {
                          ...settings.permissions,
                          customSandbox: event.target.value as SandboxMode,
                        },
                      })
                    }
                  >
                    <option value="read-only">只读</option>
                    <option value="workspace-write">工作区可写</option>
                    <option value="danger-full-access">完全访问</option>
                  </select>
                </Field>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={settings.permissions.customBypass}
                    onChange={(event) =>
                      onSettingsChange({
                        permissions: {
                          ...settings.permissions,
                          customBypass: event.target.checked,
                        },
                      })
                    }
                  />
                  <span className="danger-text">
                    同时跳过所有确认并关闭沙箱（极度危险）
                  </span>
                </label>
              </div>
            )}
          </section>

          <section className="settings-section">
            <h3>终端</h3>
            <Field label="默认 Shell">
              <select
                className="select"
                value={settings.defaultShell}
                onChange={(event) =>
                  onSettingsChange({
                    defaultShell: event.target.value as ShellKind,
                  })
                }
              >
                {SHELL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="默认工作目录">
              <div className="input-row">
                <input
                  className="input input-mono"
                  value={settings.defaultCwd}
                  onChange={(event) =>
                    onSettingsChange({ defaultCwd: event.target.value })
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  title="浏览"
                  onClick={async () => {
                    const picked = await window.api.dialog.pickDirectory()
                    if (picked) onSettingsChange({ defaultCwd: picked })
                  }}
                >
                  <IconFolder size={14} />
                </button>
              </div>
            </Field>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.autoStartCodex}
                onChange={(event) =>
                  onSettingsChange({ autoStartCodex: event.target.checked })
                }
              />
              <span>新建终端自动启动 Codex</span>
            </label>
            <Field label="终端字号（10–24）">
              <input
                type="number"
                min={10}
                max={24}
                className="input"
                value={settings.terminalFontSize}
                onChange={(event) =>
                  onSettingsChange({
                    terminalFontSize: Math.max(
                      10,
                      Math.min(24, Number(event.target.value) || 13),
                    ),
                  })
                }
              />
            </Field>
            <div className="settings-grid">
              <Field label="默认布局">
                <select
                  className="select"
                  value={settings.layout}
                  onChange={(event) =>
                    onSettingsChange({
                      layout: event.target.value as 'tabs' | 'grid',
                    })
                  }
                >
                  <option value="tabs">标签页</option>
                  <option value="grid">网格</option>
                </select>
              </Field>
              <Field label="网格列数">
                <select
                  className="select"
                  value={settings.gridColumns}
                  onChange={(event) =>
                    onSettingsChange({
                      gridColumns: Number(event.target.value),
                    })
                  }
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n} 列
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="settings-section">
            <h3>外观</h3>
            <Field label="主题">
              <select
                className="select"
                value={settings.theme}
                onChange={(event) =>
                  onSettingsChange({
                    theme: event.target.value as 'dark' | 'light',
                  })
                }
              >
                <option value="dark">深色</option>
                <option value="light">浅色</option>
              </select>
            </Field>
          </section>

          <section className="settings-section">
            <h3>数据</h3>
            <p className="settings-hint">
              以下设置只影响面板记录的终端输入/输出文本，不会清理 Codex 对话历史。
            </p>
            <Field label="终端输出保留天数">
              <input
                type="number"
                min={1}
                max={3650}
                className="input"
                value={settings.historyRetentionDays}
                onChange={(event) =>
                  onSettingsChange({
                    historyRetentionDays:
                      Number(event.target.value) || 30,
                  })
                }
              />
            </Field>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onClearHistory}
            >
              <IconTrash size={14} />
              清空终端输出记录
            </button>
          </section>

          <section className="settings-section">
            <h3>Codex 与模型</h3>
            {codexConfig ? (
              <>
                <Field label="API 服务">
                  <select
                    className="select"
                    value={codexConfig.provider ?? ''}
                    onChange={(event) =>
                      onConfigChange({ provider: event.target.value })
                    }
                  >
                    {codexConfig.providers.map((provider) => (
                      <option key={provider.name} value={provider.name}>
                        {provider.name}（{provider.baseUrl}）
                      </option>
                    ))}
                    <option value="openai">openai（官方）</option>
                    <option value="oss">oss（本地开源模型）</option>
                  </select>
                </Field>
                <Field label="模型">
                  <select
                    className="select"
                    value={codexConfig.model ?? ''}
                    onChange={(event) =>
                      onConfigChange({ model: event.target.value })
                    }
                  >
                    {codexConfig.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="推理强度">
                  <select
                    className="select"
                    value={codexConfig.reasoningEffort ?? 'high'}
                    onChange={(event) =>
                      onConfigChange({ reasoningEffort: event.target.value })
                    }
                  >
                    {['low', 'medium', 'high', 'max'].map((effort) => (
                      <option key={effort} value={effort}>
                        {effort}
                      </option>
                    ))}
                    {codexConfig.reasoningEffort &&
                      !['low', 'medium', 'high', 'max'].includes(
                        codexConfig.reasoningEffort,
                      ) && (
                        <option value={codexConfig.reasoningEffort}>
                          {codexConfig.reasoningEffort}
                        </option>
                      )}
                  </select>
                </Field>
                <div className="add-api">
                  <div className="add-api-title">添加自定义 API</div>
                  <div className="input-row">
                    <input
                      className="input"
                      placeholder="名称（如 myapi）"
                      value={apiName}
                      onChange={(event) => setApiName(event.target.value)}
                    />
                    <input
                      className="input input-mono"
                      placeholder="Base URL（https://…）"
                      value={apiBaseUrl}
                      onChange={(event) => setApiBaseUrl(event.target.value)}
                    />
                  </div>
                  <input
                    type="password"
                    className="input input-mono"
                    placeholder="Bearer Token（可选）"
                    value={apiToken}
                    onChange={(event) => setApiToken(event.target.value)}
                  />
                  {apiError && (
                    <div className="shortcut-error">{apiError}</div>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void submitApi()}
                  >
                    添加并写入 config.toml
                  </button>
                </div>
              </>
            ) : (
              <div className="panel-empty">未读取到 Codex 配置</div>
            )}
          </section>

          <section className="settings-section">
            <h3>快捷键</h3>
            <p className="settings-hint">
              点击右侧按钮后按下新的组合键即可修改；Esc 取消。
            </p>
            {shortcutError && (
              <div className="shortcut-error">{shortcutError}</div>
            )}
            <div className="shortcut-list">
              {SHORTCUT_ITEMS.map((item) => (
                <div className="shortcut-row" key={item.id}>
                  <span className="shortcut-label">{item.label}</span>
                  <ShortcutInput
                    value={settings.shortcuts[item.id]}
                    onCommit={(combo) => commitShortcut(item.id, combo)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3>Codex 快捷命令</h3>
            <div className="quick-list">
              {settings.quickCommands.map((item) => (
                <div className="quick-edit-row" key={item.id}>
                  <input
                    className="input"
                    value={item.label}
                    onChange={(event) =>
                      updateQuickCommand(item.id, {
                        label: event.target.value,
                      })
                    }
                  />
                  <input
                    className="input input-mono"
                    value={item.command}
                    onChange={(event) =>
                      updateQuickCommand(item.id, {
                        command: event.target.value,
                      })
                    }
                  />
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    title="删除"
                    onClick={() => removeQuickCommand(item.id)}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-block"
              onClick={addQuickCommand}
            >
              <IconPlus size={14} />
              添加快捷命令
            </button>
          </section>
        </div>
        <div className="dialog-actions settings-actions">
          <span className="dialog-actions-spacer" />
          <button type="button" className="btn btn-primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
