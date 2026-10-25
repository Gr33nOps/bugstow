import { ConfirmModal } from '../common/Modals'
import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  GitBranch,
  ImagePlus,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import type { IssueType, IssuePriority, IssueSeverity, IssueDetails, IssueStatus } from '../../types'
import type { TeamIssue, TeamMember, TeamIssueEvent } from '../../types/team'
import { IssueConflictError, fetchScreenshotBlob, listIssueActivity, addIssueComment, deleteIssueComment, type ScreenshotUpload } from '../../services/teamApi'
import { copyTextAndImageToClipboard } from '../../services/promptService'
import { generatePromptWithTemplate } from '../../services/promptTemplates'
import { usePromptTemplateSelection } from '../common/PromptTemplateControls'
import { FixReferences } from '../common/FixReferences'
import { normalizeCustomBadge } from '../../lib/writingAssist'
import { displayLogin } from '../../lib/login'
import { GithubMark, timeAgo, TypeBadge } from '../common/Icon'
import { WritingTools } from '../common/WritingTools'
import { IssueReportFields, IssueReportSummary, PriorityBadge, STATUS_LABELS } from '../common/IssueReportFields'

type IssueUpdates = Partial<{
  title: string
  description: string
  type: IssueType
  customType: string | null
  status: IssueStatus
  priority: IssuePriority
  severity: IssueSeverity | null
  details: IssueDetails
  projectId: string | null
  assigneeId: string | null
  fixReferences: string[]
}>

interface PendingImage {
  file: File
  previewUrl: string
}

interface TeamIssueDetailProps {
  issue: TeamIssue
  members: TeamMember[]
  projects: { id: string; name: string }[]
  loadScreenshotUrl: (id: string) => Promise<string | undefined>
  onUpdate: (id: string, updates: IssueUpdates) => Promise<TeamIssue>
  onSyncScreenshots: (id: string, keepIds: string[], additions: ScreenshotUpload[]) => Promise<string[]>
  onReload: (latest: TeamIssue) => void
  onDelete: (id: string) => Promise<void>
  onClose: () => void
  onToast: (message: string) => void
  currentUserId: string
  onCopyLink: () => Promise<void>
}

function fileToUpload(file: File): Promise<ScreenshotUpload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve({
        base64: result.split(',')[1] || '',
        mimeType: file.type || 'image/png',
        filename: file.name,
      })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function TeamIssueDetail({
  issue,
  members,
  projects,
  loadScreenshotUrl,
  onUpdate,
  onSyncScreenshots,
  onReload,
  onDelete,
  onClose,
  onToast,
  currentUserId,
  onCopyLink,
}: TeamIssueDetailProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [conflict, setConflict] = useState<TeamIssue | null>(null)
  const [title, setTitle] = useState(issue.title)
  const [description, setDescription] = useState(issue.description)
  const [projectId, setProjectId] = useState(issue.project_id || '')
  const [assigneeId, setAssigneeId] = useState(issue.assignee_id || '')
  const [typeChoice, setTypeChoice] = useState<IssueType | 'custom'>(issue.custom_type ? 'custom' : issue.type)
  const [customType, setCustomType] = useState(issue.custom_type || '')
  const [priority, setPriority] = useState<IssuePriority>(issue.priority || 'medium')
  const [severity, setSeverity] = useState<IssueSeverity | null>(issue.severity || null)
  const [details, setDetails] = useState<IssueDetails>(issue.details || {})
  const promptTemplate = usePromptTemplateSelection()
  const [keepIds, setKeepIds] = useState(issue.screenshot_ids)
  const [newImages, setNewImages] = useState<PendingImage[]>([])
  const newImagesRef = useRef<PendingImage[]>([])
  const [shotUrls, setShotUrls] = useState<Record<string, string>>({})
  const [events, setEvents] = useState<TeamIssueEvent[]>([])
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  newImagesRef.current = newImages
  useEffect(() => () => {
    newImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl))
  }, [])

  const clearNewImages = () => {
    newImages.forEach((image) => URL.revokeObjectURL(image.previewUrl))
    setNewImages([])
  }

  const resetDraft = () => {
    setTitle(issue.title)
    setDescription(issue.description)
    setProjectId(issue.project_id || '')
    setAssigneeId(issue.assignee_id || '')
    setTypeChoice(issue.custom_type ? 'custom' : issue.type)
    setCustomType(issue.custom_type || '')
    setPriority(issue.priority || 'medium')
    setSeverity(issue.severity || null)
    setDetails(issue.details || {})
    setKeepIds(issue.screenshot_ids)
    clearNewImages()
    setConflict(null)
  }

  useEffect(() => {
    resetDraft()
    setEditing(false)
    // The selected issue is the reset boundary; later prop updates are the result of this editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id])
  useEffect(() => {
    listIssueActivity(issue.id).then(setEvents).catch(() => setEvents([]))
  }, [issue.id, issue.updated_at])

  useEffect(() => {
    let alive = true
    Promise.all(issue.screenshot_ids.map(async (id) => [id, await loadScreenshotUrl(id)] as const))
      .then((entries) => {
        if (!alive) return
        setShotUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))))
      })
      .catch(() => {
        if (alive) setShotUrls({})
      })
    return () => { alive = false }
  }, [issue.screenshot_ids, loadScreenshotUrl])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const addFiles = (incoming: Iterable<File>) => {
    const additions = Array.from(incoming)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    if (additions.length > 0) setNewImages((current) => [...current, ...additions])
    if (fileRef.current) fileRef.current.value = ''
  }

  useEffect(() => {
    if (!editing) return
    const paste = (event: ClipboardEvent) => {
      const images = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      if (images.length > 0) {
        addFiles(images)
      }
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  }, [editing])

  const saveUpdate = async (updates: IssueUpdates) => {
    if (conflict) return null
    try {
      return await onUpdate(issue.id, updates)
    } catch (error) {
      if (error instanceof IssueConflictError) {
        setConflict(error.latest)
        return null
      }
      onToast(error instanceof Error ? error.message : 'Update failed')
      return null
    }
  }

  const promptText = () => generatePromptWithTemplate(
    {
      id: issue.id,
      projectId: issue.project_id,
      title: issue.title,
      description: issue.description,
      type: issue.type,
      customType: issue.custom_type || undefined,
      status: issue.status,
      priority: issue.priority,
      severity: issue.severity,
      details: issue.details,
      screenshotId: null,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    },
    issue.project_id
      ? { id: issue.project_id, name: issue.project_name || 'Project', color: '#0f766e', createdAt: '', updatedAt: '' }
      : null,
    promptTemplate.templateId,
    promptTemplate.customTemplate,
  )

  const copyPrompt = async () => {
    let blob: Blob | null = null
    if (issue.screenshot_ids[0]) {
      try { blob = await fetchScreenshotBlob(issue.screenshot_ids[0]) } catch { /* text still copies */ }
    }
    const result = await copyTextAndImageToClipboard(promptText(), blob)
    onToast(result.imageCopied ? 'Prompt and screenshot copied' : result.textCopied ? 'Prompt copied' : 'Copy failed')
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(promptText())
      onToast('Prompt text copied')
    } catch {
      onToast('Copy failed')
    }
  }

  const save = async () => {
    if (!title.trim()) return onToast('Title is required')
    const badge = typeChoice === 'custom' ? normalizeCustomBadge(customType) : null
    if (typeChoice === 'custom' && !badge) return onToast('Enter a name for the custom badge')
    setSaving(true)
    const updated = await saveUpdate({
      title: title.trim(),
      description: description.trim(),
      projectId: projectId || null,
      assigneeId: assigneeId || null,
      type: typeChoice === 'custom' ? 'idea' : typeChoice,
      customType: badge,
      priority,
      severity: typeChoice === 'bug' ? severity : null,
      details,
    })
    if (updated) {
      try {
        await onSyncScreenshots(issue.id, keepIds, await Promise.all(newImages.map(({ file }) => fileToUpload(file))))
        clearNewImages()
        setEditing(false)
        onToast('Issue updated')
      } catch (error) {
        onToast(error instanceof Error ? error.message : 'Could not update screenshots')
      }
    }
    setSaving(false)
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <button type="button" onClick={onClose} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
          <X size={16} /> <span>Close</span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-400 dark:bg-slate-800">Esc</kbd>
        </button>
        <div className="flex items-center gap-2.5">
          {!editing && (
            <button type="button" onClick={() => { resetDraft(); setEditing(true) }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200/80 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <Edit3 size={15} /> Edit issue
            </button>
          )}
          <div className="relative" ref={menuRef}>
            <button type="button" aria-label="More options" onClick={() => setMenuOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <MoreHorizontal size={17} />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-11 z-20 w-44 rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                <button type="button" role="menuitem" onClick={() => { resetDraft(); setEditing(true); setMenuOpen(false) }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"><Edit3 size={15} /> Edit issue</button>
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setConfirmDelete(true) }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"><Trash2 size={15} /> Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-6">
        {conflict && (
          <div role="alert" className="mb-5 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span><strong>This issue changed on another computer.</strong> Reload it before saving.</span></p>
            <button type="button" onClick={() => { onReload(conflict); setConflict(null); setEditing(false) }} className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white"><RefreshCw size={13} /> Reload issue</button>
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Edit issue</h2><span className="text-xs text-slate-400">Add notes, images, or change assignment</span></div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2"><label htmlFor="team-edit-title" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Title</label><WritingTools value={title} kind="title" fieldName="Title" onChange={setTitle} /></div>
              <input id="team-edit-title" name="title" autoComplete="off" value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-base text-slate-900 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2"><label htmlFor="team-edit-description" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Description and context</label><WritingTools value={description} kind="description" fieldName="Description" onChange={setDescription} /></div>
              <textarea id="team-edit-description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Add context, steps to reproduce, or requirements…" className="w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FieldSelect label="Project" value={projectId} onChange={setProjectId} options={[{ value: '', label: 'No project' }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} />
              <FieldSelect label="Issue type" value={typeChoice} onChange={(value) => setTypeChoice(value as IssueType | 'custom')} options={[{ value: 'bug', label: 'Bug' }, { value: 'uiux', label: 'UI/UX' }, { value: 'idea', label: 'Idea' }, { value: 'custom', label: 'Custom badge…' }]} />
              <FieldSelect label="Assignee" value={assigneeId} onChange={setAssigneeId} options={[{ value: '', label: 'Unassigned' }, ...members.map((member) => ({ value: member.user_id, label: member.name || displayLogin(member.email) || 'Member' }))]} />
            </div>
            {typeChoice === 'custom' && <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Custom badge<input name="customType" autoComplete="off" value={customType} maxLength={24} onChange={(event) => setCustomType(event.target.value)} placeholder="For example: Performance" className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-normal text-slate-900 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>}
            <IssueReportFields priority={priority} onPriorityChange={setPriority} severity={severity} onSeverityChange={setSeverity} details={details} onDetailsChange={setDetails} bug={typeChoice === 'bug'} />
            <div>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Screenshots and attachments</h3><span className="text-xs text-slate-400">{keepIds.length + newImages.length} image{keepIds.length + newImages.length === 1 ? '' : 's'}</span></div>
              <div className="grid grid-cols-2 gap-3">
                {keepIds.map((id, index) => shotUrls[id] && <ImageTile key={id} src={shotUrls[id]} label={`Screenshot ${index + 1}`} onRemove={() => setKeepIds((ids) => ids.filter((item) => item !== id))} />)}
                {newImages.map((image, index) => <ImageTile key={image.previewUrl} src={image.previewUrl} label={image.file.name || `New screenshot ${index + 1}`} onRemove={() => setNewImages((images) => { URL.revokeObjectURL(image.previewUrl); return images.filter((_, itemIndex) => itemIndex !== index) })} />)}
                <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-28 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 hover:border-brand dark:border-slate-700"><ImagePlus size={17} /> Add images</button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => event.target.files && addFiles(event.target.files)} />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Choose several images or paste screenshots one after another.</p>
            </div>
            <div className="flex gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
              <button type="button" onClick={() => { resetDraft(); setEditing(false) }} disabled={saving} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={save} disabled={saving || !title.trim()} className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <TypeBadge type={issue.type} customLabel={issue.custom_type} />
                <PriorityBadge priority={issue.priority} />
                {issue.project_name && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{issue.project_name}</span>}
                {issue.assignee_id && <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">Assigned to {issue.assignee_name || displayLogin(issue.assignee_email) || 'member'}</span>}
                <span className="ml-auto">{timeAgo(issue.created_at)}</span>
              </div>
              <h1 className="break-words text-2xl font-semibold leading-tight text-slate-950 dark:text-white">{issue.title}</h1>
            </div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Status<select aria-label="Issue status" className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" value={issue.status} onChange={event => void saveUpdate({ status: event.target.value as IssueStatus })}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <IssueReportSummary severity={issue.severity} details={issue.details} />
            <section><h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Description</h2>{issue.description ? <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{issue.description}</p> : <p className="text-sm italic text-slate-400">No description yet.</p>}</section>
            {issue.github_url && <a href={issue.github_url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand hover:underline"><GithubMark size={15} /> View on GitHub #{issue.github_number} <ExternalLink size={12} /></a>}
            <FixReferences links={issue.fix_references || []} onChange={async links => { const saved = await saveUpdate({ fixReferences: links }); if (!saved) throw new Error('Could not save fix references') }} />
            <button type="button" onClick={() => void onCopyLink()} className="w-fit rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700">Copy issue link</button>
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Copy size={15} className="text-brand" /> Copy for your AI assistant</h2><span className="text-xs text-slate-500">Paste into the tool you use</span></div>
              {promptTemplate.controls}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                <button type="button" onClick={copyPrompt} className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800"><Copy size={16} /> Copy with prompt</button>
                <button type="button" onClick={copyText} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800">Copy text</button>
                <button type="button" onClick={() => saveUpdate({ status: issue.status === 'fixed' ? 'open' : 'fixed' })} className="flex items-center justify-center gap-2 rounded-lg border border-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><Check size={16} /> {issue.status === 'fixed' ? 'Reopen' : 'Mark completed'}</button>
              </div>
            </section>
            {issue.screenshot_ids.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Screenshots ({issue.screenshot_ids.length})</h2><span className="text-xs text-slate-400">Click an image to enlarge it</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{issue.screenshot_ids.map((id, index) => shotUrls[id] && <a key={id} href={shotUrls[id]} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"><img src={shotUrls[id]} alt={`Screenshot ${index + 1}`} width="800" height="450" loading="lazy" className="h-auto w-full object-contain" /></a>)}</div></section>}
            <section className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-700"><h2 className="text-sm font-semibold">Activity and comments</h2>
              <ol className="space-y-2">{events.map(event => <li key={event.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800"><div className="flex items-center gap-2 text-xs text-slate-500"><strong>{event.author_name || 'Teammate'}</strong><span>{event.kind}</span><time dateTime={event.created_at}>{timeAgo(event.created_at)}</time>{event.kind === 'comment' && event.author_id === currentUserId && <button type="button" className="ml-auto underline" onClick={async () => { await deleteIssueComment(issue.id, event.id); setEvents(current => current.filter(item => item.id !== event.id)) }}>Delete</button>}</div><p className="mt-1 whitespace-pre-wrap">{event.body}</p></li>)}</ol>
              <form onSubmit={async event => { event.preventDefault(); if (!comment.trim() || posting) return; setPosting(true); try { const added = await addIssueComment(issue.id, comment); setEvents(current => [...current, added]); setComment('') } catch (error) { onToast(error instanceof Error ? error.message : 'Could not post comment') } finally { setPosting(false) } }} className="flex flex-col gap-2"><label htmlFor="team-comment" className="text-xs font-semibold">Add a comment</label><textarea id="team-comment" value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} rows={3} className="rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900" /><button type="submit" disabled={posting || !comment.trim()} className="w-fit rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Post comment</button></form>
            </section>
          </div>
        )}
      </div>
      {confirmDelete && <ConfirmModal title="Delete this issue?" message="The issue and its screenshots will move to Trash. Anyone in this workspace can restore it." confirmLabel="Move to Trash" isDestructive onCancel={() => setConfirmDelete(false)} onConfirm={() => { void onDelete(issue.id).catch(error => onToast(error instanceof Error ? error.message : 'Could not delete issue')) }} />}
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="min-w-0 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

function ImageTile({ src, label, onRemove }: { src: string; label: string; onRemove: () => void }) {
  return <div className="group relative aspect-video overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><img src={src} alt={label} width="800" height="450" loading="lazy" className="h-full w-full object-cover" /><button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/75 text-white"><X size={14} /></button></div>
}
