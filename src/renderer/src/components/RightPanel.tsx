import { useEffect, useMemo, useState } from 'react'
import { PERMISSION_MODE_LABELS } from '../../../shared/codex-modes'
import {
  AppSettings,
  CodexConfig,
  CodexConfigPatch,
  CodexInfo,
  PermissionMode,
  PermissionSettings,
  SessionMeta,
} from '../../../shared/types'
import { formatDuration, shellLabel } from '../utils'
import {
  IconCopy,
  IconExternal,
  IconFolder,
  IconRefresh,
  IconSettings,
  IconSparkles,
  IconStop,
  IconTerminal,
} from './Icons'
import { Field, Section } from './ui'

const EFFORT_OPTIONS = ['low', 'medium', 'high', 'max']

export function RightPanel({
  settings,
  activeSession,
  codex,
  codexConfig,
  onRefreshCodex,
  onConfigChange,
  onRunInNew,
  onRunInActive,
  onOpenPath,
  onKillSession,
  onOpenSettings,
  onSetPermission,
}: {
  settings: AppSettings
  activeSession: SessionMeta | null
  codex: CodexInfo | null
  codexConfig: CodexConfig | null
  onRefreshCodex: () => void
  onConfigChange: (patch: CodexConfigPatch) => void
  onRunInNew: (command: string) => void
  onRunInActive: (command: string) => void
  onOpenPath: (path: string) => void
  onKillSession: (id: string) => void
  onOpenSettings: () => void
  onSetPermission: (id: string, permissions: PermissionSettings) => void
}) {
  const [now, setNow] = useState(Date.now())
  const [execPrompt, setExecPrompt] = useState('')

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [activeSession])

  const runtime = useMemo(() => {
    if (!activeSession) return null
    if (!activeSession.endedAt) return Date.now() - activeSession.createdAt
    return activeSession.endedAt - activeSession.createdAt
  }, [activeSession, now])

  const submitExec = () => {
    const prompt = execPrompt.trim()
    if (!prompt) return
    const escaped = prompt.replace(/"/g, '\\"')
    onRunInNew(`codex exec "${escaped}"`)
    setExecPrompt('')
  }

  const copyOutput = async () => {
    if (!activeSession) return
    const text = await window.api.sessions.buffer(activeSession.id)
    void navigator.clipboard.writeText(text)
  }

  return (
    <aside className="right-panel">
      <Section
        title="当前会话"
        actions={
          activeSession && activeSession.status === 'running' ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => onKillSession(activeSession.id)}
            >
              <IconStop size={13} />
              终止
            </button>
          ) : undefined
        }
      >
        {!activeSession && (
          <div className="panel-empty">没有活动会话</div>
        )}
        {activeSession && (
          <div className="session-info">
            <div className="info-row">
              <span className="info-label">标题</span>
              <span className="info-value">{activeSession.title}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Shell</span>
              <span className="info-value">
                {shellLabel(activeSession.shell)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">状态</span>
              <span className="info-value">
                <span className={`status-dot status-${activeSession.status}`} />
                {activeSession.status === 'running'
                  ? '运行中'
                  : '已退出'}
                {activeSession.exitCode != null &&
                  ` (${activeSession.exitCode})`}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">运行时长</span>
              <span className="info-value">
                {runtime != null ? formatDuration(runtime) : '—'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">PID</span>
              <span className="info-value">{activeSession.pid ?? '—'}</span>
            </div>
            <div className="info-row info-row-column">
              <span className="info-label">工作目录</span>
              <span className="info-value info-cwd" title={activeSession.cwd}>
                {activeSession.cwd}
              </span>
            </div>
            <div className="session-actions">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onOpenPath(activeSession.cwd)}
              >
                <IconFolder size={13} />
                打开目录
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => void copyOutput()}
              >
                <IconCopy size={13} />
                复制输出
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="权限模式"
        actions={
          <button
            type="button"
            className="icon-btn"
            title="权限设置"
            onClick={onOpenSettings}
          >
            <IconSettings size={14} />
          </button>
        }
      >
        {activeSession ? (
          <>
            <select
              className="select"
              value={activeSession.permissions.mode}
              onChange={(event) =>
                onSetPermission(activeSession.id, {
                  ...activeSession.permissions,
                  mode: event.target.value as PermissionMode,
                })
              }
            >
              {(
                [
                  'default',
                  'plan',
                  'auto',
                  'auto-unsafe',
                  'custom',
                ] as PermissionMode[]
              ).map((mode) => (
                <option key={mode} value={mode}>
                  {PERMISSION_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
            <div className="settings-hint">
              权限独立于其他终端；若该终端正在运行 Codex，切换会立即同步。
            </div>
          </>
        ) : (
          <div className="panel-empty">没有活动会话</div>
        )}
      </Section>

      <Section title="模型">
        {codexConfig ? (
          <>
            <Field label="API">
              <select
                className="select"
                value={codexConfig.provider ?? ''}
                onChange={(event) =>
                  onConfigChange({ provider: event.target.value })
                }
              >
                {codexConfig.providers.map((provider) => (
                  <option key={provider.name} value={provider.name}>
                    {provider.name}
                  </option>
                ))}
                <option value="openai">openai</option>
                <option value="oss">oss</option>
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
                {EFFORT_OPTIONS.map((effort) => (
                  <option key={effort} value={effort}>
                    {effort}
                  </option>
                ))}
                {codexConfig.reasoningEffort &&
                  !EFFORT_OPTIONS.includes(codexConfig.reasoningEffort) && (
                    <option value={codexConfig.reasoningEffort}>
                      {codexConfig.reasoningEffort}
                    </option>
                  )}
              </select>
            </Field>
          </>
        ) : (
          <div className="panel-empty">未读取到 Codex 配置</div>
        )}
      </Section>

      <Section
        title="Codex"
        actions={
          <button
            type="button"
            className="icon-btn"
            title="刷新"
            onClick={onRefreshCodex}
          >
            <IconRefresh size={14} />
          </button>
        }
      >
        <div className="codex-status">
          <IconSparkles size={16} />
          {codex?.installed ? (
            <span>
              Codex CLI {codex.version ?? ''}
              {codex.model ? ` · 模型 ${codex.model}` : ''}
            </span>
          ) : (
            <span>未检测到 Codex CLI</span>
          )}
        </div>
        <div className="exec-box">
          <input
            value={execPrompt}
            onChange={(event) => setExecPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitExec()
            }}
            placeholder='codex exec "描述你的任务…"'
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!execPrompt.trim()}
            onClick={submitExec}
          >
            <IconTerminal size={13} />
            执行
          </button>
        </div>
        <div className="quick-list">
          {settings.quickCommands.map((item) => (
            <div className="quick-row" key={item.id}>
              <span className="quick-label" title={item.command}>
                {item.label}
              </span>
              <div className="quick-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="在当前会话执行"
                  disabled={!activeSession}
                  onClick={() => onRunInActive(item.command)}
                >
                  <IconTerminal size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onRunInNew(item.command)}
                >
                  新窗口
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-block"
          onClick={() => void window.api.codex.openConfig()}
        >
          <IconExternal size={14} />
          打开 Codex 配置目录
        </button>
      </Section>
    </aside>
  )
}
