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
  Unlock,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import type { BackupData, EncryptedBackupPayload } from '../../../types'
import {
  exportBackupFile,
  triggerDownload,
  validateBackupStructure,
  decryptBackup
} from '../../../services/backupService'
import { formatBytes } from '../../../services/storageService'
import { useStorageEstimate } from '../../../hooks/useStorageEstimate'

interface SettingsViewProps {
  onClearAllData: () => Promise<void>
  onRestoreBackup: (data: BackupData) => Promise<void>
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onOpenKeyboardShortcuts: () => void
  onOpenAbout: () => void
}

export function SettingsView({
  onClearAllData,
  onRestoreBackup,
  onToast,
  onOpenKeyboardShortcuts,
  onOpenAbout,
}: SettingsViewProps) {
  const { estimate, requestPersistence, refreshEstimate } = useStorageEstimate()

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

  return (
    <div className="flex-1 overflow-y-auto bg-white select-none">
      {/* Header matching bugstow_06_settings.png */}
      <div className="px-6 pt-6 pb-5">
        <h1 className="text-[24px] font-bold text-gray-900 tracking-tight">Settings</h1>
      </div>

      <div className="px-6 pb-12 flex flex-col gap-8 max-w-xl">
        {/* Data & Backup Section */}
        <div>
          <h3 className="text-[13px] font-semibold text-gray-500 mb-1">Data & Backup</h3>
          <p className="text-[13px] text-gray-400 mb-3.5">
            Keep your data safe. Everything stays on your device.
          </p>

          <div className="bg-white border border-gray-200/90 rounded-2xl overflow-hidden shadow-xs divide-y divide-gray-100">
            {/* Export Backup button */}
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="w-full flex items-center gap-3 px-5 py-4 text-[14px] text-gray-800 hover:bg-gray-50/80 active:bg-gray-100 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <Download size={16} />
              </div>
              <div className="flex-1">
                <span className="font-semibold block">Export Backup</span>
                <span className="text-[12px] text-gray-400">Save your projects, issues, and screenshots</span>
              </div>
              <span className="text-gray-300 text-lg">&rsaquo;</span>
            </button>

            {/* Import Backup button */}
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="w-full flex items-center gap-3 px-5 py-4 text-[14px] text-gray-800 hover:bg-gray-50/80 active:bg-gray-100 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <Upload size={16} />
              </div>
              <div className="flex-1">
                <span className="font-semibold block">Import Backup</span>
                <span className="text-[12px] text-gray-400">Restore from an exported JSON backup file</span>
              </div>
              <span className="text-gray-300 text-lg">&rsaquo;</span>
            </button>

            {/* Storage explanation & persistence banner */}
            <div className="p-4 bg-[#F4F6FF]/70 border-t border-[#E0E4FE]/60 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Shield size={18} className="text-[#5B50F6] shrink-0 mt-0.5" />
                <div className="flex-1 text-[12px]">
                  <p className="font-semibold text-gray-900">Your data is stored locally</p>
                  <p className="text-gray-500 mt-0.5 leading-relaxed">
                    Nothing is sent to any server. You are in complete control of your data.
                  </p>
                </div>
              </div>

              {/* Approximate Storage usage info */}
              <div className="bg-white/80 rounded-xl p-3 border border-gray-200/60 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <HardDrive size={13} className="text-gray-400" />
                    Storage used:
                  </span>
                  <span className="font-mono font-medium text-gray-800">
                    {formatBytes(estimate.usageBytes)}
                    {estimate.quotaBytes > 0 && ` (approx. ${formatBytes(estimate.quotaBytes)} available)`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[12px] pt-1 border-t border-gray-100">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className={estimate.persisted ? 'text-emerald-500' : 'text-gray-400'} />
                    Browser Persistence:
                  </span>
                  {estimate.persisted ? (
                    <span className="text-emerald-600 font-medium">Enabled</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestPersistence}
                      disabled={isPersisting}
                      className="text-[11px] font-semibold text-[#5B50F6] hover:underline disabled:opacity-50"
                    >
                      {isPersisting ? 'Requesting...' : 'Request Persistence'}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-gray-400 leading-snug">
                Persistent storage reduces automatic eviction risk during low disk events, but cannot prevent manual browser resets.
              </p>
            </div>
          </div>
        </div>

        {/* App Section */}
        <div>
          <h3 className="text-[13px] font-semibold text-gray-500 mb-3">App</h3>
          <div className="bg-white border border-gray-200/90 rounded-2xl overflow-hidden shadow-xs divide-y divide-gray-100">
            {/* Theme */}
            <div className="flex items-center gap-3 px-5 py-4">
              <Layout size={16} className="text-gray-400" />
              <span className="flex-1 text-[14px] text-gray-700">Theme</span>
              <span className="text-[13px] text-gray-400">Light</span>
            </div>

            {/* Keyboard Shortcuts */}
            <button
              type="button"
              onClick={onOpenKeyboardShortcuts}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <Keyboard size={16} className="text-gray-400" />
              <span className="flex-1 text-[14px] text-gray-700">Keyboard Shortcuts</span>
              <span className="text-[13px] text-gray-400 font-mono">⌘ K &rsaquo;</span>
            </button>

            {/* About */}
            <button
              type="button"
              onClick={onOpenAbout}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <Info size={16} className="text-gray-400" />
              <span className="flex-1 text-[14px] text-gray-700">About Bugstow</span>
              <span className="text-[13px] text-gray-400">&rsaquo;</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-5 py-3 text-[14px] font-semibold text-[#F04438] bg-[#FEECEB]/60 border border-[#FEECEB] hover:bg-[#FEECEB] active:bg-[#FEECEB]/80 rounded-2xl transition-all shadow-xs"
          >
            <Trash2 size={16} />
            <span>Clear All Data</span>
          </button>
          <p className="text-[12px] text-gray-400 mt-2 pl-1">
            This will permanently delete all your projects, issues and screenshots from local storage.
          </p>
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-xs" onClick={onClose} />
      <form
        onSubmit={handleExport}
        className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download size={18} className="text-[#5B50F6]" />
            <h3 className="text-[17px] font-bold text-gray-900">Export Backup</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            <X size={15} />
          </button>
        </div>

        <p className="text-[13px] text-gray-500 leading-relaxed">
          Create a full, portable backup of all your projects, issues, and screenshots.
        </p>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Encrypt toggle */}
        <label className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            checked={encrypt}
            onChange={e => setEncrypt(e.target.checked)}
            className="mt-0.5 rounded text-[#5B50F6] focus:ring-[#5B50F6]"
          />
          <div className="text-[13px]">
            <span className="font-semibold text-gray-800 flex items-center gap-1.5">
              <Lock size={13} className="text-[#5B50F6]" />
              Encrypt backup with passphrase (recommended)
            </span>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Uses AES-256-GCM. A lost passphrase cannot be recovered.
            </p>
          </div>
        </label>

        {encrypt ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[12px] font-semibold text-gray-600 block mb-1">Passphrase</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter a secure passphrase"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  className="w-full px-3.5 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#5B50F6] pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-gray-600 block mb-1">Confirm Passphrase</label>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Confirm your passphrase"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                className="w-full px-3.5 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#5B50F6]"
              />
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 text-amber-600 mt-0.5" />
            <span>
              Unencrypted export stores all issues and screenshots in plain text in the downloaded JSON file. Anyone with access to the file can view them.
            </span>
          </div>
        )}

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-[13px] font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isExporting}
            className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl shadow-sm disabled:opacity-50"
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
  onClose,
  onRestoreDone,
  onError,
}: {
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
      setError('Incorrect passphrase or corrupted backup file. Your existing data remains safe.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirmRestore = async () => {
    if (!validatedData) return
    setIsProcessing(true)
    setError(null)
    try {
      await onRestoreDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed.')
      onError('Restore failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-[#5B50F6]" />
            <h3 className="text-[17px] font-bold text-gray-900">Import Backup</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            <X size={15} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Select File */}
        {!fileContent && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:border-[#5B50F6] transition-colors bg-gray-50/70"
          >
            <Upload size={24} className="text-gray-400" />
            <p className="text-[13px] font-semibold text-gray-700">Click to select backup file</p>
            <p className="text-[11px] text-gray-400">Supported: .json or .enc.json</p>
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
          <form onSubmit={handleDecrypt} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-[12px] text-blue-800">
              <Lock size={15} className="text-blue-600 shrink-0" />
              <span>This backup is encrypted. Enter its passphrase to decrypt.</span>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-gray-600 block mb-1">Passphrase</label>
              <input
                autoFocus
                type="password"
                placeholder="Enter passphrase"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                className="w-full px-3.5 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#5B50F6]"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing || !passphrase}
              className="w-full py-2.5 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl shadow-sm disabled:opacity-50"
            >
              {isProcessing ? 'Decrypting...' : 'Decrypt & Verify'}
            </button>
          </form>
        )}

        {/* Step 3: Confirmation Summary */}
        {validatedData && validationSummary && (
          <div className="flex flex-col gap-3.5">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[13px] text-emerald-900">
              <p className="font-bold flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Valid Backup Detected
              </p>
              <div className="text-[12px] text-emerald-800 space-y-0.5">
                <p>• {validationSummary.projectsCount} Projects</p>
                <p>• {validationSummary.issuesCount} Issues</p>
                <p>• {validationSummary.screenshotsCount} Screenshots</p>
                <p className="text-emerald-700/80 text-[11px] pt-1">
                  Exported on: {new Date(validationSummary.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-900 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
              <span>
                Restoring will replace all current issues and projects in this browser with the backup contents.
              </span>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 py-2.5 text-[13px] font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isProcessing}
                className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl shadow-sm disabled:opacity-50"
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
        <h3 className="text-[17px] font-bold text-gray-900 mb-2">Clear all local data?</h3>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
          This will permanently wipe all your projects, issues, and screenshots stored in this browser. Without an exported backup, this action is irreversible.
        </p>

        <div className="mb-5">
          <label className="text-[12px] font-semibold text-gray-600 block mb-1">
            Type <span className="font-mono text-red-600">DELETE</span> to confirm:
          </label>
          <input
            autoFocus
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder="DELETE"
            className="w-full px-3.5 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing}
            className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-100 rounded-xl"
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
            className="px-4 py-2 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-40 transition-colors shadow-sm"
          >
            {isClearing ? 'Clearing...' : 'Clear All Data'}
          </button>
        </div>
      </div>
    </div>
  )
}
