/**
 * Print the one-time setup token again (e.g. if the startup log scrolled away).
 *
 *   Docker:  docker exec bugstow npm run -s setup-token
 *   Local:   cd server && npm run -s setup-token
 */
import { migrateAppSchema, userCount } from './db.ts'
import { ensureSetupToken } from './setup.ts'

migrateAppSchema()
if (userCount() > 0) {
  console.log('Setup is already complete: an administrator exists. No setup token is needed or valid.')
} else {
  console.log(`Setup token: ${ensureSetupToken()}`)
}
