import { useState } from 'react'
import { getSavedCustomTemplate, PROMPT_TEMPLATES, saveCustomTemplate, type PromptTemplateId } from '../../services/promptTemplates'

export function usePromptTemplateSelection() {
  const [templateId, setTemplateId] = useState<PromptTemplateId>('fix')
  const [customTemplate, setCustomTemplate] = useState(getSavedCustomTemplate)
  const [message, setMessage] = useState('')
  const save = () => {
    try { saveCustomTemplate(customTemplate); setMessage('Saved in this browser') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save template') }
  }
  const controls = <details className="text-sm">
    <summary className="cursor-pointer text-slate-600 dark:text-slate-300">Prompt template</summary>
    <div className="mt-2 space-y-2">
      <select aria-label="Prompt template" value={templateId} onChange={event => { setTemplateId(event.target.value as PromptTemplateId); setMessage('') }} className="w-full rounded border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900">
        {PROMPT_TEMPLATES.map(template => <option key={template.id} value={template.id}>{template.label}</option>)}
        <option value="custom">My template</option>
      </select>
      {templateId === 'custom' && <><label className="block text-xs text-slate-600 dark:text-slate-300">Use {'{{issue}}'} for all issue details, {'{{title}}'} or {'{{description}}'} for individual fields.
        <textarea value={customTemplate} onChange={event => setCustomTemplate(event.target.value)} rows={5} maxLength={10_000} className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
      </label><button type="button" onClick={save} className="rounded border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700">Save template</button>{message && <span role="status" className="ml-2 text-xs">{message}</span>}</>}
    </div>
  </details>
  return { templateId, customTemplate, controls }
}
