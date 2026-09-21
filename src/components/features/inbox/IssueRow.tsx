import React, { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Bug, Lightbulb, Layout, Check, RotateCcw, Copy, Trash2 } from 'lucide-react'
import type { Issue, Project } from '../../../types'
import { TypeBadge, timeAgo } from '../../common/Icon'

interface IssueRowProps {
  issue: Issue
  project?: Project | null
  screenshotUrl?: string
  onClick: () => void
  onToggleFixed: (e: React.MouseEvent) => void
  onCopyPrompt: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}

export function IssueRow({
  issue,
  project,
  screenshotUrl,
  onClick,
  onToggleFixed,
  onCopyPrompt,
  onDelete,
}: IssueRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3.5 px-4 md:px-5 py-3.5 hover:bg-gray-50/80 cursor-pointer transition-colors border-b border-gray-100 last:border-0 group select-none"
    >
      {/* Thumbnail */}
      <div className="w-16 h-13 shrink-0 rounded-xl overflow-hidden border border-gray-200/70 bg-gray-50 flex items-center justify-center">
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            alt={issue.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-gray-300">
            {issue.type === 'bug' && <Bug size={20} />}
            {issue.type === 'uiux' && <Layout size={20} />}
            {issue.type === 'idea' && <Lightbulb size={20} />}
          </div>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold text-gray-900 truncate">
            {issue.title}
          </span>
          <TypeBadge type={issue.type} />
        </div>
        {issue.description ? (
          <p className="text-[12px] text-gray-400 truncate mt-0.5 max-w-md">
            {issue.description}
          </p>
        ) : null}
      </div>

      {/* Project info (desktop) */}
      <div className="hidden sm:block shrink-0 w-28 text-[13px] text-gray-500 truncate">
        {project ? project.name : <span className="text-gray-300 italic">Unassigned</span>}
      </div>

      {/* Timestamp */}
      <div className="shrink-0 text-[13px] text-gray-400 whitespace-nowrap">
        {timeAgo(issue.createdAt)}
      </div>

      {/* Actions menu ••• */}
      <div className="relative shrink-0 ml-1" ref={menuRef}>
        <button
          type="button"
          aria-label="More actions"
          onClick={e => {
            e.stopPropagation()
            setMenuOpen(prev => !prev)
          }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <MoreHorizontal size={16} />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-9 w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={e => {
                setMenuOpen(false)
                onCopyPrompt(e)
              }}
              className="w-full text-left px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Copy size={14} className="text-gray-400" />
              <span>Copy as Prompt</span>
            </button>

            <button
              type="button"
              onClick={e => {
                setMenuOpen(false)
                onToggleFixed(e)
              }}
              className="w-full text-left px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              {issue.status === 'open' ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span>Mark as Fixed</span>
                </>
              ) : (
                <>
                  <RotateCcw size={14} className="text-gray-400" />
                  <span>Reopen Issue</span>
                </>
              )}
            </button>

            <div className="my-1 border-t border-gray-100" />

            <button
              type="button"
              onClick={e => {
                setMenuOpen(false)
                onDelete(e)
              }}
              className="w-full text-left px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 size={14} />
              <span>Delete Issue</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
