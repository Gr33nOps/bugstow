#!/usr/bin/env node
// Builds the package that the one-command installers download
// (install.ps1 / install.sh):
//
//   node scripts/build-app-package.mjs [--skip-build]
//
// Produces ./release/ :
//   bugstow-app-<version>.tar.gz          the app (launcher, server source, built frontend)
//   bugstow-app-<version>.tar.gz.sha256   checksum the installers verify
//
// The package holds no node_modules: the installer runs `npm ci` with its own
// private Node.js, so native modules (SQLite) match the computer they run on.

import { execFileSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
const serverVersion = JSON.parse(fs.readFileSync(path.join(root, 'server/package.json'), 'utf8')).version
const appVersion = fs.readFileSync(path.join(root, 'src/version.ts'), 'utf8').match(/APP_VERSION = '([^']+)'/)?.[1]
if (serverVersion !== version || appVersion !== version) {
  console.error(`Version mismatch: package.json ${version}, server ${serverVersion}, src/version.ts ${appVersion}`)
  process.exit(1)
}

const name = `bugstow-app-${version}`
const outDir = path.join(root, 'release')
const stage = path.join(outDir, name)

if (!process.argv.includes('--skip-build')) {
  console.log('$ npm run build')
  execSync('npm run build', { cwd: root, stdio: 'inherit' })
}
if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('dist/index.html is missing. Run npm run build first.')
  process.exit(1)
}

fs.rmSync(stage, { recursive: true, force: true })
fs.mkdirSync(path.join(stage, 'server', 'src'), { recursive: true })

const copy = (src, dest = src) => fs.cpSync(path.join(root, src), path.join(stage, dest), { recursive: true })

copy('desktop/bugstow.mjs', 'bugstow.mjs')
copy('desktop/bugstow.png', 'bugstow.png')
copy('dist')
copy('server/package.json')
copy('server/package-lock.json')
for (const f of fs.readdirSync(path.join(root, 'server/src'))) {
  if (f.endsWith('.ts') && !f.endsWith('.test.ts')) copy(`server/src/${f}`)
}
copy('LICENSE')
copy('docs/INSTALL.md', 'INSTALL.md')
fs.writeFileSync(path.join(stage, 'VERSION'), version + '\n')

// Windows shortcut icon: an .ico holding the 256px PNG as its only image.
const png = fs.readFileSync(path.join(root, 'desktop/bugstow.png'))
const ico = Buffer.alloc(22)
ico.writeUInt16LE(0, 0) // reserved
ico.writeUInt16LE(1, 2) // type: icon
ico.writeUInt16LE(1, 4) // one image
ico.writeUInt8(0, 6) // width 256
ico.writeUInt8(0, 7) // height 256
ico.writeUInt16LE(1, 10) // colour planes
ico.writeUInt16LE(32, 12) // bits per pixel
ico.writeUInt32LE(png.length, 14)
ico.writeUInt32LE(22, 18) // image offset
fs.writeFileSync(path.join(stage, 'bugstow.ico'), Buffer.concat([ico, png]))

const tarball = path.join(outDir, `${name}.tar.gz`)
fs.rmSync(tarball, { force: true })
execFileSync('tar', ['-czf', `${name}.tar.gz`, name], { cwd: outDir, stdio: 'inherit' })
const hash = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex')
fs.writeFileSync(`${tarball}.sha256`, `${hash}  ${name}.tar.gz\n`)
fs.rmSync(stage, { recursive: true, force: true })

console.log(`\n${path.relative(root, tarball)}  (${(fs.statSync(tarball).size / 1024 / 1024).toFixed(1)} MB)`)
console.log(`sha256 ${hash}`)
