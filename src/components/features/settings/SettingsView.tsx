import React, { useState, useRef } from 'react'
import {
  Download,
  Upload,
  Shield,
  Layout,
  Keyboard,
  Info,
  Trash2,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
  Users
} from 'lucide-react'
import type { BackupData, EncryptedBackupPayload } from '../../../types'
import type { Theme } from '../../../hooks/useTheme'
import {
  exportBackupFile,
  triggerDownload,
  validateBackupStructure,
  decryptBackup
} from '../../../services/backupService'
import { formatBytes } from '../../../services/storageService'
import { useStorageEstimate } from '../../../hooks/useStorageEstimate'
import type { CloudSync } from '../../../hooks/useCloudSync'
import { CloudSyncPanel } from './CloudSyncPanel'

interface SettingsViewProps {
  theme: Theme
  onSetTheme: (theme: Theme) => void
  onClearAllData: () => Promise<void>
  onRestoreBackup: (data: BackupData) => Promise<void>
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onOpenKeyboardShortcuts: () => void
  onOpenAbout: () => void
  onSwitchToTeam?: () => void
  cloudSync?: CloudSync
  onDataChanged?: () => void
}

export function SettingsView({
  theme,
  onSetTheme,
  onClearAllData,
  onRestoreBackup,
  onToast,
  onOpenKeyboardShortcuts,
  onOpenAbout,
  onSwitchToTeam,
  cloudSync,
  onDataChanged,
}: SettingsViewProps) {
  const { estimate, requestPersistence } = useStorageEstimate()

  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isPersisting, setIsPersisting] = useState(false)

  const handleRequestPersistence = async () => {
    setIsPersisting(true)
    try {
      const granted = await requestPersistence()
      if (granted) {
        onToast('Persistent storage granted by browser')
      } else {
        onToast('Persistent storage not granted or not supported', 'info')
      }
    } catch (err) {
      onToast('Could not request persistent storage', 'error')
    } finally {
      setIsPersisting(false)
    }
  }

  const themeOptions: Array<{ value: Theme; label: string; icon: React.ElementType }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950 select-none transition-colors">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage local storage, theme preferences, and encrypted offline backups.
        </p>
      </div>

      <div className="px-8 py-8 flex flex-col gap-8 max-w-2xl">
        {/* Appearance Section */}
        <div>
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Appearance
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3.5">
            Choose your preferred color mode.
          </p>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Layout size={18} />
              </div>
              <div>
                <span className="text-[15px] font-semibold text-slate-900 dark:text-white block">Theme Mode</span>
                <span className="text-xs text-slate-400">Current: {theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
              </div>
            </div>

            {/* 3-way toggle button group */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              {themeOptions.map(opt => {
                const active = theme === opt.value
                const IconComponent = opt.icon
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSetTheme(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      active
                        ? 'bg-white dark:bg-slate-700 text-[#5B50F6] dark:text-indigo-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <IconComponent size={14} />
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {cloudSync && <CloudSyncPanel sync={cloudSync} onToast={onToast} onDataChanged={onDataChanged ?? (() => {})} />}

        {/* Team mode */}
        {onSwitchToTeam && (
          <div>
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Workspace
            </h3>
            <button
              type="button"
              onClick={onSwitchToTeam}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-4 flex items-center gap-3.5 text-left hover:border-[#5B50F6] transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[#5B50F6] dark:text-indigo-300">
                <Users size={18} />
              </div>
              <div className="flex-1">
                <span className="text-[15px] font-semibold text-slate-900 dark:text-white block">Switch to Team mode</span>
                <span className="text-xs text-slate-400">Sign in to share issues, assign teammates, and import from GitHub</span>
              </div>
              <span className="text-slate-400 text-lg font-bold">&rsaquo;</span>
            </button>
          </div>
        )}

        {/* Data & Backup Section */}
        <div>
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Data & Backup
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3.5">
            Keep your data safe. Everything stays on your local device.
          </p>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
            {/* Export Backup button */}
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Download size={18} />
              </div>
              <div className="flex-1">
                <span className="text-[15px] font-semibold text-slate-900 dark:text-white block">Export Backup</span>
                <span className="text-xs text-slate-400">Save your projects, issues, and screenshots into JSON</span>
              </div>
              <span className="text-slate-400 text-lg font-bold">&rsaquo;</span>
            </button>

            {/* Import Backup button */}
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Upload size={18} />
              </div>
              <div className="flex-1">
                <span className="text-[15px] font-semibold text-slate-900 dark:text-white block">Import Backup</span>
                <span className="text-xs text-slate-400">Restore from an exported JSON or encrypted backup</span>
              </div>
              <span className="text-slate-400 text-lg font-bold">&rsaquo;</span>
            </button>

            {/* Storage explanation & persistence banner */}
            <div className="p-5 bg-indigo-50/50 dark:bg-slate-850 border-t border-indigo-100/60 dark:border-slate-800 flex flex-col gap-3.5">
              <div className="flex items-start gap-3">
                <Shield size={20} className="text-[#5B50F6] shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Your data stays in this browser</p>
                  <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Projects, issues and screenshots are saved in this browser's storage (IndexedDB) and are not
                    uploaded by BugsTow. There are no analytics or telemetry. Browser storage is not encrypted on
                    disk, so use an encrypted backup for copies you keep elsewhere.
                  </p>
                </div>
              </div>

              {/* Approximate Storage usage info */}
              <div className="bg-white/90 dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <HardDrive size={14} className="text-slate-400" />
                    Storage used:
                  </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {formatBytes(estimate.usageBytes)}
                    {estimate.quotaBytes > 0 && ` (approx. ${formatBytes(estimate.quotaBytes)} available)`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <CheckCircle2 size={14} className={estimate.persisted ? 'text-emerald-500' : 'text-slate-400'} />
                    Browser Persistence:
                  </span>
                  {estimate.persisted ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Enabled</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestPersistence}
                      disabled={isPersisting}
                      className="text-xs font-semibold text-[#5B50F6] dark:text-indigo-400 hover:underline disabled:opacity-50"
                    >
                      {isPersisting ? 'Requesting...' : 'Request Persistence'}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug">
                Persistent storage reduces eviction risk during low disk events. Remember to export regular backups.
              </p>
            </div>
          </div>
        </div>

        {/* Application Information Section */}
        <div>
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Help & Info
          </h3>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
            {/* Keyboard Shortcuts */}
            <button
              type="button"
              onClick={onOpenKeyboardShortcuts}
              className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <Keyboard size={18} className="text-slate-400" />
              <span className="flex-1 text-[15px] font-semibold text-slate-800 dark:text-slate-200">
                Keyboard Shortcuts
              </span>
              <span className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">⌘ K / Esc</span>
            </button>

            {/* About */}
            <button
              type="button"
              onClick={onOpenAbout}
              className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <Info size={18} className="text-slate-400" />
              <span className="flex-1 text-[15px] font-semibold text-slate-800 dark:text-slate-200">
                About Bugstow
              </span>
              <span className="text-slate-400 text-lg font-bold">&rsaquo;</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div>
          <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider mb-2">
            Danger Zone
          </h3>
          <div className="p-5 bg-red-50/50 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-bold text-red-900 dark:text-red-200">Wipe Local Database</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                Permanently deletes all projects, issues, and screenshots stored in this browser.
                {cloudSync?.connection && ' Cloud sync is turned off on this device; the copy in your cloud is kept.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-all shadow-xs"
            >
              <Trash2 size={16} />
              <span>Clear All Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportBackupModal
          onClose={() => setShowExportModal(false)}
          onExportDone={filename => {
            setShowExportModal(false)
            onToast(`Backup saved: ${filename}`)
          }}
          onError={err => onToast(err, 'error')}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportBackupModal
          onRestore={onRestoreBackup}
          onClose={() => setShowImportModal(false)}
          onRestoreDone={() => {
            setShowImportModal(false)
            onToast('Backup restored successfully!')
          }}
          onError={err => onToast(err, 'error')}
        />
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <ClearDataModal
          onConfirm={async () => {
            setShowClearConfirm(false)
            await onClearAllData()
            onToast('All local data has been cleared')
          }}
          onClose={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  )
}

// ── Export Backup Modal ───────────────────────────────────────────────────

function ExportBackupModal({
  onClose,
  onExportDone,
  onError,
}: {
  onClose: () => void
  onExportDone: (filename: string) => void
  onError: (msg: string) => void
}) {
  const [encrypt, setEncrypt] = useState(true)
  const [passphrase, setPassphrase] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (encrypt) {
      if (!passphrase || passphrase.length < 6) {
        setError('Passphrase must be at least 6 characters long.')
        return
      }
      if (passphrase !== confirmPass) {
        setError('Passphrases do not match.')
        return
      }
    }

    setIsExporting(true)
    try {
      const { filename, blob } = await exportBackupFile(encrypt ? passphrase : undefined)
      triggerDownload(blob, filename)
      onExportDone(filename)
    } catch (err) {
      console.error('Export failed:', err)
      setError('Export failed. Please try again.')
      onError('Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 select-none">
      <div className="absolute inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <form
        onSubmit={handleExport}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-md p-6 sm:p-7 flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Download size={20} className="text-[#5B50F6]" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Export Backup</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Create a full, portable backup of all your projects, issues, and screenshots into a single file.
        </p>

        {error && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Encrypt toggle */}
        <label className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            checked={encrypt}
            onChange={e => setEncrypt(e.target.checked)}
            className="mt-0.5 rounded text-[#5B50F6] focus:ring-[#5B50F6]"
          />
          <div className="text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Lock size={13} className="text-[#5B50F6]" />
              Encrypt backup with passphrase (recommended)
            </span>
            <p className="text-slate-400 dark:text-slate-500 mt-0.5">
              Uses AES-256-GCM encryption. A lost passphrase cannot be recovered.
            </p>
          </div>
        </label>

        {encrypt ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1 uppercase tracking-wider">
                Passphrase
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter a secure passphrase"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] pr-10 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1 uppercase tracking-wider">
                Confirm Passphrase
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Confirm your passphrase"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] text-slate-900 dark:text-white"
              />
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
            <span>
              Unencrypted export stores all issues and screenshots in plain text.
            </span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isExporting}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl shadow-sm disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Export Backup'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Import Backup Modal ───────────────────────────────────────────────────

function ImportBackupModal({
  onRestore,
  onClose,
  onRestoreDone,
  onError,
}: {
  onRestore: (data: BackupData) => Promise<void>
  onClose: () => void
  onRestoreDone: () => void
  onError: (msg: string) => void
}) {
  const [fileContent, setFileContent] = useState<Record<string, unknown> | null>(null)
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [validationSummary, setValidationSummary] = useState<{
    projectsCount: number
    issuesCount: number
    screenshotsCount: number
    createdAt: string
  } | null>(null)
  const [validatedData, setValidatedData] = useState<BackupData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    setError(null)
    setValidatedData(null)
    setValidationSummary(null)

    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = e.target?.result as string
        const parsed = JSON.parse(text)
        setFileContent(parsed)

        const check = validateBackupStructure(parsed)
        if (!check.isValid) {
          setError(check.error || 'Invalid backup file format.')
          return
        }

        if (check.isEncrypted) {
          setIsEncrypted(true)
        } else if (check.data && check.summary) {
          setIsEncrypted(false)
          setValidatedData(check.data)
          setValidationSummary(check.summary)
        }
      } catch (err) {
        setError('Failed to parse JSON file.')
      }
    }
    reader.readAsText(file)
  }

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passphrase) {
      setError('Please enter the passphrase.')
      return
    }

    setIsProcessing(true)
    setError(null)
    try {
      const decrypted = await decryptBackup(fileContent as unknown as EncryptedBackupPayload, passphrase)
      const check = validateBackupStructure(decrypted)
      if (!check.isValid || !check.data || !check.summary) {
        setError(check.error || 'Decrypted backup has an invalid structure.')
        return
      }

      setValidatedData(check.data)
      setValidationSummary(check.summary)
    } catch (err) {
      setError('Incorrect passphrase or corrupted backup file.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirmRestore = async () => {
    if (!validatedData) return
    setIsProcessing(true)
    setError(null)
    try {
      await onRestore(validatedData)
      onRestoreDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed.')
      onError('Restore failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 select-none">
      <div className="absolute inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-md p-6 sm:p-7 flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Upload size={20} className="text-[#5B50F6]" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Import Backup</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Select File */}
        {!fileContent && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:border-[#5B50F6] transition-colors bg-slate-50/70 dark:bg-slate-800/40"
          >
            <Upload size={26} className="text-[#5B50F6]" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Click to select backup file</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Supports .json or .enc.json backups</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
              }}
            />
          </div>
        )}

        {/* Step 2: Encrypted Passphrase Prompt */}
        {fileContent !== null && isEncrypted && !validatedData && (
          <form onSubmit={handleDecrypt} className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-800 dark:text-blue-300">
              <Lock size={16} className="text-blue-600 shrink-0" />
              <span>This backup is encrypted. Enter its passphrase to decrypt.</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1 uppercase tracking-wider">
                Passphrase
              </label>
              <input
                autoFocus
                type="password"
                placeholder="Enter passphrase"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing || !passphrase}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl shadow-sm disabled:opacity-50"
            >
              {isProcessing ? 'Decrypting...' : 'Decrypt & Verify'}
            </button>
          </form>
        )}

        {/* Step 3: Confirmation Summary */}
        {validatedData && validationSummary && (
          <div className="flex flex-col gap-3.5">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200">
              <p className="font-bold flex items-center gap-1.5 mb-2 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Valid Backup Detected
              </p>
              <div className="space-y-1 text-slate-700 dark:text-slate-300">
                <p>• {validationSummary.projectsCount} Projects</p>
                <p>• {validationSummary.issuesCount} Issues</p>
                <p>• {validationSummary.screenshotsCount} Screenshots</p>
                <p className="text-[11px] text-slate-400 pt-1">
                  Exported on: {new Date(validationSummary.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
              <span>
                Restoring will replace all current issues and projects in this browser with the backup contents.
              </span>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isProcessing}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl shadow-sm disabled:opacity-50"
              >
                {isProcessing ? 'Restoring...' : 'Replace & Restore'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Clear Data Modal ──────────────────────────────────────────────────────

function ClearDataModal({
  onConfirm,
  onClose,
}: {
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const [isClearing, setIsClearing] = useState(false)

  const isMatch = typed.trim().toLowerCase() === 'delete'

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 select-none">
      <div className="absolute inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-sm p-6 sm:p-7 animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Clear all local data?</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
          This will permanently wipe all your projects, issues, and screenshots stored in this browser. This cannot be undone without a backup file.
        </p>

        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1 uppercase tracking-wider">
            Type <span className="font-mono text-red-600 dark:text-red-400 font-bold">DELETE</span> to confirm:
          </label>
          <input
            autoFocus
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder="DELETE"
            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-red-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isMatch || isClearing}
            onClick={async () => {
              setIsClearing(true)
              await onConfirm()
            }}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-40 transition-colors shadow-sm"
          >
            {isClearing ? 'Clearing...' : 'Clear All Data'}
          </button>
        </div>
      </div>
    </div>
  )
}
