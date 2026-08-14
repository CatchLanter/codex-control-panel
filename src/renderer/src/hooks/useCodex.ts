import { useCallback, useEffect, useState } from 'react'
import {
  AddApiProviderOptions,
  CodexConfig,
  CodexConfigPatch,
  CodexInfo,
} from '../../../shared/types'

export function useCodex() {
  const [info, setInfo] = useState<CodexInfo | null>(null)
  const [config, setConfig] = useState<CodexConfig | null>(null)

  const refresh = useCallback(async () => {
    const [nextInfo, nextConfig] = await Promise.all([
      window.api.codex.info(),
      window.api.codex.config(),
    ])
    setInfo(nextInfo)
    setConfig(nextConfig)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setModelConfig = useCallback(
    async (patch: CodexConfigPatch) => {
      setConfig(await window.api.codex.setConfig(patch))
      setInfo(await window.api.codex.info())
    },
    [],
  )

  const addProvider = useCallback(async (opts: AddApiProviderOptions) => {
    setConfig(await window.api.codex.addProvider(opts))
  }, [])

  return { info, config, refresh, setModelConfig, addProvider }
}
