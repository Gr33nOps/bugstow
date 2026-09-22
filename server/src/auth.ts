import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { db, userCount, hasPendingInvite, acceptInvitesForEmail } from './db.ts'
import { config } from './config.ts'

/**
 * Self-hosted better-auth instance backed by the shared SQLite database.
 * Email + password only, server-side sessions via secure cookies (same origin
 * as the app). No third-party providers, no external calls.
 *
 * Sign-up policy: the very first account becomes the admin. After that,
 * registration is closed unless BUGSTOW_OPEN_SIGNUP=true, except for emails
 * that an admin has invited to a team.
 */
export const authOptions = {
  database: db,
  baseURL: config.baseURL,
  secret: config.authSecret,
  trustedOrigins: [config.baseURL, ...config.trustedOrigins],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  advanced: {
    cookiePrefix: 'bugstow',
    // Harden cookies in production (HTTPS/VPN). Over plain-HTTP LAN, leave
    // secure off so cookies work; document HTTPS for remote access.
    useSecureCookies: config.isProd && config.baseURL.startsWith('https://'),
  },
  databaseHooks: {
    user: {
      create: {
        before: async user => {
          const email = (user.email || '').toLowerCase()
          if (userCount() === 0) return { data: user } // first account = admin
          if (config.openSignup) return { data: user }
          if (email && hasPendingInvite(email)) return { data: user }
          throw new APIError('FORBIDDEN', {
            message: 'Sign-up is closed on this server. Ask an admin to invite you.',
          })
        },
        after: async user => {
          if (user.email) acceptInvitesForEmail(user.id, user.email)
        },
      },
    },
  },
} satisfies Parameters<typeof betterAuth>[0]

export const auth = betterAuth(authOptions)

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>
