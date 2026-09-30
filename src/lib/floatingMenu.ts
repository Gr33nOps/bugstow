export interface MenuAnchorRect {
  left: number
  right: number
  top: number
  bottom: number
}

export interface MenuSize {
  width: number
  height: number
}

const EDGE_GAP = 8

/** Place a fixed menu beside its button without letting it leave the viewport. */
export function placeFloatingMenu(
  anchor: MenuAnchorRect,
  viewport: MenuSize,
  menu: MenuSize,
): { left: number; top: number } {
  const left = Math.max(
    EDGE_GAP,
    Math.min(anchor.right - menu.width, viewport.width - menu.width - EDGE_GAP),
  )
  const below = anchor.bottom + EDGE_GAP
  const above = anchor.top - menu.height - EDGE_GAP
  const top = below + menu.height <= viewport.height - EDGE_GAP ? below : Math.max(EDGE_GAP, above)

  return { left, top }
}
