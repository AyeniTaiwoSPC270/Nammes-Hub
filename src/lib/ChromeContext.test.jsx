import { describe, it, expect } from 'vitest'
import { isAuthPath, isChromeFreePath, resolveChrome } from './ChromeContext'

describe('isChromeFreePath', () => {
  it('is true for a form page and false for the list, an admin page and a nested path', () => {
    expect(isChromeFreePath('/forms/abc-123')).toBe(true)
    expect(isChromeFreePath('/forms/abc-123/')).toBe(true)
    expect(isChromeFreePath('/forms')).toBe(false)
    expect(isChromeFreePath('/admin/forms/abc-123/edit')).toBe(false)
    expect(isChromeFreePath('/')).toBe(false)
  })
})

describe('isAuthPath', () => {
  it('is true for the four auth screens, with or without a trailing slash', () => {
    for (const path of ['/login', '/signup', '/forgot-password', '/reset-password']) {
      expect(isAuthPath(path), path).toBe(true)
      expect(isAuthPath(`${path}/`), `${path}/`).toBe(true)
    }
  })

  it('is false for a page that merely starts with one of those names', () => {
    expect(isAuthPath('/logins')).toBe(false)
    expect(isAuthPath('/account')).toBe(false)
    expect(isAuthPath('/')).toBe(false)
  })

  it('keeps the chrome off every auth screen from first paint', () => {
    for (const path of ['/login', '/signup', '/forgot-password', '/reset-password']) {
      expect(isChromeFreePath(path), path).toBe(true)
    }
    expect(isChromeFreePath('/account')).toBe(false)
    expect(isChromeFreePath('/admin')).toBe(false)
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