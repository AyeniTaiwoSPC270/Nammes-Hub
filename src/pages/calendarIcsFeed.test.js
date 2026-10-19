import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// The feed is useless if nobody can find its URL on a phone. These are source scans rather than render tests for the
// same reason playSeatResume.test.js is: there is no browser here, but there is a page that must keep importing the
// control and a control that must keep pointing at the one URL.

const calendar = readFileSync('src/pages/Calendar.jsx', 'utf8').replace(/\r\n/g, '\n')
const subscribe = readFileSync('src/components/calendar/CalendarSubscribe.jsx', 'utf8').replace(/\r\n/g, '\n')

describe('/calendar offers the subscribe feed', () => {
  it('renders the control and points it at the feed endpoint', () => {
    expect(calendar).toContain("import CalendarSubscribe from '../components/calendar/CalendarSubscribe'")
    expect(calendar).toContain('<CalendarSubscribe />')
    expect(subscribe).toContain("CALENDAR_FEED_PATH = '/api/calendar-ics'")
  })

  it('builds the download from the same endpoint rather than a second URL', () => {
    // A second endpoint with Content-Disposition would be a second answer to "what is in this calendar".
    expect(subscribe).toMatch(/fetch\(CALENDAR_FEED_PATH\)/)
    expect((subscribe.match(/\/api\//g) ?? []).length).toBe(1)
  })

  it('derives the webcal variant from the same URL', () => {
    expect(subscribe).toContain("replace(/^https:/, 'webcal:')")
    expect(subscribe).toContain('webcalUrl(url)')
  })

  it('gives the copy buttons an accessible name and a visible copied state', () => {
    expect(subscribe).toContain('aria-label="Copy the calendar subscription URL"')
    expect(subscribe).toContain("copied === 'subscribe' ? 'Copied' : 'Copy'")
  })
})
