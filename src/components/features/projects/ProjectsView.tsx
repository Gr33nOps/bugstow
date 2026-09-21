import React, { useState, useRef, useEffect } from 'react'
import { Plus, MoreHorizontal, ArrowLeft, X, Edit2, Trash2, FolderPlus } from 'lucide-react'
import type { Project, Issue } from '../../../types'
import { EmptyState } from '../inbox/EmptyState'
import { BRAND_PRIMARY } from '../../common/Icon'

export const PROJECT_COLORS = [
  '#5B50F6', // Bugstow Blurple
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#06B6D4', // Cyan
]

interface ProjectsViewProps {
  projects: Project[]
  issues: Issue[]
  onSelectProject: (projectId: string) => void
  onCreateProject: (name: string, color: string) => Promise<void>
  onUpdateProject: (id: string, updates: { name?: string; color?: string }) => Promise<void>
  onRequestDeleteProject: (project: Project) => void
  onBack?: () => void
}

export function ProjectsView({
  projects,
  issues,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onRequestDeleteProject,
  onBack,
}: ProjectsViewProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    if (menuOpenId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpenId])

  const handleOpenCreate = () => {
    setEditingProject(null)
    setShowModal(true)
  }

  const handleOpenEdit = (project: Project) => {
    setMenuOpenId(null)
    setEditingProject(project)
    setShowModal(true)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white select-none">
      {/* Header bar matching bugstow_05_projects.png */}
      <div className="flex items-center justify-between px-6 pt-6 pb-5">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 border border-gray-200 rounded-xl flex md:hidden items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <h1 className="text-[24px] font-bold text-gray-900 tracking-tight">Projects</h1>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl transition-all shadow-sm active:scale-98"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects List Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {projects.length === 0 ? (
          <EmptyState
            heading="No projects yet"
            subheading="Create a project to organize your issues, bugs and feedback."
            actionLabel="New Project"
            onAction={handleOpenCreate}
            showShortcutHint={false}
          />
        ) : (
          <div className="bg-white border border-gray-200/90 rounded-2xl overflow-hidden shadow-xs">
            {projects.map((p, idx) => {
              const projectIssueCount = issues.filter(i => i.projectId === p.id).length
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors relative group ${
                    idx < projects.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  {/* Solid color circle */}
                  <div
                    className="w-9 h-9 rounded-full shrink-0 shadow-xs flex items-center justify-center text-white"
                    style={{ backgroundColor: p.color }}
                  />

                  {/* Name and count */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-[13px] text-gray-400 mt-0.5">
                      {projectIssueCount} issue{projectIssueCount !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Actions menu ••• */}
                  <div className="relative" ref={menuOpenId === p.id ? menuRef : undefined}>
                    <button
                      type="button"
                      aria-label="Project actions"
                      onClick={e => {
                        e.stopPropagation()
                        setMenuOpenId(prev => (prev === p.id ? null : p.id))
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    {menuOpenId === p.id && (
                      <div
                        className="absolute right-0 top-9 w-40 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="w-full text-left px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Edit2 size={14} className="text-gray-400" />
                          <span>Edit Project</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpenId(null)
                            onRequestDeleteProject(p)
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
              )
            })}
          </div>
        )}
      </div>

      {/* Project Create/Edit Modal */}
      {showModal && (
        <ProjectModal
          initial={editingProject}
          onSave={async (name, color) => {
            if (editingProject) {
              await onUpdateProject(editingProject.id, { name, color })
            } else {
              await onCreateProject(name, color)
            }
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

export interface ProjectModalProps {
  initial?: Project | null
  onSave: (name: string, color: string) => Promise<void>
  onClose: () => void
}

export function ProjectModal({ initial, onSave, onClose }: ProjectModalProps) {
  const [name, setName] = useState(initial?.name || '')
  const [color, setColor] = useState(initial?.color || PROJECT_COLORS[0])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isSaving])

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || isSaving) return
    setIsSaving(true)
    try {
      await onSave(name.trim(), color)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-xs" onClick={() => !isSaving && onClose()} />

      <form
        onSubmit={handleFormSubmit}
        className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-gray-900">
            {initial ? 'Edit Project' : 'New Project'}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="text-[12px] font-semibold text-gray-500 mb-1 block">Project Name</label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. Website or Mobile App"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 text-[14px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#5B50F6] focus:ring-2 focus:ring-[#5B50F6]/15 transition-all"
          />
        </div>

        <div>
          <label className="text-[12px] font-semibold text-gray-500 mb-2 block">Color</label>
          <div className="flex gap-2.5 flex-wrap items-center">
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110 relative flex items-center justify-center"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `2.5px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-2.5 text-[13px] font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSaving}
            className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-40 transition-all shadow-sm"
          >
            {isSaving ? 'Saving...' : initial ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
