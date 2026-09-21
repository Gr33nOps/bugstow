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
  ZoomIn
} from 'lucide-react'
import type { Issue, Project, IssueType } from '../../../types'
import { TypeBadge, timeAgo, BRAND_PRIMARY } from '../../common/Icon'

interface IssueDetailProps {
  issue: Issue
  project?: Project | null
  projects: Project[]
  screenshotUrl?: string
  onBack: () => void
  onToggleFixed: () => void
  onCopyPrompt: () => void
  onDelete: () => void
  onUpdate: (
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>,
    newScreenshotBlob?: Blob | null,
    filename?: string
  ) => Promise<void>
  onZoomScreenshot: (url: string) => void
}

export function IssueDetail({
  issue,
  project,
  projects,
  screenshotUrl,
  onBack,
  onToggleFixed,
  onCopyPrompt,
  onDelete,
  onUpdate,
  onZoomScreenshot,
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
  const [newScreenshotBlob, setNewScreenshotBlob] = useState<Blob | null | undefined>(undefined)
  const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null)
  const [editFilename, setEditFilename] = useState<string | undefined>()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Reset edit state when issue changes
  useEffect(() => {
    setEditTitle(issue.title)
    setEditDesc(issue.description)
    setEditProject(issue.projectId)
    setEditType(issue.type)
    setNewScreenshotBlob(undefined)
    if (newPreviewUrl) URL.revokeObjectURL(newPreviewUrl)
    setNewPreviewUrl(null)
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

  const handleStartEdit = () => {
    setEditTitle(issue.title)
    setEditDesc(issue.description)
    setEditProject(issue.projectId)
    setEditType(issue.type)
    setNewScreenshotBlob(undefined)
    setMenuOpen(false)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (newPreviewUrl) URL.revokeObjectURL(newPreviewUrl)
    setNewPreviewUrl(null)
    setNewScreenshotBlob(undefined)
    setIsEditing(false)
    setError(null)
  }

  const handleNewFile = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Supported formats: PNG, JPG, WEBP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be 10MB or less.')
      return
    }

    if (newPreviewUrl) URL.revokeObjectURL(newPreviewUrl)
    const url = URL.createObjectURL(file)
    setNewPreviewUrl(url)
    setNewScreenshotBlob(file)
    setEditFilename(file.name)
    setError(null)
  }

  const handleRemoveScreenshot = () => {
    if (newPreviewUrl) URL.revokeObjectURL(newPreviewUrl)
    setNewPreviewUrl(null)
    setNewScreenshotBlob(null)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await onUpdate(
        {
          title: editTitle.trim(),
          description: editDesc.trim(),
          projectId: editProject,
          type: editType,
        },
        newScreenshotBlob,
        editFilename
      )
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update issue.')
    } finally {
      setIsSaving(false)
    }
  }

  const displayImageUrl = newPreviewUrl || (newScreenshotBlob === null ? null : screenshotUrl)

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          {/* Mobile Back button */}
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to issues"
            className="w-8 h-8 border border-slate-200 rounded-lg flex md:hidden items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={15} />
          </button>

          {/* Desktop Close panel button */}
          <button
            type="button"
            onClick={onBack}
            aria-label="Close details"
            className="hidden md:flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Close details (Esc)"
          >
            <X size={14} />
            <span>Close</span>
            <kbd className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded">Esc</kbd>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80"
            >
              <Edit3 size={13} />
              <span>Edit</span>
            </button>
          )}

          {/* More options ••• */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More options"
              onClick={() => setMenuOpen(prev => !prev)}
              className="w-8 h-8 border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <MoreHorizontal size={15} />
            </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-11 w-36 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleStartEdit}
                className="w-full text-left px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit3 size={14} className="text-gray-400" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete()
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Main content scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isEditing ? (
          /* Edit Mode */
          <div className="flex flex-col gap-4">
            <h3 className="text-[16px] font-bold text-gray-900">Edit Issue</h3>

            <div>
              <label className="text-[12px] font-semibold text-gray-500 mb-1 block">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 text-[14px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#5B50F6]"
              />
            </div>

            <div>
              <label className="text-[12px] font-semibold text-gray-500 mb-1 block">Description</label>
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={4}
                className="w-full px-3.5 py-2.5 text-[14px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#5B50F6] resize-none"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[12px] font-semibold text-gray-500 mb-1 block">Project</label>
                <select
                  value={editProject || ''}
                  onChange={e => setEditProject(e.target.value || null)}
                  className="w-full px-3.5 py-2.5 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#5B50F6]"
                >
                  <option value="">Unassigned</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="text-[12px] font-semibold text-gray-500 mb-1 block">Type</label>
                <select
                  value={editType}
                  onChange={e => setEditType(e.target.value as IssueType)}
                  className="w-full px-3.5 py-2.5 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#5B50F6]"
                >
                  <option value="bug">Bug</option>
                  <option value="uiux">UI/UX</option>
                  <option value="idea">Idea</option>
                </select>
              </div>
            </div>

            {/* Screenshot in edit */}
            <div>
              <label className="text-[12px] font-semibold text-gray-500 mb-1 block">Screenshot</label>
              {displayImageUrl ? (
                <div className="relative inline-block rounded-xl overflow-hidden border border-gray-200">
                  <img src={displayImageUrl} alt="" className="max-h-44 object-cover" />
                  <button
                    type="button"
                    onClick={handleRemoveScreenshot}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-[13px] text-gray-500 hover:border-gray-300 flex items-center justify-center gap-2"
                >
                  <Upload size={16} />
                  <span>Attach Screenshot (PNG, JPG, max 10MB)</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleNewFile(f)
                }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="flex-1 py-2.5 text-[13px] font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editTitle.trim() || isSaving}
                className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          /* Normal View Mode matching Figma */
          <>
            {/* Title & Badge */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[20px] font-bold text-gray-900 leading-snug tracking-tight">
                {issue.title}
              </h2>
              <TypeBadge type={issue.type} />
            </div>

            {/* Subtitle meta */}
            <p className="text-[13px] text-gray-500 -mt-2">
              {project ? project.name : 'Unassigned'} • {timeAgo(issue.createdAt)}
            </p>

            {/* Screenshot Preview Card */}
            {screenshotUrl && (
              <div
                className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 cursor-zoom-in group max-h-72 flex items-center justify-center shadow-xs"
                onClick={() => onZoomScreenshot(screenshotUrl)}
              >
                <img
                  src={screenshotUrl}
                  alt={issue.title}
                  className="w-full h-auto max-h-72 object-contain"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-white/90 text-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                    <ZoomIn size={16} />
                  </div>
                </div>
              </div>
            )}

            {/* Description Section */}
            {issue.description && (
              <div>
                <h4 className="text-[14px] font-semibold text-gray-900 mb-2">Description</h4>
                <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {issue.description}
                </p>
              </div>
            )}

            {/* Actions Section matching Figma buttons */}
            <div>
              <h4 className="text-[14px] font-semibold text-gray-900 mb-3">Actions</h4>
              <div className="flex flex-wrap gap-2.5">
                {/* Copy as Prompt */}
                <button
                  type="button"
                  onClick={onCopyPrompt}
                  className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl transition-all shadow-xs active:scale-98"
                >
                  <Copy size={15} strokeWidth={2.2} />
                  <span>Copy as Prompt</span>
                </button>

                {/* Mark as Fixed / Reopen */}
                <button
                  type="button"
                  onClick={onToggleFixed}
                  className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 rounded-xl transition-all shadow-xs active:scale-98"
                >
                  {issue.status === 'open' ? (
                    <>
                      <Check size={15} className="text-gray-600" strokeWidth={2.4} />
                      <span>Mark as Fixed</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={15} className="text-gray-600" strokeWidth={2.4} />
                      <span>Reopen</span>
                    </>
                  )}
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-[#F04438] bg-[#FEECEB]/70 border border-[#FEECEB] hover:bg-[#FEECEB] active:bg-[#FEECEB]/90 rounded-xl transition-all shadow-xs active:scale-98"
                >
                  <Trash2 size={15} strokeWidth={2.2} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
