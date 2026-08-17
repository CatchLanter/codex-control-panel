import { useEffect, useMemo, useState } from 'react'
import { CodexConversation } from '../../../shared/types'
import { dayLabel, formatBytes, formatTime } from '../utils'
import {
  IconEdit,
  IconEye,
  IconEyeOff,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconTrash,
} from './Icons'
import { IconButton } from './ui'

interface ConversationGroup {
  label: string
  entries: CodexConversation[]
}

interface MenuState {
  x: number
  y: number
  id: string
}

export function Sidebar({
  conversations,
  onRefreshConversations,
  onResumeConversation,
  onRenameConversation,
  onDeleteConversation,
  onHideConversation,
  onUnhideConversation,
}: {
  conversations: CodexConversation[]
  onRefreshConversations: () => void
  onResumeConversation: (conversation: CodexConversation) => void
  onRenameConversation: (id: string, title: string) => void
  onDeleteConversation: (conversation: CodexConversation) => void
  onHideConversation: (id: string) => void
  onUnhideConversation: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  const visibleConversations = useMemo(
    () =>
      showHidden
        ? conversations
        : conversations.filter((conversation) => !conversation.hidden),
    [conversations, showHidden],
  )

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return visibleConversations
    return visibleConversations.filter((conversation) =>
      [conversation.title, conversation.cwd, conversation.id].some((field) =>
        field.toLowerCase().includes(q),
      ),
    )
  }, [visibleConversations, query])

  const groups = useMemo<ConversationGroup[]>(() => {
    const map = new Map<string, CodexConversation[]>()
    for (const conversation of filteredConversations) {
      const label = dayLabel(conversation.lastActivity)
      const list = map.get(label) ?? []
      list.push(conversation)
      map.set(label, list)
    }
    return [...map.entries()].map(([label, entries]) => ({ label, entries }))
  }, [filteredConversations])

  const commitRename = (id: string) => {
    const title = renameDraft.trim()
    if (title) onRenameConversation(id, title)
    setRenamingId(null)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <IconSparkles size={14} />
          对话
        </div>
        <IconButton
          title="刷新对话列表"
          aria-label="刷新对话列表"
          onClick={onRefreshConversations}
        >
          <IconRefresh size={14} />
        </IconButton>
      </div>
      <div className="sidebar-search">
        <IconSearch size={14} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索对话名称、目录"
        />
      </div>
      <div className="sidebar-list">
        {groups.length === 0 && (
          <div className="sidebar-empty">
            {query
              ? '没有匹配的对话'
              : '还没有 Codex 对话\n在终端里运行 codex 开始新的对话'}
          </div>
        )}
        {groups.map((group) => (
          <div key={group.label} className="history-group">
            <div className="history-group-label">{group.label}</div>
            {group.entries.map((conversation) => (
              <div
                key={conversation.id}
                className={`history-item ${
                  conversation.hidden ? 'history-item-hidden' : ''
                }`}
                title="点击进入对话，右键更多操作"
                onClick={() => onResumeConversation(conversation)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setMenu({
                    x: event.clientX,
                    y: event.clientY,
                    id: conversation.id,
                  })
                }}
              >
                <div className="history-item-main">
                  {renamingId === conversation.id ? (
                    <input
                      className="tab-rename-input"
                      autoFocus
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onBlur={() => commitRename(conversation.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitRename(conversation.id)
                        } else if (event.key === 'Escape') {
                          setRenamingId(null)
                        }
                      }}
                    />
                  ) : (
                    <div className="history-item-title">
                      <span className="conversation-dot" />
                      {conversation.title}
                      {conversation.hidden && (
                        <span className="hidden-badge">已隐藏</span>
                      )}
                    </div>
                  )}
                  <div className="history-item-cwd" title={conversation.cwd}>
                    {conversation.cwd}
                  </div>
                  <div className="history-item-meta">
                    {formatTime(conversation.lastActivity)} ·{' '}
                    {formatBytes(conversation.sizeBytes)}
                  </div>
                </div>
                <div className="item-actions">
                  <IconButton
                    className="history-item-restore"
                    title="重命名对话"
                    aria-label="重命名对话"
                    onClick={(event) => {
                      event.stopPropagation()
                      setRenamingId(conversation.id)
                      setRenameDraft(conversation.title)
                    }}
                  >
                    <IconEdit size={14} />
                  </IconButton>
                  <IconButton
                    className="history-item-restore icon-btn-danger"
                    title="删除对话"
                    aria-label="删除对话"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDeleteConversation(conversation)
                    }}
                  >
                    <IconTrash size={14} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <IconButton
          className="sidebar-hidden-toggle"
          title={showHidden ? '收起隐藏的对话' : '查看隐藏的对话'}
          aria-label="隐藏的对话"
          onClick={() => setShowHidden((value) => !value)}
        >
          {showHidden ? <IconEyeOff size={14} /> : <IconEye size={14} />}
        </IconButton>
      </div>
      {menu && (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const conversation = conversations.find(
                (item) => item.id === menu.id,
              )
              if (conversation) onResumeConversation(conversation)
              setMenu(null)
            }}
          >
            进入对话
          </button>
          <button
            type="button"
            onClick={() => {
              setRenamingId(menu.id)
              const conversation = conversations.find(
                (item) => item.id === menu.id,
              )
              if (conversation) setRenameDraft(conversation.title)
              setMenu(null)
            }}
          >
            重命名
          </button>
          {conversations.find((item) => item.id === menu.id)?.hidden ? (
            <button
              type="button"
              onClick={() => {
                onUnhideConversation(menu.id)
                setMenu(null)
              }}
            >
              取消隐藏
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onHideConversation(menu.id)
                setMenu(null)
              }}
            >
              隐藏对话
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
