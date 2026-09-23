/** Fired after any local change to projects/issues, so cloud sync can follow. */
const EVENT = 'bugstow:local-change'

export function notifyLocalChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

export function onLocalChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}
