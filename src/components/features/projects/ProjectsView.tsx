import React, { useState, useRef, useEffect } from 'react'
import { Plus, MoreHorizontal, ArrowLeft, X, Edit2, Trash2 } from 'lucide-react'
import type { Project, Issue } from '../../../types'
import { EmptyState } from '../inbox/EmptyState'

const PROJECT_COLORS = [
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
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950 select-none transition-colors">
      {/* Header bar */}
      <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs">
        <div className="flex items-center gap-3.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-xl flex md:hidden items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Projects</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Organize issues, tasks, and notes by client or code repository.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl transition-all shadow-xs active:scale-98"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects List Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 max-w-4xl">
        {projects.length === 0 ? (
          <EmptyState
            heading="No projects yet"
            subheading="Create a project to organize your issues, bugs and feedback."
            actionLabel="New Project"
            onAction={handleOpenCreate}
            showShortcutHint={false}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
            {projects.map((p) => {
              const projectIssueCount = issues.filter(i => i.projectId === p.id).length
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className="flex items-center gap-4.5 px-6 py-4.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors relative group"
                >
                  {/* Solid color circle */}
                  <div
                    className="w-10 h-10 rounded-xl shrink-0 shadow-xs flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name and count */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-slate-900 dark:text-white truncate group-hover:text-[#5B50F6] transition-colors">
                      {p.name}
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
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
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {menuOpenId === p.id && (
                      <div
                        className="absolute right-0 top-11 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5 font-medium"
                        >
                          <Edit2 size={15} className="text-slate-400" />
                          <span>Edit Project</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpenId(null)
                            onRequestDeleteProject(p)
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 font-medium"
                        >
                          <Trash2 size={15} />
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
      <div className="absolute inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-xs" onClick={() => !isSaving && onClose()} />

      <form
        onSubmit={handleFormSubmit}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-md p-6 sm:p-7 flex flex-col gap-4.5 animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {initial ? 'Edit Project' : 'New Project'}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">
            Project Name
          </label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. Website Redesign or Mobile App"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 text-[15px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] focus:ring-2 focus:ring-[#5B50F6]/20 transition-all text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block uppercase tracking-wider">
            Color Accent
          </label>
          <div className="flex gap-3 flex-wrap items-center">
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full transition-transform hover:scale-110 relative flex items-center justify-center cursor-pointer shadow-xs"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `3px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSaving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-40 transition-all shadow-sm"
          >
            {isSaving ? 'Saving...' : initial ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
