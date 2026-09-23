#!/usr/bin/env node
// Offline acceptance test for the Team edition.
//
// Drives TWO independent clients against a running team server:
//   Client A = administrator (Computer A / the host)
//   Client B = teammate      (Computer B / a LAN client)
// Two clients against one server is exactly what two computers on a LAN do, so
// this validates the real multi-user workflow: account creation, auth, teams,
// projects, issues, screenshots, assignment, editing, deletion, permissions,
// and backup. Restart-persistence is a separate manual step (see --verify).
//
//   node scripts/acceptance-test.mjs [--url http://localhost:8080]
//
// Run against a FRESH server (no accounts yet). Exit code 0 = all passed.
//
// TLS note: for a self-signed HTTPS server, run with
//   NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/acceptance-test.mjs --url https://localhost:8080

const urlFlag = process.argv.indexOf('--url')
const BASE = (urlFlag !== -1 && process.argv[urlFlag + 1]) || process.env.BUGSTOW_URL || 'http://localhost:8080'

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQGYR54AAAAASUVORK5CYII='

let pass = 0
let fail = 0
function check(cond, label) {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}`)
  }
}

function client() {
  const jar = {}
  return async function req(path, opts = {}) {
    // Browsers always send Origin; better-auth requires it (CSRF protection).
    const headers = { Origin: BASE, ...(opts.headers || {}) }
    const cookie = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    if (cookie) headers.Cookie = cookie
    let body = opts.body
    if (body && typeof body === 'object') {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(body)
    }
    const res = await fetch(BASE + path, { ...opts, body, headers, redirect: 'manual' })
    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const sc of setCookies) {
      const pair = sc.split(';')[0]
      const i = pair.indexOf('=')
      if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1)
    }
    const ct = res.headers.get('content-type') || ''
    let data = null
    if (ct.includes('application/json')) {
      try {
        data = await res.json()
      } catch {
        /* ignore */
      }
    } else {
      data = Buffer.from(await res.arrayBuffer())
    }
    return { status: res.status, data }
  }
}

async function main() {
  console.log(`\nBugstow offline acceptance test → ${BASE}\n`)

  const A = client() // admin / Computer A
  const B = client() // teammate / Computer B

  // ── Health & offline audit ──────────────────────────────────────────────
  const health = await A('/api/health')
  check(health.status === 200 && health.data?.app === 'bugstow-team', 'server health responds')
  check(health.data?.setupComplete === false, 'server is fresh (no accounts yet)')
  const offline = health.data?.offline === true
  console.log(`  · offline mode: ${offline ? 'ON' : 'off'}`)

  // ── Account creation & authentication ────────────────────────────────────
  const adminEmail = `admin+${Date.now()}@lan.local`
  const su = await A('/api/auth/sign-up/email', {
    method: 'POST',
    body: { email: adminEmail, password: 'admin-pass-1234', name: 'Admin A' },
  })
  check(su.status === 200, 'admin account created (first account = admin)')
  const me = await A('/api/teams')
  check(me.status === 200, 'admin session authenticates')

  // ── Team & project ────────────────────────────────────────────────────────
  const team = await A('/api/teams', { method: 'POST', body: { name: 'LAN Team' } })
  const teamId = team.data?.team?.id
  check(!!teamId && team.data.team.role === 'owner', 'admin creates a team (owner)')
  const proj = await A(`/api/projects?teamId=${teamId}`, {
    method: 'POST',
    body: { name: 'Website', color: '#3B82F6' },
  })
  const projectId = proj.data?.project?.id
  check(!!projectId, 'admin creates a project')

  // ── Issue + screenshot ──────────────────────────────────────────────────
  const issue = await A(`/api/issues?teamId=${teamId}`, {
    method: 'POST',
    body: { title: 'Navbar overlaps on mobile', description: 'seen on iPhone', type: 'uiux', projectId },
  })
  const issueId = issue.data?.issue?.id
  check(!!issueId, 'admin creates an issue')
  const shot = await A(`/api/screenshots?issueId=${issueId}`, {
    method: 'POST',
    body: { base64: PNG, mimeType: 'image/png', filename: 'nav.png' },
  })
  const shotId = shot.data?.id
  check(shot.status === 201 && !!shotId, 'admin uploads a screenshot')

  // ── Invite + teammate joins ─────────────────────────────────────────────
  const bobEmail = `bob+${Date.now()}@lan.local`
  const invite = await A(`/api/members?teamId=${teamId}`, {
    method: 'POST',
    body: { email: bobEmail, role: 'member' },
  })
  check(invite.status === 201 && invite.data?.invited === true, 'admin invites teammate by email')
  const bobSignup = await B('/api/auth/sign-up/email', {
    method: 'POST',
    body: { email: bobEmail, password: 'bob-pass-12345', name: 'Bob B' },
  })
  check(bobSignup.status === 200, 'teammate registers (invited) and auto-joins')
  const bobTeams = await B('/api/teams')
  check(
    bobTeams.status === 200 && bobTeams.data?.teams?.some(t => t.id === teamId),
    'teammate sees the shared team (Computer B)'
  )

  // ── Shared data visibility ──────────────────────────────────────────────
  const bobIssues = await B(`/api/issues?teamId=${teamId}`)
  const seen = bobIssues.data?.issues?.find(i => i.id === issueId)
  check(!!seen, 'teammate sees the shared issue')
  check(seen?.screenshot_count === 1, 'teammate sees the screenshot count')
  const bobShot = await B(`/api/screenshots?id=${shotId}`)
  check(bobShot.status === 200 && Buffer.isBuffer(bobShot.data) && bobShot.data.length > 0, 'teammate downloads the screenshot')

  // ── Assignment + editing propagation ────────────────────────────────────
  const members = await A(`/api/members?teamId=${teamId}`)
  const bobId = members.data?.members?.find(m => m.email?.toLowerCase() === bobEmail.toLowerCase())?.user_id
  check(!!bobId, 'admin sees teammate in members list')
  const assign = await A(`/api/issues?id=${issueId}`, { method: 'PATCH', body: { assigneeId: bobId } })
  check(assign.data?.issue?.assignee_id === bobId, 'admin assigns the issue to the teammate')
  const bobSees = await B(`/api/issues?teamId=${teamId}`)
  check(
    bobSees.data?.issues?.find(i => i.id === issueId)?.assignee_id === bobId,
    'teammate sees the assignment'
  )
  const edit = await B(`/api/issues?id=${issueId}`, { method: 'PATCH', body: { status: 'fixed' } })
  check(edit.data?.issue?.status === 'fixed', 'teammate edits the issue (mark fixed)')
  const adminSees = await A(`/api/issues?teamId=${teamId}`)
  check(
    adminSees.data?.issues?.find(i => i.id === issueId)?.status === 'fixed',
    'admin sees the teammate’s edit'
  )

  // ── Permissions / isolation ─────────────────────────────────────────────
  const outsider = client()
  await outsider('/api/auth/sign-up/email', {
    method: 'POST',
    body: { email: `x+${Date.now()}@lan.local`, password: 'x-pass-123456', name: 'X' },
  }).catch(() => {})
  const bobPrivate = await B('/api/teams', { method: 'POST', body: { name: 'Bob Private' } })
  const bobTeamId = bobPrivate.data?.team?.id
  const adminBlocked = await A(`/api/issues?teamId=${bobTeamId}`)
  check(adminBlocked.status === 403, 'admin cannot read a team they are not a member of')

  // ── Deletion ────────────────────────────────────────────────────────────
  const del = await A(`/api/issues?id=${issueId}`, { method: 'DELETE' })
  check(del.status === 200 && del.data?.removed === true, 'admin deletes the issue')
  const afterDel = await B(`/api/issues?teamId=${teamId}`)
  check(!afterDel.data?.issues?.some(i => i.id === issueId), 'teammate no longer sees the deleted issue')

  // ── GitHub import gate ──────────────────────────────────────────────────
  if (offline) {
    const gh = await A('/api/github-import', { method: 'POST', body: { teamId, repo: 'Gr33nOps/bugstow' } })
    check(gh.status === 403, 'GitHub import is refused in offline mode (graceful)')
  }

  // ── Backup ──────────────────────────────────────────────────────────────
  const backup = await A('/api/admin/backup', { method: 'POST' })
  check(backup.status === 201 && backup.data?.ok === true, 'a backup can be created')
  const backups = await A('/api/admin/backups')
  check((backups.data?.backups?.length ?? 0) >= 1, 'backups are listed')

  console.log(`\nResult: ${pass} passed, ${fail} failed\n`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('\nAcceptance test crashed:', err)
  process.exit(2)
})
