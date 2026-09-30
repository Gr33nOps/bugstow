import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
import { placeFloatingMenu } from '../../../lib/floatingMenu'

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
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) setMenuPosition(null)
    }
    const closeMenu = () => setMenuPosition(null)
    if (menuPosition) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('resize', closeMenu)
      window.addEventListener('scroll', closeMenu, true)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        window.removeEventListener('resize', closeMenu)
        window.removeEventListener('scroll', closeMenu, true)
      }
    }
  }, [menuPosition])

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
      className={`flex items-center gap-3 @xl:gap-4 px-4 @xl:px-5 py-4 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800/80 last:border-0 group select-none relative outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
        selected
          ? 'bg-brand-soft/80 dark:bg-brand/15 shadow-[inset_2px_0_0_#0f766e]'
          : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/60 bg-white dark:bg-slate-900'
      }`}
    >
      {/* Thumbnail or Type Icon */}
      <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
        {screenshotUrl ? (
          <>
            <img src={screenshotUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            {screenshotCount > 1 && (
              <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs font-semibold px-1.5 py-0.5 rounded-md">
                +{screenshotCount - 1}
              </span>
            )}
          </>
        ) : (
          <div className="text-slate-400 dark:text-slate-500">
            {issue.type === 'bug' && <Bug size={18} className="text-red-500/80" />}
            {issue.type === 'uiux' && <Layout size={18} className="text-brand/80" />}
            {issue.type === 'idea' && <Lightbulb size={18} className="text-amber-500/80" />}
          </div>
        )}
      </div>

      {/* Title, then type / project / time underneath */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${
            issue.status === 'fixed'
              ? 'line-through text-slate-400 dark:text-slate-500 font-normal'
              : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {issue.title}
        </p>
        <div className="flex items-center gap-2 mt-1 min-w-0 text-xs text-slate-500 dark:text-slate-400">
          <TypeBadge type={issue.type} customLabel={issue.customType} />
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
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brand dark:hover:text-brand-light hover:bg-brand-soft dark:hover:bg-brand/20 transition-colors"
          title="Copy for AI"
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
          title={issue.status === 'open' ? 'Mark completed' : 'Reopen Issue'}
        >
          {issue.status === 'open' ? <Check size={16} /> : <RotateCcw size={16} />}
        </button>
      </div>

      {/* Actions menu ••• */}
      <div className="relative shrink-0 ml-1">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={Boolean(menuPosition)}
          onClick={e => {
            e.stopPropagation()
            if (menuPosition) {
              setMenuPosition(null)
              return
            }
            const anchor = e.currentTarget.getBoundingClientRect()
            setMenuPosition(placeFloatingMenu(
              anchor,
              { width: window.innerWidth, height: window.innerHeight },
              { width: 192, height: 154 },
            ))
          }}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <MoreHorizontal size={17} aria-hidden="true" />
        </button>
      </div>

      {menuPosition && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${issue.title}`}
          className="fixed w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1.5 z-[70] animate-in fade-in zoom-in-95 duration-100 text-slate-800 dark:text-slate-200"
          style={menuPosition}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={e => {
              setMenuPosition(null)
              onCopyPrompt(e)
            }}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
          >
            <Copy size={15} className="text-brand dark:text-brand-light" aria-hidden="true" />
            <span>Copy with prompt</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={e => {
              setMenuPosition(null)
              onToggleFixed(e)
            }}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
          >
            {issue.status === 'open' ? (
              <>
                <Check size={15} className="text-emerald-500" aria-hidden="true" />
                <span>Mark completed</span>
              </>
            ) : (
              <>
                <RotateCcw size={15} className="text-slate-400" aria-hidden="true" />
                <span>Reopen issue</span>
              </>
            )}
          </button>

          <div role="separator" className="my-1 border-t border-slate-100 dark:border-slate-700" />

          <button
            type="button"
            role="menuitem"
            onClick={e => {
              setMenuPosition(null)
              onDelete(e)
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5"
          >
            <Trash2 size={15} aria-hidden="true" />
            <span>Delete issue</span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
