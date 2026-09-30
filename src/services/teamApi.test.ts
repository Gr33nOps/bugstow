import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncIssueScreenshots } from './teamApi'

describe('team screenshot syncing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps selected screenshots, removes discarded ones, and uploads every new image', async () => {
    const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = []
    let uploaded = 0
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method || 'GET'
      calls.push({
        url,
        method,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      })
      if (method === 'POST') {
        uploaded += 1
        return new Response(JSON.stringify({ id: `new-${uploaded}` }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ removed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const result = await syncIssueScreenshots(
      'issue-1',
      ['old-1', 'old-2'],
      ['old-2'],
      [
        { base64: 'AAA', mimeType: 'image/png', filename: 'first.png' },
        { base64: 'BBB', mimeType: 'image/jpeg', filename: 'second.jpg' },
      ],
    )

    expect(result).toEqual(['old-2', 'new-1', 'new-2'])
    expect(calls).toEqual([
      {
        url: '/api/screenshots?issueId=issue-1',
        method: 'POST',
        body: { base64: 'AAA', mimeType: 'image/png', filename: 'first.png' },
      },
      {
        url: '/api/screenshots?issueId=issue-1',
        method: 'POST',
        body: { base64: 'BBB', mimeType: 'image/jpeg', filename: 'second.jpg' },
      },
      { url: '/api/screenshots?id=old-1', method: 'DELETE', body: undefined },
    ])
  })

  it('keeps existing screenshots when a new upload fails', async () => {
    const calls: Array<{ url: string; method: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method || 'GET' })
      return new Response(JSON.stringify({ error: 'Upload failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    await expect(syncIssueScreenshots(
      'issue-1',
      ['old-1'],
      [],
      [{ base64: 'AAA', mimeType: 'image/png', filename: 'replacement.png' }],
    )).rejects.toThrow('Upload failed')

    expect(calls).toEqual([
      { url: '/api/screenshots?issueId=issue-1', method: 'POST' },
    ])
  })
})
