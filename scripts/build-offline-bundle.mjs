#!/usr/bin/env node
// Builds the OFFLINE installation packages.
//
// Run this once on a machine that HAS internet + Docker. The output is a folder
// that can be copied to a fully offline machine and installed with no downloads:
//
//   node scripts/build-offline-bundle.mjs
//
// Produces ./offline-bundle/ :
//   team/     bugstow-image.tar, docker-compose.offline.yml, .env.example, docs
//   personal/ dist/, serve-personal.mjs, README
//   SHA256SUMS.txt  (verify integrity before installing)
//
// See docs/OFFLINE.md for how to install from the bundle.

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'offline-bundle')
const teamDir = path.join(out, 'team')
const personalDir = path.join(out, 'personal')

function run(cmd) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { cwd: root, stdio: 'inherit' })
}
function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(path.join(root, src), dest, { recursive: true })
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(teamDir, { recursive: true })
fs.mkdirSync(personalDir, { recursive: true })

// 1. Frontend build (personal edition assets).
run('npm run build')

// 2. Team edition Docker image (bundles the server + all its deps).
run('docker build -t bugstow:latest .')
run(`docker save bugstow:latest -o "${path.join(teamDir, 'bugstow-image.tar')}"`)

// 3. Assemble the team package.
copy('docker-compose.offline.yml', path.join(teamDir, 'docker-compose.offline.yml'))
copy('server/.env.example', path.join(teamDir, '.env.example'))
copy('docs/OFFLINE.md', path.join(teamDir, 'OFFLINE.md'))
copy('docs/SELF_HOSTING.md', path.join(teamDir, 'SELF_HOSTING.md'))

// 4. Assemble the personal package.
copy('dist', path.join(personalDir, 'dist'))
copy('scripts/serve-personal.mjs', path.join(personalDir, 'serve-personal.mjs'))
fs.writeFileSync(
  path.join(personalDir, 'README.txt'),
  [
    'Bugstow — Personal edition (offline)',
    '',
    'Requires Node.js (no npm install, no internet).',
    '  node serve-personal.mjs',
    'Then open http://localhost:8000 and choose "Install app" in the browser.',
    '',
    'Your data is stored only in your browser (IndexedDB). Export encrypted',
    'backups from Settings to keep a copy.',
  ].join('\n')
)

// 5. Checksums for verification.
const sums = walk(out)
  .filter(f => path.basename(f) !== 'SHA256SUMS.txt')
  .map(f => `${sha256(f)}  ${path.relative(out, f).replace(/\\/g, '/')}`)
  .sort()
fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), sums.join('\n') + '\n')

console.log(`\n✓ Offline bundle ready at: ${out}`)
console.log('  Copy this folder to the offline machine. Verify with:')
console.log('    sha256sum -c SHA256SUMS.txt   (or `shasum -a 256 -c` on macOS)')
console.log('  Team install:     cd team && docker load -i bugstow-image.tar && docker compose -f docker-compose.offline.yml up -d')
console.log('  Personal install: cd personal && node serve-personal.mjs')
