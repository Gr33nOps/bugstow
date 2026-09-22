import { createAuthClient } from 'better-auth/react'
import { jwtClient } from 'better-auth/client/plugins'

/**
 * Better Auth client pointed at the Neon Managed Better Auth server.
 * `VITE_NEON_AUTH_URL` is only set on deployments where cloud/team mode is
 * configured; when it is absent, cloud mode is disabled and Bugstow runs
 * purely local-first.
 */
const baseURL = import.meta.env.VITE_NEON_AUTH_URL as string | undefined

export const cloudEnabled = Boolean(baseURL)

export const authClient = createAuthClient({
  baseURL: baseURL || 'https://cloud-disabled.invalid',
  plugins: [jwtClient()],
})

export const { useSession, signIn, signUp, signOut } = authClient

/** Fetch a short-lived JWT for authenticating calls to the Bugstow API. */
export async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await authClient.token()
    return data?.token ?? null
  } catch {
    return null
  }
}
