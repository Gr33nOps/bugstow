/**
 * Reset a user's password from the host, e.g. when the server administrator
 * has forgotten theirs. Prints a one-time temporary password; the user must
 * choose a new one after signing in. Works fully offline.
 *
 *   Docker:  docker exec -it bugstow npm run reset-password -- <username or email>
 *   Local:   cd server && npm run reset-password -- <username or email>
 */
import { migrateAppSchema } from './db.ts'
import { findUserIdByEmail, resetUserPassword } from './passwords.ts'

async function main(): Promise<void> {
  const who = process.argv[2]?.trim().toLowerCase()
  if (!who) {
    console.error('Usage: npm run reset-password -- <username or email>')
    process.exit(1)
  }
  // People who joined with an invite link have a username; it's stored as
  // <username>@bugstow.invalid (see src/lib/login.ts in the app).
  const email = who.includes('@') ? who : `${who}@bugstow.invalid`
  migrateAppSchema()
  const userId = await findUserIdByEmail(email)
  if (!userId) {
    console.error(`No account found for ${who}.`)
    process.exit(1)
  }
  const temporary = await resetUserPassword(userId)
  console.log(`\nPassword reset for ${who}.`)
  console.log(`Temporary password: ${temporary}\n`)
  console.log('All of their sessions were signed out. They must choose a new password after signing in.')
}

main().catch(err => {
  console.error('Reset failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
