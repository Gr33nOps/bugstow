import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRemoteWorkspaceUrl, remoteWorkspaceTarget } from './remoteWorkspace.mjs'

test('stores only the safe origin from a shared invite link', () => {
  assert.equal(
    normalizeRemoteWorkspaceUrl('https://desktop.tail1234.ts.net:5757/#invite=secret'),
    'https://desktop.tail1234.ts.net:5757',
  )
})

test('rejects insecure remote addresses and credentials', () => {
  assert.throws(() => normalizeRemoteWorkspaceUrl('http://desktop.tail1234.ts.net:5757'), /HTTPS/)
  assert.throws(() => normalizeRemoteWorkspaceUrl('https://name:secret@example.com'), /credentials/)
})

test('opens a remembered workspace until it is disconnected', () => {
  assert.equal(
    remoteWorkspaceTarget({ remoteWorkspaceUrl: 'https://desktop.tail1234.ts.net:5757' }),
    'https://desktop.tail1234.ts.net:5757',
  )
  assert.equal(remoteWorkspaceTarget({ remoteWorkspaceUrl: '' }), null)
})
