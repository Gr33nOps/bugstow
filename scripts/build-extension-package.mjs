#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
const outDir = path.join(root, 'release')
const name = `bugstow-capture-${version}`
const stage = path.join(outDir, name)
if (path.relative(outDir, stage).startsWith('..')) throw new Error('Invalid release stage path')
fs.mkdirSync(outDir, { recursive: true })
fs.rmSync(stage, { recursive: true, force: true })
fs.mkdirSync(stage)
for (const file of ['manifest.json', 'popup.html', 'popup.js', 'background.js', 'README.md']) {
  fs.copyFileSync(path.join(root, 'extension', file), path.join(stage, file))
}
const tarball = path.join(outDir, `${name}.tar.gz`)
fs.rmSync(tarball, { force: true })
execFileSync('tar', ['-czf', `${name}.tar.gz`, name], { cwd: outDir, stdio: 'inherit' })
const hash = createHash('sha256').update(fs.readFileSync(tarball)).digest('hex')
fs.writeFileSync(`${tarball}.sha256`, `${hash}  ${name}.tar.gz\n`)
fs.rmSync(stage, { recursive: true, force: true })
console.log(`${path.relative(root, tarball)}\nsha256 ${hash}`)
