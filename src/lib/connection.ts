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

/**
 * Whether the sign-in screen offers "I was invited: create my account".
 * The installed app opened on its own computer has nobody joining; anywhere
 * else (a team server, or the installed app reached over the network with
 * `bugstow start --lan`) an invited person needs it.
 */
export function offersInviteSignUp(desktopEdition: boolean, kind: ConnectionKind): boolean {
  return !(desktopEdition && kind === 'localhost')
}
