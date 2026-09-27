import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-passwords-'))
process.env.BUGSTOW_DATA_DIR = tmp
process.env.BUGSTOW_AUTH_SECRET = 'test-secret-abcdefghijklmnop'

const { getMigrations } = await import('better-auth/db/migration')
const { auth, authOptions } = await import('./auth.ts')
const db = await import('./db.ts')
const { generateTempPassword, resetUserPassword, findUserIdByEmail } = await import('./passwords.ts')
const { ensureSetupToken, SETUP_TOKEN_HEADER } = await import('./setup.ts')

const { runMigrations } = await getMigrations(authOptions)
await runMigrations()
db.migrateAppSchema()

const signUp = (email: string, password: string, headers?: Headers) =>
  auth.api.signUpEmail({ body: { email, password, name: email.split('@')[0] }, headers })
const signIn = (email: string, password: string) =>
  auth.api.signInEmail({ body: { email, password } })

test('temporary passwords are long, grouped, and unique', () => {
  const a = generateTempPassword()
  assert.match(a, /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/)
  assert.notEqual(a, generateTempPassword())
})

test('the first account needs the setup token', async () => {
  ensureSetupToken()
  await assert.rejects(signUp('intruder@lan.local', 'intruder-pass-1'), /setup token/)
  await assert.rejects(
    signUp('intruder@lan.local', 'intruder-pass-1', new Headers({ [SETUP_TOKEN_HEADER]: 'WRONG-TOKEN' })),
    /setup token/
  )
  assert.equal(db.userCount(), 0)
})

test('the first account becomes the server administrator and the token expires', async () => {
  const token = ensureSetupToken()!
  const admin = await signUp('admin@lan.local', 'admin-pass-1234', new Headers({ [SETUP_TOKEN_HEADER]: token }))
  assert.equal(db.isServerAdmin(admin.user.id), true)
  assert.equal(ensureSetupToken(), null, 'no token once an admin exists')
  // The old token cannot create another account.
  await assert.rejects(
    signUp('second@lan.local', 'second-pass-12', new Headers({ [SETUP_TOKEN_HEADER]: token })),
    /Sign-up is closed/
  )
})

test('invites expire after INVITE_TTL_DAYS', () => {
  const adminId = db.getServerAdminId()!
  db.db.prepare('insert into teams (id, name, created_by, created_at) values (?,?,?,?)').run(
    'team-1', 'Team', adminId, new Date().toISOString()
  )
  const old = new Date(Date.now() - (db.INVITE_TTL_DAYS + 1) * 86400_000).toISOString()
  db.db.prepare(
    'insert into team_invites (id, team_id, email, role, token, invited_by, created_at) values (?,?,?,?,?,?,?)'
  ).run('inv-old', 'team-1', 'late@lan.local', 'member', 'tok-old', adminId, old)
  db.db.prepare(
    'insert into team_invites (id, team_id, email, role, token, invited_by, created_at) values (?,?,?,?,?,?,?)'
  ).run('inv-new', 'team-1', 'bob@lan.local', 'member', 'tok-new', adminId, new Date().toISOString())
  assert.equal(db.hasPendingInvite('late@lan.local'), false)
  assert.equal(db.hasPendingInvite('bob@lan.local'), true)
})

test('reset issues a working temporary password and signs the user out', async () => {
  const bob = await signUp('bob@lan.local', 'bob-original-pass')
  assert.equal(db.isServerAdmin(bob.user.id), false)
  const before = db.db.prepare('select count(*) as n from session where userId = ?').get(bob.user.id) as { n: number }
  assert.ok(before.n >= 1, 'bob has a session')

  assert.equal(await findUserIdByEmail('BOB@lan.local'), bob.user.id)
  const temp = await resetUserPassword(bob.user.id)

  const after = db.db.prepare('select count(*) as n from session where userId = ?').get(bob.user.id) as { n: number }
  assert.equal(after.n, 0, 'all sessions revoked')
  assert.equal(db.mustChangePassword(bob.user.id), true)

  await assert.rejects(signIn('bob@lan.local', 'bob-original-pass'), 'old password no longer works')
  const res = await signIn('bob@lan.local', temp)
  assert.equal(res.user.id, bob.user.id, 'temporary password works')
})

test('the must-change flag can be cleared', () => {
  const id = db.db.prepare("select id from user where email = 'bob@lan.local'").get() as { id: string }
  db.setMustChangePassword(id.id, false)
  assert.equal(db.mustChangePassword(id.id), false)
})
