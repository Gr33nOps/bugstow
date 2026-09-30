import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickLanAddress } from './net.mjs'

const v4 = address => [{ family: 'IPv4', address, internal: false }]

test('skips WSL / Hyper-V / Tailscale adapters and picks the real network (a real Windows PC)', () => {
  const pc = {
    Tailscale: v4('100.98.136.91'),
    'vEthernet (Default Switch)': v4('172.30.64.1'),
    'vEthernet (Ethernet 2)': v4('172.20.32.1'),
    'vEthernet (WSL)': v4('172.19.208.1'),
    'Ethernet 2': v4('192.168.1.2'),
    'vEthernet (Wi-Fi)': v4('172.27.192.1'),
    'Loopback Pseudo-Interface 1': [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
  }
  assert.equal(pickLanAddress(pc), '192.168.1.2')
})

test('prefers 192.168.x, then 10.x, then 172.16-31.x', () => {
  assert.equal(pickLanAddress({ eth0: v4('172.16.0.5'), wlan0: v4('10.0.0.8') }), '10.0.0.8')
  assert.equal(pickLanAddress({ en0: v4('10.1.1.1'), en1: v4('192.168.0.9') }), '192.168.0.9')
})

test('Node 18 numeric family, docker bridges, and no network at all', () => {
  assert.equal(pickLanAddress({ docker0: v4('172.17.0.1'), en0: [{ family: 4, address: '192.168.4.20', internal: false }] }), '192.168.4.20')
  // Only a virtual adapter: better than nothing.
  assert.equal(pickLanAddress({ 'vEthernet (WSL)': v4('172.19.208.1') }), '172.19.208.1')
  assert.equal(pickLanAddress({ Tailscale: v4('100.98.136.91') }), null, 'not a private LAN address')
  assert.equal(pickLanAddress({}), null)
})
