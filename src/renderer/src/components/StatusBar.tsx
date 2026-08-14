import { CodexInfo, SessionMeta } from '../../../shared/types'
import { shellLabel } from '../utils'

export function StatusBar({
  activeSession,
  runningCount,
  codex,
  conversationsCount,
  permissionLabel,
}: {
  activeSession: SessionMeta | null
  runningCount: number
  codex: CodexInfo | null
  conversationsCount: number
  permissionLabel: string
}) {
  return (
    <footer className="statusbar">
      <span className="status-item">
        <span
          className={`status-dot ${runningCount > 0 ? 'running' : ''}`}
        />
        {runningCount > 0 ? `${runningCount} 个会话运行中` : '就绪'}
      </span>
      {activeSession && (
        <>
          <span className="status-sep" />
          <span className="status-item status-cwd" title={activeSession.cwd}>
            {shellLabel(activeSession.shell)} · {activeSession.cwd}
          </span>
        </>
      )}
      <span className="status-spacer" />
      {codex?.installed && (
        <span className="status-item" title={codex.path ?? undefined}>
          Codex {codex.version ?? ''}
          {codex.model ? ` · ${codex.model}` : ''}
        </span>
      )}
      <span className="status-sep" />
      <span className="status-item">{conversationsCount} 个 Codex 对话</span>
      <span className="status-sep" />
      <span className="status-item">权限 · {permissionLabel}</span>
    </footer>
  )
}
