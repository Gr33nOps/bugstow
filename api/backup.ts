import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Bugstow cloud sync endpoint.
 *
 * The app stays local-first (IndexedDB). This function only brokers a single
 * *encrypted* backup blob to/from a Cloudflare R2 bucket, and it never sees the
 * bytes themselves — it hands the browser a short-lived presigned URL and the
 * browser transfers the blob directly to R2. That sidesteps Vercel's ~4.5 MB
 * function body limit, so large screenshot backups sync fine.
 *
 * The stored object is always ciphertext (AES-256-GCM) when the user sets a
 * passphrase, so an open endpoint still never exposes readable data.
 *
 * Env vars (set in Vercel project settings):
 *   R2_ACCOUNT_ID         - Cloudflare account id that owns the bucket
 *   R2_ACCESS_KEY_ID      - R2 S3 API token access key id
 *   R2_SECRET_ACCESS_KEY  - R2 S3 API token secret
 *   R2_BUCKET             - bucket name (e.g. "bugstow")
 *   BUGSTOW_SYNC_KEY      - optional shared secret; when set, requests must send
 *                           ?key=<value>. Leave unset for no auth.
 */

const OBJECT_KEY = 'backups/vault.enc.json'
const URL_TTL_SECONDS = 300

function getClient() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })

  return { client, bucket }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Optional shared-secret gate. No-op unless BUGSTOW_SYNC_KEY is configured.
  const requiredKey = process.env.BUGSTOW_SYNC_KEY
  if (requiredKey) {
    const provided = typeof req.query.key === 'string' ? req.query.key : ''
    if (provided !== requiredKey) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }

  const cfg = getClient()
  if (!cfg) {
    res.status(503).json({ error: 'Cloud sync is not configured on this deployment.' })
    return
  }
  const { client, bucket } = cfg

  const action = typeof req.query.action === 'string' ? req.query.action : ''

  try {
    if (req.method === 'GET' && action === 'upload-url') {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: OBJECT_KEY }),
        { expiresIn: URL_TTL_SECONDS }
      )
      res.status(200).json({ url, key: OBJECT_KEY, expiresIn: URL_TTL_SECONDS })
      return
    }

    if (req.method === 'GET' && action === 'download-url') {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: OBJECT_KEY }),
        { expiresIn: URL_TTL_SECONDS }
      )
      res.status(200).json({ url, key: OBJECT_KEY, expiresIn: URL_TTL_SECONDS })
      return
    }

    if (req.method === 'GET' && (action === 'meta' || action === '')) {
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: OBJECT_KEY })
        )
        res.status(200).json({
          exists: true,
          size: head.ContentLength ?? null,
          lastModified: head.LastModified ? head.LastModified.toISOString() : null,
        })
      } catch (err: unknown) {
        const name = (err as { name?: string })?.name
        const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
        if (name === 'NotFound' || name === 'NoSuchKey' || status === 404) {
          res.status(200).json({ exists: false })
          return
        }
        throw err
      }
      return
    }

    res.status(400).json({ error: 'Unsupported action.' })
  } catch (err) {
    console.error('Cloud sync error:', err)
    res.status(500).json({ error: 'Cloud sync request failed.' })
  }
}
