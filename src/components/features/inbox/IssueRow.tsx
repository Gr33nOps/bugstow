import React, { useState, useRef, useEffect } from 'react'
import {
  MoreHorizontal,
  Bug,
  Lightbulb,
  Layout,
  Check,
  RotateCcw,
  Copy,
  Trash2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import type { Issue, Project } from '../../../types'
import { TypeBadge, timeAgo } from '../../common/Icon'

interface IssueRowProps {
  issue: Issue
  project?: Project | null
  screenshotUrl?: string
  selected?: boolean
  onClick: () => void
  onToggleFixed: (e: React.MouseEvent) => void
  onCopyPrompt: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}

export function IssueRow({
  issue,
  project,
  screenshotUrl,
  selected = false,
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
      className={`flex items-center gap-3.5 px-4 md:px-5 py-3 cursor-pointer transition-all border-b border-slate-100 last:border-0 group select-none relative ${
        selected
          ? 'bg-[#EEF0FF]/70 border-l-4 border-l-[#5B50F6] pl-[calc(1.25rem-4px)]'
          : 'hover:bg-slate-50/90 bg-white'
      }`}
    >
      {/* Thumbnail or Type Icon */}
      <div className="w-14 h-11 shrink-0 rounded-lg overflow-hidden border border-slate-200/80 bg-slate-100 flex items-center justify-center">
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            alt={issue.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-slate-400">
            {issue.type === 'bug' && <Bug size={18} className="text-red-500/80" />}
            {issue.type === 'uiux' && <Layout size={18} className="text-[#5B50F6]/80" />}
            {issue.type === 'idea' && <Lightbulb size={18} className="text-amber-500/80" />}
          </div>
        )}
      </div>

      {/* Main info: Title, Type badge, and description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[13.5px] font-semibold truncate ${
              issue.status === 'fixed'
                ? 'line-through text-slate-400 font-normal'
                : 'text-slate-900'
            }`}
          >
            {issue.title}
          </span>
          <TypeBadge type={issue.type} />
        </div>
        {issue.description ? (
          <p className="text-[12px] text-slate-400 truncate mt-0.5 max-w-lg">
            {issue.description}
          </p>
        ) : null}
      </div>

      {/* Project badge (desktop) */}
      <div className="hidden sm:block shrink-0 w-32 text-[12px] text-slate-500 truncate">
        {project ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <span className="truncate">{project.name}</span>
          </span>
        ) : (
          <span className="text-slate-300 italic text-[11px]">Unassigned</span>
        )}
      </div>

      {/* Timestamp */}
      <div className="shrink-0 text-[12px] text-slate-400 whitespace-nowrap">
        {timeAgo(issue.createdAt)}
      </div>

      {/* Quick Action Buttons on Desktop Hover (Linear style) */}
      <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onCopyPrompt}
          className="p-1.5 rounded-lg text-slate-500 hover:text-[#5B50F6] hover:bg-[#EEF0FF] transition-colors"
          title="Copy Prompt for AI"
        >
          <Copy size={15} />
        </button>

        <button
          type="button"
          onClick={onToggleFixed}
          className={`p-1.5 rounded-lg transition-colors ${
            issue.status === 'open'
              ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
              : 'text-emerald-600 hover:text-slate-600 hover:bg-slate-100'
          }`}
          title={issue.status === 'open' ? 'Mark as Fixed' : 'Reopen Issue'}
        >
          {issue.status === 'open' ? <Check size={15} /> : <RotateCcw size={15} />}
        </button>
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
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <MoreHorizontal size={16} />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-9 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={e => {
                setMenuOpen(false)
                onCopyPrompt(e)
              }}
              className="w-full text-left px-3.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Copy size={14} className="text-[#5B50F6]" />
              <span>Copy as Prompt</span>
            </button>

            <button
              type="button"
              onClick={e => {
                setMenuOpen(false)
                onToggleFixed(e)
              }}
              className="w-full text-left px-3.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              {issue.status === 'open' ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span>Mark as Fixed</span>
                </>
              ) : (
                <>
                  <RotateCcw size={14} className="text-slate-400" />
                  <span>Reopen Issue</span>
                </>
              )}
            </button>

            <div className="my-1 border-t border-slate-100" />

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
