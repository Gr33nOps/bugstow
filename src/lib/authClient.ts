import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth client for self-hosted Team mode. The team server serves both the
 * app and its auth API from the same origin, so the client points at the
 * current origin and relies on secure session cookies — no tokens in the
 * browser, no cross-origin requests.
 *
 * On the public static site there is no auth server; the app detects that at
 * runtime (see teamServer.ts) and never calls these methods there.
 */
const baseURL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: { credentials: 'include' },
})

export const { useSession, signIn, signUp, signOut } = authClient
