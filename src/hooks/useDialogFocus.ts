import { useEffect, useRef } from 'react'

/** Keep keyboard navigation in an open dialog and return to its trigger. */
export function useDialogFocus(onClose: () => void, dismissible = true) {
  const ref = useRef<HTMLDivElement>(null)
  const previousFocus = useRef(document.activeElement as HTMLElement | null)
  const closeRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  closeRef.current = onClose
  dismissibleRef.current = dismissible
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previous = previousFocus.current
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]'))
      .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0)
    if (!dialog.contains(document.activeElement)) (controls()[0] || dialog).focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (dismissibleRef.current) closeRef.current()
      }
      if (event.key !== 'Tab') return
      const items = controls()
      const first = items[0], last = items.at(-1)
      if (!first || !last) { event.preventDefault(); dialog.focus(); return }
      if (!dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', keydown, true)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return ref
}
