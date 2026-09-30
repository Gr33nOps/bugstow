#!/usr/bin/env node
// Zero-dependency static server for the Personal edition.
//
// Serves the built frontend (the `dist` folder) over http for local/LAN use so
// you can open Bugstow and install it as an offline app (PWA). It has no
// dependencies beyond Node itself, makes no network requests, and needs no
// npm install — ideal for fully offline machines.
//
//   node scripts/serve-personal.mjs [dir] [--port 8000] [--host 0.0.0.0]
//
// Then open http://localhost:8000 (or http://<your-ip>:8000 on the LAN) and,
// in the browser, choose "Install app" to keep it offline.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
function flag(name, dflt) {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] ? args[i + 1] : dflt
}
const here = path.dirname(fileURLToPath(import.meta.url))
const positional = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true)
// Default: `dist` next to this script (offline bundle: personal/dist), else the
// repo's build output (scripts/../dist).
const defaultRoot = [path.join(here, 'dist'), path.join(here, '..', 'dist')].find(d =>
  fs.existsSync(path.join(d, 'index.html'))
) || path.join(here, 'dist')
const root = path.resolve(positional || process.env.BUGSTOW_DIST || defaultRoot)
const port = parseInt(flag('--port', process.env.PORT || '8000'), 10)
const host = flag('--host', '0.0.0.0')

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error(`No index.html found in ${root}. Point this at the built "dist" folder.`)
  process.exit(1)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    let pathname = decodeURIComponent(url.pathname)
    let filePath = path.normalize(path.join(root, pathname))
    // Guard against path traversal.
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('Forbidden')
      return
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }
    if (!fs.existsSync(filePath)) {
      // SPA fallback for client-side routes; assets keep their 404.
      if (path.extname(pathname) === '') filePath = path.join(root, 'index.html')
      else {
        res.writeHead(404).end('Not found')
        return
      }
    }
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  } catch {
    res.writeHead(500).end('Server error')
  }
})

server.listen(port, host, () => {
  console.log(`\n  Bugstow (Personal) served from ${root}`)
  console.log(`  Local:   http://localhost:${port}`)
  console.log(`  Network: http://<this-machine-ip>:${port}`)
  console.log('  Open it in a browser and choose "Install app" to use it offline.\n')
})
