import { ipcMain } from 'electron'
import { applyCodexMode } from '../../shared/codex-modes'
import {
  PermissionSettings,
  RunCommandOptions,
  SessionCreateOptions,
} from '../../shared/types'
import type { IpcContext } from './types'
import { approvalClear } from '../approval-watch'

export function registerSessionIpc(ctx: IpcContext): void {
  ipcMain.handle('session:create', (_event, opts: SessionCreateOptions) =>
    ctx.pty().create(opts),
  )
  ipcMain.handle('session:list', () => ctx.pty().list())
  ipcMain.handle('session:meta', (_event, id: string) => ctx.pty().meta(id))
  ipcMain.handle('session:buffer', (_event, id: string) =>
    ctx.pty().buffer(id),
  )
  ipcMain.on('session:write', (_event, id: string, data: unknown) => {
    ctx.pty().write(id, String(data))
    if (approvalClear(id)) {
      const win = ctx.mainWindow()
      win?.webContents.send('terminal:approval', {
        sessionId: id,
        waiting: false,
      })
    }
  })
  ipcMain.on(
    'session:resize',
    (_event, id: string, cols: unknown, rows: unknown) => {
      ctx.pty().resize(id, Number(cols), Number(rows))
    },
  )
  ipcMain.handle('session:kill', async (_event, id: string) => {
    await ctx.pty().kill(id)
    return true
  })
  ipcMain.handle('session:title', async (_event, id: string, title: unknown) => {
    await ctx.pty().setTitle(id, String(title))
    return true
  })
  ipcMain.handle(
    'session:set-permissions',
    async (_event, id: string, permissions: PermissionSettings) => {
      await ctx.pty().setPermissions(id, permissions)
      return true
    },
  )
  ipcMain.handle('session:run-command', (_event, opts: RunCommandOptions) =>
    ctx.pty().runCommand({
      ...opts,
      command: applyCodexMode(
        opts.command,
        opts.permissions ?? ctx.settings().load().permissions,
      ),
    }),
  )
}
