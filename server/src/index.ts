import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import fs from 'node:fs'
import { toNodeHandler } from 'better-auth/node'
import { getMigrations } from 'better-auth/db/migration'
import { auth, authOptions } from './auth.ts'
import { migrateAppSchema, userCount } from './db.ts'
import { api } from './api.ts'
import { config } from './config.ts'

async function main() {
  // 1. Run migrations: better-auth tables first, then application tables.
  const { runMigrations } = await getMigrations(authOptions)
  await runMigrations()
  migrateAppSchema()

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1) // correct client IPs behind a reverse proxy

  // Security headers. CSP is left to the reverse proxy / disabled here so the
  // static SPA and its inline module script load without extra configuration.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-origin' } }))

  // Throttle auth endpoints to blunt credential stuffing.
  app.use(
    '/api/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false })
  )

  // better-auth handler must be mounted BEFORE express.json().
  app.all('/api/auth/*', toNodeHandler(auth))

  // JSON body parsing for our API. Allow headroom over the raw upload cap for
  // base64 inflation (~33%) plus metadata.
  app.use(express.json({ limit: Math.ceil(config.maxUploadBytes * 1.4) + 1024 }))

  app.use('/api', api)

  // Serve the built frontend (same origin as the API) when present.
  if (config.publicDir && fs.existsSync(path.join(config.publicDir, 'index.html'))) {
    const dist = config.publicDir
    app.use(express.static(dist, { index: false }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
      res.sendFile(path.join(dist, 'index.html'))
    })
  }

  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }))

  app.listen(config.port, () => {
    const setup = userCount() === 0
    console.log(`\n  Bugstow team server running on ${config.baseURL}`)
    console.log(`  Data dir: ${config.dataDir}`)
    if (setup) {
      console.log('  Setup: no accounts yet — the first person to register becomes the administrator.\n')
    } else {
      console.log('  Setup: complete. Teammates can sign in.\n')
    }
  })
}

main().catch(err => {
  console.error('Failed to start Bugstow server:', err)
  process.exit(1)
})
