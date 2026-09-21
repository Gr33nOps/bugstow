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
  Image,
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

  const screenshotCount = (issue.screenshotIds && issue.screenshotIds.length > 0)
    ? issue.screenshotIds.length
    : (issue.screenshotId ? 1 : 0)

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-all border-b border-slate-100 dark:border-slate-800/80 last:border-0 group select-none relative ${
        selected
          ? 'bg-[#EEF0FF]/80 dark:bg-[#5B50F6]/15 border-l-4 border-l-[#5B50F6] pl-[calc(1.25rem-4px)]'
          : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/60 bg-white dark:bg-slate-900'
      }`}
    >
      {/* Thumbnail or Type Icon */}
      <div className="w-16 h-13 shrink-0 rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
        {screenshotUrl ? (
          <>
            <img
              src={screenshotUrl}
              alt={issue.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {screenshotCount > 1 && (
              <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                +{screenshotCount - 1}
              </span>
            )}
          </>
        ) : (
          <div className="text-slate-400 dark:text-slate-500">
            {issue.type === 'bug' && <Bug size={22} className="text-red-500/80" />}
            {issue.type === 'uiux' && <Layout size={22} className="text-[#5B50F6]/80" />}
            {issue.type === 'idea' && <Lightbulb size={22} className="text-amber-500/80" />}
          </div>
        )}
      </div>

      {/* Main info: Title, Type badge, and description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={`text-[15px] font-semibold truncate ${
              issue.status === 'fixed'
                ? 'line-through text-slate-400 dark:text-slate-500 font-normal'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {issue.title}
          </span>
          <TypeBadge type={issue.type} />
        </div>
        {issue.description ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1 max-w-xl">
            {issue.description}
          </p>
        ) : null}
      </div>

      {/* Project badge (desktop) */}
      <div className="hidden sm:block shrink-0 w-36 text-xs text-slate-500 dark:text-slate-400 truncate">
        {project ? (
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <span className="truncate max-w-[110px]">{project.name}</span>
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 italic">Unassigned</span>
        )}
      </div>

      {/* Timestamp */}
      <div className="shrink-0 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
        {timeAgo(issue.createdAt)}
      </div>

      {/* Quick Action Buttons on Desktop Hover (Linear style) */}
      <div className="hidden md:flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onCopyPrompt}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-[#5B50F6] dark:hover:text-[#7C74FF] hover:bg-[#EEF0FF] dark:hover:bg-[#5B50F6]/20 transition-colors"
          title="Copy Prompt (+ Image)"
        >
          <Copy size={16} />
        </button>

        <button
          type="button"
          onClick={onToggleFixed}
          className={`p-2 rounded-lg transition-colors ${
            issue.status === 'open'
              ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              : 'text-emerald-600 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={issue.status === 'open' ? 'Mark as Fixed' : 'Reopen Issue'}
        >
          {issue.status === 'open' ? <Check size={16} /> : <RotateCcw size={16} />}
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
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <MoreHorizontal size={17} />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-10 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100 text-slate-800 dark:text-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={e => {
                setMenuOpen(false)
                onCopyPrompt(e)
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
            >
              <Copy size={15} className="text-[#5B50F6] dark:text-[#7C74FF]" />
              <span>Copy as Prompt</span>
            </button>

            <button
              type="button"
              onClick={e => {
                setMenuOpen(false)
                onToggleFixed(e)
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
            >
              {issue.status === 'open' ? (
                <>
                  <Check size={15} className="text-emerald-500" />
                  <span>Mark as Fixed</span>
                </>
              ) : (
                <>
                  <RotateCcw size={15} className="text-slate-400" />
                  <span>Reopen Issue</span>
                </>
              )}
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-slate-700" />

            <button
              type="button"
              onClick={e => {
                setMenuOpen(false)
                onDelete(e)
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5"
            >
              <Trash2 size={15} />
              <span>Delete Issue</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
