import { useCallback, useEffect, useRef, useState } from 'react'
import { applyCodexMode } from '../../../shared/codex-modes'
import {
  AppSettings,
  PermissionSettings,
  SessionMeta,
  ShellKind,
} from '../../../shared/types'

export function useSessions(settings: AppSettings | null) {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const sessionsRef = useRef<SessionMeta[]>([])

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  useEffect(() => {
    let cancelled = false
    void window.api.sessions.list().then((list) => {
      if (cancelled) return
      setSessions(list)
      setActiveId(list[0]?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return window.api.onExit(({ sessionId }) => {
      setSessions((prev) => {
        const next = prev.filter((session) => session.id !== sessionId)
        setActiveId((cur) =>
          cur === sessionId ? (next[0]?.id ?? null) : cur,
        )
        return next
      })
    })
  }, [])

  useEffect(() => {
    return window.api.onPermissionChanged(({ sessionId, permissions }) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? { ...session, permissions: { ...permissions } }
            : session,
        ),
      )
    })
  }, [])

  const addSession = useCallback((meta: SessionMeta) => {
    setSessions((prev) => [...prev, meta])
    setActiveId(meta.id)
  }, [])

  const createSession = useCallback(
    async (
      shell?: ShellKind,
      cwd?: string,
      initialCommand?: string,
      permissions?: PermissionSettings,
      codexSession?: boolean,
    ) => {
      if (!settings) return
      const meta = await window.api.sessions.create({
        shell: shell ?? settings.defaultShell,
        cwd: cwd ?? settings.defaultCwd,
        initialCommand,
        permissions: permissions ?? { ...settings.permissions },
        codexSession,
      })
      addSession(meta)
    },
    [settings, addSession],
  )

  const closeSession = useCallback(async (id: string) => {
    await window.api.sessions.kill(id)
    setSessions((prev) => prev.filter((item) => item.id !== id))
    setActiveId((cur) => (cur === id ? null : cur))
  }, [])

  const renameSession = useCallback(async (id: string, title: string) => {
    await window.api.sessions.setTitle(id, title)
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id ? { ...session, title } : session,
      ),
    )
  }, [])

  const setSessionPermission = useCallback(
    async (id: string, permissions: PermissionSettings) => {
      const current = sessionsRef.current.find((session) => session.id === id)
      if (!current) return
      await window.api.sessions.setPermissions(id, permissions)
      setSessions((prev) =>
        prev.map((session) =>
          session.id === id
            ? { ...session, permissions: { ...permissions } }
            : session,
        ),
      )
      if (current.codexSession && current.status === 'running') {
        // Exit the running Codex TUI, then relaunch it with the new
        // permission flags while resuming the same conversation.
        window.api.sessions.write(id, '\x03')
        window.setTimeout(() => {
          window.api.sessions.write(id, '\x03')
        }, 1500)
        window.setTimeout(() => {
          void window.api.codex
            .restartConversation({
              conversationId: current.conversationId,
              cwd: current.cwd,
              after: current.createdAt,
              permissions,
            })
            .then(({ command }) => {
              window.api.sessions.write(id, `${command}\r`)
            })
        }, 4000)
      }
    },
    [],
  )

  const moveTab = useCallback((direction: 1 | -1) => {
    setActiveId((cur) => {
      const list = sessionsRef.current
      if (!list.length) return cur
      const index = list.findIndex((session) => session.id === cur)
      const next =
        direction === 1
          ? (index + 1) % list.length
          : (index - 1 + list.length) % list.length
      return list[next].id
    })
  }, [])

  const runInActive = useCallback(
    async (command: string) => {
      const session = sessionsRef.current.find((item) => item.id === activeId)
      if (!session) return
      const finalCommand = applyCodexMode(command, session.permissions)
      window.api.sessions.write(session.id, `${finalCommand}\r`)
    },
    [activeId],
  )

  return {
    sessions,
    activeId,
    setActiveId,
    addSession,
    createSession,
    closeSession,
    renameSession,
    setSessionPermission,
    moveTab,
    runInActive,
  }
}
