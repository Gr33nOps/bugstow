import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { Tab, Issue, Project, IssueType } from './types'
import { useBugstowData } from './hooks/useBugstowData'
import { copyPromptToClipboard } from './services/promptService'

// Layout & Common Components
import { Sidebar } from './components/layout/Sidebar'
import { MobileHeader, MobileBottomNav } from './components/layout/MobileNav'
import { ToastContainer, ConfirmModal, ImageFullModal, KeyboardShortcutsModal, AboutModal, type ToastMessage, type ConfirmDialogProps } from './components/common/Modals'
import { BRAND_PRIMARY } from './components/common/Icon'

// Feature Components
import { ListView } from './components/features/inbox/ListView'
import { NewIssueModal } from './components/features/capture/NewIssueModal'
import { IssueDetail } from './components/features/issues/IssueDetail'
import { ProjectsView } from './components/features/projects/ProjectsView'
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
    createIssue,
    updateIssue,
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

  // Navigation & View States
  const [currentTab, setCurrentTab] = useState<Tab>('inbox')
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [projectFilterId, setProjectFilterId] = useState<string | null>(null)

  // Modals & Overlays
  const [showNewIssueModal, setShowNewIssueModal] = useState(false)
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
    }, 3200)
  }, [])

  // Currently selected issue object
  const selectedIssue = useMemo(() => {
    if (!selectedIssueId) return null
    return issues.find(i => i.id === selectedIssueId) || null
  }, [selectedIssueId, issues])

  // Counts
  const openIssues = useMemo(() => issues.filter(i => i.status === 'open'), [issues])
  const fixedIssues = useMemo(() => issues.filter(i => i.status === 'fixed'), [issues])

  // Global Keyboard Shortcuts (⌘K / Ctrl+K and Esc)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowNewIssueModal(true)
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
  }, [zoomImageUrl, showNewIssueModal, showKeyboardShortcuts, showAbout, confirmDialog, selectedIssueId])

  // Global clipboard paste listener (when modal is not already open)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't hijack if user is typing in an input or textarea
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

  // Handlers for Issue Operations
  const handleSaveNewIssue = async (
    data: {
      title: string
      description: string
      projectId: string | null
      type: IssueType
    },
    screenshotBlob?: Blob | null,
    filename?: string
  ) => {
    await createIssue(data, screenshotBlob, filename)
    showToast('Issue captured')
  }

  const handleToggleFixed = async (issue: Issue) => {
    try {
      if (issue.status === 'open') {
        await markFixed(issue.id)
        showToast('Marked as fixed')
      } else {
        await reopenIssue(issue.id)
        showToast('Issue reopened')
      }
    } catch (err) {
      showToast('Failed to update issue status', 'error')
    }
  }

  const handleCopyPrompt = async (issue: Issue) => {
    const project = projects.find(p => p.id === issue.projectId)
    const success = await copyPromptToClipboard(issue, project)
    if (success) {
      showToast('Prompt copied to clipboard')
    } else {
      showToast('Could not copy prompt', 'error')
    }
  }

  const handleDeleteIssueRequest = (issue: Issue) => {
    setConfirmDialog({
      title: 'Delete this issue?',
      description:
        'This will permanently remove the issue and its attached screenshot. This action cannot be undone.',
      confirmLabel: 'Delete Issue',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteIssue(issue.id)
          if (selectedIssueId === issue.id) setSelectedIssueId(null)
          setConfirmDialog(null)
          showToast('Issue deleted')
        } catch (err) {
          showToast('Failed to delete issue', 'error')
        }
      },
      onCancel: () => setConfirmDialog(null),
    })
  }

  // Handlers for Project Operations
  const handleDeleteProjectRequest = (project: Project) => {
    setConfirmDialog({
      title: `Delete "${project.name}"?`,
      description:
        'All issues in this project will be preserved and moved into Unassigned. They will not be deleted.',
      confirmLabel: 'Delete Project',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteProject(project.id)
          if (projectFilterId === project.id) setProjectFilterId(null)
          setConfirmDialog(null)
          showToast(`Project "${project.name}" deleted. Issues moved to Unassigned.`)
        } catch (err) {
          showToast('Failed to delete project', 'error')
        }
      },
      onCancel: () => setConfirmDialog(null),
    })
  }

  // Backup reminder calculation
  const shouldShowBackupReminder = useMemo(() => {
    if (!settings) return false
    if (issues.length < 3) return false

    // Check if dismissed recently (within 7 days)
    if (settings.backupReminderDismissedAt) {
      const dismissedTime = new Date(settings.backupReminderDismissedAt).getTime()
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
      if (daysSinceDismissed < 7) return false
    }

    // Check if exported recently (within 14 days)
    if (settings.lastBackupExportAt) {
      const exportedTime = new Date(settings.lastBackupExportAt).getTime()
      const daysSinceExport = (Date.now() - exportedTime) / (1000 * 60 * 60 * 24)
      if (daysSinceExport < 14) return false
    }

    return true
  }, [settings, issues.length])

  // Content Renderer
  const renderTabContent = () => {
    if (currentTab === 'projects') {
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
        />
      )
    }

    if (currentTab === 'settings') {
      return (
        <SettingsView
          onClearAllData={clearAllData}
          onRestoreBackup={restoreBackup}
          onToast={showToast}
          onOpenKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
          onOpenAbout={() => setShowAbout(true)}
        />
      )
    }

    // Inbox or Fixed View
    const isFixedView = currentTab === 'fixed'
    const targetIssues = isFixedView ? fixedIssues : openIssues

    return (
      <ListView
        title={isFixedView ? 'Fixed' : 'Inbox'}
        subtitle={
          isFixedView
            ? 'A little less to worry about.'
            : 'Capture it now. Fix it later.'
        }
        issues={targetIssues}
        projects={projects}
        screenshotUrls={screenshotUrls}
        onSelectIssue={issue => setSelectedIssueId(issue.id)}
        onNewIssue={() => setShowNewIssueModal(true)}
        onToggleFixed={handleToggleFixed}
        onCopyPrompt={handleCopyPrompt}
        onDeleteIssue={handleDeleteIssueRequest}
        emptyHeading={isFixedView ? 'No fixes yet' : 'Nothing to fix. Yet.'}
        emptySub={
          isFixedView
            ? 'Issues you mark as fixed will appear here.'
            : 'Capture bugs, feedback or ideas while you build.'
        }
        showCaptureOnEmpty={!isFixedView}
        activeProjectFilter={projectFilterId}
        onClearProjectFilter={() => setProjectFilterId(null)}
      />
    )
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
      onBack={() => setSelectedIssueId(null)}
      onToggleFixed={() => handleToggleFixed(selectedIssue)}
      onCopyPrompt={() => handleCopyPrompt(selectedIssue)}
      onDelete={() => handleDeleteIssueRequest(selectedIssue)}
      onUpdate={async (updates, newScreenshotBlob, filename) => {
        await updateIssue(selectedIssue.id, updates, newScreenshotBlob, filename)
        showToast('Issue updated')
      }}
      onZoomScreenshot={url => setZoomImageUrl(url)}
    />
  ) : null

  return (
    <div className="flex h-screen bg-white overflow-hidden text-gray-900 antialiased selection:bg-[#EEF0FF] selection:text-[#5B50F6]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={tab => {
            setCurrentTab(tab)
            setSelectedIssueId(null)
          }}
          inboxCount={openIssues.length}
          fixedCount={fixedIssues.length}
        />
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
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
          <div className="bg-[#EEF0FF] border-b border-[#D8DDFF] px-5 py-2.5 flex items-center justify-between text-[12px] text-[#4338CA] animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-[#5B50F6] shrink-0" />
              <span>
                <strong>Backup reminder:</strong> Your data is stored only in this browser. Remember to export a backup.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentTab('settings')}
                className="font-semibold underline hover:text-[#251D98] flex items-center gap-1"
              >
                <Download size={12} />
                Export
              </button>
              <button
                type="button"
                aria-label="Dismiss reminder"
                onClick={dismissBackupReminder}
                className="text-[#5B50F6] hover:text-[#251D98]"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Center Canvas */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Split View if issue is selected */}
          {selectedIssue ? (
            <>
              {/* Left: list on desktop (hidden on mobile when issue is open) */}
              <div className="hidden md:flex flex-1 overflow-hidden border-r border-gray-100">
                {renderTabContent()}
              </div>

              {/* Right: issue detail panel on desktop, full screen on mobile */}
              <div className="flex-1 md:flex-initial md:w-[460px] lg:w-[500px] flex flex-col overflow-hidden bg-white">
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
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-64 bg-white h-full shadow-2xl p-4 flex flex-col animate-in slide-in-from-left duration-200">
            <Sidebar
              currentTab={currentTab}
              onSelectTab={tab => {
                setCurrentTab(tab)
                setSelectedIssueId(null)
                setMobileDrawerOpen(false)
              }}
              inboxCount={openIssues.length}
              fixedCount={fixedIssues.length}
            />
          </div>
        </div>
      )}

      {/* Capture New Issue Modal */}
      {showNewIssueModal && (
        <NewIssueModal
          projects={projects}
          defaultProjectId={projectFilterId}
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
