import { ipcMain } from 'electron'
import type { IpcContext } from './types'

export function registerHistoryIpc(ctx: IpcContext): void {
  ipcMain.handle('history:clear', () => {
    ctx.history().clear()
    return true
  })
}
