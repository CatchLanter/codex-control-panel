import { useCallback, useMemo, useState } from 'react'
import { PERMISSION_MODE_LABELS } from '../../shared/codex-modes'
import { shortcutMatches } from '../../shared/shortcuts'
import {
  CommandPalette,
  PaletteAction,
} from './components/CommandPalette'
import { ConfirmDialog, ConfirmRequest } from './components/ConfirmDialog'
import { RightPanel } from './components/RightPanel'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { TerminalsView } from './components/TerminalsView'
import { TopBar } from './components/TopBar'
import { useCodex } from './hooks/useCodex'
import { useConversations } from './hooks/useConversations'
import { useSessions } from './hooks/useSessions'
import { useSettings } from './hooks/useSettings'

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { settings, updateSettings } = useSettings()
  const sessionsStore = useSessions(settings)
  const conversationsStore = useConversations(
    settings,
    sessionsStore.addSession,
    setConfirm,
  )
  const codexStore = useCodex()

  const requestConfirm = useCallback((request: ConfirmRequest) => {
    setConfirm(request)
  }, [])

  const clearTerminalHistory = useCallback(() => {
    requestConfirm({
      title: '清空终端记录',
      message: '所有终端会话记录和输出将被永久删除，且无法恢复。确定要继续吗？',
      confirmLabel: '清空',
      danger: true,
      onConfirm: async () => {
        await window.api.history.clear()
      },
    })
  }, [requestConfirm])

  const runInNew = useCallback(
    async (command: string) => {
      if (!settings) return
      const isCodex = /^codex(\s|$)/.test(command.trim())
      await sessionsStore.createSession(
        settings.defaultShell,
        settings.defaultCwd,
        command,
        { ...settings.permissions },
        isCodex,
      )
    },
    [settings, sessionsStore],
  )

  const toggleLayout = useCallback(() => {
    if (!settings) return
    void updateSettings({ layout: settings.layout === 'tabs' ? 'grid' : 'tabs' })
  }, [settings, updateSettings])

  const createCodexSession = useCallback(() => {
    if (!settings) return
    void sessionsStore.createSession(
      settings.defaultShell,
      settings.defaultCwd,
      'codex',
      { ...settings.permissions },
      true,
    )
  }, [settings, sessionsStore])

  const openModelPicker = useCallback(() => {
    const session = sessionsStore.sessions.find(
      (item) => item.id === sessionsStore.activeId,
    )
    if (session?.codexSession && session.status === 'running') {
      window.api.sessions.write(session.id, '/model\r')
    }
  }, [sessionsStore])

  const paletteActions: PaletteAction[] = useMemo(() => {
    if (!settings) return []
    const openCommand = (command: string) => () => runInNew(command)
    return [
      {
        id: 'new-codex',
        label: '新建 Codex 窗口（自动）',
        run: createCodexSession,
      },
      {
        id: 'new-cmd',
        label: '新建 CMD 窗口',
        hint: settings.shortcuts.newTerminal,
        run: () => sessionsStore.createSession('cmd'),
      },
      {
        id: 'new-powershell',
        label: '新建 PowerShell 窗口',
        run: () => sessionsStore.createSession('powershell'),
      },
      {
        id: 'new-pwsh',
        label: '新建 PowerShell 7 窗口',
        run: () => sessionsStore.createSession('pwsh'),
      },
      {
        id: 'new-wsl',
        label: '新建 WSL 窗口',
        run: () => sessionsStore.createSession('wsl'),
      },
      {
        id: 'toggle-layout',
        label: settings.layout === 'tabs' ? '切换为网格布局' : '切换为标签布局',
        run: toggleLayout,
      },
      {
        id: 'run-codex',
        label: '在新窗口运行 codex',
        run: openCommand('codex'),
      },
      {
        id: 'run-codex-doctor',
        label: '在新窗口运行 codex doctor',
        run: openCommand('codex doctor'),
      },
      {
        id: 'open-codex-config',
        label: '打开 Codex 配置目录',
        run: () => window.api.codex.openConfig(),
      },
      {
        id: 'open-settings',
        label: '打开设置',
        hint: settings.shortcuts.openSettings,
        run: () => setSettingsOpen(true),
      },
      {
        id: 'clear-history',
        label: '清空终端输出记录',
        run: clearTerminalHistory,
      },
      { id: 'quit', label: '退出应用', run: () => window.api.app.quit() },
    ]
  }, [
    settings,
    sessionsStore,
    runInNew,
    toggleLayout,
    clearTerminalHistory,
    createCodexSession,
  ])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!settings) return
      const shortcutEvent = {
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        key: event.key,
      }
      const matches = (binding: string) =>
        shortcutMatches(shortcutEvent, binding)
      const bindings = settings.shortcuts

      if (matches(bindings.commandPalette)) {
        event.preventDefault()
        setPaletteOpen(true)
      } else if (matches(bindings.newTerminal)) {
        event.preventDefault()
        void sessionsStore.createSession()
      } else if (matches(bindings.closeTerminal)) {
        event.preventDefault()
        if (sessionsStore.activeId) {
          void sessionsStore.closeSession(sessionsStore.activeId)
        }
      } else if (matches(bindings.nextTab)) {
        event.preventDefault()
        sessionsStore.moveTab(1)
      } else if (matches(bindings.prevTab)) {
        event.preventDefault()
        sessionsStore.moveTab(-1)
      } else if (matches(bindings.toggleSidebar)) {
        event.preventDefault()
        void updateSettings({
          sidebarVisible: !settings.sidebarVisible,
        })
      } else if (matches(bindings.openSettings)) {
        event.preventDefault()
        setSettingsOpen(true)
      }
    },
    [settings, sessionsStore, updateSettings],
  )

  if (!settings) {
    return <div className="boot">正在加载 Codex 控制面板…</div>
  }

  const activeSession =
    sessionsStore.sessions.find((s) => s.id === sessionsStore.activeId) ??
    sessionsStore.sessions[0] ??
    null
  const runningCount = sessionsStore.sessions.filter(
    (s) => s.status === 'running',
  ).length
  const activePermissions = activeSession?.permissions ?? settings.permissions

  return (
    <div
      className={`app theme-${settings.theme}`}
      onKeyDown={handleKeyDown}
    >
      <TopBar
        settings={settings}
        onToggleSidebar={() =>
          void updateSettings({ sidebarVisible: !settings.sidebarVisible })
        }
        onToggleRightPanel={() =>
          void updateSettings({ rightPanelVisible: !settings.rightPanelVisible })
        }
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="app-body">
        {settings.sidebarVisible && (
          <Sidebar
            conversations={conversationsStore.conversations}
            onRefreshConversations={() =>
              void conversationsStore.refreshConversations()
            }
            onResumeConversation={(conversation) =>
              void conversationsStore.resumeConversation(conversation)
            }
            onRenameConversation={(id, title) =>
              void conversationsStore.renameConversation(id, title)
            }
            onDeleteConversation={conversationsStore.deleteConversation}
            onHideConversation={(id) =>
              void conversationsStore.hideConversation(id)
            }
            onUnhideConversation={(id) =>
              void conversationsStore.unhideConversation(id)
            }
          />
        )}
        <main className="center">
          <TerminalsView
            sessions={sessionsStore.sessions}
            activeId={activeSession?.id ?? null}
            settings={settings}
            theme={settings.theme}
            onActivate={sessionsStore.setActiveId}
            onClose={(id) => void sessionsStore.closeSession(id)}
            onCreate={(shell) => void sessionsStore.createSession(shell)}
            onCreateCodex={createCodexSession}
            onRename={(id, title) =>
              void sessionsStore.renameSession(id, title)
            }
            onSettingsChange={(patch) => void updateSettings(patch)}
          />
        </main>
        {settings.rightPanelVisible && (
          <RightPanel
            settings={settings}
            activeSession={activeSession}
            codex={codexStore.info}
            codexConfig={codexStore.config}
            onRefreshCodex={() => void codexStore.refresh()}
            onConfigChange={(patch) => void codexStore.setModelConfig(patch)}
            onOpenModelPicker={openModelPicker}
            onRunInNew={(command) => void runInNew(command)}
            onRunInActive={sessionsStore.runInActive}
            onOpenPath={(path) => void window.api.app.openPath(path)}
            onKillSession={(id) => void sessionsStore.closeSession(id)}
            onOpenSettings={() => setSettingsOpen(true)}
            onSetPermission={(id, permissions) =>
              void sessionsStore.setSessionPermission(id, permissions)
            }
          />
        )}
      </div>
      <StatusBar
        activeSession={activeSession}
        runningCount={runningCount}
        codex={codexStore.info}
        conversationsCount={conversationsStore.conversations.length}
        permissionLabel={PERMISSION_MODE_LABELS[activePermissions.mode]}
      />
      <CommandPalette
        open={paletteOpen}
        actions={paletteActions}
        onClose={() => setPaletteOpen(false)}
      />
      {confirm && (
        <ConfirmDialog
          request={confirm}
          onClose={() => setConfirm(null)}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          codexConfig={codexStore.config}
          onSettingsChange={(patch) => void updateSettings(patch)}
          onConfigChange={(patch) => void codexStore.setModelConfig(patch)}
          onAddProvider={(opts) => codexStore.addProvider(opts)}
          onClearHistory={clearTerminalHistory}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
