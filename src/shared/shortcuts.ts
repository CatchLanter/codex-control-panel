import type { ShortcutBindings } from './types'

export const DEFAULT_SHORTCUTS: ShortcutBindings = {
  commandPalette: 'Ctrl+Shift+P',
  newTerminal: 'Ctrl+Shift+N',
  closeTerminal: 'Ctrl+W',
  nextTab: 'Ctrl+Tab',
  prevTab: 'Ctrl+Shift+Tab',
  toggleSidebar: 'Ctrl+B',
  openSettings: 'Ctrl+,',
}

export function normalizeKey(key: string): string {
  if (key === ' ') return 'space'
  if (key === 'Control') return 'ctrl'
  if (key === 'Shift') return 'shift'
  if (key === 'Alt') return 'alt'
  if (key === 'Meta') return 'meta'
  if (key.startsWith('Arrow')) return key.slice(5).toLowerCase()
  return key.toLowerCase()
}

export interface ShortcutEvent {
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  key: string
}

export function shortcutMatches(
  event: ShortcutEvent,
  binding: string,
): boolean {
  const parts = binding.split('+')
  const key = normalizeKey(parts[parts.length - 1] ?? '')
  if (!key) return false
  const wantsCtrl = parts.includes('Ctrl')
  const wantsShift = parts.includes('Shift')
  const wantsAlt = parts.includes('Alt')
  return (
    wantsCtrl === event.ctrlKey &&
    wantsShift === event.shiftKey &&
    wantsAlt === event.altKey &&
    normalizeKey(event.key) === key
  )
}

export function formatShortcut(event: ShortcutEvent): string {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')
  const raw = event.key
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(raw)) {
    const key =
      raw === ' '
        ? 'Space'
        : raw.length === 1
          ? raw.toUpperCase()
          : raw.replace(/^Arrow/, '')
    parts.push(key)
  }
  return parts.join('+')
}
