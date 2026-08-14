import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as readline from 'readline'
import { CodexConversation } from '../shared/types'

interface RolloutMeta {
  sessionId: string
  cwd: string
  createdAt: number
  provider: string | null
}

function deriveTitle(text: string): string {
  let value = text
  const envIndex = value.indexOf('</environment_context>')
  if (envIndex >= 0) {
    value = value.slice(envIndex + '</environment_context>'.length)
  }
  value = value.replace(/\s+/g, ' ').trim()
  if (!value) return ''
  const firstLine = value.split('\n')[0]
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine
}

export class CodexSessionsStore {
  private readonly sessionsRoot: string
  private readonly indexFile: string
  private readonly overridesFile: string
  private readonly providerCache = new Map<string, string>()
  private readonly fileCache = new Map<string, string>()

  constructor(dataDir: string) {
    this.sessionsRoot = path.join(os.homedir(), '.codex', 'sessions')
    this.indexFile = path.join(os.homedir(), '.codex', 'session_index.jsonl')
    this.overridesFile = path.join(dataDir, 'codex-titles.json')
  }

  async list(): Promise<CodexConversation[]> {
    const files = this.collectRolloutFiles()
    const threadNames = this.readThreadNames()
    const overrides = this.readOverrides()
    const conversations: CodexConversation[] = []

    for (const file of files) {
      try {
        const stat = fs.statSync(file)
        const meta = await this.readMeta(file)
        if (!meta) continue
        if (meta.provider) {
          this.providerCache.set(meta.sessionId, meta.provider)
        }
        this.fileCache.set(meta.sessionId, file)
        const derived = await this.readDerivedTitle(file)
        const title =
          overrides[meta.sessionId] ??
          threadNames[meta.sessionId] ??
          derived ??
          meta.sessionId.slice(0, 8)
        conversations.push({
          id: meta.sessionId,
          title,
          cwd: meta.cwd,
          createdAt: meta.createdAt,
          lastActivity: stat.mtimeMs,
          sizeBytes: stat.size,
        })
      } catch {
        // skip unreadable rollout
      }
    }

    return conversations.sort((a, b) => b.lastActivity - a.lastActivity)
  }

  rename(id: string, title: string): boolean {
    const trimmed = title.trim()
    if (!trimmed || !id) return false

    const overrides = this.readOverrides()
    overrides[id] = trimmed
    const tmpOverrides = `${this.overridesFile}.tmp`
    fs.writeFileSync(tmpOverrides, JSON.stringify(overrides, null, 2), 'utf8')
    fs.renameSync(tmpOverrides, this.overridesFile)

    try {
      const lines = fs.existsSync(this.indexFile)
        ? fs
            .readFileSync(this.indexFile, 'utf8')
            .split(/\r?\n/)
            .filter((line) => line.trim())
        : []
      const record = JSON.stringify({
        id,
        thread_name: trimmed,
        updated_at: new Date().toISOString(),
      })
      const idx = lines.findIndex((line) => {
        try {
          return (JSON.parse(line) as { id?: string }).id === id
        } catch {
          return false
        }
      })
      if (idx >= 0) lines[idx] = record
      else lines.push(record)
      const tmpIndex = `${this.indexFile}.tmp`
      fs.writeFileSync(tmpIndex, `${lines.join('\n')}\n`, 'utf8')
      fs.renameSync(tmpIndex, this.indexFile)
    } catch {
      // index write is best-effort; local override already persisted
    }

    return true
  }

  async providerFor(id: string): Promise<string | null> {
    const cached = this.providerCache.get(id)
    if (cached) return cached
    const file = this.fileCache.get(id)
    if (!file) return null
    const meta = await this.readMeta(file)
    if (meta?.provider) this.providerCache.set(id, meta.provider)
    return meta?.provider ?? null
  }

  private collectRolloutFiles(): string[] {
    const result: string[] = []
    if (!fs.existsSync(this.sessionsRoot)) return result
    for (const year of fs.readdirSync(this.sessionsRoot)) {
      const yearDir = path.join(this.sessionsRoot, year)
      if (!this.isDirectory(yearDir)) continue
      for (const month of fs.readdirSync(yearDir)) {
        const monthDir = path.join(yearDir, month)
        if (!this.isDirectory(monthDir)) continue
        for (const day of fs.readdirSync(monthDir)) {
          const dayDir = path.join(monthDir, day)
          if (!this.isDirectory(dayDir)) continue
          for (const name of fs.readdirSync(dayDir)) {
            if (name.startsWith('rollout-') && name.endsWith('.jsonl')) {
              result.push(path.join(dayDir, name))
            }
          }
        }
      }
    }
    return result
  }

  private isDirectory(target: string): boolean {
    try {
      return fs.statSync(target).isDirectory()
    } catch {
      return false
    }
  }

  private readMeta(file: string): Promise<RolloutMeta | null> {
    return new Promise((resolve) => {
      let settled = false
      const stream = fs.createReadStream(file, { encoding: 'utf8' })
      const lines = readline.createInterface({ input: stream })
      lines.on('line', (line) => {
        if (settled) return
        settled = true
        lines.close()
        try {
          const record = JSON.parse(line) as {
            type?: string
            timestamp?: string
            payload?: {
              session_id?: string
              cwd?: string
              timestamp?: string
              model_provider?: string
            }
          }
          if (
            record.type === 'session_meta' &&
            record.payload?.session_id
          ) {
            const rawTime =
              record.payload.timestamp ?? record.timestamp ?? new Date().toISOString()
            resolve({
              sessionId: String(record.payload.session_id),
              cwd: String(record.payload.cwd ?? ''),
              createdAt: Date.parse(String(rawTime)) || Date.now(),
              provider: record.payload.model_provider
                ? String(record.payload.model_provider)
                : null,
            })
          } else {
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      })
      lines.on('close', () => {
        if (!settled) {
          settled = true
          resolve(null)
        }
      })
      lines.on('error', () => {
        if (!settled) {
          settled = true
          resolve(null)
        }
      })
    })
  }

  private readDerivedTitle(file: string): Promise<string | null> {
    return new Promise((resolve) => {
      let settled = false
      let scannedLines = 0
      const stream = fs.createReadStream(file, { encoding: 'utf8' })
      const lines = readline.createInterface({ input: stream })
      lines.on('line', (line) => {
        if (settled) return
        scannedLines += 1
        if (scannedLines > 300) {
          settled = true
          lines.close()
          resolve(null)
          return
        }
        try {
          const record = JSON.parse(line) as {
            type?: string
            payload?: {
              role?: string
              content?: Array<{ type?: string; text?: string }>
            }
          }
          if (record.type === 'response_item' && record.payload?.role === 'user') {
            for (const part of record.payload.content ?? []) {
              if (part.type === 'input_text' && typeof part.text === 'string') {
                const title = deriveTitle(part.text)
                if (title) {
                  settled = true
                  lines.close()
                  resolve(title)
                  return
                }
              }
            }
          }
        } catch {
          // keep scanning for the first user message
        }
      })
      lines.on('close', () => {
        if (!settled) {
          settled = true
          resolve(null)
        }
      })
      lines.on('error', () => {
        if (!settled) {
          settled = true
          resolve(null)
        }
      })
    })
  }

  private readThreadNames(): Record<string, string> {
    const map: Record<string, string> = {}
    try {
      if (fs.existsSync(this.indexFile)) {
        for (const line of fs
          .readFileSync(this.indexFile, 'utf8')
          .split(/\r?\n/)) {
          if (!line.trim()) continue
          try {
            const record = JSON.parse(line) as {
              id?: string
              thread_name?: string
            }
            if (record.id && record.thread_name) {
              map[record.id] = record.thread_name
            }
          } catch {
            // skip malformed line
          }
        }
      }
    } catch {
      // no index file
    }
    return map
  }

  private readOverrides(): Record<string, string> {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(this.overridesFile, 'utf8'),
      ) as Record<string, string>
      return typeof parsed === 'object' && parsed ? parsed : {}
    } catch {
      return {}
    }
  }
}
