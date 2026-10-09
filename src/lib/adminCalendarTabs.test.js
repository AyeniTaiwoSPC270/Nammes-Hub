import { describe, it, expect } from 'vitest'
import { CALENDAR_TABS, DEFAULT_CALENDAR_TAB, normalizeCalendarTab } from './adminCalendarTabs.js'

describe('calendar admin tabs', () => {
  it('keeps every id unique, or a tab would swallow another', () => {
    const ids = CALENDAR_TABS.map((tab) => tab.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has the default tab as a real tab', () => {
    expect(CALENDAR_TABS.some((tab) => tab.id === DEFAULT_CALENDAR_TAB)).toBe(true)
  })

  it('gives every tab a label and a description', () => {
    for (const tab of CALENDAR_TABS) {
      expect(tab.label, tab.id).toBeTruthy()
      expect(tab.description, tab.id).toBeTruthy()
    }
  })

  it('covers the four admin screens that used to be four routes', () => {
    expect(CALENDAR_TABS.map((tab) => tab.id)).toEqual(['dates', 'paste', 'design', 'session'])
  })

  it('returns each real tab unchanged', () => {
    for (const tab of CALENDAR_TABS) {
      expect(normalizeCalendarTab(tab.id)).toBe(tab.id)
    }
  })

  it('falls back to the default for anything that is not a tab', () => {
    for (const bad of [undefined, null, '', 'nope', 'DATES', 'dates ', ' dates', 0, false, {}, ['dates']]) {
      expect(normalizeCalendarTab(bad), String(bad)).toBe(DEFAULT_CALENDAR_TAB)
    }
  })

  it('does not mutate the tab list while normalising', () => {
    const before = JSON.stringify(CALENDAR_TABS)
    normalizeCalendarTab('nope')
    normalizeCalendarTab('design')
    expect(JSON.stringify(CALENDAR_TABS)).toBe(before)
  })
})
