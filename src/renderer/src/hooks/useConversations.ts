import { useCallback, useEffect, useState } from 'react'
import {
  AppSettings,
  CodexConversation,
  SessionMeta,
} from '../../../shared/types'
import type { ConfirmRequest } from '../components/ConfirmDialog'

export function useConversations(
  settings: AppSettings | null,
  addSession: (meta: SessionMeta) => void,
  requestConfirm: (request: ConfirmRequest) => void,
) {
  const [conversations, setConversations] = useState<CodexConversation[]>([])

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await window.api.codex.conversations())
    } catch {
      // codex sessions dir may not exist yet
    }
  }, [])

  useEffect(() => {
    void refreshConversations()
    const onFocus = () => void refreshConversations()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshConversations])

  const resumeConversation = useCallback(
    async (conversation: CodexConversation) => {
      if (!settings) return
      const meta = await window.api.codex.resumeConversation({
        id: conversation.id,
        shell: settings.defaultShell,
        cwd: conversation.cwd,
      })
      addSession(meta)
      void refreshConversations()
    },
    [settings, addSession, refreshConversations],
  )

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      await window.api.codex.renameConversation(id, title)
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === id
            ? { ...conversation, title }
            : conversation,
        ),
      )
    },
    [],
  )

  const deleteConversation = useCallback(
    (conversation: CodexConversation) => {
      requestConfirm({
        title: '删除对话',
        message: `将永久删除「${conversation.title}」及其全部消息，无法恢复。确定删除吗？`,
        confirmLabel: '永久删除',
        danger: true,
        onConfirm: async () => {
          const result = await window.api.codex.deleteConversation(
            conversation.id,
          )
          if (result.ok) {
            setConversations((prev) =>
              prev.filter((item) => item.id !== conversation.id),
            )
            void refreshConversations()
          } else {
            requestConfirm({
              title: '删除失败',
              message: result.output,
              confirmLabel: '知道了',
              onConfirm: () => undefined,
            })
          }
        },
      })
    },
    [requestConfirm, refreshConversations],
  )

  const hideConversation = useCallback(async (id: string) => {
    await window.api.codex.hideConversation(id)
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === id
          ? { ...conversation, hidden: true }
          : conversation,
      ),
    )
  }, [])

  const unhideConversation = useCallback(async (id: string) => {
    await window.api.codex.unhideConversation(id)
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === id
          ? { ...conversation, hidden: false }
          : conversation,
      ),
    )
  }, [])

  return {
    conversations,
    refreshConversations,
    resumeConversation,
    renameConversation,
    deleteConversation,
    hideConversation,
    unhideConversation,
  }
}
