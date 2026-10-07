import { describe, it, expect } from 'vitest'
import { frozenStyles, lockScroll } from './useBodyScrollLock'

// The freeze has to be driven through `lockScroll` rather than a rendered hook: this project runs Vitest
// with no DOM environment (no jsdom or happy-dom installed), so there is nothing to mount into. A fake
// document is enough to pin the behaviour that actually broke, which is which element gets frozen and
// whether the page is handed back where it was.

function fakeDocument({ htmlStyle = null, bodyStyle = null } = {}) {
  const makeStyle = () => ({
    props: new Map(),
    overflow: '',
    position: '',
    setProperty(name, value) {
      this.props.set(name, value)
    },
    getPropertyValue(name) {
      return this.props.get(name) ?? ''
    },
  })
  const html = makeStyle()
  const body = makeStyle()
  let htmlAttr = htmlStyle
  let bodyAttr = bodyStyle
  // A real element forgets its inline declarations when the style attribute goes, and these tests turn on
  // whether the page is genuinely thawed, so the fake has to forget them too.
  const forget = (style, next) => {
    style.overflow = ''
    style.position = ''
    style.props.clear()
    return next
  }
  const documentElement = {
    style: html,
    getAttribute: (name) => (name === 'style' ? htmlAttr : null),
    setAttribute: (name, value) => {
      if (name === 'style') htmlAttr = value
    },
    removeAttribute: (name) => {
      if (name === 'style') htmlAttr = forget(html, null)
    },
  }
  return {
    documentElement,
    body: {
      style: body,
      getAttribute: (name) => (name === 'style' ? bodyAttr : null),
      setAttribute: (name, value) => {
        if (name === 'style') bodyAttr = value
      },
      removeAttribute: (name) => {
        if (name === 'style') bodyAttr = forget(body, null)
      },
    },
    htmlAttr: () => htmlAttr,
    bodyAttr: () => bodyAttr,
  }
}

function fakeWindow(scrollY = 0) {
  return {
    scrollY,
    scrollTo(x, y) {
      this.restoredTo = [x, y]
    },
  }
}

describe('frozenStyles', () => {
  it('freezes the body rather than relying on overflow, so iOS stops rubber-banding', () => {
    expect(frozenStyles(0).position).toBe('fixed')
  })
  it('offsets the frozen body by the scroll position, so the page does not jump to the top', () => {
    expect(frozenStyles(420).top).toBe('-420px')
  })
  it('does not give the frozen body its own overflow, which would paint a scrollbar inside it', () => {
    expect(frozenStyles(0).overflowY).toBeUndefined()
  })
})

describe('lockScroll', () => {
  it('hides overflow on html as well as body, which is what actually stops the page', () => {
    const doc = fakeDocument()
    const win = fakeWindow(300)
    const release = lockScroll(doc, win)
    expect(doc.documentElement.style.overflow).toBe('hidden')
    release()
  })

  it('freezes the body at the current scroll offset', () => {
    const doc = fakeDocument()
    const win = fakeWindow(300)
    const release = lockScroll(doc, win)
    expect(doc.body.style.position).toBe('fixed')
    expect(doc.body.style.getPropertyValue('top')).toBe('-300px')
    release()
  })

  it('hands the page back to where it was scrolled on release', () => {
    const doc = fakeDocument()
    const win = fakeWindow(842)
    const release = lockScroll(doc, win)
    release()
    expect(win.restoredTo).toEqual([0, 842])
  })

  it('puts the html and body styles back exactly as they were', () => {
    const doc = fakeDocument({ htmlStyle: 'overflow-x: clip;', bodyStyle: 'position: relative;' })
    const win = fakeWindow(0)
    const release = lockScroll(doc, win)
    release()
    expect(doc.htmlAttr()).toBe('overflow-x: clip;')
    expect(doc.bodyAttr()).toBe('position: relative;')
  })

  it('leaves no style attribute behind when there was none to begin with', () => {
    const doc = fakeDocument()
    const win = fakeWindow(0)
    const release = lockScroll(doc, win)
    release()
    expect(doc.htmlAttr()).toBeNull()
    expect(doc.bodyAttr()).toBeNull()
  })

  it('keeps the page frozen while a stacked overlay is still open', () => {
    const doc = fakeDocument()
    const win = fakeWindow(120)
    const outer = lockScroll(doc, win)
    const inner = lockScroll(doc, win)
    inner()
    // Closing the inner overlay must not thaw the page the outer one is still covering.
    expect(doc.documentElement.style.overflow).toBe('hidden')
    expect(doc.body.style.position).toBe('fixed')
    outer()
    expect(doc.htmlAttr()).toBeNull()
  })

  it('unfreezes cleanly when the outer overlay closes before the inner one', () => {
    const doc = fakeDocument()
    const win = fakeWindow(120)
    const outer = lockScroll(doc, win)
    const inner = lockScroll(doc, win)
    // Out of order: the inner one has to leave the recorded styles alone, or the last release would
    // restore the already-frozen state and the page would stay stuck.
    outer()
    expect(doc.htmlAttr()).toBeNull()
    inner()
    expect(doc.htmlAttr()).toBeNull()
    expect(doc.documentElement.style.overflow).toBe('')
  })

  it('cannot be driven negative by an extra release', () => {
    const doc = fakeDocument()
    const win = fakeWindow(0)
    const release = lockScroll(doc, win)
    release()
    release()
    const again = lockScroll(doc, win)
    again()
    expect(doc.htmlAttr()).toBeNull()
  })
})
