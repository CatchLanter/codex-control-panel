import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawn, IPty } from '@homebridge/node-pty-prebuilt-multiarch'
import { defaultPermissions } from '../shared/codex-modes'
import {
  PermissionSettings,
  SessionCreateOptions,
  SessionMeta,
  ShellKind,
} from '../shared/types'

export interface TerminalEvents {
  onData: (id: string, data: string) => void
  onExit: (id: string, exitCode: number) => void
}

interface Session {
  id: string
  meta: SessionMeta
  pty: IPty
  chunks: string[]
  bufferSize: number
  stream: fs.WriteStream | null
  ended: boolean
  killedByUser: boolean
}

const MAX_BUFFER_BYTES = 2 * 1024 * 1024

const SHELL_LABELS: Record<ShellKind, string> = {
  cmd: 'cmd',
  powershell: 'PowerShell',
  pwsh: 'PowerShell 7',
  wsl: 'WSL',
}

function shellExecutable(shell: ShellKind): { file: string; args: string[] } {
  switch (shell) {
    case 'powershell':
      return { file: 'powershell.exe', args: ['-NoLogo'] }
    case 'pwsh':
      return { file: 'pwsh.exe', args: ['-NoLogo'] }
    case 'wsl':
      return { file: 'wsl.exe', args: [] }
    default:
      return { file: 'cmd.exe', args: [] }
  }
}

function resolveCwd(cwd?: string): string {
  const candidate = cwd && cwd.trim() ? cwd.trim() : os.homedir()
  try {
    if (fs.statSync(candidate).isDirectory()) return candidate
  } catch {
    // fall through to home directory
  }
  return os.homedir()
}

export class TerminalManager {
  private readonly sessions = new Map<string, Session>()
  private readonly historyDir: string
  private readonly persist: boolean

  constructor(
    private readonly dataDir: string,
    private readonly events: TerminalEvents,
    options: { persist?: boolean } = {},
  ) {
    this.persist = options.persist ?? true
    this.historyDir = this.persist
      ? path.join(dataDir, 'history')
      : path.join(os.tmpdir(), 'codex-control-panel-daemon')
    if (this.persist) {
      fs.mkdirSync(this.historyDir, { recursive: true })
    }
  }

  create(opts: SessionCreateOptions): SessionMeta {
    const id = randomUUID()
    const cols = opts.cols && opts.cols > 0 ? opts.cols : 100
    const rows = opts.rows && opts.rows > 0 ? opts.rows : 30
    const cwd = resolveCwd(opts.cwd)
    const { file, args } = shellExecutable(opts.shell)
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    }

    const pty = spawn(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env,
      useConptyDll: true,
    })

    const meta: SessionMeta = {
      id,
      title:
        opts.title && opts.title.trim()
          ? opts.title.trim()
          : `${SHELL_LABELS[opts.shell]} ${this.sessions.size + 1}`,
      shell: opts.shell,
      cwd,
      cols,
      rows,
      createdAt: Date.now(),
      endedAt: null,
      exitCode: null,
      status: 'running',
      sizeBytes: 0,
      pid: pty.pid,
      permissions: opts.permissions
        ? { ...opts.permissions }
        : defaultPermissions(),
      codexSession: opts.codexSession ?? false,
      conversationId: opts.conversationId ?? null,
    }

    const session: Session = {
      id,
      meta,
      pty,
      chunks: [],
      bufferSize: 0,
      stream: this.persist
        ? fs.createWriteStream(path.join(this.historyDir, `${id}.ndjson`), {
            flags: 'a',
          })
        : null,
      ended: false,
      killedByUser: false,
    }

    this.sessions.set(id, session)

    pty.onData((data) => this.handleData(session, data))
    pty.onExit(({ exitCode }) => this.handleExit(session, exitCode))

    if (opts.initialCommand && opts.initialCommand.trim()) {
      const command = opts.initialCommand.trim()
      setTimeout(() => {
        if (!session.ended) session.pty.write(`${command}\r`)
      }, 120)
    }

    return { ...meta }
  }

  list(): SessionMeta[] {
    return [...this.sessions.values()].map((s) => ({ ...s.meta }))
  }

  getMeta(id: string): SessionMeta | null {
    const session = this.sessions.get(id)
    return session ? { ...session.meta } : null
  }

  getBuffer(id: string): string {
    return this.sessions.get(id)?.chunks.join('') ?? ''
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (session && !session.ended) session.pty.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (session && !session.ended && cols > 0 && rows > 0) {
      try {
        session.pty.resize(cols, rows)
        session.meta.cols = cols
        session.meta.rows = rows
      } catch {
        // resize can fail while the child is exiting
      }
    }
  }

  kill(id: string): void {
    const session = this.sessions.get(id)
    if (session && !session.ended) {
      session.killedByUser = true
      try {
        session.pty.kill()
      } catch {
        // process may already be gone
      }
    }
  }

  setTitle(id: string, title: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.meta.title = title.trim() || session.meta.title
    }
  }

  setPermissions(id: string, permissions: PermissionSettings): void {
    const session = this.sessions.get(id)
    if (session) {
      session.meta.permissions = { ...permissions }
    }
  }

  closeAll(interrupt = true): void {
    for (const session of this.sessions.values()) {
      if (session.ended) continue
      session.ended = true
      session.meta.endedAt = Date.now()
      session.meta.status = interrupt ? 'interrupted' : 'killed'
      session.meta.pid = null
      try {
        session.pty.kill()
      } catch {
        // process may already be gone
      }
      session.stream?.end()
      session.stream = null
    }
  }

  private handleData(session: Session, data: string): void {
    const bytes = Buffer.byteLength(data, 'utf8')
    session.chunks.push(data)
    session.bufferSize += bytes
    while (session.bufferSize > MAX_BUFFER_BYTES && session.chunks.length > 1) {
      const removed = session.chunks.shift() as string
      session.bufferSize -= Buffer.byteLength(removed, 'utf8')
    }
    session.meta.sizeBytes += bytes
    if (session.stream) {
      session.stream.write(
        `${JSON.stringify({
          t: Date.now(),
          d: Buffer.from(data, 'utf8').toString('base64'),
        })}\n`,
      )
    }
    this.events.onData(session.id, data)
  }

  private handleExit(session: Session, exitCode: number): void {
    if (session.ended) return
    session.ended = true
    session.meta.endedAt = Date.now()
    session.meta.exitCode = exitCode
    session.meta.status = session.killedByUser ? 'killed' : 'exited'
    session.meta.pid = null
    session.stream?.end()
    session.stream = null
    this.events.onExit(session.id, exitCode)
  }
}
