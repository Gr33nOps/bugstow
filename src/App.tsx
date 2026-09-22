import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { Tab, Issue, Project, IssueType } from './types'
import { useBugstowData } from './hooks/useBugstowData'
import { useStorageEstimate } from './hooks/useStorageEstimate'
import { useTheme } from './hooks/useTheme'
import { formatBytes } from './services/storageService'
import { copyPromptToClipboard } from './services/promptService'

// Layout & Common Components
import { Sidebar } from './components/layout/Sidebar'
import { AppHeader } from './components/layout/AppHeader'
import { MobileHeader, MobileBottomNav } from './components/layout/MobileNav'
import {
  ToastContainer,
  ConfirmModal,
  ImageFullModal,
  KeyboardShortcutsModal,
  AboutModal,
  type ToastMessage,
  type ConfirmDialogProps,
} from './components/common/Modals'

// Feature Components
import { ListView } from './components/features/inbox/ListView'
import { NewIssueModal } from './components/features/capture/NewIssueModal'
import { IssueDetail } from './components/features/issues/IssueDetail'
import { ProjectsView, ProjectModal } from './components/features/projects/ProjectsView'
import { SettingsView } from './components/features/settings/SettingsView'
import { Shield, X, Download } from 'lucide-react'

export default function App() {
  const {
    issues,
    projects,
    settings,
    loading,
    error,
    screenshotUrls,
    getScreenshotBlob,
    createIssue,
    updateIssue,
    updateIssueScreenshots,
    markFixed,
    reopenIssue,
    deleteIssue,
    createProject,
    updateProject,
    deleteProject,
    clearAllData,
    restoreBackup,
    dismissBackupReminder,
  } = useBugstowData()

  const { estimate } = useStorageEstimate()
  const { theme, setTheme, toggleTheme } = useTheme()

  // Navigation & View States
  const [currentTab, setCurrentTab] = useState<Tab>('inbox')
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [projectFilterId, setProjectFilterId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('bugstow_sidebar_collapsed') === 'true'
  })

  // Global Search & Type Filters (shared across AppHeader & ListView)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<IssueType | 'all'>('all')

  // Modals & Overlays
  const [showNewIssueModal, setShowNewIssueModal] = useState(false)
  const [showQuickProjectModal, setShowQuickProjectModal] = useState(false)
  const [initialPastedFile, setInitialPastedFile] = useState<File | null>(null)
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogProps | null>(null)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts(prev => [...prev, { id, text, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('bugstow_sidebar_collapsed', String(next))
      return next
    })
  }

  // Currently selected issue object
  const selectedIssue = useMemo(() => {
    if (!selectedIssueId) return null
    return issues.find(i => i.id === selectedIssueId) || null
  }, [selectedIssueId, issues])

  // Active project object
  const activeProject = useMemo(() => {
    if (!projectFilterId) return null
    return projects.find(p => p.id === projectFilterId) || null
  }, [projectFilterId, projects])

  // Counts
  const openIssues = useMemo(() => issues.filter(i => i.status === 'open'), [issues])
  const fixedIssues = useMemo(() => issues.filter(i => i.status === 'fixed'), [issues])

  const storageUsedFormatted = useMemo(() => {
    if (!estimate || estimate.usageBytes === undefined) return undefined
    return formatBytes(estimate.usageBytes)
  }, [estimate])

  // Global Keyboard Shortcuts (⌘K, ⌘B, /, Esc, ?)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      // ⌘K or Ctrl+K: New Issue
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowNewIssueModal(true)
        return
      }

      // ⌘B or Ctrl+B: Toggle Sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        handleToggleSidebar()
        return
      }

      // / : Focus global search if not already typing
      if (e.key === '/' && !isInput) {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
        return
      }

      // ? : Show keyboard shortcuts if not typing
      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShowKeyboardShortcuts(prev => !prev)
        return
      }

      // Escape key closes modals / selection
      if (e.key === 'Escape') {
        if (zoomImageUrl) {
          setZoomImageUrl(null)
          return
        }
        if (showNewIssueModal) {
          setShowNewIssueModal(false)
          return
        }
        if (showQuickProjectModal) {
          setShowQuickProjectModal(false)
          return
        }
        if (showKeyboardShortcuts) {
          setShowKeyboardShortcuts(false)
          return
        }
        if (showAbout) {
          setShowAbout(false)
          return
        }
        if (confirmDialog) {
          setConfirmDialog(null)
          return
        }
        if (selectedIssueId) {
          setSelectedIssueId(null)
          return
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [zoomImageUrl, showNewIssueModal, showQuickProjectModal, showKeyboardShortcuts, showAbout, confirmDialog, selectedIssueId])

  // Global clipboard paste listener (when modal is not already open)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      const items = Array.from(e.clipboardData?.items || [])
      const imageItem = items.find(i => i.type.startsWith('image/'))
      if (imageItem) {
        const file = imageItem.getAsFile()
        if (file) {
          e.preventDefault()
          setInitialPastedFile(file)
          setShowNewIssueModal(true)
        }
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
  }, [])

  // Handle Save New Issue
  const handleSaveNewIssue = async (
    data: {
      title: string
      description: string
      projectId: string | null
      type: IssueType
    },
    screenshotBlob?: Blob | null,
    filename?: string,
    additionalBlobs?: Array<{ blob: Blob; filename?: string }>
  ) => {
    try {
      const newIssue = await createIssue(
        {
          title: data.title,
          description: data.description,
          projectId: data.projectId,
          type: data.type,
          status: 'open',
        },
        screenshotBlob || undefined,
        filename,
        additionalBlobs
      )
      showToast('Issue captured')
      setShowNewIssueModal(false)
      setInitialPastedFile(null)
      setCurrentTab('inbox')
      setSelectedIssueId(newIssue.id)
    } catch (err) {
      console.error('Failed to create issue:', err)
      showToast('Failed to save issue. Please retry.', 'error')
      throw err
    }
  }

  // Handle Copy Prompt
  const handleCopyPrompt = async (issue: Issue) => {
    const project = projects.find(p => p.id === issue.projectId)
    const success = await copyPromptToClipboard(issue, project)
    if (success) {
      showToast('Prompt copied to clipboard')
    } else {
      showToast('Failed to copy prompt to clipboard', 'error')
    }
  }

  // Handle Toggle Fixed / Reopen
  const handleToggleFixed = async (issue: Issue) => {
    if (issue.status === 'open') {
      await markFixed(issue.id)
      showToast('Marked as fixed')
    } else {
      await reopenIssue(issue.id)
      showToast('Issue reopened')
    }
  }

  // Handle Delete Request
  const handleDeleteIssueRequest = (issue: Issue) => {
    setConfirmDialog({
      title: 'Delete Issue',
      message: `Are you sure you want to delete "${issue.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        await deleteIssue(issue.id)
        if (selectedIssueId === issue.id) {
          setSelectedIssueId(null)
        }
        setConfirmDialog(null)
        showToast('Issue deleted')
      },
      onCancel: () => setConfirmDialog(null),
    })
  }

  // Handle Project Delete Request
  const handleDeleteProjectRequest = (project: Project) => {
    const associatedCount = issues.filter(i => i.projectId === project.id).length
    setConfirmDialog({
      title: 'Delete Project',
      message: `Are you sure you want to delete "${project.name}"? ${
        associatedCount > 0
          ? `All ${associatedCount} issue${
              associatedCount > 1 ? 's' : ''
            } in this project will be preserved and moved to "Unassigned".`
          : 'No issues are currently assigned to this project.'
      }`,
      confirmLabel: 'Delete Project',
      isDestructive: true,
      onConfirm: async () => {
        await deleteProject(project.id)
        if (projectFilterId === project.id) {
          setProjectFilterId(null)
        }
        setConfirmDialog(null)
        showToast('Project deleted. Associated issues were preserved.')
      },
      onCancel: () => setConfirmDialog(null),
    })
  }

  // Calculate if backup reminder is due
  const shouldShowBackupReminder = useMemo(() => {
    if (!settings || !settings.backupReminderDismissedAt) return issues.length >= 5
    const dismissed = new Date(settings.backupReminderDismissedAt).getTime()
    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    return now - dismissed > sevenDays && issues.length >= 5
  }, [settings, issues.length])

  // Render main tab content
  const renderTabContent = () => {
    switch (currentTab) {
      case 'inbox':
        return (
          <ListView
            title="Inbox"
            subtitle="Capture bugs, feedback or ideas while you build."
            issues={openIssues}
            projects={projects}
            screenshotUrls={screenshotUrls}
            selectedIssueId={selectedIssueId}
            onSelectIssue={issue => setSelectedIssueId(issue.id)}
            onNewIssue={() => setShowNewIssueModal(true)}
            onToggleFixed={handleToggleFixed}
            onCopyPrompt={handleCopyPrompt}
            onDeleteIssue={handleDeleteIssueRequest}
            emptyHeading="Nothing to fix. Yet."
            emptySub="Capture bugs, feedback or ideas while you build."
            showCaptureOnEmpty={true}
            activeProjectFilter={projectFilterId}
            onClearProjectFilter={() => setProjectFilterId(null)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
          />
        )

      case 'fixed':
        return (
          <ListView
            title="Fixed Issues"
            subtitle="Resolved and fixed items."
            issues={fixedIssues}
            projects={projects}
            screenshotUrls={screenshotUrls}
            selectedIssueId={selectedIssueId}
            onSelectIssue={issue => setSelectedIssueId(issue.id)}
            onNewIssue={() => setShowNewIssueModal(true)}
            onToggleFixed={handleToggleFixed}
            onCopyPrompt={handleCopyPrompt}
            onDeleteIssue={handleDeleteIssueRequest}
            emptyHeading="No fixed issues yet"
            emptySub="Mark resolved issues as fixed to clear them from your inbox."
            showCaptureOnEmpty={false}
            activeProjectFilter={projectFilterId}
            onClearProjectFilter={() => setProjectFilterId(null)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
          />
        )

      case 'projects':
        return (
          <ProjectsView
            projects={projects}
            issues={issues}
            onSelectProject={id => {
              setProjectFilterId(id)
              setCurrentTab('inbox')
            }}
            onCreateProject={async (name, color) => {
              await createProject(name, color)
              showToast('Project created')
            }}
            onUpdateProject={async (id, updates) => {
              await updateProject(id, updates)
              showToast('Project updated')
            }}
            onRequestDeleteProject={handleDeleteProjectRequest}
            onBack={() => setCurrentTab('inbox')}
          />
        )

      case 'settings':
        return (
          <SettingsView
            theme={theme}
            onSetTheme={setTheme}
            onClearAllData={async () => {
              await clearAllData()
              setSelectedIssueId(null)
              setProjectFilterId(null)
              showToast('All data permanently deleted')
            }}
            onRestoreBackup={async data => {
              await restoreBackup(data)
              setSelectedIssueId(null)
              showToast('Backup restored successfully')
            }}
            onToast={showToast}
            onOpenKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
            onOpenAbout={() => setShowAbout(true)}
          />
        )

      default:
        return null
    }
  }

  // Selected Issue Detail Element
  const issueDetailComponent = selectedIssue ? (
    <IssueDetail
      issue={selectedIssue}
      project={projects.find(p => p.id === selectedIssue.projectId)}
      projects={projects}
      screenshotUrl={
        selectedIssue.screenshotId ? screenshotUrls[selectedIssue.screenshotId] : undefined
      }
      screenshotUrls={screenshotUrls}
      getScreenshotBlob={getScreenshotBlob}
      onBack={() => setSelectedIssueId(null)}
      onToggleFixed={() => handleToggleFixed(selectedIssue)}
      onCopyPrompt={() => handleCopyPrompt(selectedIssue)}
      onDelete={() => handleDeleteIssueRequest(selectedIssue)}
      onUpdate={async (updates, newScreenshotBlob, filename) => {
        await updateIssue(selectedIssue.id, updates, newScreenshotBlob, filename)
        showToast('Issue updated')
      }}
      onUpdateScreenshots={async (updates, options) => {
        await updateIssueScreenshots(selectedIssue.id, updates, options)
        showToast('Issue updated')
      }}
      onZoomScreenshot={url => setZoomImageUrl(url)}
      onToast={showToast}
    />
  ) : null

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 antialiased selection:bg-[#EEF0FF] dark:selection:bg-indigo-950 selection:text-[#5B50F6] dark:selection:text-indigo-300 transition-colors">
      {/* Desktop Responsive Sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={tab => {
            setCurrentTab(tab)
            setSelectedIssueId(null)
          }}
          inboxCount={openIssues.length}
          fixedCount={fixedIssues.length}
          projects={projects}
          activeProjectFilterId={projectFilterId}
          onSelectProjectFilter={id => {
            setProjectFilterId(id)
            setCurrentTab('inbox')
          }}
          onNewIssue={() => setShowNewIssueModal(true)}
          onCreateProject={() => setShowQuickProjectModal(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          storageEstimateText={storageUsedFormatted ? `${storageUsedFormatted} stored in browser` : undefined}
        />
      </div>

      {/* Main Web Application Canvas */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 relative min-w-0 transition-colors">
        {/* Global Desktop Top Bar */}
        <AppHeader
          currentTab={currentTab}
          activeProject={activeProject}
          onClearProjectFilter={() => setProjectFilterId(null)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onNewIssue={() => setShowNewIssueModal(true)}
          onOpenKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          issueCount={currentTab === 'inbox' ? openIssues.length : currentTab === 'fixed' ? fixedIssues.length : undefined}
          storageUsedFormatted={storageUsedFormatted}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Mobile Header */}
        {!selectedIssue && (
          <MobileHeader
            currentTab={currentTab}
            onOpenNewIssue={() => setShowNewIssueModal(true)}
            onToggleMenu={() => setMobileDrawerOpen(prev => !prev)}
          />
        )}

        {/* Subtle Backup Reminder Banner */}
        {shouldShowBackupReminder && currentTab === 'inbox' && !selectedIssue && (
          <div className="bg-[#EEF0FF] dark:bg-indigo-950/40 border-b border-[#D8DDFF] dark:border-indigo-900/60 px-5 py-2.5 flex items-center justify-between text-xs text-[#4338CA] dark:text-indigo-300 shrink-0">
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-[#5B50F6] shrink-0" />
              <span>
                <strong>Backup reminder:</strong> Your data is stored locally in this browser. Keep an encrypted backup.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentTab('settings')}
                className="font-semibold underline hover:text-[#251D98] dark:hover:text-white flex items-center gap-1"
              >
                <Download size={13} />
                Export
              </button>
              <button
                type="button"
                aria-label="Dismiss reminder"
                onClick={dismissBackupReminder}
                className="text-[#5B50F6] dark:text-indigo-400 hover:text-[#251D98] dark:hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Center Workspace (Split view or full content) */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-50/50 dark:bg-slate-950">
          {selectedIssue ? (
            <>
              {/* Left pane: list on desktop (hidden on mobile when issue is open) */}
              <div className="hidden md:flex flex-1 overflow-hidden border-r border-slate-200 dark:border-slate-800 min-w-0 bg-white dark:bg-slate-900">
                {renderTabContent()}
              </div>

              {/* Right pane: issue detail panel on desktop, full screen on mobile */}
              <div className="flex-1 md:flex-initial md:w-[480px] lg:w-[540px] xl:w-[600px] flex flex-col overflow-hidden bg-white dark:bg-slate-900 shrink-0 border-l border-slate-200/80 dark:border-slate-800">
                {issueDetailComponent}
              </div>
            </>
          ) : (
            /* Normal Tab Content */
            renderTabContent()
          )}
        </div>

        {/* Mobile Bottom Navigation (hidden when issue details is open) */}
        {!selectedIssue && (
          <MobileBottomNav
            currentTab={currentTab}
            onSelectTab={tab => {
              setCurrentTab(tab)
              setSelectedIssueId(null)
            }}
            inboxCount={openIssues.length}
            fixedCount={fixedIssues.length}
          />
        )}
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex select-none">
          <div
            className="absolute inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-68 bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200 border-r border-slate-200 dark:border-slate-800">
            <Sidebar
              currentTab={currentTab}
              onSelectTab={tab => {
                setCurrentTab(tab)
                setSelectedIssueId(null)
                setMobileDrawerOpen(false)
              }}
              inboxCount={openIssues.length}
              fixedCount={fixedIssues.length}
              projects={projects}
              activeProjectFilterId={projectFilterId}
              onSelectProjectFilter={id => {
                setProjectFilterId(id)
                setCurrentTab('inbox')
                setMobileDrawerOpen(false)
              }}
              onNewIssue={() => {
                setMobileDrawerOpen(false)
                setShowNewIssueModal(true)
              }}
              onCreateProject={() => {
                setMobileDrawerOpen(false)
                setShowQuickProjectModal(true)
              }}
              storageEstimateText={storageUsedFormatted ? `${storageUsedFormatted} on device` : undefined}
            />
          </div>
        </div>
      )}

      {/* Quick Project Creation Modal (triggered from sidebar) */}
      {showQuickProjectModal && (
        <ProjectModal
          onSave={async (name, color) => {
            await createProject(name, color)
            showToast('Project created')
            setShowQuickProjectModal(false)
          }}
          onClose={() => setShowQuickProjectModal(false)}
        />
      )}

      {/* Capture New Issue Modal */}
      {showNewIssueModal && (
        <NewIssueModal
          projects={projects}
          defaultProjectId={projectFilterId}
          initialFile={initialPastedFile}
          onSave={handleSaveNewIssue}
          onClose={() => {
            setShowNewIssueModal(false)
            setInitialPastedFile(null)
          }}
        />
      )}

      {/* Lightbox Screenshot Zoom */}
      {zoomImageUrl && (
        <ImageFullModal src={zoomImageUrl} onClose={() => setZoomImageUrl(null)} />
      )}

      {/* Generic Confirmation Modal */}
      {confirmDialog && <ConfirmModal {...confirmDialog} />}

      {/* Keyboard Shortcuts Dialog */}
      {showKeyboardShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowKeyboardShortcuts(false)} />
      )}

      {/* About Bugstow Dialog */}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  )
}
