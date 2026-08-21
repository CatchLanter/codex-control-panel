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
import { permissionFromCodexLabel } from '../shared/codex-modes'
import { initLogging, writeLog } from './log'

let ptyClient: PtyClient | null = null
let historyStore: HistoryStore | null = null
let settingsStore: SettingsStore | null = null
let codexSessionsStore: CodexSessionsStore | null = null
let quitting = false
const permissionScanBuffers = new Map<string, string>()

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
    initLogging(dataDir)
    settingsStore = new SettingsStore(dataDir)
    historyStore = new HistoryStore(dataDir)
    historyStore.pruneOlderThan(settingsStore.load().historyRetentionDays)
    codexSessionsStore = new CodexSessionsStore(dataDir)

    ptyClient = new PtyClient((event, payload) => {
      const win = getMainWindow()
      if (!win) return
      if (event === 'data') {
        const sessionId = String(payload.sessionId)
        const data = String(payload.data)
        const combined = (
          (permissionScanBuffers.get(sessionId) ?? '') + data
        ).slice(-600)
        permissionScanBuffers.set(sessionId, combined)
        const cleaned = combined
          .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, ' ')
          .replace(/\x1b\][^\x07]*\x07/g, ' ')
        const match = cleaned.match(/Permissions updated to\s+([^\n\r•]+)/i)
        if (match) {
          const permissions = permissionFromCodexLabel(match[1].trim())
          if (permissions) {
            void ptyClient?.setPermissions(sessionId, permissions)
            win.webContents.send('terminal:permission', {
              sessionId,
              permissions,
            })
          }
          permissionScanBuffers.set(sessionId, '')
        }
        const modelMatch = cleaned.match(/Model changed to\s+(\S+)\s+(\S+)/i)
        if (modelMatch) {
          win.webContents.send('terminal:model', {
            sessionId,
            model: modelMatch[1],
            effort: modelMatch[2],
          })
          permissionScanBuffers.set(sessionId, '')
        }
        const headerMatch = cleaned.match(/\bmodel:\s+(\S+)\s+(\S+)\b/i)
        if (headerMatch && !/loading/i.test(headerMatch[1])) {
          win.webContents.send('terminal:model', {
            sessionId,
            model: headerMatch[1],
            effort: headerMatch[2],
          })
        }
        win.webContents.send('terminal:data', {
          sessionId,
          data,
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
    writeLog('info', 'app started')

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
