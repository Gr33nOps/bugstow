/**
 * Detects whether the app is being served by a self-hosted Bugstow team server
 * (which exposes /api/health) or as the public static site (no backend).
 *
 * This lets a single frontend build work in both places: on a team server it
 * offers sign-in and the shared workspace; on the public site it offers
 * personal mode plus self-hosting instructions.
 */

export interface TeamServerInfo {
  available: boolean
  setupComplete: boolean
  openSignup: boolean
  /** Server is in strict offline mode (GitHub import disabled). */
  offline: boolean
}

let cached: TeamServerInfo | null = null

export async function detectTeamServer(): Promise<TeamServerInfo> {
  if (cached) return cached
  try {
    const res = await fetch('/api/health', {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    if (res.ok) {
      const data = (await res.json()) as {
        app?: string
        setupComplete?: boolean
        openSignup?: boolean
        offline?: boolean
      }
      if (data && data.app === 'bugstow-team') {
        cached = {
          available: true,
          setupComplete: Boolean(data.setupComplete),
          openSignup: Boolean(data.openSignup),
          offline: Boolean(data.offline),
        }
        return cached
      }
    }
  } catch {
    // Network error / no backend → public static site.
  }
  cached = { available: false, setupComplete: false, openSignup: false, offline: false }
  return cached
}
