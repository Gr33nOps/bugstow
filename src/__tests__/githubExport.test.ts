import { expect, it, vi } from 'vitest'
import { exportGithubIssues } from '../../server/src/githubExport'

const issue = { id: 'one', title: 'Broken button', description: 'Steps to reproduce', type: 'bug', status: 'fixed' }
it('creates issues, saves links before closing, and skips already linked issues', async () => {
  const calls: Array<{ url: string; body: any }> = []
  let saved = false
  const fetchImpl = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) })
    if (init.method === 'PATCH') expect(saved).toBe(true)
    return new Response(JSON.stringify({ number: 12, html_url: 'https://github.com/acme/app/issues/12' }), { status: 201 })
  })
  const result = await exportGithubIssues('acme/app', 'secret', [issue, { ...issue, id: 'two', githubUrl: 'https://github.com/acme/app/issues/4' }], async () => { saved = true }, fetchImpl)
  expect(result).toMatchObject({ exported: 1, skipped: 1, error: null })
  expect(calls).toHaveLength(2)
  expect(calls[0].body.title).toBe('Broken button')
  expect(calls[0].body.body).toContain('Steps to reproduce')
  expect(calls[1]).toEqual({ url: 'https://api.github.com/repos/acme/app/issues/12', body: { state: 'closed' } })
})
it('retains partial progress and stops after GitHub rejects an issue', async () => {
  let count = 0
  const saved: string[] = []
  const result = await exportGithubIssues('acme/app', 'secret', [{ ...issue, status: 'open' }, { ...issue, id: 'two' }], async id => { saved.push(id) }, async () => {
    count++
    return count === 1 ? new Response(JSON.stringify({ number: 12, html_url: 'https://github.com/acme/app/issues/12' }), { status: 201 }) : new Response('{}', { status: 403 })
  })
  expect(saved).toEqual(['one'])
  expect(result.exported).toBe(1)
  expect(result.error).toContain('Issues: Read and write')
})
it('refuses unsafe repository paths and empty tokens before sending data', async () => {
  const fetchImpl = vi.fn()
  await expect(exportGithubIssues('../escape', 'secret', [issue], async () => {}, fetchImpl)).rejects.toThrow()
  await expect(exportGithubIssues('acme/app', '', [issue], async () => {}, fetchImpl)).rejects.toThrow()
  expect(fetchImpl).not.toHaveBeenCalled()
})

it('reports the created URL when saving its link fails and stops before creating more', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ number: 12 }), { status: 201 }))
  const result = await exportGithubIssues('acme/app', 'secret', [issue, { ...issue, id: 'two' }], async () => { throw new Error('Disk full') }, fetchImpl)
  expect(result.error).toContain('https://github.com/acme/app/issues/12')
  expect(result.error).toContain('do not export this issue again')
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})

it('retains the link and reports a warning if closing the GitHub issue fails', async () => {
  const links: string[] = []
  const result = await exportGithubIssues('acme/app', 'secret', [issue], async (_id, url) => { links.push(url) }, async (_url, init) => {
    return init?.method === 'POST' ? new Response(JSON.stringify({ number: 12 }), { status: 201 }) : new Response('{}', { status: 503 })
  })
  expect(links).toEqual(['https://github.com/acme/app/issues/12'])
  expect(result.exported).toBe(1)
  expect(result.warnings[0]).toContain('Close it on GitHub')
})

it('does not retry an ambiguous network failure that could have created an issue', async () => {
  const fetchImpl = vi.fn(async () => { throw new Error('Connection lost') })
  const result = await exportGithubIssues('acme/app', 'secret', [issue], async () => {}, fetchImpl)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect(result.error).toContain('may have been created')
})
