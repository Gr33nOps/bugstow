/**
 * End-to-end encryption for cloud sync. Everything BugsTow puts in your cloud
 * is encrypted here, in the browser, with a key derived from your passphrase.
 * The cloud provider (and the BugsTow maintainer) only ever sees ciphertext.
 *
 * - Key: PBKDF2-HMAC-SHA256 (310,000 iterations) over the passphrase and a
 *   random 16-byte salt stored, unencrypted, in the sync index file.
 * - Cipher: AES-256-GCM, fresh 12-byte IV per file. The file's name is bound
 *   in as additional authenticated data, so files can't be swapped around.
 *
 * The derived key is non-extractable: it can be stored on this device (so you
 * don't retype the passphrase) but its raw bytes can never be read back.
 */

import type { Bytes } from './types'

export const KDF_ITERATIONS = 310_000
const MAGIC = new TextEncoder().encode('BGSTW1') // 6 bytes, identifies encrypted sync files

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}
function fromB64(b64: string): Bytes {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export function newSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveKey(passphrase: string, saltB64: string, iterations = KDF_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt']
  )
}

/** Encrypt bytes for the file `name`. Output: MAGIC | IV (12) | ciphertext+tag. */
export async function encryptFile(key: CryptoKey, name: string, plain: Bytes): Promise<Bytes> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(name) }, key, plain)
  )
  const out = new Uint8Array(MAGIC.length + iv.length + ct.length)
  out.set(MAGIC, 0)
  out.set(iv, MAGIC.length)
  out.set(ct, MAGIC.length + iv.length)
  return out
}

export class WrongPassphraseError extends Error {
  name = 'WrongPassphraseError'
  constructor() {
    super('The passphrase does not match the data in your cloud.')
  }
}

export async function decryptFile(key: CryptoKey, name: string, data: Bytes): Promise<Bytes> {
  const magicOk = MAGIC.every((b, i) => data[i] === b)
  if (!magicOk || data.length < MAGIC.length + 12 + 16) throw new Error(`${name} is not a BugsTow sync file.`)
  const iv = data.slice(MAGIC.length, MAGIC.length + 12)
  const ct = data.slice(MAGIC.length + 12)
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(name) }, key, ct)
    )
  } catch {
    // GCM authentication failed: wrong key, or the file was changed.
    throw new WrongPassphraseError()
  }
}

/**
 * The index file is JSON with the KDF parameters in the clear (a new device
 * needs the salt to derive the key) and the encrypted body.
 */
export interface IndexEnvelope {
  format: 'bugstow-sync'
  version: 1
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  body: string // base64 of encryptFile(...) output
}

export async function sealIndex(key: CryptoKey, salt: string, iterations: number, json: unknown): Promise<Bytes> {
  const body = await encryptFile(key, INDEX_FILE, new TextEncoder().encode(JSON.stringify(json)))
  const env: IndexEnvelope = {
    format: 'bugstow-sync',
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt },
    body: toB64(body),
  }
  return new TextEncoder().encode(JSON.stringify(env))
}

export function readEnvelope(data: Bytes): IndexEnvelope {
  let env: IndexEnvelope
  try {
    env = JSON.parse(new TextDecoder().decode(data))
  } catch {
    throw new Error('The sync index in your cloud is damaged or not a BugsTow file.')
  }
  if (env?.format !== 'bugstow-sync' || env.version !== 1 || !env.kdf?.salt) {
    throw new Error('The sync index in your cloud was made by an incompatible BugsTow version.')
  }
  return env
}

export async function openIndex<T>(key: CryptoKey, env: IndexEnvelope): Promise<T> {
  const plain = await decryptFile(key, INDEX_FILE, fromB64(env.body))
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

export const INDEX_FILE = 'bugstow-index.json'
export const shotFileName = (id: string) => `shots/${id}.bin`

export { toB64, fromB64 }
