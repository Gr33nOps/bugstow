import { APP_VERSION } from '../../version'
import React, { useEffect } from 'react'
import { X, Check, AlertCircle, Shield, Keyboard } from 'lucide-react'

// ── Toasts ───────────────────────────────────────────────────────────────

export interface ToastMessage {
  id: string
  text: string
  type?: 'success' | 'error' | 'info'
}

export function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[200] pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="flex items-center gap-2.5 bg-slate-900/95 dark:bg-slate-800/95 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-slate-800 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {t.type === 'error' ? (
            <AlertCircle size={16} className="text-red-400 shrink-0" />
          ) : (
            <Check size={16} className="text-emerald-400 shrink-0" />
          )}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Confirm Modal ─────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  isDestructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 select-none">
      <div className="absolute inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-xs transition-opacity" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 sm:p-7 overflow-hidden animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-colors shadow-xs ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#5B50F6] hover:bg-[#4E44E6]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Image Fullscreen Modal ────────────────────────────────────────────────

export function ImageFullModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 select-none"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close image preview"
        onClick={onClose}
        className="absolute top-5 right-5 w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt="Screenshot Full Preview"
        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl cursor-default"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// ── Keyboard Shortcuts Modal ──────────────────────────────────────────────

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const shortcuts = [
    { key: '⌘ K / Ctrl+K', desc: 'Capture New Issue' },
    { key: '⌘ B / Ctrl+B', desc: 'Toggle Sidebar Expand/Collapse' },
    { key: 'Ctrl+V / ⌘ V', desc: 'Paste screenshot from clipboard anywhere' },
    { key: '/', desc: 'Focus global search input' },
    { key: 'Esc', desc: 'Close dialogs, drawer, lightbox or details panel' },
    { key: '?', desc: 'Show keyboard shortcuts' },
  ]

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 select-none">
      <div className="absolute inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 sm:p-7 animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Keyboard size={20} className="text-[#5B50F6]" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Keyboard Shortcuts</h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {shortcuts.map((s, i) => (
            <div key={i} className="py-3 flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">{s.desc}</span>
              <kbd className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── About Bugstow Modal ───────────────────────────────────────────────────

export function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 select-none">
      <div className="absolute inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm p-6 sm:p-7 text-center animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
        >
          <X size={16} />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-[#EEF0FF] dark:bg-indigo-950/60 text-[#5B50F6] flex items-center justify-center mx-auto mb-3.5 mt-1 shadow-xs">
          <Shield size={28} />
        </div>

        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">bugstow.</h3>
        <p className="text-sm font-semibold text-[#5B50F6] mt-0.5">Spot it. Stow it. Fix it.</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 font-mono">Version {APP_VERSION} · Personal mode</p>

        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-600 dark:text-slate-300 text-left leading-relaxed mb-6">
          In Personal mode your projects, issues and screenshots stay in this browser (IndexedDB). BugsTow does not
          need an account or a backend for Personal mode and includes no analytics or telemetry. Browser storage is
          not encrypted on disk; exported backups can be.
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl transition-colors shadow-xs"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
