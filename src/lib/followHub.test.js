import { describe, expect, it } from 'vitest'
import {
  FOLLOW_SCAN_SOURCES,
  followPageUrl,
  followQrTarget,
  scanSourceFromSearch,
} from './followHub'

describe('followQrTarget', () => {
  it('carries the page plus the marker that makes a scan countable', () => {
    expect(followQrTarget('https://nammes.example')).toBe('https://nammes.example/follow?src=qr')
  })

  it('does not double a trailing slash', () => {
    expect(followQrTarget('https://nammes.example/')).toBe('https://nammes.example/follow?src=qr')
  })

  it('leaves the copied link unmarked', () => {
    expect(followPageUrl('https://nammes.example')).toBe('https://nammes.example/follow')
  })
})

describe('scanSourceFromSearch', () => {
  it('reads the marker out of a query string', () => {
    expect(scanSourceFromSearch('?src=qr')).toBe('qr')
    expect(scanSourceFromSearch('src=link')).toBe('link')
  })

  it('ignores anything that is not a known source', () => {
    expect(scanSourceFromSearch('?src=email')).toBeNull()
    expect(scanSourceFromSearch('?utm_source=qr')).toBeNull()
    expect(scanSourceFromSearch('?src=QR')).toBeNull()
    expect(scanSourceFromSearch('')).toBeNull()
  })

  it('keeps the whitelist and the database in agreement', () => {
    expect(FOLLOW_SCAN_SOURCES).toEqual(['qr', 'link'])
  })
})
