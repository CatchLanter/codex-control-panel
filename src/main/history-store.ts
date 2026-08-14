import * as fs from 'fs'
import * as path from 'path'
import { HistoryEntry, HistoryReplay } from '../shared/types'

export class HistoryStore {
  private readonly dir: string
  private index: HistoryEntry[] | null = null

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, 'history')
    fs.mkdirSync(this.dir, { recursive: true })
  }

  upsert(entry: HistoryEntry): void {
    const entries = this.loadIndex()
    const idx = entries.findIndex((e) => e.id === entry.id)
    if (idx >= 0) entries[idx] = entry
    else entries.push(entry)
    this.persist()
  }

  list(query?: string): HistoryEntry[] {
    const q = query?.trim().toLowerCase()
    let entries = [...this.loadIndex()].sort((a, b) => b.createdAt - a.createdAt)
    if (q) {
      entries = entries.filter((e) =>
        [e.title, e.cwd, e.shell].some((field) =>
          field.toLowerCase().includes(q),
        ),
      )
    }
    return entries
  }

  replay(id: string): HistoryReplay | null {
    const entry = this.loadIndex().find((e) => e.id === id)
    if (!entry) return null
    let transcript = ''
    try {
      const raw = fs.readFileSync(this.fileFor(id), 'utf8')
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue
        try {
          const record = JSON.parse(line) as { d?: string }
          if (record.d) {
            transcript += Buffer.from(record.d, 'base64').toString('utf8')
          }
        } catch {
          // skip malformed record
        }
      }
    } catch {
      // transcript file may be missing
    }
    return { entry, transcript }
  }

  search(query: string, limit = 60): HistoryEntry[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const results: HistoryEntry[] = []
    const sorted = [...this.loadIndex()].sort(
      (a, b) => b.createdAt - a.createdAt,
    )
    for (const entry of sorted) {
      if (results.length >= limit) break
      try {
        const raw = fs.readFileSync(this.fileFor(entry.id), 'utf8')
        if (raw.toLowerCase().includes(q)) results.push(entry)
      } catch {
        // ignore unreadable transcript
      }
    }
    return results
  }

  remove(id: string): void {
    const entries = this.loadIndex()
    this.index = entries.filter((e) => e.id !== id)
    this.persist()
    try {
      fs.rmSync(this.fileFor(id), { force: true })
    } catch {
      // already gone
    }
  }

  clear(): void {
    this.index = []
    this.persist()
    for (const name of fs.readdirSync(this.dir)) {
      if (name.endsWith('.ndjson')) {
        try {
          fs.rmSync(path.join(this.dir, name), { force: true })
        } catch {
          // ignore
        }
      }
    }
  }

  pruneOlderThan(days: number): void {
    if (!days || days <= 0) return
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const stale = this.loadIndex().filter(
      (e) => e.endedAt != null && e.endedAt < cutoff,
    )
    for (const entry of stale) this.remove(entry.id)
  }

  private indexPath(): string {
    return path.join(this.dir, 'index.json')
  }

  private fileFor(id: string): string {
    return path.join(this.dir, `${id}.ndjson`)
  }

  private loadIndex(): HistoryEntry[] {
    if (this.index) return this.index
    try {
      const raw = fs.readFileSync(this.indexPath(), 'utf8')
      const parsed = JSON.parse(raw)
      this.index = Array.isArray(parsed) ? (parsed as HistoryEntry[]) : []
    } catch {
      this.index = []
    }
    return this.index
  }

  private persist(): void {
    const tmp = `${this.indexPath()}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.index ?? [], null, 2), 'utf8')
    fs.renameSync(tmp, this.indexPath())
  }
}
