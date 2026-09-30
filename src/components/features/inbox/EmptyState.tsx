import React from 'react'
import { Plus } from 'lucide-react'
import { shortcut } from '../../../lib/platform'
import { EmptyStateIllustration, BRAND_PRIMARY, GithubMark } from '../../common/Icon'

interface EmptyStateProps {
  heading?: string
  subheading?: string
  actionLabel?: string
  onAction?: () => void
  /** Second way to fill an empty list: bring issues in from GitHub. */
  onImportGithub?: () => void
  showShortcutHint?: boolean
}

export function EmptyState({
  heading = 'A clear place to start',
  subheading = 'Add your first issue or bring in your work from GitHub.',
  actionLabel = 'New issue',
  onAction,
  onImportGithub,
  showShortcutHint = true,
}: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 animate-in fade-in duration-200">
      {/* Tray illustration with sparkle lines */}
      <div className="mb-6">
        <EmptyStateIllustration size={68} color={BRAND_PRIMARY} />
      </div>

      <h3 className="text-[22px] font-semibold text-gray-900 dark:text-white tracking-tight mb-2">{heading}</h3>
      <p className="text-[14px] text-slate-600 dark:text-slate-400 mb-6 max-w-sm leading-relaxed">{subheading}</p>

      {(onAction || onImportGithub) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {onAction && (
            <button
              type="button"
              onClick={onAction}
              className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white bg-brand hover:bg-brand-hover active:bg-brand-hover rounded-lg transition-all shadow-sm active:scale-98"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>{actionLabel}</span>
            </button>
          )}
          {onImportGithub && (
            <button
              type="button"
              onClick={onImportGithub}
              className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <GithubMark size={16} />
              <span>Import from GitHub</span>
            </button>
          )}
        </div>
      )}

      {onAction && showShortcutHint && (
        <p className="hidden md:block text-[12px] text-gray-400 mt-3 font-medium">or press {shortcut('K')}</p>
      )}
    </div>
  )
}
