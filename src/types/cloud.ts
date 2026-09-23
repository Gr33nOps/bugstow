import type { IssueType, IssueStatus } from './index'

export type MemberRole = 'owner' | 'admin' | 'member'

export interface Team {
  id: string
  name: string
  role: MemberRole
  member_count: number
  created_at: string
}

export interface TeamMember {
  user_id: string
  role: MemberRole
  name: string | null
  email: string | null
}

export interface TeamInvite {
  id: string
  email: string
  role: 'admin' | 'member'
  created_at: string
}

export interface CloudProject {
  id: string
  team_id: string
  name: string
  description: string | null
  color: string
  created_at: string
  updated_at: string
}

export interface CloudIssue {
  id: string
  team_id: string
  project_id: string | null
  title: string
  description: string
  type: IssueType
  status: IssueStatus
  assignee_id: string | null
  created_by: string
  github_url: string | null
  github_number: number | null
  created_at: string
  updated_at: string
  project_name: string | null
  assignee_name: string | null
  assignee_email: string | null
  screenshot_count: number
  screenshot_ids: string[]
}

export interface CurrentUser {
  id: string
  email: string | null
  name: string | null
  /** The first account on this server; can reset passwords and run backups. */
  isServerAdmin: boolean
  /** Set after an admin password reset until the user picks a new password. */
  mustChangePassword: boolean
}
