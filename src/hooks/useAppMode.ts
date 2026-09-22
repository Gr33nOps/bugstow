import { useState, useCallback } from 'react'

export type AppMode = 'local' | 'cloud'

const STORAGE_KEY = 'bugstow_app_mode'

function readMode(): AppMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'local' || v === 'cloud' ? v : null
  } catch {
    return null
  }
}

/**
 * Tracks whether the user chose Local (in-browser) or Cloud (team) mode.
 * `null` means they have not chosen yet, so the first-run picker is shown.
 */
export function useAppMode() {
  const [mode, setModeState] = useState<AppMode | null>(() => readMode())

  const setMode = useCallback((next: AppMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore persistence failures (private mode, etc.)
    }
    setModeState(next)
  }, [])

  const clearMode = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    setModeState(null)
  }, [])

  return { mode, setMode, clearMode }
}
