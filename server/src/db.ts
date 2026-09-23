import Database from 'better-sqlite3'
import { config } from './config.ts'

/**
 * Single better-sqlite3 connection shared by better-auth and the application
 * tables. Synchronous, fast, and file-backed under the data volume.
 */
export const db = new Database(config.dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
// Wait instead of failing if another process (e.g. the reset-password command)
// holds a write lock briefly.
db.pragma('busy_timeout = 5000')

/** Create the application tables (better-auth manages its own tables). */
export function migrateAppSchema(): void {
  db.exec(`
    create table if not exists teams (
      id text primary key,
      name text not null,
      created_by text not null,
      created_at text not null
    );

    create table if not exists team_members (
      team_id text not null references teams(id) on delete cascade,
      user_id text not null,
      role text not null default 'member' check (role in ('owner','admin','member')),
      created_at text not null,
      primary key (team_id, user_id)
    );
    create index if not exists team_members_user_idx on team_members(user_id);

    create table if not exists team_invites (
      id text primary key,
      team_id text not null references teams(id) on delete cascade,
      email text not null,
      role text not null default 'member' check (role in ('admin','member')),
      token text not null unique,
      invited_by text not null,
      created_at text not null,
      accepted_at text
    );
    create index if not exists team_invites_team_idx on team_invites(team_id);
    create index if not exists team_invites_email_idx on team_invites(email);

    create table if not exists projects (
      id text primary key,
      team_id text not null references teams(id) on delete cascade,
      name text not null,
      description text,
      color text not null default '#5B50F6',
      created_at text not null,
      updated_at text not null
    );
    create index if not exists projects_team_idx on projects(team_id);

    create table if not exists issues (
      id text primary key,
      team_id text not null references teams(id) on delete cascade,
      project_id text references projects(id) on delete set null,
      title text not null,
      description text not null default '',
      type text not null default 'bug' check (type in ('bug','uiux','idea')),
      status text not null default 'open' check (status in ('open','fixed')),
      assignee_id text,
      created_by text not null,
      github_url text,
      github_number integer,
      created_at text not null,
      updated_at text not null
    );
    create index if not exists issues_team_idx on issues(team_id);
    create index if not exists issues_project_idx on issues(project_id);
    create index if not exists issues_status_idx on issues(status);
    create unique index if not exists issues_team_github_idx
      on issues(team_id, github_number) where github_number is not null;

    create table if not exists screenshots (
      id text primary key,
      issue_id text not null references issues(id) on delete cascade,
      team_id text not null references teams(id) on delete cascade,
      mime_type text not null default 'image/png',
      filename text,
      storage_path text not null,
      created_at text not null
    );
    create index if not exists screenshots_issue_idx on screenshots(issue_id);

    create table if not exists server_settings (
      key text primary key,
      value text not null
    );

    create table if not exists user_flags (
      user_id text primary key,
      must_change_password integer not null default 0,
      updated_at text not null
    );
  `)
}

/** Number of registered users (via better-auth's `user` table). Used for setup state. */
export function userCount(): number {
  try {
    const row = db.prepare('select count(*) as n from user').get() as { n: number } | undefined
    return row?.n ?? 0
  } catch {
    // `user` table may not exist until better-auth migrations run.
    return 0
  }
}

export interface DbUser {
  id: string
  name: string | null
  email: string | null
}

export function getUserById(id: string): DbUser | undefined {
  try {
    return db.prepare('select id, name, email from user where id = ?').get(id) as DbUser | undefined
  } catch {
    return undefined
  }
}

export function getUserByEmail(email: string): DbUser | undefined {
  try {
    return db
      .prepare('select id, name, email from user where lower(email) = lower(?)')
      .get(email) as DbUser | undefined
  } catch {
    return undefined
  }
}

/** Invites expire so a stale, unclaimed invite can't be used later. */
export const INVITE_TTL_DAYS = 7

export function inviteCutoff(): string {
  return new Date(Date.now() - INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

/** Whether a pending, unexpired invite exists for an email (used to gate sign-up). */
export function hasPendingInvite(email: string): boolean {
  const row = db
    .prepare(
      'select 1 from team_invites where lower(email) = lower(?) and accepted_at is null and created_at > ? limit 1'
    )
    .get(email, inviteCutoff())
  return Boolean(row)
}

/** When a user registers, add them to any teams they were invited to. */
export function acceptInvitesForEmail(userId: string, email: string): void {
  const now = new Date().toISOString()
  const invites = db
    .prepare(
      'select id, team_id, role from team_invites where lower(email) = lower(?) and accepted_at is null and created_at > ?'
    )
    .all(email, inviteCutoff()) as Array<{ id: string; team_id: string; role: string }>
  const addMember = db.prepare(
    'insert or ignore into team_members (team_id, user_id, role, created_at) values (?, ?, ?, ?)'
  )
  const markAccepted = db.prepare('update team_invites set accepted_at = ? where id = ?')
  const tx = db.transaction(() => {
    for (const inv of invites) {
      addMember.run(inv.team_id, userId, inv.role, now)
      markAccepted.run(now, inv.id)
    }
  })
  tx()
}

// ── Server administrator ─────────────────────────────────────────────────────
// The first account ever registered is the server administrator. It is
// recorded explicitly; installs from before this was recorded fall back to the
// earliest account.

export function getServerAdminId(): string | null {
  const row = db.prepare("select value from server_settings where key = 'admin_user_id'").get() as
    | { value: string }
    | undefined
  if (row) return row.value
  try {
    const first = db.prepare('select id from user order by createdAt asc limit 1').get() as { id: string } | undefined
    if (first) {
      setServerAdmin(first.id)
      return first.id
    }
  } catch {
    // user table not created yet
  }
  return null
}

export function setServerAdmin(userId: string): void {
  db.prepare(
    "insert into server_settings (key, value) values ('admin_user_id', ?) on conflict(key) do update set value = excluded.value"
  ).run(userId)
}

export function isServerAdmin(userId: string): boolean {
  return getServerAdminId() === userId
}

// ── Forced password change after an admin reset ─────────────────────────────

export function setMustChangePassword(userId: string, value: boolean): void {
  db.prepare(
    `insert into user_flags (user_id, must_change_password, updated_at) values (?, ?, ?)
     on conflict(user_id) do update set must_change_password = excluded.must_change_password,
       updated_at = excluded.updated_at`
  ).run(userId, value ? 1 : 0, new Date().toISOString())
}

export function mustChangePassword(userId: string): boolean {
  const row = db.prepare('select must_change_password as m from user_flags where user_id = ?').get(userId) as
    | { m: number }
    | undefined
  return row?.m === 1
}
