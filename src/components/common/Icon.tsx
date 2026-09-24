import React from 'react'
import type { IssueType } from '../../types'

export const BRAND_PRIMARY = '#5B50F6'
export const BRAND_PRIMARY_HOVER = '#4E44E6'
export const BRAND_BG_TINT = '#F0F2FE'

/**
 * Exact Bugstow Logo Icon matching Figma design
 */
export function BugstowLogoIcon({ size = 24, className = '', color = BRAND_PRIMARY }: { size?: number; className?: string; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Inbox tray with front opening */}
      <path
        d="M4 8L6.2 3.8C6.56 3.32 7.12 3 7.72 3H16.28C16.88 3 17.44 3.32 17.8 3.8L20 8M4 8V18C4 19.66 5.34 21 7 21H17C18.66 21 20 19.66 20 18V8M4 8H9L10.5 11.5C10.8 12.2 11.4 12.6 12 12.6C12.6 12.6 13.2 12.2 13.5 11.5L15 8H20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Empty State Tray Illustration with radiant sparkle/burst lines from bugstow_01_empty_state.png
 */
/** GitHub's mark (Octicons "mark-github", MIT), so "Import from GitHub" is recognizable at a glance. */
export function GithubMark({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}

export function EmptyStateIllustration({ size = 64, color = BRAND_PRIMARY }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block"
    >
      {/* 3 Radiant lines above tray */}
      <path d="M32 8V16" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M20 12L25 18" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M44 12L39 18" stroke={color} strokeWidth="3" strokeLinecap="round" />

      {/* Main Inbox Tray */}
      <path
        d="M23.6 24H40.4C42.1 24 43.6 25.1 44.2 26.7L48 37V48C48 51.3 45.3 54 42 54H22C18.7 54 16 51.3 16 48V37L19.8 26.7C20.4 25.1 21.9 24 23.6 24Z"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center notch / opening */}
      <path
        d="M16 38H25L28.2 44.4C28.8 45.4 30 46 32 46C34 46 35.2 45.4 35.8 44.4L39 38H48"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Exact Type Badge matching Figma
 */
export function TypeBadge({ type }: { type: IssueType }) {
  if (type === 'bug') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#FEECEB] text-[#F04438]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F04438]" />
        Bug
      </span>
    )
  }
  if (type === 'uiux') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#EEF0FF] text-[#5B50F6]">
        UI/UX
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#FEF6EE] text-[#F79009]">
      Idea
    </span>
  )
}

/**
 * Relative time formatter
 */
export function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
