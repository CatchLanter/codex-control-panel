import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { AppSettings, QuickCommand } from '../shared/types'
import { DEFAULT_SHORTCUTS } from '../shared/shortcuts'

export const DEFAULT_QUICK_COMMANDS: QuickCommand[] = [
  { id: 'codex', label: 'codex', command: 'codex' },
  { id: 'codex-resume', label: 'codex resume --last', command: 'codex resume --last' },
  { id: 'codex-doctor', label: 'codex doctor', command: 'codex doctor' },
  { id: 'codex-mcp', label: 'codex mcp list', command: 'codex mcp list' },
  { id: 'codex-update', label: 'codex update', command: 'codex update' },
  { id: 'codex-login', label: 'codex login', command: 'codex login' },
]

const DEFAULT_SETTINGS: AppSettings = {
  defaultShell: 'cmd',
  defaultCwd: os.homedir(),
  layout: 'tabs',
  gridColumns: 2,
  sidebarVisible: true,
  rightPanelVisible: true,
  theme: 'dark',
  terminalFontSize: 13,
  autoStartCodex: true,
  historyRetentionDays: 30,
  quickCommands: DEFAULT_QUICK_COMMANDS,
  permissions: {
    mode: 'default',
    customApproval: 'on-request',
    customSandbox: 'workspace-write',
    customBypass: false,
  },
  shortcuts: { ...DEFAULT_SHORTCUTS },
}

export class SettingsStore {
  private readonly file: string
  private cache: AppSettings | null = null

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'settings.json')
  }

  load(): AppSettings {
    if (this.cache) return this.cache
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      this.cache = { ...DEFAULT_SETTINGS, ...raw }
    } catch {
      this.cache = { ...DEFAULT_SETTINGS }
    }
    return this.cache as AppSettings
  }

  save(patch: Partial<AppSettings>): AppSettings {
    const next = { ...this.load(), ...patch }
    this.cache = next
    fs.writeFileSync(this.file, JSON.stringify(next, null, 2), 'utf8')
    return next
  }
}
