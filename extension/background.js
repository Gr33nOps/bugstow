function validOrigin(value) {
  try {
    const url = new URL(value)
    return url.origin === value && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  } catch { return false }
}

async function waitForTab(tabId, origin) {
  const current = await chrome.tabs.get(tabId)
  if (current.status === 'complete') {
    if (!current.url?.startsWith(origin + '/')) throw new Error('BugsTow redirected to another address.')
    return current
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(updated); reject(new Error('BugsTow did not open in time.')) }, 20000)
    function updated(id, info, tab) {
      if (id !== tabId || info.status !== 'complete') return
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(updated)
      if (!tab.url?.startsWith(origin + '/')) reject(new Error('BugsTow redirected to another address.'))
      else resolve(tab)
    }
    chrome.tabs.onUpdated.addListener(updated)
  })
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== 'bugstow-open-draft') return false
  ;(async () => {
    if (!validOrigin(message.origin) || !message.draft || typeof message.draft.pageUrl !== 'string') throw new Error('Invalid capture destination.')
    const allowed = await chrome.permissions.contains({ origins: [`${message.origin}/*`] })
    if (!allowed) throw new Error('BugsTow address access is not granted.')
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
    const opened = await chrome.tabs.create({ url: `${message.origin}/?capture=${nonce}` })
    await waitForTab(opened.id, message.origin)
    await chrome.scripting.executeScript({
      target: { tabId: opened.id },
      args: [{ ...message.draft, type: 'bugstow-capture', nonce }, message.origin, nonce],
      func: (payload, origin, expectedNonce) => {
        let attempts = 0
        const receive = event => {
          if (event.source === window && event.origin === origin && event.data?.type === 'bugstow-capture-ack' && event.data.nonce === expectedNonce) {
            clearInterval(timer)
            window.removeEventListener('message', receive)
          }
        }
        window.addEventListener('message', receive)
        const timer = setInterval(() => {
          if (attempts++ >= 40) { clearInterval(timer); window.removeEventListener('message', receive); return }
          window.postMessage(payload, origin)
        }, 500)
        window.postMessage(payload, origin)
      },
    })
    return { ok: true }
  })().then(respond).catch(error => respond({ ok: false, error: error.message || 'Could not open draft.' }))
  return true
})
