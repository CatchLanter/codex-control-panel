import { ipcMain, shell } from 'electron'
import * as path from 'path'
import { applyCodexMode } from '../../shared/codex-modes'
import {
  AddApiProviderOptions,
  CodexConfigPatch,
  ResumeConversationOptions,
  RestartConversationOptions,
} from '../../shared/types'
import {
  addCodexProvider,
  currentModelProvider,
  deleteCodexConversation,
  detectCodex,
  hasActiveWriterLock,
  killWriterProcesses,
  readCodexConfig,
  releaseStaleWriterLock,
  writeCodexConfig,
} from '../codex'
import type { IpcContext } from './types'

function samePath(left?: string | null, right?: string | null): boolean {
  const normalize = (value?: string | null) =>
    (value ?? '').toLowerCase().replace(/[\\/]+$/, '')
  const a = normalize(left)
  const b = normalize(right)
  return Boolean(a) && a === b
}

async function resumeCommand(
  ctx: IpcContext,
  id: string,
): Promise<string> {
  const provider = await ctx.codexSessions().providerFor(id)
  const config = currentModelProvider()
  const known = new Set<string>(
    ['openai', 'oss', ...config.defined, config.defaultProvider].filter(
      (value): value is string => Boolean(value),
    ),
  )
  if (provider && !known.has(provider)) {
    const target = config.defaultProvider ?? 'openai'
    return `codex -c model_provider=${target} resume ${id}`
  }
  return `codex resume ${id}`
}

export function registerCodexIpc(ctx: IpcContext): void {
  ipcMain.handle('codex:info', () => detectCodex())
  ipcMain.handle('codex:config', () => readCodexConfig())
  ipcMain.handle('codex:config:set', (_event, patch: CodexConfigPatch) =>
    writeCodexConfig(patch),
  )
  ipcMain.handle(
    'codex:provider:add',
    (_event, opts: AddApiProviderOptions) => addCodexProvider(opts),
  )
  ipcMain.handle('codex:conversations', () => ctx.codexSessions().list())
  ipcMain.handle(
    'codex:conversation:rename',
    (_event, id: string, title: unknown) =>
      ctx.codexSessions().rename(id, String(title)),
  )
  ipcMain.handle(
    'codex:conversation:resume',
    async (_event, opts: ResumeConversationOptions) => {
      const panelSessions = await ctx.pty().list()
      const hasRunningPanelSession = panelSessions.some(
        (session) =>
          session.conversationId === opts.id &&
          session.status === 'running',
      )
      if (!hasRunningPanelSession) {
        await killWriterProcesses(opts.id)
      }
      await releaseStaleWriterLock(opts.id)
      const permissions = { ...ctx.settings().load().permissions }
      return ctx.pty().runCommand({
        shell: opts.shell,
        cwd: opts.cwd,
        command: applyCodexMode(
          await resumeCommand(ctx, opts.id),
          permissions,
        ),
        permissions,
        codexSession: true,
        conversationId: opts.id,
      })
    },
  )
  ipcMain.handle('codex:conversation:delete', async (_event, id: string) => {
    await killWriterProcesses(id)
    await releaseStaleWriterLock(id)
    return deleteCodexConversation(id)
  })
  ipcMain.handle(
    'codex:conversation:restart',
    async (_event, opts: RestartConversationOptions) => {
      let targetId = opts.conversationId
      if (!targetId && opts.cwd) {
        const threshold = (opts.after ?? Date.now()) - 2000
        const entries = await ctx.codexSessions().list()
        const recent = entries.find(
          (entry) =>
            samePath(entry.cwd, opts.cwd) &&
            entry.createdAt >= threshold,
        )
        if (recent) targetId = recent.id
      }
      if (!targetId) {
        return { command: applyCodexMode('codex', opts.permissions) }
      }
      await releaseStaleWriterLock(targetId)
      if (await hasActiveWriterLock(targetId)) {
        return { command: applyCodexMode('codex', opts.permissions) }
      }
      const base = await resumeCommand(ctx, targetId)
      return { command: applyCodexMode(base, opts.permissions) }
    },
  )
  ipcMain.handle('codex:open-config', async () => {
    const info = await detectCodex()
    if (info.configPath) {
      const error = await shell.openPath(path.dirname(info.configPath))
      return error === ''
    }
    return false
  })
}
