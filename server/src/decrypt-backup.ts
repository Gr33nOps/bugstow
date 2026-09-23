/**
 * Decrypt a cloud backup archive back into a normal backup folder, which you
 * then restore as usual (docs/RELEASE_OFFLINE.md §8).
 *
 *   docker exec -it bugstow npm run decrypt-backup -- /backup-cloud/bugstow-backup-<time>.bugstow-backup /data/restore-me
 *
 * The passphrase is read from BUGSTOW_BACKUP_ENCRYPTION_PASSPHRASE (already set
 * in the container), or from the file given with --passphrase-file.
 */
import fs from 'node:fs'
import { readArchive } from './cloudBackup.ts'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const pf = args.indexOf('--passphrase-file')
  const passphrase =
    pf !== -1 ? fs.readFileSync(args[pf + 1], 'utf8').trim() : process.env.BUGSTOW_BACKUP_ENCRYPTION_PASSPHRASE || ''
  const [archive, outDir] = args.filter((a, i) => !a.startsWith('--') && (pf === -1 || i !== pf + 1))
  if (!archive || !outDir) {
    console.error('Usage: npm run decrypt-backup -- <archive.bugstow-backup> <output folder> [--passphrase-file <file>]')
    process.exit(1)
  }
  if (!passphrase) {
    console.error('Set BUGSTOW_BACKUP_ENCRYPTION_PASSPHRASE or pass --passphrase-file.')
    process.exit(1)
  }
  const { files, bytes, manifest } = await readArchive(archive, passphrase, outDir)
  console.log(`Decrypted ${files} files (${bytes} bytes) into ${outDir}.`)
  console.log(`Backup taken at ${String(manifest.createdAt ?? 'unknown time')}.`)
  console.log('Now restore that folder as described in docs/RELEASE_OFFLINE.md §8.')
}

main().catch(err => {
  console.error('Decrypt failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
