import { describe, it, expect, vi, afterEach } from 'vitest'
import { readMode } from '../hooks/useAppMode'

afterEach(() => vi.unstubAllGlobals())
describe('invitation navigation', () => {
  it('opens team mode from a join link even when browser mode was saved', () => {
    vi.stubGlobal('location', { hash: '#join=person%40example.com' })
    vi.stubGlobal('localStorage', { getItem: () => 'local' })
    expect(readMode()).toBe('team')
  })
})
