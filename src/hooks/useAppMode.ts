import { useState, useCallback } from 'react'

export type AppMode = 'local' | 'team'

const STORAGE_KEY = 'bugstow_app_mode'

/**
 * Reads the saved mode. Versions before 2.1 saved team mode as 'cloud'; that
 * value is still accepted and rewritten as 'team', so existing users keep their
 * choice after upgrading.
 */
export function readMode(): AppMode | null {
  // Opened a team invite (link or older email invitation): straight to Team,
  // and remembered, so opening the plain address later goes there too.
  if (typeof location !== 'undefined' && /^#(join|invite)=/.test(location.hash)) {
    try {
      localStorage.setItem(STORAGE_KEY, 'team')
    } catch {
      // private mode: this visit still opens Team
    }
    return 'team'
  }
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'cloud') {
      localStorage.setItem(STORAGE_KEY, 'team')
      return 'team'
    }
    return v === 'local' || v === 'team' ? v : null
  } catch {
    return null
  }
}

/**
 * Tracks whether the user chose Local (in-browser) or Team (self-hosted server)
 * mode. `null` means they have not chosen yet, so the first-run picker is shown.
 */
export function useAppMode() {
  const [mode, setModeState] = useState<AppMode | null>(() => readMode())

  const setMode = useCallback((next: AppMode) => {
    if (location.hash.startsWith('#join=') || (next === 'local' && location.hash.startsWith('#invite='))) {
      history.replaceState(null, '', location.pathname + location.search)
    }
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
