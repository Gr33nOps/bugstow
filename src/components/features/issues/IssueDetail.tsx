import React, { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  MoreHorizontal,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Edit3,
  X,
  Upload,
  ChevronDown,
  AlertCircle,
  ZoomIn,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Plus,
} from 'lucide-react'
import type { Issue, Project, IssueType } from '../../../types'
import { TypeBadge, timeAgo, BRAND_PRIMARY } from '../../common/Icon'
import {
  copyPromptToClipboard,
  copyScreenshotImageToClipboard,
  copyPromptAndImageToClipboard,
} from '../../../services/promptService'

interface IssueDetailProps {
  issue: Issue
  project?: Project | null
  projects: Project[]
  screenshotUrl?: string
  screenshotUrls?: Record<string, string>
  getScreenshotBlob?: (id: string) => Promise<Blob | undefined>
  onBack: () => void
  onToggleFixed: () => void
  onCopyPrompt: () => void
  onDelete: () => void
  onUpdate: (
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>,
    newScreenshotBlob?: Blob | null,
    filename?: string
  ) => Promise<void>
  onUpdateScreenshots?: (
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>,
    options?: {
      keepScreenshotIds?: string[]
      newScreenshots?: Array<{ blob: Blob; filename?: string }>
    }
  ) => Promise<void>
  onZoomScreenshot: (url: string) => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function IssueDetail({
  issue,
  project,
  projects,
  screenshotUrl,
  screenshotUrls = {},
  getScreenshotBlob,
  onBack,
  onToggleFixed,
  onCopyPrompt,
  onDelete,
  onUpdate,
  onUpdateScreenshots,
  onZoomScreenshot,
  onToast,
}: IssueDetailProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit form state
  const [editTitle, setEditTitle] = useState(issue.title)
  const [editDesc, setEditDesc] = useState(issue.description)
  const [editProject, setEditProject] = useState<string | null>(issue.projectId)
  const [editType, setEditType] = useState<IssueType>(issue.type)

  // Multi-image edit state
  const [keepScreenshotIds, setKeepScreenshotIds] = useState<string[]>([])
  const [newScreenshotsToAdd, setNewScreenshotsToAdd] = useState<Array<{ blob: Blob; previewUrl: string; filename: string }>>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Active screenshot IDs for read mode
  const currentScreenshotIds = (issue.screenshotIds && issue.screenshotIds.length > 0)
    ? issue.screenshotIds
    : (issue.screenshotId ? [issue.screenshotId] : [])

  // Reset edit state when issue changes
  useEffect(() => {
    setEditTitle(issue.title)
    setEditDesc(issue.description)
    setEditProject(issue.projectId)
    setEditType(issue.type)
    setKeepScreenshotIds(currentScreenshotIds)
    // Revoke object URLs for added previews
    newScreenshotsToAdd.forEach(s => URL.revokeObjectURL(s.previewUrl))
    setNewScreenshotsToAdd([])
    setIsEditing(false)
    setError(null)
  }, [issue.id])

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

  // Paste support inside edit mode to add more images
  useEffect(() => {
    if (!isEditing) return

    const handleEditPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || [])
      const imageItem = items.find(i => i.type.startsWith('image/'))
      if (imageItem) {
        const file = imageItem.getAsFile()
        if (file) {
          e.preventDefault()
          const previewUrl = URL.createObjectURL(file)
          setNewScreenshotsToAdd(prev => [
            ...prev,
            { blob: file, previewUrl, filename: file.name || `pasted-${Date.now()}.png` }
          ])
          onToast?.('Image pasted and attached!')
        }
      }
    }

    window.addEventListener('paste', handleEditPaste)
    return () => window.removeEventListener('paste', handleEditPaste)
  }, [isEditing, onToast])

  const handleStartEdit = () => {
    setEditTitle(issue.title)
    setEditDesc(issue.description)
    setEditProject(issue.projectId)
    setEditType(issue.type)
    setKeepScreenshotIds(currentScreenshotIds)
    setNewScreenshotsToAdd([])
    setMenuOpen(false)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    newScreenshotsToAdd.forEach(s => URL.revokeObjectURL(s.previewUrl))
    setNewScreenshotsToAdd([])
    setIsEditing(false)
    setError(null)
  }

  const handleAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const additions: Array<{ blob: Blob; previewUrl: string; filename: string }> = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        additions.push({
          blob: file,
          previewUrl: URL.createObjectURL(file),
          filename: file.name,
        })
      }
    }
    setNewScreenshotsToAdd(prev => [...prev, ...additions])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveExistingScreenshot = (sid: string) => {
    setKeepScreenshotIds(prev => prev.filter(id => id !== sid))
  }

  const handleRemoveNewScreenshot = (index: number) => {
    setNewScreenshotsToAdd(prev => {
      const target = prev[index]
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setError('Title cannot be empty')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      if (onUpdateScreenshots) {
        await onUpdateScreenshots(
          {
            title: editTitle.trim(),
            description: editDesc.trim(),
            projectId: editProject || null,
            type: editType,
          },
          {
            keepScreenshotIds,
            newScreenshots: newScreenshotsToAdd.map(s => ({ blob: s.blob, filename: s.filename })),
          }
        )
      } else {
        // Fallback to legacy single update
        const blob = newScreenshotsToAdd[0]?.blob
        await onUpdate(
          {
            title: editTitle.trim(),
            description: editDesc.trim(),
            projectId: editProject || null,
            type: editType,
          },
          blob !== undefined ? blob : (keepScreenshotIds.length === 0 ? null : undefined)
        )
      }
      setIsEditing(false)
      onToast?.('Issue updated successfully')
    } catch (err) {
      console.error('Failed to save issue edits:', err)
      setError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Copy Prompt + Image
  const handleCopyPromptAndImage = async () => {
    let mainBlob: Blob | null | undefined = null
    const primaryId = currentScreenshotIds[0]
    if (primaryId && getScreenshotBlob) {
      mainBlob = await getScreenshotBlob(primaryId)
    }

    const res = await copyPromptAndImageToClipboard(issue, project, mainBlob)
    if (res.textCopied && res.imageCopied) {
      onToast?.('Copied prompt + image! Paste into ChatGPT/Claude (⌘V)')
    } else if (res.textCopied) {
      onToast?.('Copied prompt text to clipboard!')
    } else {
      onToast?.('Failed to copy to clipboard', 'error')
    }
  }

  // Handle Copy Screenshot Image Only
  const handleCopyImageOnly = async (screenshotId: string) => {
    if (!getScreenshotBlob) return
    const blob = await getScreenshotBlob(screenshotId)
    if (blob) {
      const ok = await copyScreenshotImageToClipboard(blob)
      if (ok) {
        onToast?.('Screenshot copied as PNG to clipboard!')
      } else {
        onToast?.('Failed to copy image to clipboard', 'error')
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden select-none transition-colors">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile Back button */}
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to issues"
            className="w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-xl flex md:hidden items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Desktop Close panel button */}
          <button
            type="button"
            onClick={onBack}
            aria-label="Close details"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="Close details (Esc)"
          >
            <X size={16} />
            <span>Close</span>
            <kbd className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Esc</kbd>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          {!isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200/80 dark:border-slate-700"
            >
              <Edit3 size={15} />
              <span>Edit Issue</span>
            </button>
          )}

          {/* More options ••• */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More options"
              onClick={() => setMenuOpen(prev => !prev)}
              className="w-9 h-9 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <MoreHorizontal size={17} />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-11 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100 text-slate-800 dark:text-slate-200"
                onClick={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5"
                >
                  <Edit3 size={15} className="text-slate-400" />
                  <span>Edit Issue</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5"
                >
                  <Trash2 size={15} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content scrollable */}
      <div className="flex-1 overflow-y-auto px-7 py-6 flex flex-col gap-6">
        {error && (
          <div className="flex items-center gap-2.5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-300">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isEditing ? (
          /* ============================================================ */
          /* EDIT MODE: Edit title, description, project, type, + images  */
          /* ============================================================ */
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Issue Details</h3>
              <span className="text-xs text-slate-400">Add notes, images, or switch projects</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">
                Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full px-4 py-2.5 text-base bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] text-slate-900 dark:text-white"
                placeholder="What is the issue?"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">
                Description & Context
              </label>
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={5}
                className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] text-slate-900 dark:text-white resize-y"
                placeholder="Add context, steps to reproduce, or requirements..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">
                  Project
                </label>
                <select
                  value={editProject || ''}
                  onChange={e => setEditProject(e.target.value || null)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#5B50F6]"
                >
                  <option value="">Unassigned</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">
                  Issue Type
                </label>
                <select
                  value={editType}
                  onChange={e => setEditType(e.target.value as IssueType)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#5B50F6]"
                >
                  <option value="bug">Bug</option>
                  <option value="uiux">UI/UX</option>
                  <option value="idea">Idea</option>
                </select>
              </div>
            </div>

            {/* Screenshots Edit: View existing + add more images */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Screenshots & Attachments
                </label>
                <span className="text-xs text-slate-400">
                  {keepScreenshotIds.length + newScreenshotsToAdd.length} image(s)
                </span>
              </div>

              {/* Existing & New Images Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {/* Existing Screenshots */}
                {keepScreenshotIds.map(sid => {
                  const url = screenshotUrls[sid]
                  return (
                    <div key={sid} className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-video bg-slate-100 dark:bg-slate-800 group">
                      {url ? (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">Loading...</div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingScreenshot(sid)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors"
                        title="Remove image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}

                {/* Newly Added Screenshots */}
                {newScreenshotsToAdd.map((s, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden border-2 border-dashed border-[#5B50F6] aspect-video bg-slate-50 dark:bg-slate-800 group">
                    <img src={s.previewUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveNewScreenshot(idx)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors"
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-[#5B50F6] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      New
                    </span>
                  </div>
                ))}

                {/* Add More Button / Drop Zone */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#5B50F6] rounded-xl text-slate-500 hover:text-[#5B50F6] transition-colors aspect-video bg-slate-50 dark:bg-slate-800/50 cursor-pointer"
                >
                  <Plus size={20} />
                  <span className="text-xs font-semibold">Add Image</span>
                  <span className="text-[10px] text-slate-400">(or paste Ctrl+V)</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={e => handleAddFiles(e.target.files)}
                className="hidden"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving || !editTitle.trim()}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl transition-all shadow-xs disabled:opacity-40"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* READ MODE: Big Title, Prompt Buttons, Image Gallery, Desc    */
          /* ============================================================ */
          <>
            {/* Title & Metadata */}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <TypeBadge type={issue.type} />
                {project ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span>{project.name}</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">Unassigned</span>
                )}
                <span className="text-xs text-slate-400 ml-auto">
                  {timeAgo(issue.createdAt)}
                </span>
              </div>

              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                {issue.title}
              </h1>
            </div>

            {/* AI Prompts & Actions Bar */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#5B50F6]" />
                  <span>AI Prompt Tools</span>
                </span>
                <span className="text-[11px] text-slate-400">Ready for ChatGPT, Claude, Cursor</span>
              </div>

              {/* Primary: Copy Prompt + Image button */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPromptAndImage}
                  className="flex-1 min-w-[200px] flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl shadow-xs transition-all active:scale-[0.99]"
                  title="Copies prompt text and screenshot image to clipboard together"
                >
                  <Copy size={16} />
                  <span>Copy Prompt + Image</span>
                </button>

                {/* Secondary prompt text only */}
                <button
                  type="button"
                  onClick={onCopyPrompt}
                  className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
                  title="Copy plain prompt text"
                >
                  Copy Text
                </button>

                {/* Status Toggle Button */}
                <button
                  type="button"
                  onClick={onToggleFixed}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${
                    issue.status === 'open'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {issue.status === 'open' ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span>Mark Fixed</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={14} className="text-slate-500" />
                      <span>Reopen</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Screenshots Gallery / Carousel */}
            {currentScreenshotIds.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ImageIcon size={14} />
                    <span>Screenshots ({currentScreenshotIds.length})</span>
                  </h3>
                  <span className="text-xs text-slate-400">Click image to zoom full screen</span>
                </div>

                <div className="flex flex-col gap-3">
                  {currentScreenshotIds.map(sid => {
                    const url = screenshotUrls[sid]
                    if (!url) return null
                    return (
                      <div
                        key={sid}
                        className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 group shadow-xs"
                      >
                        <img
                          src={url}
                          alt={issue.title}
                          onClick={() => onZoomScreenshot(url)}
                          className="w-full max-h-96 object-contain cursor-zoom-in transition-transform hover:scale-[1.01]"
                        />

                        {/* Image overlay actions */}
                        <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleCopyImageOnly(sid)}
                            className="p-2 rounded-xl bg-black/70 hover:bg-black text-white text-xs font-medium flex items-center gap-1.5 shadow-md backdrop-blur-xs"
                            title="Copy screenshot image to clipboard"
                          >
                            <Copy size={13} />
                            <span>Copy Image</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onZoomScreenshot(url)}
                            className="p-2 rounded-xl bg-black/70 hover:bg-black text-white shadow-md backdrop-blur-xs"
                            title="Zoom full screen"
                          >
                            <ZoomIn size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Description Section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Description
              </h3>
              {issue.description ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {issue.description}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No description provided.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
