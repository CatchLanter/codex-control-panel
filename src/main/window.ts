import { BrowserWindow, shell } from 'electron'
import * as path from 'path'
import { writeLog } from './log'

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#111214',
    title: 'Codex 控制面板',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  win.once('ready-to-show', () => win.show())
  win.on('maximize', () => {
    writeLog('info', 'window maximized')
    win.webContents.send('window:maximized', true)
  })
  win.on('unmaximize', () => {
    writeLog('info', 'window unmaximized')
    win.webContents.send('window:maximized', false)
  })
  let lastResizeLog = 0
  win.on('resize', () => {
    const now = Date.now()
    if (now - lastResizeLog > 800) {
      lastResizeLog = now
      const [width, height] = win.getSize()
      writeLog('info', `window resized ${width}x${height}`)
    }
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}
