import type { BrowserWindow } from 'electron'
import type { CodexSessionsStore } from '../codex-sessions'
import type { HistoryStore } from '../history-store'
import type { PtyClient } from '../pty-client'
import type { SettingsStore } from '../settings'

export interface IpcContext {
  mainWindow: () => BrowserWindow | null
  pty: () => PtyClient
  history: () => HistoryStore
  settings: () => SettingsStore
  codexSessions: () => CodexSessionsStore
}
