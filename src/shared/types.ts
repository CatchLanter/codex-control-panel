export type ShellKind = 'cmd' | 'powershell' | 'pwsh' | 'wsl'

export type SessionStatus = 'running' | 'exited' | 'killed' | 'interrupted'

export type PermissionMode =
  | 'default'
  | 'plan'
  | 'auto'
  | 'auto-unsafe'
  | 'custom'

export type ApprovalPolicy = 'untrusted' | 'on-request' | 'never'

export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

export interface PermissionSettings {
  mode: PermissionMode
  customApproval: ApprovalPolicy
  customSandbox: SandboxMode
  customBypass: boolean
}

export interface SessionMeta {
  id: string
  title: string
  shell: ShellKind
  cwd: string
  cols: number
  rows: number
  createdAt: number
  endedAt: number | null
  exitCode: number | null
  status: SessionStatus
  sizeBytes: number
  pid: number | null
  permissions: PermissionSettings
  codexSession: boolean
  conversationId: string | null
}

export interface SessionCreateOptions {
  shell: ShellKind
  cwd?: string
  title?: string
  cols?: number
  rows?: number
  initialCommand?: string
  permissions?: PermissionSettings
  codexSession?: boolean
  conversationId?: string
}

export interface RunCommandOptions {
  shell: ShellKind
  cwd?: string
  command: string
  permissions?: PermissionSettings
  codexSession?: boolean
  conversationId?: string
}

export interface HistoryEntry {
  id: string
  title: string
  shell: ShellKind
  cwd: string
  createdAt: number
  endedAt: number | null
  exitCode: number | null
  status: SessionStatus
  sizeBytes: number
}

export interface HistoryReplay {
  entry: HistoryEntry
  transcript: string
}

export interface QuickCommand {
  id: string
  label: string
  command: string
}

export type ShortcutActionId =
  | 'commandPalette'
  | 'newTerminal'
  | 'closeTerminal'
  | 'nextTab'
  | 'prevTab'
  | 'toggleSidebar'
  | 'openSettings'

export type ShortcutBindings = Record<ShortcutActionId, string>

export interface AppSettings {
  defaultShell: ShellKind
  defaultCwd: string
  layout: 'tabs' | 'grid'
  gridColumns: number
  sidebarVisible: boolean
  rightPanelVisible: boolean
  theme: 'dark' | 'light'
  terminalFontSize: number
  autoStartCodex: boolean
  historyRetentionDays: number
  quickCommands: QuickCommand[]
  permissions: PermissionSettings
  shortcuts: ShortcutBindings
}

export interface CodexInfo {
  installed: boolean
  path: string | null
  version: string | null
  model: string | null
  configPath: string | null
}

export interface CodexApiProvider {
  name: string
  baseUrl: string
  wireApi: string
  hasKey: boolean
}

export interface CodexConfig {
  provider: string | null
  model: string | null
  reasoningEffort: string | null
  providers: CodexApiProvider[]
  models: string[]
  configPath: string | null
}

export interface CodexConfigPatch {
  provider?: string
  model?: string
  reasoningEffort?: string
}

export interface AddApiProviderOptions {
  name: string
  baseUrl: string
  wireApi?: string
  bearerToken?: string
}

export interface CodexConversation {
  id: string
  title: string
  cwd: string
  createdAt: number
  lastActivity: number
  sizeBytes: number
}

export interface ResumeConversationOptions {
  id: string
  shell: ShellKind
  cwd?: string
}

export interface DeleteConversationResult {
  ok: boolean
  output: string
}

export interface RestartConversationOptions {
  conversationId: string | null
  permissions: PermissionSettings
}

export interface RestartConversationResult {
  command: string
}

export interface TerminalDataPayload {
  sessionId: string
  data: string
}

export interface TerminalExitPayload {
  sessionId: string
  exitCode: number
}

export interface CodexPanelApi {
  sessions: {
    create: (opts: SessionCreateOptions) => Promise<SessionMeta>
    list: () => Promise<SessionMeta[]>
    meta: (id: string) => Promise<SessionMeta | null>
    buffer: (id: string) => Promise<string>
    write: (id: string, data: string) => void
    resize: (id: string, cols: number, rows: number) => void
    kill: (id: string) => Promise<boolean>
    setTitle: (id: string, title: string) => Promise<boolean>
    setPermissions: (
      id: string,
      permissions: PermissionSettings,
    ) => Promise<boolean>
    runCommand: (opts: RunCommandOptions) => Promise<SessionMeta>
  }
  history: {
    clear: () => Promise<boolean>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (patch: Partial<AppSettings>) => Promise<AppSettings>
  }
  codex: {
    info: () => Promise<CodexInfo>
    openConfig: () => Promise<boolean>
    conversations: () => Promise<CodexConversation[]>
    renameConversation: (id: string, title: string) => Promise<boolean>
    resumeConversation: (
      opts: ResumeConversationOptions,
    ) => Promise<SessionMeta>
    deleteConversation: (id: string) => Promise<DeleteConversationResult>
    restartConversation: (
      opts: RestartConversationOptions,
    ) => Promise<RestartConversationResult>
    config: () => Promise<CodexConfig>
    setConfig: (patch: CodexConfigPatch) => Promise<CodexConfig>
    addProvider: (opts: AddApiProviderOptions) => Promise<CodexConfig>
  }
  dialog: {
    pickDirectory: () => Promise<string | null>
  }
  app: {
    openPath: (path: string) => Promise<string>
    getPathForFile: (file: unknown) => string
    quit: () => Promise<void>
  }
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximizedChange: (cb: (maximized: boolean) => void) => () => void
  }
  onData: (cb: (payload: TerminalDataPayload) => void) => () => void
  onExit: (cb: (payload: TerminalExitPayload) => void) => () => void
}
