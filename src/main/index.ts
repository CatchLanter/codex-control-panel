import { app, BrowserWindow, dialog } from 'electron'
import * as path from 'path'
import { CodexSessionsStore } from './codex-sessions'
import { HistoryStore } from './history-store'
import { registerAllIpc } from './ipc'
import { IpcContext } from './ipc/types'
import { PtyClient } from './pty-client'
import { SettingsStore } from './settings'
import { createMainWindow, getMainWindow } from './window'
import { HistoryEntry, SessionMeta } from '../shared/types'

let ptyClient: PtyClient | null = null
let historyStore: HistoryStore | null = null
let settingsStore: SettingsStore | null = null
let codexSessionsStore: CodexSessionsStore | null = null
let quitting = false

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    const dataDir = path.join(app.getPath('userData'), 'data')
    settingsStore = new SettingsStore(dataDir)
    historyStore = new HistoryStore(dataDir)
    historyStore.pruneOlderThan(settingsStore.load().historyRetentionDays)
    codexSessionsStore = new CodexSessionsStore(dataDir)

    ptyClient = new PtyClient((event, payload) => {
      const win = getMainWindow()
      if (!win) return
      if (event === 'data') {
        win.webContents.send('terminal:data', {
          sessionId: payload.sessionId,
          data: payload.data,
        })
      } else if (event === 'exit') {
        void (async () => {
          const meta = await ptyClient?.meta(String(payload.sessionId))
          if (meta) historyStore?.upsert(toHistoryEntry(meta))
        })()
        win.webContents.send('terminal:exit', {
          sessionId: payload.sessionId,
          exitCode: Number(payload.exitCode ?? 0),
        })
      }
    })

    try {
      await ptyClient.start()
    } catch (error) {
      dialog.showErrorBox(
        '终端服务启动失败',
        `${error instanceof Error ? error.message : String(error)}\n\n请确认系统已安装 Node.js 20 或更高版本，并已加入 PATH。`,
      )
    }

    const ctx: IpcContext = {
      mainWindow: () => getMainWindow(),
      pty: () => {
        if (!ptyClient) throw new Error('终端服务尚未就绪')
        return ptyClient
      },
      history: () => {
        if (!historyStore) throw new Error('历史存储尚未就绪')
        return historyStore
      },
      settings: () => {
        if (!settingsStore) throw new Error('设置存储尚未就绪')
        return settingsStore
      },
      codexSessions: () => {
        if (!codexSessionsStore) throw new Error('对话存储尚未就绪')
        return codexSessionsStore
      },
    }

    registerAllIpc(ctx)
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void (async () => {
    for (const session of (await ptyClient?.interruptAndList()) ?? []) {
      historyStore?.upsert(toHistoryEntry(session))
    }
    ptyClient?.shutdown()
    app.exit(0)
  })()
})

function toHistoryEntry(meta: SessionMeta): HistoryEntry {
  return {
    id: meta.id,
    title: meta.title,
    shell: meta.shell,
    cwd: meta.cwd,
    createdAt: meta.createdAt,
    endedAt: meta.endedAt,
    exitCode: meta.exitCode,
    status: meta.status,
    sizeBytes: meta.sizeBytes,
  }
}
