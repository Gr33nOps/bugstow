import fs from 'node:fs'
import os from 'node:os'
import selfsigned from 'selfsigned'
import { config } from './config.ts'

/**
 * HTTPS certificate handling for LAN use — entirely local, no cloud CA.
 *
 * If a certificate and key already exist at the configured paths, they are
 * used as-is (bring your own cert, e.g. from mkcert). Otherwise a self-signed
 * certificate is generated locally, valid for `localhost`, `127.0.0.1`, and
 * every non-internal IPv4 address of this host, so teammates on the LAN can
 * reach it by IP. Teammates trust the certificate once (see docs/OFFLINE.md).
 */
export function ensureCert(): { cert: string; key: string } {
  if (fs.existsSync(config.tlsCertPath) && fs.existsSync(config.tlsKeyPath)) {
    return {
      cert: fs.readFileSync(config.tlsCertPath, 'utf8'),
      key: fs.readFileSync(config.tlsKeyPath, 'utf8'),
    }
  }

  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => Boolean(i) && i!.family === 'IPv4' && !i!.internal)
    .map(i => i.address)

  const altNames = [
    { type: 2, value: 'localhost' }, // DNS
    { type: 7, ip: '127.0.0.1' }, // IP
    ...ips.map(ip => ({ type: 7 as const, ip })),
  ]

  const pems = selfsigned.generate([{ name: 'commonName', value: 'bugstow.local' }], {
    days: 3650,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames }],
  })

  fs.writeFileSync(config.tlsKeyPath, pems.private, { mode: 0o600 })
  fs.writeFileSync(config.tlsCertPath, pems.cert)
  return { cert: pems.cert, key: pems.private }
}
