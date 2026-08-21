import { useEffect, useRef, useState } from 'react'
import {
  AppSettings,
  CodexConversation,
  SessionMeta,
  ShellKind,
} from '../../../shared/types'
import { PERMISSION_MODE_LABELS } from '../../../shared/codex-modes'
import {
  IconChevronDown,
  IconClose,
  IconColumns,
  IconGrid,
  IconPlus,
  IconSparkles,
  IconTerminal,
} from './Icons'
import { IconButton } from './ui'
import { TerminalPane } from './TerminalPane'

const SHELL_OPTIONS: { value: ShellKind; label: string }[] = [
  { value: 'cmd', label: 'CMD' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'pwsh', label: 'PowerShell 7' },
  { value: 'wsl', label: 'WSL' },
]

export function TerminalsView({
  sessions,
  conversations,
  activeId,
  settings,
  theme,
  onActivate,
  onClose,
  onCreate,
  onCreateCodex,
  onRename,
  onSettingsChange,
}: {
  sessions: SessionMeta[]
  conversations: CodexConversation[]
  activeId: string | null
  settings: AppSettings
  theme: 'dark' | 'light'
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onCreate: (shell: ShellKind) => void
  onCreateCodex: () => void
  onRename: (id: string, title: string) => void
  onSettingsChange: (patch: Partial<AppSettings>) => void
}) {
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const newMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!newMenuOpen) return
    const close = (event: MouseEvent) => {
      if (!newMenuRef.current?.contains(event.target as Node)) {
        setNewMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [newMenuOpen])

  const columns = settings.layout === 'grid' ? settings.gridColumns : 1
  const gridStyle = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  }
  const activeSession =
    sessions.find((session) => session.id === activeId) ?? null
  const activeConversation = activeSession?.conversationId
    ? conversations.find(
        (conversation) => conversation.id === activeSession.conversationId,
      )
    : undefined

  return (
    <div className="terminals">
      {activeSession?.codexSession && (
        <div className="conversation-bar">
          <IconSparkles size={13} />
          <span className="conversation-bar-name">
            {activeConversation?.title ?? '新对话'}
          </span>
        </div>
      )}
      <div className="tabs-bar">
        <div className="tabs">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`tab ${session.id === activeId ? 'active' : ''}`}
              onClick={() => onActivate(session.id)}
              onDoubleClick={() => {
                setRenamingId(session.id)
                setRenameDraft(session.title)
              }}
            >
              <span className={`tab-dot status-${session.status}`} />
              <span
                className={`permission-dot mode-${session.permissions.mode}`}
                title={`权限：${PERMISSION_MODE_LABELS[session.permissions.mode]}`}
              />
              {renamingId === session.id ? (
                <input
                  className="tab-rename-input"
                  autoFocus
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={() => {
                    onRename(session.id, renameDraft.trim())
                    setRenamingId(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      onRename(session.id, renameDraft.trim())
                      setRenamingId(null)
                    } else if (event.key === 'Escape') {
                      setRenamingId(null)
                    }
                  }}
                />
              ) : (
                <span className="tab-title">{session.title}</span>
              )}
              <button
                type="button"
                className="tab-close"
                title="关闭"
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(session.id)
                }}
              >
                <IconClose size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="tabs-actions" ref={newMenuRef}>
          <div className="new-menu-wrap">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (settings.autoStartCodex) {
                  onCreateCodex()
                } else {
                  setNewMenuOpen((v) => !v)
                }
              }}
            >
              <IconPlus size={14} />
              新建 Codex
              <IconChevronDown size={12} />
            </button>
            {newMenuOpen && (
              <div className="new-menu">
                <button
                  type="button"
                  onClick={() => {
                    onCreateCodex()
                    setNewMenuOpen(false)
                  }}
                >
                  Codex（自动）
                </button>
                {SHELL_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => {
                      onCreate(option.value)
                      setNewMenuOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <IconButton
            title={
              settings.layout === 'tabs'
                ? '切换为网格布局'
                : '切换为标签布局'
            }
            aria-label="切换布局"
            onClick={() =>
              onSettingsChange({
                layout: settings.layout === 'tabs' ? 'grid' : 'tabs',
              })
            }
          >
            {settings.layout === 'tabs' ? <IconGrid /> : <IconColumns />}
          </IconButton>
          {settings.layout === 'grid' && (
            <select
              className="select grid-select"
              value={settings.gridColumns}
              onChange={(event) =>
                onSettingsChange({ gridColumns: Number(event.target.value) })
              }
              title="网格列数"
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} 列
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {sessions.length > 0 && (
        <div className="panes" style={gridStyle}>
          {sessions.map((session) => {
            const isVisible =
              settings.layout === 'grid' || session.id === activeId
            return (
              <div
                key={session.id}
                className="pane"
                style={{ display: isVisible ? 'flex' : 'none' }}
              >
                <TerminalPane
                  meta={session}
                  visible={isVisible}
                  theme={theme}
                  fontSize={settings.terminalFontSize}
                />
              </div>
            )
          })}
        </div>
      )}
      {sessions.length === 0 && (
        <div className="empty-state">
          <IconTerminal size={36} />
          <div className="empty-title">还没有终端窗口</div>
          <div className="empty-sub">新建一个 CMD 窗口开始工作</div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onCreateCodex}
          >
            <IconPlus size={14} />
            新建 Codex 窗口
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onCreate(settings.defaultShell)}
          >
            新建空终端
          </button>
        </div>
      )}
    </div>
  )
}
