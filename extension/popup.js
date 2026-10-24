const target = document.getElementById('target')
const status = document.getElementById('status')
const preview = document.getElementById('preview')
let savedOrigin = ''
let draft = null

function originFrom(value) {
  try {
    const url = new URL(value.trim())
    if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return null
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) return null
    return url.origin
  } catch { return null }
}

chrome.storage.local.get('bugstowOrigin').then(result => {
  savedOrigin = result.bugstowOrigin || ''
  target.value = savedOrigin
})

document.getElementById('save').addEventListener('click', async () => {
  const origin = originFrom(target.value)
  if (!origin) { status.textContent = 'Enter a localhost address or an HTTPS Team address.'; return }
  const allowed = await chrome.permissions.request({ origins: [`${origin}/*`] })
  if (!allowed) { status.textContent = 'BugsTow address access was not granted.'; return }
  await chrome.storage.local.set({ bugstowOrigin: origin })
  savedOrigin = origin
  target.value = origin
  status.textContent = 'Address saved. Choose what to capture.'
})

async function capture(withScreenshot) {
  if (!savedOrigin || target.value.trim() !== savedOrigin) { status.textContent = 'Save the BugsTow address first.'; return }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) { status.textContent = 'Open a web page before capturing.'; return }
  const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.getSelection()?.toString().slice(0, 4000) || '' })
  const selectedText = result[0]?.result || ''
  let screenshotDataUrl
  if (withScreenshot) {
    screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
    if (screenshotDataUrl.length > 14_000_000) { status.textContent = 'Screenshot is too large for an issue. Capture the page without it.'; return }
  }
  draft = { title: (tab.title || 'Captured page').slice(0, 200), pageUrl: tab.url, selectedText, screenshotDataUrl }
  document.getElementById('title').textContent = draft.title
  document.getElementById('url').textContent = draft.pageUrl
  document.getElementById('selection').textContent = selectedText ? `Selected text: ${selectedText}` : 'No selected text'
  const image = document.getElementById('image')
  image.hidden = !screenshotDataUrl
  if (screenshotDataUrl) image.src = screenshotDataUrl
  preview.style.display = 'block'
  status.textContent = 'Review the draft, then open it in BugsTow.'
}

for (const [id, withScreenshot] of [['capture', false], ['screenshot', true]]) {
  document.getElementById(id).addEventListener('click', () => capture(withScreenshot).catch(() => { status.textContent = 'Capture failed. Try again on a normal web page.' }))
}

document.getElementById('open').addEventListener('click', async () => {
  if (!draft || !savedOrigin) return
  const response = await chrome.runtime.sendMessage({ type: 'bugstow-open-draft', origin: savedOrigin, draft })
  status.textContent = response?.ok ? 'Draft opened. Review it before saving.' : (response?.error || 'Could not open BugsTow.')
})
