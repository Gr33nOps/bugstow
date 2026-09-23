import { describe, it, expect, beforeEach } from 'vitest'
import { readMode } from '../hooks/useAppMode'
import { connectionKind } from '../lib/connection'

// Minimal localStorage for the node test environment.
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: k => store.get(k) ?? null,
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: k => void store.delete(k),
  clear: () => store.clear(),
  key: i => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
} as Storage

describe('saved app mode', () => {
  beforeEach(() => store.clear())

  it('keeps users who chose team mode before 2.1 ("cloud") in team mode', () => {
    store.set('bugstow_app_mode', 'cloud')
    expect(readMode()).toBe('team')
    expect(store.get('bugstow_app_mode')).toBe('team')
  })

  it('reads current values and ignores unknown ones', () => {
    store.set('bugstow_app_mode', 'local')
    expect(readMode()).toBe('local')
    store.set('bugstow_app_mode', 'team')
    expect(readMode()).toBe('team')
    store.set('bugstow_app_mode', 'something-else')
    expect(readMode()).toBeNull()
  })

  it('shows the picker when nothing was chosen', () => {
    expect(readMode()).toBeNull()
  })
})

describe('connection kind', () => {
  it('treats this computer as local testing', () => {
    expect(connectionKind({ protocol: 'http:', hostname: 'localhost' })).toBe('localhost')
    expect(connectionKind({ protocol: 'http:', hostname: '127.0.0.1' })).toBe('localhost')
    expect(connectionKind({ protocol: 'http:', hostname: '[::1]' })).toBe('localhost')
  })

  it('flags plain HTTP on a LAN address as unencrypted', () => {
    expect(connectionKind({ protocol: 'http:', hostname: '192.168.1.20' })).toBe('lan-http')
    expect(connectionKind({ protocol: 'http:', hostname: 'bugstow.lan' })).toBe('lan-http')
  })

  it('recognises HTTPS on the LAN', () => {
    expect(connectionKind({ protocol: 'https:', hostname: '192.168.1.20' })).toBe('lan-https')
  })
})

describe('version', () => {
  it('matches package.json', async () => {
    const { APP_VERSION } = await import('../version')
    const pkg = await import('../../package.json')
    expect(APP_VERSION).toBe(pkg.version)
  })
})

describe('public site Content-Security-Policy (vercel.json)', () => {
  it('allows exactly the inline theme script in index.html and no external connections', async () => {
    const fs = await import('node:fs')
    const { createHash } = await import('node:crypto')
    const html = fs.readFileSync('index.html', 'utf8')
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
      m => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`
    )
    const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
    const csp: string = vercel.headers[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy').value
    const scriptSrc = csp.split(';').find(d => d.trim().startsWith('script-src'))!.trim().split(/\s+/).slice(1)
    expect(scriptSrc.sort()).toEqual(["'self'", ...inline].sort())
    expect(csp).toContain("connect-src 'self';")
  })
})
