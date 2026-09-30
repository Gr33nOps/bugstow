/**
 * `bugstow share`: lets people on other networks reach this desktop app
 * through Tailscale, a private network the owner and their friends join.
 *
 * BugsTow itself keeps listening on 127.0.0.1 only. `tailscale serve`
 * publishes it at https://<machine>.<tailnet>.ts.net:<BugsTow port> with a
 * real certificate. It uses BugsTow's own port, never 443, and refuses when
 * that port is already published: people often serve or Funnel other things
 * on 443, and replacing that would silently break them.
 *
 * The address is reachable only by devices in the owner's tailnet or people
 * the machine is shared with (Tailscale admin console → Machines → Share).
 * Nothing is exposed to the open internet (this never uses Funnel), and
 * nothing goes through BugsTow's maintainer.
 *
 * Only Node built-ins; the pure functions here are unit-tested
 * (desktop/tailscale.test.mjs).
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

/** Where the Tailscale CLI usually is, besides the PATH. */
export function tailscaleCandidates(platform = process.platform, env = process.env) {
  // An explicit path (unusual installs, and tests' stand-in) is the only
  // candidate: never fall back to a real Tailscale the caller didn't ask for.
  if (env.BUGSTOW_TAILSCALE_BIN) return [env.BUGSTOW_TAILSCALE_BIN]
  const list = []
  list.push('tailscale')
  if (platform === 'win32') {
    list.push(path.join(env.ProgramFiles || 'C:\\Program Files', 'Tailscale', 'tailscale.exe'))
  }
  if (platform === 'darwin') {
    list.push('/Applications/Tailscale.app/Contents/MacOS/Tailscale')
  }
  return list
}

/** Runs the CLI. A .mjs/.js path (a stand-in, in tests) runs with this Node. */
export function runTailscale(bin, args, opts = {}) {
  const isScript = /\.(mjs|js)$/i.test(bin)
  return spawnSync(isScript ? process.execPath : bin, isScript ? [bin, ...args] : args, {
    encoding: 'utf8',
    windowsHide: true,
    ...opts,
  })
}

/** The first candidate that answers `tailscale version`, or null. */
export function findTailscale(platform = process.platform, env = process.env) {
  for (const bin of tailscaleCandidates(platform, env)) {
    if (bin !== 'tailscale' && !fs.existsSync(bin)) continue
    const r = runTailscale(bin, ['version'])
    if (r.status === 0) return bin
  }
  return null
}

/**
 * What `tailscale status --json` says about this computer: whether Tailscale
 * is signed in and running, and its MagicDNS name (without the trailing dot).
 */
export function parseStatus(jsonText) {
  let j
  try {
    j = JSON.parse(jsonText)
  } catch {
    return { running: false, state: 'Unknown', dnsName: null }
  }
  const state = typeof j?.BackendState === 'string' ? j.BackendState : 'Unknown'
  const raw = typeof j?.Self?.DNSName === 'string' ? j.Self.DNSName : ''
  const dnsName = raw.replace(/\.$/, '').toLowerCase()
  const valid = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dnsName)
  return { running: state === 'Running', state, dnsName: valid ? dnsName : null }
}

/** The address friends open: BugsTow's own port on the machine's ts.net name. */
export const shareUrlFor = (dnsName, port) => `https://${dnsName}:${port}`

/** Where BugsTow itself listens; what tailscale serve forwards to. */
export const bugstowTarget = port => `http://127.0.0.1:${port}`

/**
 * `tailscale serve` arguments: HTTPS on BugsTow's own port, forwarded to
 * 127.0.0.1 (not localhost: BugsTow only listens on IPv4, and localhost can
 * resolve to ::1 first).
 */
export const serveOnArgs = port => ['serve', `--https=${port}`, '--bg', bugstowTarget(port)]
export const serveOffArgs = port => ['serve', `--https=${port}`, bugstowTarget(port), 'off']
export const serveStatusArgs = ['serve', 'status', '--json']

/**
 * Is `port` already published by tailscale serve / Funnel, and if so, is it
 * BugsTow? From `tailscale serve status --json` (empty or "{}" when nothing is
 * served). Anything unreadable counts as taken, so nothing gets replaced.
 */
export function portUse(statusJson, port) {
  const text = (statusJson || '').trim()
  if (!text || text === '{}' || /no serve config/i.test(text)) return { taken: false, ours: false }
  let j
  try {
    j = JSON.parse(text)
  } catch {
    return { taken: true, ours: false }
  }
  const key = String(port)
  const webKey = Object.keys(j?.Web || {}).find(k => k.endsWith(`:${key}`))
  const taken = Boolean(j?.TCP?.[key] || webKey)
  if (!taken) return { taken: false, ours: false }
  const handlers = webKey ? j.Web[webKey]?.Handlers || {} : {}
  const ours = Object.keys(handlers).length === 1 && handlers['/']?.Proxy === bugstowTarget(port)
  return { taken, ours }
}
