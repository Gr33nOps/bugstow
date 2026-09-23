import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { toNodeHandler } from 'better-auth/node'
import { getMigrations } from 'better-auth/db/migration'
import { auth, authOptions } from './auth.ts'
import { migrateAppSchema } from './db.ts'
import { api } from './api.ts'
import { config } from './config.ts'

/** CSP hashes for the inline <script> blocks in the built index.html. */
function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    hashes.push(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
  }
  return hashes
}

/**
 * Builds the Express app: runs migrations, then mounts security headers, auth,
 * the REST API and the built frontend. Used by index.ts and by the HTTP tests.
 */
export async function createApp(): Promise<express.Express> {
  // 1. Run migrations: better-auth tables first, then application tables.
  const { runMigrations } = await getMigrations(authOptions)
  await runMigrations()
  migrateAppSchema()

  // Built frontend (same origin as the API), when present.
  const dist = config.publicDir
  const indexHtml =
    dist && fs.existsSync(path.join(dist, 'index.html'))
      ? fs
          .readFileSync(path.join(dist, 'index.html'), 'utf8')
          // Mark the HTML as served by a team server. The frontend only probes
          // /api/health when this marker is present, so the static public site
          // never makes an API request.
          .replace(
            '<head>',
            '<head>\n    <meta name="bugstow-server" content="team" />' +
              (config.desktop ? '\n    <meta name="bugstow-edition" content="desktop" />' : '')
          )
      : null

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy) // BUGSTOW_TRUST_PROXY; off unless behind a reverse proxy

  // Desktop app: answer only to this computer's own names. A website that points
  // its domain at 127.0.0.1 (DNS rebinding) is refused before anything runs.
  if (config.desktop) {
    const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
    try {
      allowedHosts.add(new URL(config.baseURL).hostname)
    } catch {
      // an invalid baseURL fails elsewhere
    }
    app.use((req, res, next) => {
      const host = (req.headers.host || '').replace(/:\d+$/, '').toLowerCase()
      if (!allowedHosts.has(host)) {
        res.status(421).type('text').send('BugsTow only answers on this computer. Open http://localhost instead.')
        return
      }
      next()
    })
  }

  // Strict Content-Security-Policy. `connect-src 'self'` is the hard guarantee
  // that the browser cannot make requests to any external host — the app is
  // sealed to its own origin. This holds even if a future dependency tried to
  // phone home.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          // Only our own files plus the exact inline theme script (by hash);
          // injected inline scripts are refused.
          scriptSrc: ["'self'", ...(indexHtml ? inlineScriptHashes(indexHtml) : [])],
          styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind inline styles
          imgSrc: ["'self'", 'data:', 'blob:'], // screenshots via object/data URLs
          // Team server: no external network from the browser. The desktop app
          // (one person, this computer only) also allows https: so its Personal
          // sync can reach the user's own Google Drive, Dropbox or WebDAV.
          connectSrc: config.desktop ? ["'self'", 'https:'] : ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'], // service worker
          formAction: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    })
  )

  // Throttle auth endpoints to blunt credential stuffing.
  app.use(
    '/api/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false })
  )
  // Password guessing: at most 10 failed attempts per 15 minutes per client IP.
  // Successful sign-ins don't count, so normal use is never blocked.
  app.use(
    ['/api/auth/sign-in', '/api/auth/sign-up', '/api/auth/change-password'],
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many failed attempts. Wait 15 minutes and try again.' },
    })
  )

  // better-auth handler must be mounted BEFORE express.json().
  app.all('/api/auth/*', toNodeHandler(auth))

  app.use(express.json({ limit: Math.ceil(config.maxUploadBytes * 1.4) + 1024 }))

  // CSRF defence for the REST API (better-auth checks its own routes): a
  // browser always sends Origin on POST/PATCH/DELETE, so refuse writes coming
  // from any other site. SameSite cookies already block most of this; this also
  // covers other apps on the same host (same "site", different port).
  const allowedOrigins = new Set([new URL(config.baseURL).origin, ...config.trustedOrigins])
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
    const origin = req.headers.origin
    if ((origin && !allowedOrigins.has(origin)) || req.headers['sec-fetch-site'] === 'cross-site') {
      res.status(403).json({ error: 'Cross-site request refused.' })
      return
    }
    next()
  })

  app.use('/api', api)

  // Serve the built frontend. index.html is also served for /index.html
  // because the PWA precaches that URL.
  if (indexHtml) {
    const sendIndex = (_req: express.Request, res: express.Response) => {
      res.type('html').setHeader('Cache-Control', 'no-cache')
      res.send(indexHtml)
    }
    app.get(['/', '/index.html'], sendIndex)
    app.use(express.static(dist, { index: false }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
      sendIndex(req, res)
    })
  }

  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }))

  return app
}
