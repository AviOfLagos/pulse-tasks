import { useCallback, useEffect, useState } from 'react'

import { loadSettings, saveSettings } from '../state/settings.js'

/**
 * Owns the settings object: hydrates once, then writes back on every change —
 * the same shape as `useTodos`, for the same reason.
 */
export function useSettings() {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  /** Patches one or more fields. */
  const update = useCallback(
    (changes) => setSettings((current) => ({ ...current, ...changes })),
    [],
  )

  return { settings, update }
}
