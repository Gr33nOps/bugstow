import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Image as ImageIcon, ChevronDown, AlertCircle, Plus } from 'lucide-react'
import type { Project, IssueType } from '../../../types'

interface AttachedScreenshot {
  id: string
  blob: Blob
  previewUrl: string
  filename: string
}

interface NewIssueModalProps {
  projects: Project[]
  defaultProjectId: string | null
  initialFile?: File | null
  onSave: (
    data: {
      title: string
      description: string
      projectId: string | null
      type: IssueType
    },
    screenshotBlob?: Blob | null,
    filename?: string,
    additionalBlobs?: Array<{ blob: Blob; filename?: string }>
  ) => Promise<void>
  onClose: () => void
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function NewIssueModal({
  projects,
  defaultProjectId,
  initialFile,
  onSave,
  onClose,
}: NewIssueModalProps) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId)
  const [type, setType] = useState<IssueType>('bug')
  const [screenshots, setScreenshots] = useState<AttachedScreenshot[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const screenshotsRef = useRef<AttachedScreenshot[]>([])
  screenshotsRef.current = screenshots

  const addFiles = useCallback((files: FileList | File[]) => {
    setValidationError(null)
    const newItems: AttachedScreenshot[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setValidationError('Unsupported format. Please upload PNG, JPG, or WEBP images.')
        continue
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setValidationError(`"${file.name}" exceeds maximum size of 10 MB.`)
        continue
      }
      const previewUrl = URL.createObjectURL(file)
      newItems.push({
        id: Math.random().toString(36).slice(2, 9),
        blob: file,
        previewUrl,
        filename: file.name || `screenshot-${Date.now()}.png`,
      })
    }

    if (newItems.length > 0) {
      setScreenshots(prev => [...prev, ...newItems])
    }
  }, [])

  // Process initial pasted file if provided
  useEffect(() => {
    if (initialFile) {
      addFiles([initialFile])
    }
  }, [initialFile, addFiles])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      screenshotsRef.current.forEach(s => URL.revokeObjectURL(s.previewUrl))
    }
  }, [])

  // Paste handler inside modal
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageFiles: File[] = []
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault()
      addFiles(imageFiles)
    }
  }, [addFiles])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isSaving])

  const handleRemoveScreenshot = (id: string) => {
    setScreenshots(prev => {
      const target = prev.find(s => s.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter(s => s.id !== id)
    })
    setValidationError(null)
  }

  const handleSave = async () => {
    if (!title.trim() || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const first = screenshots[0]
      const additionalBlobs = screenshots.slice(1).map(s => ({
        blob: s.blob,
        filename: s.filename,
      }))

      await onSave(
        {
          title: title.trim(),
          description: desc.trim(),
          projectId,
          type,
        },
        first ? first.blob : null,
        first ? first.filename : undefined,
        additionalBlobs.length > 0 ? additionalBlobs : undefined
      )
      onClose()
    } catch (err) {
      console.error('Failed to save issue:', err)
      setError(err instanceof Error ? err.message : 'Storage failed. Your input has been preserved. Please retry.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none">
      <div
        className="absolute inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={() => !isSaving && onClose()}
      />

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-[540px] p-6 sm:p-7 flex flex-col gap-4.5 animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Capture Issue</h2>
            <p className="text-xs text-slate-400 mt-0.5">Spot it. Stow it. Fix it with AI later.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={isSaving}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Storage error banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-300">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1">
              <p className="font-semibold">Unable to save</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Validation error */}
        {validationError && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Screenshot Dropzone */}
        <div
          className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#5B50F6] hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors relative group"
          onClick={() => fileInputRef.current?.click()}
          onDrop={e => {
            e.preventDefault()
            if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
          }}
          onDragOver={e => e.preventDefault()}
        >
          <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-700 shadow-xs border border-slate-100 dark:border-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <ImageIcon size={20} className="text-[#5B50F6]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Paste (Ctrl+V), drag or click to add screenshots
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Supports multiple PNG, JPG, or WEBP images (max 10MB each)
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={e => {
            if (e.target.files) addFiles(e.target.files)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        />

        {/* Attached thumbnails gallery */}
        {screenshots.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider">
                Attached Images ({screenshots.length})
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[#5B50F6] hover:underline flex items-center gap-1 font-medium"
              >
                <Plus size={13} />
                <span>Add more</span>
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {screenshots.map((s, idx) => (
                <div
                  key={s.id}
                  className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-video shadow-xs group"
                >
                  <img src={s.previewUrl} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remove screenshot"
                    onClick={e => {
                      e.stopPropagation()
                      handleRemoveScreenshot(s.id)
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <X size={12} />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.2 rounded font-mono">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Title input */}
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
            Issue Title <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            type="text"
            placeholder="What's not working? e.g. Navigation bar overflows on mobile"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSave()
              }
            }}
            className="w-full px-4 py-3 text-[15px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] focus:ring-2 focus:ring-[#5B50F6]/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
          />
        </div>

        {/* Description textarea */}
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
            Context & Details
          </label>
          <textarea
            placeholder="Add a little context, steps to reproduce, or expected behavior..."
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] focus:ring-2 focus:ring-[#5B50F6]/20 transition-all resize-y placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white leading-relaxed"
          />
        </div>

        {/* Project & Type selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Project dropdown */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
              Project
            </label>
            <div className="relative">
              <select
                value={projectId || ''}
                onChange={e => setProjectId(e.target.value || null)}
                className="w-full appearance-none px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5B50F6] transition-colors pr-9 cursor-pointer"
              >
                <option value="">No Project (Unassigned)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    📁 {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Type dropdown */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
              Issue Type
            </label>
            <div className="relative">
              <select
                value={type}
                onChange={e => setType(e.target.value as IssueType)}
                className="w-full appearance-none px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5B50F6] transition-colors pr-9 cursor-pointer"
              >
                <option value="bug">🔴 Bug (Problem or malfunction)</option>
                <option value="uiux">🟣 UI/UX (Design or visual polish)</option>
                <option value="idea">🟡 Idea (Feature or enhancement)</option>
              </select>
              <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="flex-1 py-3 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl disabled:opacity-40 transition-all shadow-sm flex items-center justify-center gap-2 active:scale-98"
          >
            {isSaving ? 'Saving...' : 'Save Issue'}
          </button>
        </div>
      </div>
    </div>
  )
}
