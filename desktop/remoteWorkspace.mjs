/** Return a safe origin that can be remembered by the desktop launcher. */
export function normalizeRemoteWorkspaceUrl(input) {
  let url
  try {
    url = new URL(String(input || '').trim())
  } catch {
    throw new Error('Enter the full HTTPS address of the shared BugsTow workspace.')
  }
  if (url.protocol !== 'https:') {
    throw new Error('A shared workspace must use HTTPS.')
  }
  if (url.username || url.password) {
    throw new Error('Workspace addresses cannot contain credentials.')
  }
  return url.origin
}

/** The remote workspace the shortcut should open, when one was remembered. */
export function remoteWorkspaceTarget(settings) {
  const saved = String(settings?.remoteWorkspaceUrl || '').trim()
  return saved || null
}
