/** True on Apple devices, where shortcuts use ⌘ instead of Ctrl. */
export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)

/** The shortcut modifier as shown to the user: "⌘" on a Mac, "Ctrl" elsewhere. */
export const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl'

/** A shortcut label such as "⌘K" (Mac) or "Ctrl+K" (Windows, Linux). */
export function shortcut(key: string): string {
  return IS_MAC ? `⌘${key}` : `Ctrl+${key}`
}
