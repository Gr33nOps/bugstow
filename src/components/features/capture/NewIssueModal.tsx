import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Image as ImageIcon, ChevronDown, Folder, AlertCircle } from 'lucide-react'
import type { Project, IssueType } from '../../../types'
import { BRAND_PRIMARY } from '../../common/Icon'

interface NewIssueModalProps {
  projects: Project[]
  defaultProjectId: string | null
  onSave: (
    data: {
      title: string
      description: string
      projectId: string | null
      type: IssueType
    },
    screenshotBlob?: Blob | null,
    filename?: string
  ) => Promise<void>
  onClose: () => void
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function NewIssueModal({
  projects,
  defaultProjectId,
  onSave,
  onClose,
}: NewIssueModalProps) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId)
  const [type, setType] = useState<IssueType>('bug')
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState<string | undefined>()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clean up preview object URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const processFile = (file: File) => {
    setValidationError(null)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setValidationError('Unsupported format. Please upload a PNG, JPG, or WEBP image.')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError('File is too large. Maximum size is 10 MB.')
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const newUrl = URL.createObjectURL(file)
    setPreviewUrl(newUrl)
    setScreenshotBlob(file)
    setFilename(file.name)
  }

  // Paste handler
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (imageItem) {
      const file = imageItem.getAsFile()
      if (file) {
        e.preventDefault()
        processFile(file)
      }
    }
  }, [previewUrl])

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

  const handleRemoveScreenshot = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setScreenshotBlob(null)
    setFilename(undefined)
    setValidationError(null)
  }

  const handleSave = async () => {
    if (!title.trim() || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await onSave(
        {
          title: title.trim(),
          description: desc.trim(),
          projectId,
          type,
        },
        screenshotBlob,
        filename
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-xs" onClick={() => !isSaving && onClose()} />

      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-[460px] p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-gray-900">New Issue</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Storage error banner (preserves input) */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1">
              <p className="font-semibold">Unable to save</p>
              <p className="text-[12px] text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Validation error */}
        {validationError && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800">
            <AlertCircle size={14} className="shrink-0 text-amber-600" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Screenshot Dropzone */}
        <div
          className="border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/70 p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors relative"
          onClick={() => fileInputRef.current?.click()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) processFile(file)
          }}
          onDragOver={e => e.preventDefault()}
        >
          <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-gray-100 flex items-center justify-center">
            <ImageIcon size={18} className="text-gray-500" />
          </div>
          <p className="text-[13px] font-medium text-gray-700 text-center">
            Paste, drag or click to add a screenshot
          </p>
          <p className="text-[11px] text-gray-400">PNG, JPG, WEBP (max 10MB)</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) processFile(file)
          }}
        />

        {/* Attached thumbnail preview */}
        {previewUrl && (
          <div className="relative inline-block self-start rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs">
            <img src={previewUrl} alt="Attached preview" className="w-20 h-20 object-cover" />
            <button
              type="button"
              aria-label="Remove screenshot"
              onClick={e => {
                e.stopPropagation()
                handleRemoveScreenshot()
              }}
              className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Title input */}
        <div>
          <input
            autoFocus
            type="text"
            placeholder="What's not working?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSave()
              }
            }}
            className="w-full px-3.5 py-2.5 text-[14px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#5B50F6] focus:ring-2 focus:ring-[#5B50F6]/15 transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Description textarea */}
        <div>
          <textarea
            placeholder="Add a little context..."
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 text-[14px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#5B50F6] focus:ring-2 focus:ring-[#5B50F6]/15 transition-all resize-none placeholder:text-gray-400 leading-relaxed"
          />
        </div>

        {/* Project & Type selectors */}
        <div className="flex gap-3">
          {/* Project dropdown */}
          <div className="relative flex-1">
            <select
              value={projectId || ''}
              onChange={e => setProjectId(e.target.value || null)}
              className="w-full appearance-none px-3.5 py-2.5 text-[13px] font-medium border border-gray-200 rounded-xl bg-white text-gray-800 focus:outline-none focus:border-[#5B50F6] transition-colors pr-8 cursor-pointer"
            >
              <option value="">No Project (Unassigned)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  📁 {p.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Type dropdown */}
          <div className="relative flex-1">
            <select
              value={type}
              onChange={e => setType(e.target.value as IssueType)}
              className="w-full appearance-none px-3.5 py-2.5 text-[13px] font-medium border border-gray-200 rounded-xl bg-white text-gray-800 focus:outline-none focus:border-[#5B50F6] transition-colors pr-8 cursor-pointer"
            >
              <option value="bug">🔴 Bug</option>
              <option value="uiux">🟣 UI/UX</option>
              <option value="idea">🟡 Idea</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-2.5 text-[13px] font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl disabled:opacity-40 transition-all shadow-sm flex items-center justify-center gap-1.5"
          >
            {isSaving ? 'Saving...' : 'Save Issue'}
          </button>
        </div>
      </div>
    </div>
  )
}
