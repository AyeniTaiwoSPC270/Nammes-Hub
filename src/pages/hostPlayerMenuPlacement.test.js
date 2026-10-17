import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { placePlayerMenu } from './HostQuiz.jsx'

// The manage-a-player panel has been wrong twice, in opposite directions, and both times it was only visible on a
// projector. Anchored inside the player pill it inherited that pill's shrink-to-fit width and wrapped three items into an
// unreadable column. Anchored to the right it then pushed a 16rem panel off the LEFT of the screen for a player near the
// start of a row -- which is the first player in the game, so the commonest case was the broken one.
//
// Which side has room depends on where the row wrapped, so there is no single answer CSS can give. It is measured and
// clamped instead, and this pins the arithmetic.

const PANEL = { width: 256, height: 168 }
const VIEWPORT = { width: 1280, height: 720 }

function box(left, top, width = 44, height = 44) {
  return { left, top, right: left + width, bottom: top + height }
}

describe('the player menu is placed inside the screen', () => {
  it('opens to the right of a button that has room', () => {
    const place = placePlayerMenu({ anchor: box(400, 200), panel: PANEL, viewport: VIEWPORT })
    expect(place.opensRight).toBe(true)
    expect(place.left).toBe(408)
    expect(place.top).toBe(252)
  })

  it('opens to the LEFT when the button is near the right edge, rather than hanging off it', () => {
    // The regression: this used to be `right-0`, which is correct for a button at the far right of a centred row and
    // sends the panel off the left edge for one at the far left. Here the right edge is the crowded one.
    const place = placePlayerMenu({ anchor: box(1240, 200), panel: PANEL, viewport: VIEWPORT })
    expect(place.opensRight).toBe(false)
    expect(place.left + PANEL.width).toBeLessThanOrEqual(VIEWPORT.width)
  })

  it('never puts the panel past the left edge for the first player in the game', () => {
    // The case in the screenshot: one player, at the very start of the row.
    const place = placePlayerMenu({ anchor: box(40, 180), panel: PANEL, viewport: VIEWPORT })
    expect(place.left).toBeGreaterThanOrEqual(8)
    expect(place.left + PANEL.width).toBeLessThanOrEqual(VIEWPORT.width)
  })

  it('opens upwards when there is no room below', () => {
    const place = placePlayerMenu({ anchor: box(400, 690), panel: PANEL, viewport: VIEWPORT })
    expect(place.opensUp).toBe(true)
    expect(place.top).toBeGreaterThanOrEqual(8)
  })

  it('opens downwards when there is no room above', () => {
    // A button in the top-left corner: above would be off-screen, so below is the only option, and it has to stay on.
    const place = placePlayerMenu({ anchor: box(20, 4), panel: PANEL, viewport: VIEWPORT })
    expect(place.opensUp).toBe(false)
    expect(place.top).toBe(56)
    expect(place.left).toBeGreaterThanOrEqual(8)
  })

  it('keeps the panel on screen at every corner of a small projector', () => {
    // A 1024x768 projector is the tight realistic case; 800x600 is the point where it starts to matter.
    for (const viewport of [{ width: 1024, height: 768 }, { width: 800, height: 600 }]) {
      for (const anchor of [box(4, 4), box(viewport.width - 48, 4), box(4, viewport.height - 48), box(viewport.width - 48, viewport.height - 48)]) {
        const place = placePlayerMenu({ anchor, panel: PANEL, viewport })
        expect(place.left, `left edge at ${JSON.stringify({ anchor, viewport })}`).toBeGreaterThanOrEqual(8)
        expect(place.left + PANEL.width, `right edge at ${JSON.stringify({ anchor, viewport })}`).toBeLessThanOrEqual(viewport.width - 8)
        expect(place.top, `top edge at ${JSON.stringify({ anchor, viewport })}`).toBeGreaterThanOrEqual(8)
        expect(place.top + PANEL.height, `bottom edge at ${JSON.stringify({ anchor, viewport })}`).toBeLessThanOrEqual(viewport.height)
      }
    }
  })

  it('sits below the button when both sides would fit, because that is where a thumb expects it', () => {
    const place = placePlayerMenu({ anchor: box(600, 300), panel: PANEL, viewport: VIEWPORT })
    expect(place.top).toBeGreaterThan(300)
    expect(place.opensUp).toBe(false)
  })
})

// The placement is only half of it. The first version of this menu called `useRef` inside the player list's map, which
// is a hook called a variable number of times: it happens to work while nobody joins, and then throws "Rendered more
// hooks than during the previous render" the moment a player does -- i.e. every time the lobby is in use. There is no DOM
// test harness here to catch that at runtime, so the shape is pinned at the source instead.
it('keeps the player list hook-free, because the list changes length as people join', () => {
  const source = readFileSync(new URL('./HostQuiz.jsx', import.meta.url), 'utf8')
  const start = source.indexOf('aria-label="Players"')
  const list = source.slice(start, source.indexOf('</ul>', start))
  expect(list).not.toContain('useRef(')
  expect(list).toContain('menuAnchors.current.get')
})