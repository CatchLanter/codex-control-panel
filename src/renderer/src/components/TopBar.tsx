import { AppSettings } from '../../../shared/types'
import {
  IconCommand,
  IconPanelRight,
  IconSettings,
  IconSidebar,
  IconSparkles,
} from './Icons'
import { IconButton } from './ui'
import { WindowControls } from './WindowControls'

export function TopBar({
  settings,
  onToggleSidebar,
  onToggleRightPanel,
  onOpenPalette,
  onOpenSettings,
}: {
  settings: AppSettings
  onToggleSidebar: () => void
  onToggleRightPanel: () => void
  onOpenPalette: () => void
  onOpenSettings: () => void
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <IconSparkles size={16} />
        <span className="brand-name">Codex</span>
      </div>
      <div className="topbar-tools">
        <IconButton
          title={settings.sidebarVisible ? '隐藏历史记录' : '显示历史记录'}
          aria-label="切换历史记录"
          onClick={onToggleSidebar}
        >
          <IconSidebar />
        </IconButton>
        <IconButton
          title={settings.rightPanelVisible ? '隐藏功能面板' : '显示功能面板'}
          aria-label="切换功能面板"
          onClick={onToggleRightPanel}
        >
          <IconPanelRight />
        </IconButton>
        <IconButton
          title="命令面板 (Ctrl+Shift+P)"
          aria-label="命令面板"
          onClick={onOpenPalette}
        >
          <IconCommand />
        </IconButton>
        <IconButton
          title="设置"
          aria-label="设置"
          onClick={onOpenSettings}
        >
          <IconSettings />
        </IconButton>
      </div>
      <div className="topbar-spacer" />
      <WindowControls />
    </header>
  )
}
