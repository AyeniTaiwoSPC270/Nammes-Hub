import { describe, it, expect } from 'vitest'
import { isChromeFreePath, resolveChrome } from './ChromeContext'

describe('isChromeFreePath', () => {
  it('is true for a form page and false for the list, an admin page and a nested path', () => {
    expect(isChromeFreePath('/forms/abc-123')).toBe(true)
    expect(isChromeFreePath('/forms/abc-123/')).toBe(true)
    expect(isChromeFreePath('/forms')).toBe(false)
    expect(isChromeFreePath('/admin/forms/abc-123/edit')).toBe(false)
    expect(isChromeFreePath('/')).toBe(false)
  })
})

describe('resolveChrome', () => {
  const form = '/forms/abc-123'

  it('hides the chrome on a form route before the page has decided', () => {
    expect(resolveChrome({ pathname: form, decision: null })).toBe(true)
  })
  it('shows the chrome on a form route the page has decided to keep it on', () => {
    // The bug this pins: a route default that is OR-ed with the page's answer hides the navbar on
    // every form, including the ones with focus mode off.
    expect(resolveChrome({ pathname: form, decision: { pathname: form, hidden: false } })).toBe(false)
  })
  it('keeps the chrome hidden when the page decides so', () => {
    expect(resolveChrome({ pathname: form, decision: { pathname: form, hidden: true } })).toBe(true)
  })
  it('ignores a decision made on another path', () => {
    expect(resolveChrome({ pathname: '/about', decision: { pathname: form, hidden: true } })).toBe(false)
    expect(resolveChrome({ pathname: form, decision: { pathname: '/about', hidden: false } })).toBe(true)
  })
  it('keeps the chrome on a page that never asked to change it', () => {
    expect(resolveChrome({ pathname: '/about', decision: null })).toBe(false)
    expect(resolveChrome({ pathname: '/forms', decision: null })).toBe(false)
  })
})