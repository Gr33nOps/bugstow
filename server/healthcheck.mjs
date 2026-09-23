// Docker healthcheck: asks this container's own server whether it is up.
// Works with HTTP and HTTPS. For HTTPS it talks to itself over loopback, so
// the self-signed certificate is not checked here (it is checked by browsers).
import http from 'node:http'
import https from 'node:https'

const tls = process.env.BUGSTOW_TLS === 'true' || process.env.BUGSTOW_TLS === '1'
const client = tls ? https : http
const req = client.get(
  { host: '127.0.0.1', port: process.env.PORT || 8080, path: '/api/health', rejectUnauthorized: false, timeout: 4000 },
  res => process.exit(res.statusCode === 200 ? 0 : 1)
)
req.on('error', () => process.exit(1))
req.on('timeout', () => {
  req.destroy()
  process.exit(1)
})
