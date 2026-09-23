/**
 * How this browser is connected to the team server. Used to warn honestly when
 * traffic is not encrypted: plain HTTP on a LAN is readable by anyone on that
 * network, however "local" it feels.
 */
export type ConnectionKind = 'localhost' | 'lan-http' | 'lan-https'

export function connectionKind(loc: Pick<Location, 'protocol' | 'hostname'> = window.location): ConnectionKind {
  const host = loc.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost')) {
    return 'localhost'
  }
  return loc.protocol === 'https:' ? 'lan-https' : 'lan-http'
}
