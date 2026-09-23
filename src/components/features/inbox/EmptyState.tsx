import React from 'react'
import { Plus } from 'lucide-react'
import { shortcut } from '../../../lib/platform'
import { EmptyStateIllustration, BRAND_PRIMARY } from '../../common/Icon'

interface EmptyStateProps {
  heading?: string
  subheading?: string
  actionLabel?: string
  onAction?: () => void
  showShortcutHint?: boolean
}

export function EmptyState({
  heading = 'Nothing to fix. Yet.',
  subheading = 'Capture bugs, feedback or ideas while you build.',
  actionLabel = 'Capture Issue',
  onAction,
  showShortcutHint = true,
}: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 animate-in fade-in duration-200">
      {/* Tray illustration with sparkle lines */}
      <div className="mb-6">
        <EmptyStateIllustration size={68} color={BRAND_PRIMARY} />
      </div>

      <h3 className="text-[22px] font-bold text-gray-900 tracking-tight mb-2">{heading}</h3>
      <p className="text-[14px] text-gray-400 mb-6 max-w-sm leading-relaxed">{subheading}</p>

      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl transition-all shadow-sm active:scale-98"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>{actionLabel}</span>
        </button>
      )}

      {onAction && showShortcutHint && (
        <p className="hidden md:block text-[12px] text-gray-400 mt-3 font-medium">or press {shortcut('K')}</p>
      )}
    </div>
  )
}
