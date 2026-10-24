import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.ts'

/** Launcher preferences are accessible only from a browser on this computer. */
export const desktopWorkspace = Router()
desktopWorkspace.use((req, res, next) => {
  const host = (req.headers.host || '').replace(/:\d+$/, '').toLowerCase()
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(host)
    && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')
    && !req.headers['x-forwarded-for'] && !req.headers['x-forwarded-host']
  if (!config.desktop || !local) { res.status(403).json({ error: 'Open BugsTow on this computer to change its shortcut.' }); return }
  if (req.method !== 'GET' && req.headers.origin !== `${req.protocol}://${req.headers.host}`) {
    res.status(403).json({ error: 'Same-origin request required.' }); return
  }
  res.setHeader('Cache-Control', 'no-store')
  next()
})
// Older launchers did not pass this path; their standard data folder is a sibling.
const settingsFile = () => process.env.BUGSTOW_LAUNCHER_SETTINGS || path.join(path.dirname(config.dataDir), 'launcher', 'settings.json')
function readSettings(): Record<string, unknown> {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }
  catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw err }
}
desktopWorkspace.get('/', (_req, res) => {
  try { res.json({ url: readSettings().remoteWorkspaceUrl || '' }) }
  catch { res.status(500).json({ error: 'Could not read shortcut settings.' }) }
})
desktopWorkspace.put('/', (req, res) => {
  let origin = ''
  if (req.body?.url !== '') {
    try {
      const url = new URL(req.body?.url)
      if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error()
      origin = url.origin
    } catch { res.status(400).json({ error: 'Paste the shared HTTPS BugsTow link from your teammate.' }); return }
  }
  try {
    const settings = { ...readSettings(), remoteWorkspaceUrl: origin }
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
    const temp = settingsFile() + '.tmp'
    fs.writeFileSync(temp, JSON.stringify(settings, null, 2), { mode: 0o600 })
    fs.renameSync(temp, settingsFile())
    res.json({ url: origin })
  } catch { res.status(500).json({ error: 'Could not save shortcut settings.' }) }
})
