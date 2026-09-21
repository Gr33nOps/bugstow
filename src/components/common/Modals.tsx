import React, { useEffect } from 'react'
import { X, Check, AlertCircle, Shield, Keyboard } from 'lucide-react'
import { BRAND_PRIMARY } from './Icon'

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
          className="flex items-center gap-2.5 bg-gray-900/95 text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-xl backdrop-blur-sm border border-gray-800 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {t.type === 'error' ? (
            <AlertCircle size={15} className="text-red-400 shrink-0" />
          ) : (
            <Check size={15} className="text-emerald-400 shrink-0" />
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
  description: string
  confirmLabel: string
  cancelLabel?: string
  isDestructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  description,
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 overflow-hidden animate-in zoom-in-95 duration-150">
        <h3 className="text-[16px] font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-6">{description}</p>
        <div className="flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-[13px] font-semibold rounded-xl text-white transition-colors ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 shadow-sm'
                : 'bg-[#5B50F6] hover:bg-[#4E44E6] shadow-sm'
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
      className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 select-none"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close image preview"
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
      >
        <X size={18} />
      </button>
      <img
        src={src}
        alt="Screenshot Full Preview"
        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl cursor-default"
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
    { key: 'Esc', desc: 'Close dialogs, drawer, or details' },
    { key: 'Ctrl+V / ⌘ V', desc: 'Paste screenshot from clipboard' },
  ]

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[#5B50F6]" />
            <h3 className="text-[16px] font-semibold text-gray-900">Keyboard Shortcuts</h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            <X size={15} />
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {shortcuts.map((s, i) => (
            <div key={i} className="py-2.5 flex items-center justify-between text-[13px]">
              <span className="text-gray-600">{s.desc}</span>
              <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded-md font-mono text-[11px] text-gray-800">
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-150">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
        >
          <X size={15} />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-[#EEF0FF] text-[#5B50F6] flex items-center justify-center mx-auto mb-3 mt-1">
          <Shield size={24} />
        </div>

        <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">bugstow.</h3>
        <p className="text-[13px] font-medium text-[#5B50F6] mt-0.5">Spot it. Stow it. Fix it.</p>
        <p className="text-[12px] text-gray-400 mt-1 mb-4">Version 1.0.0 (Local-First)</p>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-[12px] text-gray-600 text-left leading-relaxed mb-5">
          Bugstow stores 100% of your issues, screenshots, and projects locally in your browser's IndexedDB. No telemetry, no accounts, and no data uploaded to any server.
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl transition-colors shadow-sm"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
