import type { IpcContext } from './types'
import { registerCodexIpc } from './codex'
import { registerHistoryIpc } from './history'
import { registerSessionIpc } from './session'
import { registerSettingsIpc } from './settings'
import { registerSystemIpc } from './system'

export function registerAllIpc(ctx: IpcContext): void {
  registerSessionIpc(ctx)
  registerHistoryIpc(ctx)
  registerSettingsIpc(ctx)
  registerCodexIpc(ctx)
  registerSystemIpc(ctx)
}
