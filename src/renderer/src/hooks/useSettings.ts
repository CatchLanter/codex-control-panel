import { useCallback, useEffect, useState } from 'react'
import { AppSettings } from '../../../shared/types'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.settings.get().then((loaded) => {
      if (!cancelled) setSettings(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings(await window.api.settings.set(patch))
  }, [])

  return { settings, updateSettings }
}
