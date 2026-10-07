import { useEffect } from 'react'

// Stops the page behind an overlay from scrolling while `locked` is true.
//
// Two things make this fiddly, and both are why a bare `body { overflow: hidden }` was not enough:
//
// 1. `src/index.css` puts `overflow-x: clip` on both `html` and `body` as a guard against stray wide
//    elements. Overflow only propagates from `body` to the viewport when `html`'s overflow is `visible`,
//    so that guard makes `html` the scroll container instead. Hiding overflow on `body` alone therefore
//    clips a `body` with no height of its own, and the page scrolls straight through.
// 2. On iOS Safari `overflow: hidden` does not stop the rubber-band at all. Freezing `body` with
//    `position: fixed` and an offset `top` is the only reliable way, which means holding the current
//    scroll offset so it can be handed back on release.
//
// Both live here rather than at each call site, because getting them wrong is invisible on desktop and
// only shows up on a phone.

/**
 * The styles that freeze the page at `scrollY`.
 *
 * `top` is the negated scroll offset, because a fixed body starts at the viewport top and would otherwise
 * jump the page to the beginning. Taking the body out of flow is what stops the scroll: `html` is the
 * scroll container, and with nothing left in flow there is nothing for it to scroll.
 *
 * Deliberately no `overflow-y` here. The frozen body is as tall as the whole document, so any overflow
 * value that makes it a scroll container would paint a scrollbar inside it. Hiding `html`'s overflow
 * below is what actually removes the scroll.
 */
export function frozenStyles(scrollY) {
  return {
    position: 'fixed',
    top: `-${scrollY}px`,
    left: '0',
    width: '100%',
  }
}

// Overlays can stack (a quiz modal opening a confirm dialog), so the freeze is reference counted.
// Without this, closing the inner one would thaw the page while the outer one is still up.
let activeLocks = 0

/**
 * Freezes scrolling and returns the matching release. `doc` and `win` are parameters so this can be
 * driven by a fake in tests rather than only by a real browser.
 */
export function lockScroll(doc = document, win = window) {
  const { body, documentElement } = doc
  const scrollY = win.scrollY

  // Only the outermost freeze may record and restore. A nested one has to leave the styles alone entirely:
  // were it to record them it would capture the already-frozen state, and closing the outer overlay first
  // would then leave the page stuck in that frozen state for good.
  const outermost = activeLocks === 0
  const previousHtml = outermost ? documentElement.getAttribute('style') : null
  const previousBody = outermost ? body.getAttribute('style') : null
  activeLocks += 1

  if (outermost) {
    for (const [property, value] of Object.entries(frozenStyles(scrollY))) {
      if (property === 'position') body.style.position = value
      else body.style.setProperty(property, value)
    }
    // `html` is the real scroll container here, so this is the line that actually stops the scroll.
    documentElement.style.overflow = 'hidden'
  }

  return function release() {
    activeLocks = Math.max(0, activeLocks - 1)
    if (activeLocks > 0) return

    if (previousHtml === null) documentElement.removeAttribute('style')
    else documentElement.setAttribute('style', previousHtml)
    if (previousBody === null) body.removeAttribute('style')
    else body.setAttribute('style', previousBody)
    // Handing the offset back is what keeps a long page from jumping to the top on close.
    win.scrollTo(0, scrollY)
  }
}

export function useBodyScrollLock(locked = true) {
  useEffect(() => {
    if (!locked) return undefined
    return lockScroll()
  }, [locked])
}
