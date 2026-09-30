/**
 * Team sign-ins without email. Someone who joins with an invite link picks a
 * username; the server's auth still keys accounts by an email-shaped login, so
 * a username is stored as `<username>@bugstow.invalid`. `.invalid` is a
 * reserved domain that can never be a real mailbox, and BugsTow never sends
 * email anyway. People only ever see and type the username.
 */
export const USERNAME_DOMAIN = 'bugstow.invalid'

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,31}$/

export function isValidUsername(name: string): boolean {
  return USERNAME.test(name.trim().toLowerCase())
}

/** What someone typed in "Username or email" → the login the server knows. */
export function loginToEmail(input: string): string {
  const v = input.trim().toLowerCase()
  return v.includes('@') ? v : `${v}@${USERNAME_DOMAIN}`
}

/** A login as people should see it: the username, or the email for older accounts. */
export function displayLogin(email: string | null | undefined): string {
  if (!email) return ''
  const suffix = `@${USERNAME_DOMAIN}`
  return email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length) : email
}

/**
 * An invite link opens BugsTow at `/#invite=<token>`. The token is kept for
 * this tab (sessionStorage) until it has been used, so it survives choosing
 * "I already have an account" and signing in first.
 */
const PENDING_KEY = 'bugstow_pending_invite'
const TOKEN = /^[A-Za-z0-9_-]{20,100}$/

export function readInviteFromAddress(): string {
  if (typeof location === 'undefined') return ''
  const m = /^#invite=([A-Za-z0-9_-]{20,100})$/.exec(location.hash)
  if (m) {
    history.replaceState(null, '', location.pathname + location.search)
    try {
      sessionStorage.setItem(PENDING_KEY, m[1])
    } catch {
      // private mode: the token still works for this page load
    }
    return m[1]
  }
  return pendingInvite()
}

export function pendingInvite(): string {
  try {
    const t = sessionStorage.getItem(PENDING_KEY) || ''
    return TOKEN.test(t) ? t : ''
  } catch {
    return ''
  }
}

export function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // ignore
  }
}

export function savePendingInvite(token: string): void {
  try {
    if (TOKEN.test(token)) sessionStorage.setItem(PENDING_KEY, token)
  } catch {
    // ignore
  }
}
