import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  AppSettings,
  AddApiProviderOptions,
  CodexConfig,
  CodexConfigPatch,
  CodexConversation,
  CodexInfo,
  CodexPanelApi,
  DeleteConversationResult,
  PermissionSettings,
  ResumeConversationOptions,
  RestartConversationOptions,
  RestartConversationResult,
  RunCommandOptions,
  SessionCreateOptions,
  SessionMeta,
  TerminalDataPayload,
  TerminalExitPayload,
  TerminalModelPayload,
  TerminalPermissionPayload,
} from '../shared/types'

const api: CodexPanelApi = {
  sessions: {
    create: (opts: SessionCreateOptions): Promise<SessionMeta> =>
      ipcRenderer.invoke('session:create', opts),
    list: (): Promise<SessionMeta[]> => ipcRenderer.invoke('session:list'),
    meta: (id: string): Promise<SessionMeta | null> =>
      ipcRenderer.invoke('session:meta', id),
    buffer: (id: string): Promise<string> =>
      ipcRenderer.invoke('session:buffer', id),
    write: (id: string, data: string): void => {
      ipcRenderer.send('session:write', id, data)
    },
    resize: (id: string, cols: number, rows: number): void => {
      ipcRenderer.send('session:resize', id, cols, rows)
    },
    kill: (id: string): Promise<boolean> => ipcRenderer.invoke('session:kill', id),
    setTitle: (id: string, title: string): Promise<boolean> =>
      ipcRenderer.invoke('session:title', id, title),
    setPermissions: (
      id: string,
      permissions: PermissionSettings,
    ): Promise<boolean> =>
      ipcRenderer.invoke('session:set-permissions', id, permissions),
    runCommand: (opts: RunCommandOptions): Promise<SessionMeta> =>
      ipcRenderer.invoke('session:run-command', opts),
  },
  history: {
    clear: (): Promise<boolean> => ipcRenderer.invoke('history:clear'),
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:set', patch),
  },
  codex: {
    info: (): Promise<CodexInfo> => ipcRenderer.invoke('codex:info'),
    openConfig: (): Promise<boolean> =>
      ipcRenderer.invoke('codex:open-config'),
    conversations: (): Promise<CodexConversation[]> =>
      ipcRenderer.invoke('codex:conversations'),
    renameConversation: (id: string, title: string): Promise<boolean> =>
      ipcRenderer.invoke('codex:conversation:rename', id, title),
    hideConversation: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('codex:conversation:hide', id),
    unhideConversation: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('codex:conversation:unhide', id),
    resumeConversation: (
      opts: ResumeConversationOptions,
    ): Promise<SessionMeta> =>
      ipcRenderer.invoke('codex:conversation:resume', opts),
    deleteConversation: (id: string): Promise<DeleteConversationResult> =>
      ipcRenderer.invoke('codex:conversation:delete', id),
    restartConversation: (
      opts: RestartConversationOptions,
    ): Promise<RestartConversationResult> =>
      ipcRenderer.invoke('codex:conversation:restart', opts),
    config: (): Promise<CodexConfig> => ipcRenderer.invoke('codex:config'),
    setConfig: (patch: CodexConfigPatch): Promise<CodexConfig> =>
      ipcRenderer.invoke('codex:config:set', patch),
    addProvider: (opts: AddApiProviderOptions): Promise<CodexConfig> =>
      ipcRenderer.invoke('codex:provider:add', opts),
  },
  dialog: {
    pickDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('dialog:pick-directory'),
  },
  app: {
    openPath: (target: string): Promise<string> =>
      ipcRenderer.invoke('app:open-path', target),
    getPathForFile: (file: unknown): string =>
      webUtils.getPathForFile(file as File),
    quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
    log: (level: string, message: string): void => {
      ipcRenderer.send('log:write', level, message)
    },
  },
  window: {
    minimize: (): void => {
      ipcRenderer.send('window:minimize')
    },
    toggleMaximize: (): void => {
      ipcRenderer.send('window:toggle-maximize')
    },
    close: (): void => {
      ipcRenderer.send('window:close')
    },
    isMaximized: (): Promise<boolean> =>
      ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChange: (cb: (maximized: boolean) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        maximized: boolean,
      ) => cb(maximized)
      ipcRenderer.on('window:maximized', listener)
      return () => ipcRenderer.removeListener('window:maximized', listener)
    },
  },
  onData: (cb: (payload: TerminalDataPayload) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: TerminalDataPayload,
    ) => cb(payload)
    ipcRenderer.on('terminal:data', listener)
    return () => ipcRenderer.removeListener('terminal:data', listener)
  },
  onExit: (cb: (payload: TerminalExitPayload) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: TerminalExitPayload,
    ) => cb(payload)
    ipcRenderer.on('terminal:exit', listener)
    return () => ipcRenderer.removeListener('terminal:exit', listener)
  },
  onPermissionChanged: (
    cb: (payload: TerminalPermissionPayload) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: TerminalPermissionPayload,
    ) => cb(payload)
    ipcRenderer.on('terminal:permission', listener)
    return () => ipcRenderer.removeListener('terminal:permission', listener)
  },
  onModelChanged: (cb: (payload: TerminalModelPayload) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: TerminalModelPayload,
    ) => cb(payload)
    ipcRenderer.on('terminal:model', listener)
    return () => ipcRenderer.removeListener('terminal:model', listener)
  },
}

contextBridge.exposeInMainWorld('api', api)
