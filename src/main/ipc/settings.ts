import { ipcMain } from 'electron'
import { AppSettings } from '../../shared/types'
import type { IpcContext } from './types'

export function registerSettingsIpc(ctx: IpcContext): void {
  ipcMain.handle('settings:get', () => ctx.settings().load())
  ipcMain.handle(
    'settings:set',
    (_event, patch: Partial<AppSettings>) => ctx.settings().save(patch),
  )
}
