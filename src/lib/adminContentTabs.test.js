import { describe, it, expect } from 'vitest'
import { CONTENT_TABS, DEFAULT_CONTENT_TAB, contentTabIds, normalizeContentTab } from './adminContentTabs.js'

describe('CONTENT_TABS', () => {
  it('has a unique id per tab, and a default that is one of them', () => {
    const ids = CONTENT_TABS.map((tab) => tab.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_CONTENT_TAB)
  })

  it('gives every tab a label and a description, because the shell prints both', () => {
    for (const tab of CONTENT_TABS) {
      expect(tab.id, tab.id).toBeTypeOf('string')
      expect(tab.label.length, tab.id).toBeGreaterThan(0)
      expect(tab.description.length, tab.id).toBeGreaterThan(0)
    }
  })

  it('offers exactly the two tabs both admin pages have to share', () => {
    expect(CONTENT_TABS.map((t) => t.id)).toEqual(['content', 'design'])
  })
})

describe('normalizeContentTab', () => {
  it('passes a real id through', () => {
    for (const tab of CONTENT_TABS) expect(normalizeContentTab(tab.id)).toBe(tab.id)
  })

  it('falls back for anything else, which is everything in a URL', () => {
    for (const value of [
      undefined,
      null,
      '',
      'nope',
      'CONTENT',
      'LIST',
      'content ',
      ' content',
      'Design',
      0,
      1,
      false,
      true,
      {},
      [],
      ['content'],
      NaN,
    ]) {
      expect(normalizeContentTab(value), String(value)).toBe(DEFAULT_CONTENT_TAB)
    }
  })

  it('matches exactly, so a near miss cannot be mistaken for a tab', () => {
    // The reason adminCalendarTabs.js:33-37 gives: a case-insensitive match would accept ?tab=Design and then
    // highlight nothing. 'Design' therefore has to come back as the default, not as 'design'.
    //
    // Note this can only be observed through a tab that is NOT the default -- the default here is 'content',
    // so a near miss on it is indistinguishable from a hit by return value alone.
    expect(normalizeContentTab('Design')).toBe(DEFAULT_CONTENT_TAB)
    expect(normalizeContentTab('design')).not.toBe(DEFAULT_CONTENT_TAB)
    expect(normalizeContentTab('design')).toBe('design')
  })

  it('does not mutate what it was handed', () => {
    const value = ['content']
    normalizeContentTab(value)
    expect(value).toEqual(['content'])
  })
})

describe('contentTabIds', () => {
  it('differs per page, so /admin/events and /admin/news never share DOM ids', () => {
    expect(contentTabIds('events').panel).not.toBe(contentTabIds('news').panel)
    expect(contentTabIds('events').tablist).not.toBe(contentTabIds('news').tablist)
  })

  it('is stable for the same page', () => {
    expect(contentTabIds('events')).toEqual(contentTabIds('events'))
  })

  it('falls back for a page it does not know, rather than emitting an undefined id', () => {
    const ids = contentTabIds('calendar')
    expect(ids.panel).toBeTypeOf('string')
    expect(ids.tablist).toBeTypeOf('string')
    expect(ids.panel).not.toBe(contentTabIds('events').panel)
  })

  it('keeps the ids valid for an HTML id attribute', () => {
    for (const page of ['events', 'news', 'calendar', undefined, 5]) {
      for (const value of Object.values(contentTabIds(page))) {
        expect(value, String(value)).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/)
      }
    }
  })
})