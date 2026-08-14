import { randomUUID } from 'crypto'
import { ChildProcess, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {
  PermissionSettings,
  RunCommandOptions,
  SessionCreateOptions,
  SessionMeta,
} from '../shared/types'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

export type PtyEvent = (event: string, payload: Record<string, unknown>) => void

export class PtyClient {
  private child: ChildProcess | null = null
  private pending = new Map<string, PendingRequest>()
  private lineBuffer = ''
  private stopped = false

  constructor(private readonly onEvent: PtyEvent) {}

  async start(): Promise<void> {
    if (this.child) return
    let daemonPath = path.join(__dirname, 'pty-daemon.js')
    const asarMarker = `${path.sep}app.asar${path.sep}`
    if (daemonPath.includes(asarMarker)) {
      daemonPath = daemonPath.replace(
        asarMarker,
        `${path.sep}app.asar.unpacked${path.sep}`,
      )
    }
    const nodeExecutable = await this.findNodeExecutable()
    if (process.env.CCP_DEBUG) {
      console.error(`[pty-client] spawning ${nodeExecutable} ${daemonPath}`)
    }
    this.stopped = false
    this.child = spawn(nodeExecutable, [daemonPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
      windowsHide: true,
    })
    this.child.stdout?.setEncoding('utf8')
    this.child.stdout?.on('data', (chunk: string) => this.handleStdout(chunk))
    this.child.on('error', (error) => {
      this.rejectAll(error)
      this.child = null
    })
    this.child.on('exit', (code) => {
      if (process.env.CCP_DEBUG) {
        console.error(`[pty-client] daemon exited with code ${code}`)
      }
      if (this.stopped) return
      this.rejectAll(new Error(`终端守护进程意外退出（exit ${code}）`))
      this.child = null
    })
    if (process.env.CCP_DEBUG) console.error('[pty-client] sending ping')
    await this.request('ping', {})
  }

  create(options: SessionCreateOptions): Promise<SessionMeta> {
    return this.request('create', options) as Promise<SessionMeta>
  }

  list(): Promise<SessionMeta[]> {
    return this.request('list', {}) as Promise<SessionMeta[]>
  }

  meta(id: string): Promise<SessionMeta | null> {
    return this.request('meta', { id }) as Promise<SessionMeta | null>
  }

  buffer(id: string): Promise<string> {
    return this.request('buffer', { id }) as Promise<string>
  }

  write(id: string, data: string): void {
    this.send({ method: 'write', params: { id, data } })
  }

  resize(id: string, cols: number, rows: number): void {
    this.send({ method: 'resize', params: { id, cols, rows } })
  }

  kill(id: string): Promise<void> {
    return this.request('kill', { id }) as Promise<void>
  }

  setTitle(id: string, title: string): Promise<void> {
    return this.request('setTitle', { id, title }) as Promise<void>
  }

  setPermissions(
    id: string,
    permissions: PermissionSettings,
  ): Promise<void> {
    return this.request('setPermissions', { id, permissions }) as Promise<void>
  }

  runCommand(options: RunCommandOptions): Promise<SessionMeta> {
    return this.request('runCommand', options) as Promise<SessionMeta>
  }

  async interruptAndList(): Promise<SessionMeta[]> {
    try {
      await this.request('closeAll', { interrupt: true })
    } catch {
      // daemon may already be down
    }
    try {
      return (await this.request('list', {})) as SessionMeta[]
    } catch {
      return []
    }
  }

  shutdown(): void {
    this.stopped = true
    this.send({ method: 'shutdown' })
    const child = this.child
    if (child) {
      setTimeout(() => {
        if (child.exitCode == null) child.kill()
      }, 500)
    }
  }

  private async findNodeExecutable(): Promise<string> {
    const candidates = [
      process.env.CODEX_PANEL_NODE,
      process.resourcesPath
        ? path.join(process.resourcesPath, 'node', 'node.exe')
        : null,
      'node',
    ].filter((value): value is string => Boolean(value))
    for (const candidate of candidates) {
      if (candidate !== 'node') {
        if (fs.existsSync(candidate)) return candidate
      } else {
        return candidate
      }
    }
    return 'node'
  }

  private request(method: string, params?: unknown): Promise<unknown> {
    if (this.stopped) return Promise.reject(new Error('应用正在退出'))
    const id = randomUUID()
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`终端守护进程响应超时：${method}`))
      }, 15000)
      this.pending.set(id, { resolve, reject, timer })
      this.send({ id, method, params })
    })
  }

  private send(message: Record<string, unknown>): void {
    if (process.env.CCP_DEBUG) {
      console.error(`[pty-client] send ${JSON.stringify(message)}`)
    }
    if (this.child?.stdin?.writable) {
      this.child.stdin.write(`${JSON.stringify(message)}\n`)
    }
  }

  private handleStdout(chunk: string): void {
    if (process.env.CCP_DEBUG) {
      console.error(`[pty-client] recv ${JSON.stringify(chunk)}`)
    }
    this.lineBuffer += chunk
    let index: number
    while ((index = this.lineBuffer.indexOf('\n')) >= 0) {
      const line = this.lineBuffer.slice(0, index).trim()
      this.lineBuffer = this.lineBuffer.slice(index + 1)
      if (!line) continue
      let message: Record<string, unknown>
      try {
        message = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }
      if (message.id != null) {
        const pending = this.pending.get(String(message.id))
        if (!pending) continue
        this.pending.delete(String(message.id))
        clearTimeout(pending.timer)
        if (message.ok === false) {
          pending.reject(new Error(String(message.error ?? 'daemon error')))
        } else {
          pending.resolve(message.result ?? null)
        }
      } else if (typeof message.event === 'string') {
        this.onEvent(message.event, message as Record<string, unknown>)
      }
    }
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
      this.pending.delete(id)
    }
  }
}
