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

  // The row adapts to the width of the list (a container query), not the
  // window: with the details panel open the list is narrow even on a wide
  // screen, so project and time move under the title instead of squeezing it.
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`flex items-center gap-3 @xl:gap-4 px-4 @xl:px-5 py-3.5 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800/80 last:border-0 group select-none relative outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5B50F6] ${
        selected
          ? 'bg-[#EEF0FF]/80 dark:bg-[#5B50F6]/15 shadow-[inset_4px_0_0_#5B50F6]'
          : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/60 bg-white dark:bg-slate-900'
      }`}
    >
      {/* Thumbnail or Type Icon */}
      <div className="w-14 h-11 @xl:w-16 @xl:h-13 shrink-0 rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
        {screenshotUrl ? (
          <>
            <img src={screenshotUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            {screenshotCount > 1 && (
              <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
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

      {/* Title, then type / project / time underneath */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[15px] font-semibold truncate ${
            issue.status === 'fixed'
              ? 'line-through text-slate-400 dark:text-slate-500 font-normal'
              : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {issue.title}
        </p>
        <div className="flex items-center gap-2 mt-1 min-w-0 text-xs text-slate-500 dark:text-slate-400">
          <TypeBadge type={issue.type} />
          <span className="@xl:hidden flex items-center gap-2 min-w-0">
            <span aria-hidden="true">·</span>
            {project ? (
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
            <span className="truncate">{project.name}</span>
          </span>
        ) : (
          <span className="italic">Unassigned</span>
        )}
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{timeAgo(issue.createdAt)}</span>
          </span>
          {issue.description ? (
            <span className="hidden @xl:block truncate">{issue.description}</span>
          ) : null}
        </div>
      </div>

      {/* Project (wide list only) */}
      <div className="hidden @xl:block shrink-0 w-36 text-xs text-slate-500 dark:text-slate-400 truncate">
        {project ? (
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 max-w-full">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
            <span className="truncate">{project.name}</span>
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 italic">Unassigned</span>
        )}
      </div>

      {/* Timestamp (wide list only) */}
      <div className="hidden @xl:block shrink-0 w-16 text-right text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
        {timeAgo(issue.createdAt)}
      </div>

      {/* Quick Action Buttons on Desktop Hover (Linear style) */}
      <div className="hidden @3xl:flex items-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
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
