#!/usr/bin/env node
/**
 * BugsTow launcher: the `bugstow` command of the installed desktop app.
 *
 * Runs the BugsTow server (the same one the team edition uses) on this
 * computer, in the background, and opens it in the browser. Only Node's
 * built-in modules are used, so this file works before and after
 * `npm ci` and never talks to the internet.
 *
 *   bugstow                 start if needed, then open BugsTow in the browser
 *   bugstow start [--lan] [--local] [--port N] [--no-open]
 *   bugstow stop | restart | status | logs | data | setup-token
 *   bugstow reset-password <username or email>
 *   bugstow share | unshare   let people on other networks join (via Tailscale)
 *   bugstow run             run in this terminal (Ctrl+C stops it)
 *   bugstow uninstall       remove the app; your data folder is kept
 *   bugstow version | help
 *
 * Layout (see install.ps1 / install.sh):
 *   <home>/app      this file, server/, dist/
 *   <home>/node     private Node.js runtime
 *   <home>/data     database, screenshots, backups (never touched by updates)
 *   <home>/launcher settings, auth secret, pid, log
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import { spawn, spawnSync, execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  findTailscale,
  runTailscale,
  parseStatus,
  shareUrlFor,
  serveOnArgs,
  serveOffArgs,
  serveStatusArgs,
  portUse,
} from './tailscale.mjs'
import { pickLanAddress, pidFromNetstat, pidFromLsof } from './net.mjs'

const APP_DIR = path.dirname(fileURLToPath(import.meta.url))
const VERSION = readVersion()
const DEFAULT_PORT = 5757

function readVersion() {
  try {
    return fs.readFileSync(path.join(APP_DIR, 'VERSION'), 'utf8').trim()
  } catch {
    return 'dev'
  }
}

/** Same rule as the installers: BUGSTOW_HOME, else the usual per-user app folder. */
export function bugstowHome() {
  if (process.env.BUGSTOW_HOME) return path.resolve(process.env.BUGSTOW_HOME)
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'BugsTow')
  }
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'BugsTow')
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'bugstow')
}

const HOME = bugstowHome()
const DATA_DIR = path.join(HOME, 'data')
const STATE_DIR = path.join(HOME, 'launcher')
const SETTINGS_FILE = path.join(STATE_DIR, 'settings.json')
const SECRET_FILE = path.join(STATE_DIR, 'auth-secret')
const TOKEN_FILE = path.join(STATE_DIR, 'setup-token')
const PID_FILE = path.join(STATE_DIR, 'server.pid')
const LOG_FILE = path.join(STATE_DIR, 'server.log')

// ── small helpers ────────────────────────────────────────────────────────────
function say(msg = '') {
  process.stdout.write(msg + '\n')
}
function fail(msg) {
  process.stderr.write(`\n  ${msg}\n\n`)
  process.exit(1)
}
function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true })
}
function writePrivate(file, content) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, content, { mode: 0o600 })
}
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    return ''
  }
}

function readSettings() {
  try {
    return { port: DEFAULT_PORT, lan: false, setupDone: false, shareUrl: '', ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }
  } catch {
    const envPort = parseInt(process.env.BUGSTOW_PORT || '', 10)
    return { port: Number.isFinite(envPort) ? envPort : DEFAULT_PORT, lan: false, setupDone: false, shareUrl: '' }
  }
}
function saveSettings(s) {
  writePrivate(
    SETTINGS_FILE,
    JSON.stringify({ port: s.port, lan: s.lan, setupDone: s.setupDone, shareUrl: s.shareUrl || '' }, null, 2)
  )
}

/** This computer's address on the Wi-Fi / office network (see net.mjs). */
const lanAddress = () => pickLanAddress(os.networkInterfaces())

function urls(s) {
  if (s.lan) {
    const ip = lanAddress()
    if (!ip) fail('No network connection found, so phones cannot reach this PC. Run: bugstow start --local')
    const base = `https://${ip}:${s.port}`
    return { base, open: base, probe: { proto: 'https', port: s.port } }
  }
  const base = `http://localhost:${s.port}`
  return { base, open: base, probe: { proto: 'http', port: s.port } }
}

/** GET /api/health on this computer. Resolves null when nothing answers. */
function health(probe, timeoutMs = 1500) {
  return new Promise(resolve => {
    const lib = probe.proto === 'https' ? https : http
    const req = lib.get(
      {
        host: '127.0.0.1',
        port: probe.port,
        path: '/api/health',
        headers: { Host: probe.host || `localhost:${probe.port}`, Accept: 'application/json' },
        timeout: timeoutMs,
        // Our own self-signed certificate on this computer (LAN mode).
        rejectUnauthorized: false,
      },
      res => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', c => (body += c))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(body) })
          } catch {
            resolve({ status: res.statusCode, json: null })
          }
        })
      }
    )
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(null))
  })
}

/** Is something (anything) listening on the port? */
async function portAnswers(port) {
  for (const proto of ['http', 'https']) {
    const h = await health({ proto, port }, 800)
    if (h) return { proto, ...h }
  }
  return null
}

function isBugstow(h) {
  return h && h.json && h.json.app === 'bugstow-team'
}

function pidAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/**
 * The process actually listening on this port, found independently of what
 * PID_FILE says. PID_FILE can go stale (an update replaced it, a previous
 * stop partially failed, ...), and trusting it alone was the bug behind
 * `bugstow restart` silently doing nothing while claiming success: it saw a
 * non-matching pid, concluded "not running", and never touched the real
 * process. This is the ground truth instead; PID_FILE is only a fallback.
 */
function findListeningPid(port) {
  try {
    if (process.platform === 'win32') {
      return pidFromNetstat(execSync('netstat -ano -p tcp', { encoding: 'utf8', windowsHide: true }), port)
    }
    return pidFromLsof(execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -Fpn`, { encoding: 'utf8' }), port)
  } catch {
    // netstat/lsof missing, or nothing listening; the caller falls back to PID_FILE.
  }
  return null
}

/**
 * Ends a process. Deliberately not `taskkill.exe` on Windows: as an external
 * program it can itself be denied by security software in ways plain
 * process.kill() (in-process, no subprocess) isn't, and Node's process.kill()
 * already terminates unconditionally on Windows for a detached, console-less
 * process like this one.
 */
function killProcess(pid) {
  try {
    process.kill(pid)
  } catch {
    // already gone
  }
}

function openBrowser(url) {
  if (process.env.BUGSTOW_NO_BROWSER === '1') return
  const opts = { detached: true, stdio: 'ignore' }
  try {
    if (process.platform === 'win32') spawn('rundll32', ['url.dll,FileProtocolHandler', url], opts).unref()
    else if (process.platform === 'darwin') spawn('open', [url], opts).unref()
    else spawn('xdg-open', [url], opts).unref()
  } catch {
    say(`  Open this address in your browser: ${url}`)
  }
}

/** Opens a folder in the file manager. */
function openFolder(dir) {
  const opts = { detached: true, stdio: 'ignore' }
  try {
    if (process.platform === 'win32') spawn('explorer.exe', [dir], opts).unref()
    else if (process.platform === 'darwin') spawn('open', [dir], opts).unref()
    else spawn('xdg-open', [dir], opts).unref()
  } catch {
    // the path was printed already
  }
}

/** A first sign-in token, until the server reports that setup is done. */
function ensureSetupTokenFile(s) {
  if (!s.setupDone && !readText(TOKEN_FILE)) writePrivate(TOKEN_FILE, newSetupToken())
}

/** Keep the log from growing forever: start a new one past 5 MB. */
function rotateLog() {
  try {
    if (fs.statSync(LOG_FILE).size > 5 * 1024 * 1024) fs.renameSync(LOG_FILE, LOG_FILE + '.old')
  } catch {
    // no log yet
  }
}

function lastLogLines(n = 25) {
  const text = readText(LOG_FILE)
  return text ? text.split(/\r?\n/).slice(-n).join('\n') : '(no log yet)'
}

/**
 * Optional server settings in <home>/bugstow.env (KEY=VALUE lines, # comments),
 * for example a backup copy on a second drive. Only BUGSTOW_BACKUP_* and
 * BUGSTOW_OFFLINE are used; the launcher manages everything else.
 */
const ENV_FILE = path.join(HOME, 'bugstow.env')
function userSettings() {
  const out = {}
  for (const line of readText(ENV_FILE).split(/\r?\n/)) {
    const m = /^\s*(BUGSTOW_BACKUP_[A-Z_]+|BUGSTOW_OFFLINE)\s*=\s*(.*?)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

// ── server process ───────────────────────────────────────────────────────────
function serverEnv(s) {
  let secret = readText(SECRET_FILE)
  if (secret.length < 32) {
    secret = randomBytes(32).toString('base64url')
    writePrivate(SECRET_FILE, secret)
  }
  const u = urls(s)
  const env = {
    ...process.env,
    ...userSettings(),
    NODE_ENV: 'production',
    PORT: String(s.port),
    BUGSTOW_DESKTOP: 'true',
    BUGSTOW_DATA_DIR: DATA_DIR,
    BUGSTOW_PUBLIC_DIR: path.join(APP_DIR, 'dist'),
    BUGSTOW_AUTH_SECRET: secret,
    BUGSTOW_BASE_URL: u.base,
    BUGSTOW_HOST: s.lan ? '0.0.0.0' : '127.0.0.1',
    BUGSTOW_TLS: s.lan ? 'true' : 'false',
  }
  // Shared through Tailscale (bugstow share): trust its address, and the
  // X-Forwarded-For that tailscale serve adds, so sign-in limits are per person.
  if (s.shareUrl && !s.lan) {
    env.BUGSTOW_SHARE_URL = s.shareUrl
    env.BUGSTOW_TRUST_PROXY = '1'
  }
  // First run only: a one-time token the launcher hands to the browser, so the
  // person who installed BugsTow creates the first sign-in without copying it.
  const token = readText(TOKEN_FILE)
  if (token) env.BUGSTOW_SETUP_TOKEN = token
  return env
}

function newSetupToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (const b of randomBytes(24)) out += alphabet[b % alphabet.length]
  return out.match(/.{1,6}/g).join('-')
}

function serverCommand() {
  const serverDir = path.join(APP_DIR, 'server')
  if (!fs.existsSync(path.join(serverDir, 'node_modules'))) {
    fail(`BugsTow is not fully installed (missing ${path.join(serverDir, 'node_modules')}). Run the install command again.`)
  }
  return { cwd: serverDir, args: ['--import', 'tsx', 'src/index.ts'] }
}

async function waitForServer(probe, ms = 45000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    const h = await health(probe, 1000)
    if (isBugstow(h)) return h
    await new Promise(r => setTimeout(r, 400))
  }
  return null
}

async function start({ open = true } = {}) {
  const s = readSettings()
  // Remember the port (and mode) from the first start, so the shortcut, `status`
  // and `stop` all find this copy later.
  if (!fs.existsSync(SETTINGS_FILE)) saveSettings(s)
  const u = urls(s)
  let h = await health(u.probe)

  // Running, but started before sharing was saved (or by an older launcher):
  // it would answer 421 to the shared address. Restart it with the setting.
  if (isBugstow(h) && s.shareUrl && !s.lan) {
    const c = await health({ ...u.probe, host: new URL(s.shareUrl).host })
    if (c && c.status === 421) {
      say('  Restarting BugsTow so it answers at your shared address ...')
      if (!(await stop({ quiet: true }))) fail('Could not restart BugsTow. Close it yourself (Task Manager on Windows) and run: bugstow')
      h = null
    }
  }

  if (!isBugstow(h)) {
    const other = await portAnswers(s.port)
    if (other && !isBugstow(other)) {
      fail(`Port ${s.port} is used by another program. Pick another port: bugstow start --port ${s.port + 1}`)
    }
    if (other && isBugstow(other)) {
      // Running, but in the other mode (local vs --lan): restart in the right one.
      if (!(await stop({ quiet: true }))) {
        fail(`Could not switch modes: something on port ${s.port} would not stop. Close it yourself and try again.`)
      }
    }
    ensureDir(DATA_DIR)
    ensureDir(STATE_DIR)
    ensureSetupTokenFile(s)
    rotateLog()
    const cmd = serverCommand()
    const log = fs.openSync(LOG_FILE, 'a')
    fs.writeSync(log, `\n--- ${new Date().toISOString()} starting BugsTow ${VERSION} ---\n`)
    const child = spawn(process.execPath, cmd.args, {
      cwd: cmd.cwd,
      env: serverEnv(s),
      detached: true,
      windowsHide: true,
      stdio: ['ignore', log, log],
    })
    child.unref()
    writePrivate(PID_FILE, String(child.pid))
    say(`  Starting BugsTow on ${u.base} ...`)
    h = await waitForServer(u.probe)
    if (!h) {
      say('\n  BugsTow did not start. Last lines of its log:\n')
      say(lastLogLines())
      fail(`Full log: ${LOG_FILE}`)
    }
  }

  let target = u.open
  if (h.json.setupComplete) {
    fs.rmSync(TOKEN_FILE, { force: true })
    if (!s.setupDone) saveSettings({ ...s, setupDone: true })
  } else {
    const token = readText(TOKEN_FILE)
    if (token) target += `/#setup=${token}`
  }

  say(`  BugsTow is running: ${u.base}`)
  if (s.shareUrl && !s.lan) say(`  Shared with your tailnet at: ${s.shareUrl}`)
  say(`  Your data: ${DATA_DIR}`)
  if (s.lan) {
    say('')
    say(`  Phones and other computers on the same network can open ${u.base}`)
    say('  The browser warns about the certificate the first time. That is expected for a')
    say(`  certificate made on this PC: check the fingerprint in ${LOG_FILE}.`)
  }
  if (open) openBrowser(target)
}

/**
 * Returns true once BugsTow is confirmed stopped (or wasn't running), false if
 * it's still up and the caller should not assume otherwise — this used to be
 * silently swallowed: a stale PID_FILE made `stop` conclude "not running" and
 * skip killing the process that health checks proved was actually there, so
 * `bugstow restart` looked successful while doing nothing.
 */
async function stop({ quiet = false } = {}) {
  const s = readSettings()
  const u = urls(s)
  // Only stop a process that is really BugsTow: after a reboot the port may
  // be free, or held by some other program.
  if (!isBugstow(await portAnswers(s.port))) {
    if (!quiet) say('  BugsTow is not running.')
    fs.rmSync(PID_FILE, { force: true })
    return true
  }
  // The port-owning process is the source of truth; PID_FILE is only a
  // fallback for the rare case netstat/lsof aren't available.
  const filePid = parseInt(readText(PID_FILE), 10)
  const pid = findListeningPid(s.port) ?? (pidAlive(filePid) ? filePid : null)
  if (!pid) {
    say(`  BugsTow is running on port ${s.port}, but its process could not be found to stop it.`)
    say('  Close it yourself (Task Manager on Windows, Activity Monitor on Mac) and try again.')
    return false
  }
  killProcess(pid)
  const until = Date.now() + 10000
  while ((await health(u.probe, 500)) && Date.now() < until) await new Promise(r => setTimeout(r, 300))
  fs.rmSync(PID_FILE, { force: true })
  if (isBugstow(await health(u.probe))) {
    say(`  Could not stop BugsTow (process ${pid}). Close it yourself and try again.`)
    return false
  }
  if (!quiet) say('  BugsTow stopped. Your data is kept.')
  return true
}

async function status() {
  const s = readSettings()
  const u = urls(s)
  const h = await health(u.probe)
  say(`  BugsTow ${VERSION}`)
  say(`  Status:  ${isBugstow(h) ? `running at ${u.base}` : 'stopped'}`)
  say(`  Mode:    ${s.lan ? 'phones and other computers on this network can connect (HTTPS)' : 'this PC only'}`)
  if (s.shareUrl && !s.lan) say(`  Shared:  ${s.shareUrl} (people you share this PC with in Tailscale)`)
  say(`  Data:    ${DATA_DIR}`)
  say(`  Backups: ${path.join(DATA_DIR, 'backups')}`)
  say(`  Log:     ${LOG_FILE}`)
}

function run() {
  const s = readSettings()
  const cmd = serverCommand()
  ensureDir(DATA_DIR)
  ensureSetupTokenFile(s)
  const r = spawnSync(process.execPath, cmd.args, { cwd: cmd.cwd, env: serverEnv(s), stdio: 'inherit' })
  process.exit(r.status ?? 0)
}

/** Sets a temporary password for a sign-in (you choose a new one when signing in). */
function resetPassword(email) {
  if (!email) fail('Usage: bugstow reset-password <username or email>')
  const s = readSettings()
  const cmd = serverCommand()
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'src/reset-password.ts', email], {
    cwd: cmd.cwd,
    env: serverEnv(s),
    stdio: 'inherit',
  })
  process.exit(r.status ?? 0)
}

const psQuote = p => `'${String(p).replaceAll("'", "''")}'`

function uninstall() {
  const nodeDir = path.join(HOME, 'node')
  const binDir = path.join(HOME, 'bin')
  if (process.platform === 'win32') {
    // node.exe is running this script, so a separate process removes the files
    // after we exit. Shortcuts and the PATH entry are removed too.
    const ps = [
      `Start-Sleep -Seconds 2`,
      `Remove-Item -Recurse -Force -LiteralPath ${psQuote(APP_DIR)},${psQuote(nodeDir)},${psQuote(binDir)} -ErrorAction SilentlyContinue`,
      `$lnk = 'BugsTow.lnk'`,
      `Remove-Item -Force -LiteralPath (Join-Path ([Environment]::GetFolderPath('Programs')) $lnk),(Join-Path ([Environment]::GetFolderPath('Desktop')) $lnk) -ErrorAction SilentlyContinue`,
      `$p = [Environment]::GetEnvironmentVariable('Path','User')`,
      `if ($p) { [Environment]::SetEnvironmentVariable('Path', (($p -split ';') | Where-Object { $_ -and $_ -ne ${psQuote(binDir)} }) -join ';', 'User') }`,
    ].join('; ')
    spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref()
  } else {
    fs.rmSync(APP_DIR, { recursive: true, force: true })
    fs.rmSync(nodeDir, { recursive: true, force: true })
    fs.rmSync(binDir, { recursive: true, force: true })
    fs.rmSync(path.join(os.homedir(), '.local', 'bin', 'bugstow'), { force: true })
    fs.rmSync(path.join(os.homedir(), '.local', 'share', 'applications', 'bugstow.desktop'), { force: true })
    fs.rmSync(path.join(os.homedir(), 'Applications', 'BugsTow.app'), { recursive: true, force: true })
  }
  say('  BugsTow was removed.')
  say(`  Your issues, screenshots and backups are still in ${DATA_DIR}`)
  say('  Installing again later picks them up. Delete that folder yourself to erase them.')
}

/** Stops tailscale serve for BugsTow's port; quiet if Tailscale is gone. */
/** Stops BugsTow's own tailscale serve entry, and only that one. */
function turnOffServe(port) {
  const bin = findTailscale()
  if (!bin) return
  const use = portUse(runTailscale(bin, serveStatusArgs).stdout || '', port)
  if (use.ours) runTailscale(bin, serveOffArgs(port), { stdio: 'ignore' })
}

async function share() {
  const bin = findTailscale()
  if (!bin) {
    fail(`Tailscale isn't installed on this computer.

  People on other networks reach BugsTow through Tailscale, a free app that
  connects your devices privately:
    1. Install it from https://tailscale.com/download and sign in.
    2. Run: bugstow share`)
  }
  const st = parseStatus(runTailscale(bin, ['status', '--json']).stdout || '')
  if (!st.running) {
    fail(`Tailscale is installed but not connected (${st.state}). Open the Tailscale app, sign in, then run: bugstow share`)
  }
  if (!st.dnsName) {
    fail('Turn on MagicDNS for your tailnet (https://login.tailscale.com/admin/dns), then run: bugstow share')
  }
  const s = readSettings()
  // Never replace something else this computer already publishes on that port.
  const use = portUse(runTailscale(bin, serveStatusArgs).stdout || '', s.port)
  if (use.taken && !use.ours) {
    fail(`Tailscale already publishes something else on port ${s.port} of this computer,
  and BugsTow won't replace it. See it with: tailscale serve status
  Then pick a free port for BugsTow and try again:
    bugstow start --port ${s.port + 1}
    bugstow share`)
  }
  const url = shareUrlFor(st.dnsName, s.port)
  say(`  Publishing BugsTow in your tailnet at ${url} ...`)
  say('  (The first time, Tailscale may ask you to allow HTTPS certificates: open the link it prints.)')
  const r = runTailscale(bin, serveOnArgs(s.port), { stdio: 'inherit' })
  if (r.status !== 0) {
    fail(`Tailscale couldn't publish BugsTow (tailscale serve exited with ${r.status}).
  On Linux you may first need: sudo tailscale set --operator=$USER`)
  }
  if (!(await stop({ quiet: true }))) {
    fail(`BugsTow is published in Tailscale, but it could not be restarted to use that address.
  Close BugsTow yourself (Task Manager on Windows), then run: bugstow share`)
  }
  saveSettings({ ...s, lan: false, shareUrl: url })
  await start({ open: false })
  // Prove it: the running server must accept the shared address as its Host.
  const check = await health({ proto: 'http', port: s.port, host: new URL(url).host })
  if (!check || check.status === 421) {
    fail(`BugsTow restarted but still refuses ${url}. Run: bugstow restart
  If it keeps happening, send the last lines of: bugstow logs`)
  }
  say('')
  say(`  BugsTow is shared at ${url}`)
  say('')
  say('  To let a friend join:')
  say('    1. In Tailscale, share this computer with them:')
  say('       https://login.tailscale.com/admin/machines → this PC → ⋯ → Share')
  say('    2. They install Tailscale (free), sign in, and accept your share.')
  say('    3. In BugsTow, People & invitations → invite their email → Copy the join link')
  say('       (it now uses the address above) and send it to them.')
  say('')
  say('  Only people in your tailnet or that you share this PC with can open it.')
  say('  Keep this computer on and BugsTow running while they use it. Stop with: bugstow unshare')
}

async function unshare() {
  const s = readSettings()
  turnOffServe(s.port)
  if (s.shareUrl) {
    await stop({ quiet: true })
    saveSettings({ ...s, shareUrl: '' })
    await start({ open: false })
  }
  say('  BugsTow is no longer shared through Tailscale. Only this PC can open it.')
}

function help() {
  say(`BugsTow ${VERSION}: your issue tracker, running on this computer.

  bugstow                  Start BugsTow (if needed) and open it in your browser
  bugstow start --lan      Let phones and other computers on your network connect (HTTPS)
  bugstow start --local    This PC only again (the default)
  bugstow start --port N   Use another port (default ${DEFAULT_PORT}); remembered for next time
  bugstow stop             Stop BugsTow
  bugstow restart          Stop and start again
  bugstow status           Is it running? Where is my data?
  bugstow logs             Show the last lines of the log
  bugstow data             Open the data folder
  bugstow setup-token      Show the one-time token for creating the first sign-in
  bugstow reset-password N Forgot a password? Temporary one for username (or email) N
  bugstow share            Let people on other networks join, through Tailscale
  bugstow unshare          Stop that
  bugstow run              Run in this terminal instead of the background
  bugstow uninstall        Remove BugsTow (your data folder is kept)

Data folder: ${DATA_DIR}`)
}

// ── main ─────────────────────────────────────────────────────────────────────
const [cmd = 'open', ...rest] = process.argv.slice(2)
const flag = f => rest.includes(f)
const portArg = rest.indexOf('--port')

async function applyFlags() {
  const s = readSettings()
  let changed = false
  if (flag('--lan') && !s.lan) {
    if (s.shareUrl) {
      say('  Turning off Tailscale sharing first (it needs BugsTow on this PC only).')
      turnOffServe(s.port)
      s.shareUrl = ''
    }
    s.lan = true
    changed = true
  }
  if (flag('--local') && s.lan) {
    s.lan = false
    changed = true
  }
  if (portArg >= 0) {
    const p = parseInt(rest[portArg + 1], 10)
    if (!Number.isInteger(p) || p < 1024 || p > 65535) fail('Use a port between 1024 and 65535.')
    if (p !== s.port) {
      // Stop the copy on the old port before moving.
      await stop({ quiet: true })
      if (s.shareUrl) {
        // The Tailscale address includes the port.
        turnOffServe(s.port)
        s.shareUrl = ''
        say('  Tailscale sharing was turned off for the old port. Run bugstow share again to share the new one.')
      }
      s.port = p
      changed = true
    }
  }
  if (changed) {
    await stop({ quiet: true })
    saveSettings(s)
  }
}

switch (cmd) {
  case 'open':
  case 'start':
    await applyFlags()
    await start({ open: !flag('--no-open') })
    break
  case 'stop':
    if (!(await stop())) process.exitCode = 1
    break
  case 'restart':
    if (!(await stop({ quiet: true }))) fail('BugsTow could not be stopped, so it was not restarted.')
    await start({ open: false })
    break
  case 'status':
    await status()
    break
  case 'logs':
    say(lastLogLines(60))
    break
  case 'data':
    say(`  ${DATA_DIR}`)
    ensureDir(DATA_DIR)
    openFolder(DATA_DIR)
    break
  case 'setup-token': {
    const t = readText(TOKEN_FILE)
    say(t ? `  Setup token: ${t}` : '  No setup token: a sign-in already exists. Forgot the password? bugstow reset-password <username>')
    break
  }
  case 'share':
    await share()
    break
  case 'unshare':
    await unshare()
    break
  case 'reset-password':
    resetPassword(rest[0])
    break
  case 'run':
    run()
    break
  case 'uninstall':
    if (!(await stop({ quiet: true }))) {
      say('  Could not stop BugsTow first; close it yourself if some files are left behind.')
    }
    uninstall()
    break
  case 'version':
  case '--version':
    say(VERSION)
    break
  case 'help':
  case '--help':
  case '-h':
    help()
    break
  default:
    say(`  Unknown command "${cmd}".\n`)
    help()
    process.exit(1)
}
