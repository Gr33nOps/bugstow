import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import fs from 'node:fs'
import { toNodeHandler } from 'better-auth/node'
import { getMigrations } from 'better-auth/db/migration'
import { auth, authOptions } from './auth.ts'
import { migrateAppSchema, userCount } from './db.ts'
import { api } from './api.ts'
import { config } from './config.ts'
import { startBackupScheduler } from './backup.ts'
import { ensureCert } from './tls.ts'

async function main() {
  // 1. Run migrations: better-auth tables first, then application tables.
  const { runMigrations } = await getMigrations(authOptions)
  await runMigrations()
  migrateAppSchema()

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy) // BUGSTOW_TRUST_PROXY; off unless behind a reverse proxy

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
          scriptSrc: ["'self'", "'unsafe-inline'"], // inline theme script + module
          styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind inline styles
          imgSrc: ["'self'", 'data:', 'blob:'], // screenshots via object/data URLs
          connectSrc: ["'self'"], // no external network from the browser
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

  // better-auth handler must be mounted BEFORE express.json().
  app.all('/api/auth/*', toNodeHandler(auth))

  app.use(express.json({ limit: Math.ceil(config.maxUploadBytes * 1.4) + 1024 }))

  app.use('/api', api)

  // Serve the built frontend (same origin as the API) when present.
  if (config.publicDir && fs.existsSync(path.join(config.publicDir, 'index.html'))) {
    const dist = config.publicDir
    // Mark the HTML as served by a team server. The frontend only probes
    // /api/health when this marker is present, so the static public site never
    // makes an API request. Also served for /index.html because the PWA
    // precaches that URL.
    const indexHtml = fs
      .readFileSync(path.join(dist, 'index.html'), 'utf8')
      .replace('<head>', '<head>\n    <meta name="bugstow-server" content="team" />')
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

  const server = config.tls
    ? https.createServer(ensureCert(), app)
    : http.createServer(app)

  startBackupScheduler()

  server.listen(config.port, () => {
    const scheme = config.tls ? 'https' : 'http'
    console.log(`\n  Bugstow team server running on ${scheme}://localhost:${config.port}`)
    console.log(`  Base URL: ${config.baseURL}`)
    console.log(`  Data dir: ${config.dataDir}`)
    console.log(`  Offline mode: ${config.offline ? 'ON (GitHub import disabled)' : 'off'}`)
    console.log(`  TLS: ${config.tls ? 'on (self-signed LAN cert)' : 'off'}`)
    console.log(`  Auto-backups: ${config.backupEnabled ? `every ${config.backupIntervalHours}h, keep ${config.backupRetention}` : 'off'}`)
    console.log(
      userCount() === 0
        ? '  Setup: no accounts yet — the first person to register becomes the administrator.\n'
        : '  Setup: complete. Teammates can sign in.\n'
    )
  })
}

main().catch(err => {
  console.error('Failed to start Bugstow server:', err)
  process.exit(1)
})
