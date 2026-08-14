import * as os from 'os'
import * as path from 'path'
import * as readline from 'readline'
import { RunCommandOptions, SessionCreateOptions } from '../shared/types'
import { PermissionSettings } from '../shared/types'
import { TerminalManager } from './terminal-manager'

interface Request {
  id: number | string
  method: string
  params?: Record<string, unknown>
}

const manager = new TerminalManager(
  path.join(os.tmpdir(), 'codex-control-panel-daemon'),
  {
    onData: (sessionId, data) => send({ event: 'data', sessionId, data }),
    onExit: (sessionId, exitCode) =>
      send({ event: 'exit', sessionId, exitCode }),
  },
  { persist: false },
)

function send(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

const lines = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})

lines.on('line', (line) => {
  let request: Request
  try {
    request = JSON.parse(line) as Request
  } catch {
    return
  }

  const { id, method, params = {} } = request
  try {
    let result: unknown = null
    switch (method) {
      case 'create':
        {
          const options = params as unknown as SessionCreateOptions
          result = manager.create({
            ...options,
            conversationId: options.conversationId,
          })
        }
        break
      case 'list':
        result = manager.list()
        break
      case 'meta':
        result = manager.getMeta(String(params.id))
        break
      case 'buffer':
        result = manager.getBuffer(String(params.id))
        break
      case 'write':
        manager.write(String(params.id), String(params.data))
        break
      case 'resize':
        manager.resize(
          String(params.id),
          Number(params.cols),
          Number(params.rows),
        )
        break
      case 'kill':
        manager.kill(String(params.id))
        break
      case 'setTitle':
        manager.setTitle(String(params.id), String(params.title))
        break
      case 'setPermissions':
        manager.setPermissions(
          String(params.id),
          params.permissions as PermissionSettings,
        )
        break
      case 'runCommand': {
        const options = params as unknown as RunCommandOptions
        result = manager.create({
          shell: options.shell,
          cwd: options.cwd,
          initialCommand: options.command,
          permissions: options.permissions,
          codexSession: options.codexSession,
          conversationId: options.conversationId,
        })
        break
      }
      case 'closeAll':
        manager.closeAll(params.interrupt !== false)
        break
      case 'ping':
        result = { pong: true, pid: process.pid }
        break
      case 'shutdown':
        manager.closeAll(false)
        process.exit(0)
        break
      default:
        throw new Error(`unknown method: ${method}`)
    }
    send({ id, ok: true, result: result ?? null })
  } catch (error) {
    send({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

process.stdin.on('close', () => {
  manager.closeAll(false)
  process.exit(0)
})

process.on('SIGTERM', () => {
  manager.closeAll(false)
  process.exit(0)
})
