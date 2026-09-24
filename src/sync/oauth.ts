/**
 * Sign-in to Google Drive and Dropbox, entirely in the browser (no BugsTow
 * server involved). Uses a full-page redirect rather than a popup so it also
 * works in installed apps on phones.
 *
 * The maintainer registers a free OAuth app with each provider; its client ID
 * is not a secret. It comes from, in order:
 *  1. the BugsTow server serving this page (BUGSTOW_GOOGLE_CLIENT_ID /
 *     BUGSTOW_DROPBOX_APP_KEY, e.g. in the installed app's bugstow.env), which
 *     lets anyone use their own registration without rebuilding;
 *  2. the build (VITE_GOOGLE_CLIENT_ID / VITE_DROPBOX_CLIENT_ID, .env.production).
 * See docs/CLOUD_SYNC.md.
 */

function fromServer(name: string): string {
  if (typeof document === 'undefined') return ''
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content')?.trim() || ''
}

export const GOOGLE_CLIENT_ID: string =
  fromServer('bugstow-google-client-id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
export const DROPBOX_CLIENT_ID: string =
  fromServer('bugstow-dropbox-app-key') || import.meta.env.VITE_DROPBOX_CLIENT_ID || ''

const PENDING_KEY = 'bugstow_oauth_pending'
export const CALLBACK_PATH = '/oauth/callback'

export const redirectUri = () => `${window.location.origin}${CALLBACK_PATH}`

function randomString(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replaceAll('=', '')
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replaceAll('=', '')
}

interface Pending {
  provider: 'gdrive' | 'dropbox'
  state: string
  verifier?: string
  startedAt: number
}

export function startGoogleSignIn(): void {
  const state = randomString()
  localStorage.setItem(PENDING_KEY, JSON.stringify({ provider: 'gdrive', state, startedAt: Date.now() } satisfies Pending))
  const q = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    include_granted_scopes: 'true',
    state,
  })
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${q}`)
}

export async function startDropboxSignIn(): Promise<void> {
  const state = randomString()
  const verifier = randomString(48)
  localStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ provider: 'dropbox', state, verifier, startedAt: Date.now() } satisfies Pending)
  )
  const q = new URLSearchParams({
    client_id: DROPBOX_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    state,
  })
  window.location.assign(`https://www.dropbox.com/oauth2/authorize?${q}`)
}

export type OAuthOutcome =
  | { provider: 'gdrive'; config: { accessToken: string; expiresAt: number } }
  | { provider: 'dropbox'; config: { clientId: string; accessToken: string; refreshToken: string; expiresAt: number } }
  | { error: string }

/**
 * If this page load is the return from a sign-in, finish it and clean the URL.
 * Returns null when this isn't an OAuth return.
 */
export async function completeOAuthRedirect(): Promise<OAuthOutcome | null> {
  if (window.location.pathname !== CALLBACK_PATH) return null
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  window.history.replaceState(null, '', '/') // never leave tokens in the address bar or history

  const raw = localStorage.getItem(PENDING_KEY)
  localStorage.removeItem(PENDING_KEY)
  const pending = raw ? (JSON.parse(raw) as Pending) : null
  const state = hash.get('state') || query.get('state')
  if (!pending || !state || state !== pending.state || Date.now() - pending.startedAt > 15 * 60_000) {
    return { error: 'The sign-in could not be verified. Please try connecting again.' }
  }
  const denied = hash.get('error') || query.get('error')
  if (denied) return { error: denied === 'access_denied' ? 'Access was not granted.' : `Sign-in failed (${denied}).` }

  if (pending.provider === 'gdrive') {
    const accessToken = hash.get('access_token')
    const expiresIn = Number(hash.get('expires_in') || 3600)
    const scope = hash.get('scope') || ''
    if (!accessToken) return { error: 'Google did not return access.' }
    if (!scope.includes('drive.appdata')) return { error: 'Google Drive access was not granted.' }
    return { provider: 'gdrive', config: { accessToken, expiresAt: Date.now() + expiresIn * 1000 } }
  }

  const code = query.get('code')
  if (!code || !pending.verifier) return { error: 'Dropbox did not return access.' }
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      code_verifier: pending.verifier,
      client_id: DROPBOX_CLIENT_ID,
      redirect_uri: redirectUri(),
    }),
  })
  if (!res.ok) return { error: `Dropbox sign-in failed (${res.status}).` }
  const j = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
  return {
    provider: 'dropbox',
    config: {
      clientId: DROPBOX_CLIENT_ID,
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: Date.now() + j.expires_in * 1000,
    },
  }
}
