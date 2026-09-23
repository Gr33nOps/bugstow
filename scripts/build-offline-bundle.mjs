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
// See docs/RELEASE_OFFLINE.md for how to install from the bundle.

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'offline-bundle')
const teamDir = path.join(out, 'team')
const personalDir = path.join(out, 'personal')
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version

function run(cmd) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { cwd: root, stdio: 'inherit' })
}
function capture(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim()
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

// Every version stamp must agree before anything is packaged.
const serverVersion = JSON.parse(fs.readFileSync(path.join(root, 'server/package.json'), 'utf8')).version
const appVersion = fs.readFileSync(path.join(root, 'src/version.ts'), 'utf8').match(/APP_VERSION = '([^']+)'/)?.[1]
if (serverVersion !== version || appVersion !== version) {
  console.error(`Version mismatch: package.json ${version}, server ${serverVersion}, src/version.ts ${appVersion}`)
  process.exit(1)
}

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(teamDir, { recursive: true })
fs.mkdirSync(personalDir, { recursive: true })

// 1. Frontend build (personal edition assets).
run('npm run build')

// 2. Team edition Docker image (bundles the server + all its deps).
run(`docker build -t bugstow:latest -t bugstow:${version} .`)
const imageVersion = capture('docker run --rm --entrypoint node bugstow:latest -p "require(\'./package.json\').version"')
if (imageVersion !== version) {
  console.error(`The built image reports version ${imageVersion}, expected ${version}.`)
  process.exit(1)
}
run(`docker save bugstow:latest bugstow:${version} -o "${path.join(teamDir, 'bugstow-image.tar')}"`)

// 3. Assemble the team package.
copy('docker-compose.offline.yml', path.join(teamDir, 'docker-compose.offline.yml'))
copy('server/.env.example', path.join(teamDir, '.env.example'))
copy('docs/OFFLINE.md', path.join(teamDir, 'OFFLINE.md'))
copy('docs/SELF_HOSTING.md', path.join(teamDir, 'SELF_HOSTING.md'))
copy('scripts/acceptance-test.mjs', path.join(teamDir, 'acceptance-test.mjs'))

// 4. Assemble the personal package.
copy('dist', path.join(personalDir, 'dist'))
copy('scripts/serve-personal.mjs', path.join(personalDir, 'serve-personal.mjs'))
fs.writeFileSync(
  path.join(personalDir, 'README.txt'),
  [
    'BugsTow - Personal edition (offline)',
    '',
    'Requires Node.js (no npm install, no internet).',
    '  node serve-personal.mjs',
    'Then open http://localhost:8000 and choose "Install app" in the browser.',
    '',
    'Your projects, issues and screenshots are stored in this browser (IndexedDB).',
    'Browser storage is not encrypted on disk. Export an encrypted backup from',
    'Settings to keep a copy elsewhere.',
  ].join('\n')
)

// 5. Version stamp, docs, top-level readme.
fs.writeFileSync(path.join(out, 'VERSION'), `bugstow ${version}\nbuilt ${new Date().toISOString()}\n`)
copy('docs/RELEASE_OFFLINE.md', path.join(out, 'RELEASE_OFFLINE.md'))
copy('docs/RELEASE_CHECKLIST.md', path.join(out, 'RELEASE_CHECKLIST.md'))
copy('LICENSE', path.join(out, 'LICENSE'))
fs.writeFileSync(
  path.join(out, 'README.txt'),
  [
    `BugsTow ${version} - offline release bundle`,
    '',
    '1. Verify:   sha256sum -c SHA256SUMS.txt   (macOS: shasum -a 256 -c)',
    '2. Team:     cd team && cp .env.example .env',
    '             edit .env: BUGSTOW_AUTH_SECRET, BUGSTOW_BASE_URL, BUGSTOW_TLS=true (recommended)',
    '             docker load -i bugstow-image.tar',
    '             docker compose -f docker-compose.offline.yml up -d',
    '             docker compose -f docker-compose.offline.yml logs bugstow   (shows the setup token)',
    '             then open the server address, choose "My team" and enter the token.',
    '3. Personal: cd personal && node serve-personal.mjs   (open http://localhost:8000)',
    '',
    'Full instructions: RELEASE_OFFLINE.md. Manual release checks: RELEASE_CHECKLIST.md.',
  ].join('\n')
)

// 6. Checksums for verification.
const sums = walk(out)
  .filter(f => path.basename(f) !== 'SHA256SUMS.txt')
  .map(f => `${sha256(f)}  ${path.relative(out, f).replace(/\\/g, '/')}`)
  .sort()
fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), sums.join('\n') + '\n')

console.log(`\n✓ BugsTow ${version} offline bundle ready at: ${out}`)
console.log('  Copy this folder to the offline machine. Verify with:')
console.log('    sha256sum -c SHA256SUMS.txt   (or `shasum -a 256 -c` on macOS)')
