import { betterAuth } from 'better-auth'
import { authOptions } from './auth-options.ts'

export { authOptions }

/**
 * The better-auth instance. Created on import, which also starts better-auth's
 * schema check, so the server entry point (index.ts) runs migrations before
 * importing anything that imports this module.
 */
export const auth = betterAuth(authOptions)

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>
