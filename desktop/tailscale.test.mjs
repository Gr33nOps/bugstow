import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseStatus,
  shareUrlFor,
  serveOnArgs,
  serveOffArgs,
  tailscaleCandidates,
  portUse,
} from './tailscale.mjs'

test('reads the MagicDNS name of a signed-in computer', () => {
  const s = parseStatus(JSON.stringify({ BackendState: 'Running', Self: { DNSName: 'Zain-PC.tail1234.ts.net.' } }))
  assert.deepEqual(s, { running: true, state: 'Running', dnsName: 'zain-pc.tail1234.ts.net' })
  assert.equal(shareUrlFor(s.dnsName, 5757), 'https://zain-pc.tail1234.ts.net:5757')
})

test('not signed in, no MagicDNS, or garbage are all reported, never guessed', () => {
  assert.equal(parseStatus(JSON.stringify({ BackendState: 'NeedsLogin', Self: {} })).running, false)
  assert.equal(parseStatus(JSON.stringify({ BackendState: 'Running', Self: { DNSName: '' } })).dnsName, null)
  assert.equal(parseStatus(JSON.stringify({ BackendState: 'Running', Self: { DNSName: 'bad name!' } })).dnsName, null)
  assert.deepEqual(parseStatus('not json'), { running: false, state: 'Unknown', dnsName: null })
})

test('serve uses BugsTow’s own port, never 443, forwarding to IPv4 localhost', () => {
  assert.deepEqual(serveOnArgs(5757), ['serve', '--https=5757', '--bg', 'http://127.0.0.1:5757'])
  assert.deepEqual(serveOffArgs(5757), ['serve', '--https=5757', 'http://127.0.0.1:5757', 'off'])
  assert.ok(!serveOnArgs(5757).some(a => a.includes('443')))
})

test('a port something else publishes (serve or Funnel) is never taken over', () => {
  const funnelOn443 = JSON.stringify({
    TCP: { 443: { HTTPS: true } },
    Web: { 'pc.tail1.ts.net:443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:8096' } } } },
    AllowFunnel: { 'pc.tail1.ts.net:443': true },
  })
  // BugsTow on 5757 does not touch 443.
  assert.deepEqual(portUse(funnelOn443, 5757), { taken: false, ours: false })
  // Someone else's app on BugsTow's port: taken, not ours.
  const other = JSON.stringify({
    TCP: { 5757: { HTTPS: true } },
    Web: { 'pc.tail1.ts.net:5757': { Handlers: { '/': { Proxy: 'http://127.0.0.1:3000' } } } },
  })
  assert.deepEqual(portUse(other, 5757), { taken: true, ours: false })
  // BugsTow's own entry: ours, so share again / unshare may change it.
  const mine = JSON.stringify({
    TCP: { 5757: { HTTPS: true } },
    Web: { 'pc.tail1.ts.net:5757': { Handlers: { '/': { Proxy: 'http://127.0.0.1:5757' } } } },
  })
  assert.deepEqual(portUse(mine, 5757), { taken: true, ours: true })
  // Nothing served, in the shapes the CLI uses.
  assert.equal(portUse('', 5757).taken, false)
  assert.equal(portUse('{}', 5757).taken, false)
  assert.equal(portUse('No serve config', 5757).taken, false)
  // Unreadable output: assume taken, change nothing.
  assert.deepEqual(portUse('garbled', 5757), { taken: true, ours: false })
})

test('an explicit Tailscale path is the only one used (tests never reach a real install)', () => {
  assert.deepEqual(tailscaleCandidates('win32', { BUGSTOW_TAILSCALE_BIN: 'C:\\fake\\ts.mjs' }), ['C:\\fake\\ts.mjs'])
  assert.ok(tailscaleCandidates('win32', { ProgramFiles: 'C:\\Program Files' }).some(p => p.endsWith('tailscale.exe')))
  assert.ok(tailscaleCandidates('darwin', {}).includes('/Applications/Tailscale.app/Contents/MacOS/Tailscale'))
})
