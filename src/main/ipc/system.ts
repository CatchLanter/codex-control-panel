import { app, dialog, ipcMain, shell } from 'electron'
import type { IpcContext } from './types'

export function registerSystemIpc(ctx: IpcContext): void {
  ipcMain.handle('dialog:pick-directory', async () => {
    const win = ctx.mainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '选择目录',
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled || !result.filePaths[0]
      ? null
      : result.filePaths[0]
  })

  ipcMain.handle('app:open-path', (_event, target: string) =>
    shell.openPath(target),
  )
  ipcMain.handle('app:quit', () => {
    app.quit()
  })

  ipcMain.on('window:minimize', () => ctx.mainWindow()?.minimize())
  ipcMain.on('window:toggle-maximize', () => {
    const win = ctx.mainWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window:close', () => ctx.mainWindow()?.close())
  ipcMain.handle(
    'window:is-maximized',
    () => ctx.mainWindow()?.isMaximized() ?? false,
  )
}
