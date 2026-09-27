import type { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import {
  db,
  userCount,
  hasPendingInvite,
  acceptInvitesForEmail,
  setServerAdmin,
  setMustChangePassword,
} from './db.ts'
import { config } from './config.ts'
import { SETUP_TOKEN_HEADER, verifySetupToken, clearSetupToken } from './setup.ts'

/**
 * Self-hosted better-auth instance backed by the shared SQLite database.
 * Email + password only, server-side sessions via secure cookies (same origin
 * as the app). No third-party providers, no external calls.
 *
 * Sign-up policy: the very first account becomes the admin, and creating it
 * requires the one-time setup token printed in the server log (see setup.ts).
 * After that, registration is closed unless BUGSTOW_OPEN_SIGNUP=true, except
 * for emails that an admin has invited to a team.
 */
export const authOptions = {
  database: db,
  baseURL: config.baseURL,
  secret: config.authSecret,
  trustedOrigins: [config.baseURL, ...config.trustedOrigins],
  // Never send anonymous usage data to better-auth (also forced off in config.ts).
  telemetry: { enabled: false },
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
  hooks: {
    // After a successful password change, lift the "must change password" flag
    // set by an admin reset. Done server-side so it can't be skipped.
    after: createAuthMiddleware(async ctx => {
      if (ctx.path !== '/change-password') return
      const returned = ctx.context.returned
      if (!returned || returned instanceof Error) return
      const userId = ctx.context.session?.user?.id
      if (userId) setMustChangePassword(userId, false)
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          const email = (user.email || '').toLowerCase()
          if (userCount() === 0) {
            // First account = server administrator: only with the setup token.
            if (!verifySetupToken(ctx?.headers?.get(SETUP_TOKEN_HEADER))) {
              throw new APIError('FORBIDDEN', {
                message: 'The setup token is missing or wrong. Find it in the server log.',
              })
            }
            return { data: user }
          }
          if (config.openSignup) return { data: user }
          if (email && hasPendingInvite(email)) return { data: user }
          throw new APIError('FORBIDDEN', {
            message: 'Sign-up is closed on this server. Ask an admin to invite you.',
          })
        },
        after: async user => {
          // The very first account on the server is its administrator.
          if (userCount() === 1) {
            setServerAdmin(user.id)
            clearSetupToken() // one-time: can never be used again
          }
          if (user.email) acceptInvitesForEmail(user.id, user.email)
        },
      },
    },
  },
} satisfies Parameters<typeof betterAuth>[0]
