import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, MoreHorizontal, ArrowLeft, X, Edit2, Trash2, FolderInput } from 'lucide-react'
import type { Project, Issue } from '../../../types'
import { EmptyState } from '../inbox/EmptyState'
import { placeFloatingMenu } from '../../../lib/floatingMenu'

const PROJECT_COLORS = [
  '#0f766e', // Bugstow Blurple
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
  onCopyProjectToTeam?: (project: Project) => void
  onBack?: () => void
}

export function ProjectsView({
  projects,
  issues,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onRequestDeleteProject,
  onCopyProjectToTeam,
  onBack,
}: ProjectsViewProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [openMenu, setOpenMenu] = useState<{
    project: Project
    left: number
    top: number
  } | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) setOpenMenu(null)
    }
    const closeMenu = () => setOpenMenu(null)
    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('resize', closeMenu)
      window.addEventListener('scroll', closeMenu, true)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        window.removeEventListener('resize', closeMenu)
        window.removeEventListener('scroll', closeMenu, true)
      }
    }
  }, [openMenu])

  const handleOpenCreate = () => {
    setEditingProject(null)
    setShowModal(true)
  }

  const handleOpenEdit = (project: Project) => {
    setOpenMenu(null)
    setEditingProject(project)
    setShowModal(true)
  }

  const toggleMenu = (button: HTMLButtonElement, project: Project) => {
    if (openMenu?.project.id === project.id) {
      setOpenMenu(null)
      return
    }
    menuButtonRef.current = button
    const anchor = button.getBoundingClientRect()
    const position = placeFloatingMenu(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      { width: 208, height: onCopyProjectToTeam ? 140 : 98 },
    )
    setOpenMenu({ project, ...position })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950 select-none transition-colors">
      {/* Header bar */}
      <div className="flex items-center justify-between page-heading flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to issues"
              className="w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-lg flex md:hidden items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          <div>
            <h1 className="page-title text-slate-900 dark:text-white">Projects</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              A place for each project. All its issues, together.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover active:bg-brand-hover rounded-lg transition-[background-color,transform] shadow-xs active:scale-98"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>New project</span>
        </button>
      </div>

      {/* Projects List Content */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 w-full max-w-5xl">
        {projects.length === 0 ? (
          <EmptyState
            heading="No projects yet"
            subheading="Create a project to organize your issues, bugs and feedback."
            actionLabel="New project"
            onAction={handleOpenCreate}
            showShortcutHint={false}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
            {projects.map((p) => {
              const projectIssueCount = issues.filter(i => i.projectId === p.id).length
              return (
                <div key={p.id} className="flex items-center hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                  <button
                    type="button"
                    aria-label={`Open project ${p.name}`}
                    onClick={() => onSelectProject(p.id)}
                    className="min-w-0 flex flex-1 items-center gap-4.5 px-6 py-4.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                  >
                    <span
                      className="w-10 h-10 rounded-lg shrink-0 shadow-xs flex items-center justify-center text-white font-semibold text-sm"
                      style={{ backgroundColor: p.color }}
                      aria-hidden="true"
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-base font-semibold text-slate-900 dark:text-white truncate group-hover:text-brand transition-colors">
                        {p.name}
                      </span>
                      <span className="block text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                        {projectIssueCount} issue{projectIssueCount !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </button>

                  <div className="shrink-0 pr-5">
                    <button
                      type="button"
                      ref={openMenu?.project.id === p.id ? menuButtonRef : undefined}
                      aria-label={`Actions for ${p.name}`}
                      aria-haspopup="menu"
                      aria-expanded={openMenu?.project.id === p.id}
                      onClick={e => {
                        e.stopPropagation()
                        toggleMenu(e.currentTarget, p)
                      }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </button>
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

      {openMenu && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${openMenu.project.name}`}
          className="fixed w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1.5 z-[70] animate-in fade-in zoom-in-95 duration-100 text-slate-800 dark:text-slate-200"
          style={{ left: openMenu.left, top: openMenu.top }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleOpenEdit(openMenu.project)}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5 font-medium"
          >
            <Edit2 size={15} className="text-slate-400" aria-hidden="true" />
            <span>Edit project</span>
          </button>
          {onCopyProjectToTeam && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpenMenu(null)
                onCopyProjectToTeam(openMenu.project)
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5 font-medium"
            >
              <FolderInput size={15} className="text-slate-400" aria-hidden="true" />
              <span>Copy to Team</span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpenMenu(null)
              onRequestDeleteProject(openMenu.project)
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 font-medium"
          >
            <Trash2 size={15} aria-hidden="true" />
            <span>Delete project</span>
          </button>
        </div>,
        document.body,
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
        className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-md p-6 sm:p-7 flex flex-col gap-4.5 animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {initial ? 'Edit project' : 'New project'}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        <div>
          <label htmlFor="project-name" className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 block tracking-wide">
            Project name
          </label>
          <input
            id="project-name"
            name="project-name"
            autoFocus
            type="text"
            placeholder="Example: Website redesign"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 text-[15px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-[border-color,box-shadow] text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block tracking-wide">Color</p>
          <div className="flex gap-3 flex-wrap items-center">
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                type="button"
                aria-label={`Use color ${c}`}
                aria-pressed={color === c}
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
            className="flex-1 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSaving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg disabled:opacity-40 transition-[background-color,opacity] shadow-sm"
          >
            {isSaving ? 'Saving…' : initial ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  )
}
