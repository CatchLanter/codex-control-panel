import type { PermissionMode, PermissionSettings } from './types'

export const PERMISSION_MODE_LABELS: Record<PermissionMode, string> = {
  default: '默认模式',
  plan: '计划模式',
  auto: '自动模式',
  'auto-unsafe': '完全自动',
  custom: '自定义',
}

export function defaultPermissions(): PermissionSettings {
  return {
    mode: 'default',
    customApproval: 'on-request',
    customSandbox: 'workspace-write',
    customBypass: false,
  }
}

export function codexModeArgs(permissions: PermissionSettings): string[] {
  switch (permissions.mode) {
    case 'plan':
      return ['-c', 'approval_policy=untrusted', '-c', 'sandbox_mode=read-only']
    case 'auto':
      return ['-c', 'approval_policy=never']
    case 'auto-unsafe':
      return ['--dangerously-bypass-approvals-and-sandbox']
    case 'custom': {
      const args = [
        '-c',
        `approval_policy=${permissions.customApproval}`,
        '-c',
        `sandbox_mode=${permissions.customSandbox}`,
      ]
      if (permissions.customBypass) {
        args.push('--dangerously-bypass-approvals-and-sandbox')
      }
      return args
    }
    default:
      return []
  }
}

export function applyCodexMode(command: string, permissions: PermissionSettings): string {
  const trimmed = command.trim()
  if (!/^codex(\s|$)/.test(trimmed)) return command
  const rest = trimmed.slice('codex'.length).trim()
  return ['codex', '--no-alt-screen', ...codexModeArgs(permissions), rest]
    .filter(Boolean)
    .join(' ')
}

export function runtimePermissionCommand(
  from: PermissionSettings,
  to: PermissionSettings,
): string | null {
  const fromMode = from.mode
  const toMode = to.mode
  if (toMode === 'plan' && fromMode !== 'plan') return '/plan'
  if (toMode === 'auto' && fromMode !== 'auto') return '/auto'
  if (toMode === 'default') {
    if (fromMode === 'plan') return '/plan'
    if (fromMode === 'auto') return '/auto'
  }
  if (toMode === 'auto-unsafe' || toMode === 'custom') return '/permissions'
  return null
}
