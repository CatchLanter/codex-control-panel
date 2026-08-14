import type { CodexPanelApi } from '../../shared/types'

declare global {
  interface Window {
    api: CodexPanelApi
  }
}

export {}
