import { describe, expect, it } from 'vitest'
import { placeFloatingMenu } from './floatingMenu'

describe('floating action menus', () => {
  it('opens above an action button near the bottom of the window', () => {
    expect(
      placeFloatingMenu(
        { left: 1380, right: 1420, top: 590, bottom: 630 },
        { width: 1440, height: 650 },
        { width: 208, height: 140 },
      ),
    ).toEqual({ left: 1212, top: 442 })
  })

  it('keeps a menu inside the left and top edges', () => {
    expect(
      placeFloatingMenu(
        { left: 2, right: 34, top: 2, bottom: 34 },
        { width: 320, height: 480 },
        { width: 208, height: 140 },
      ),
    ).toEqual({ left: 8, top: 42 })
  })
})
