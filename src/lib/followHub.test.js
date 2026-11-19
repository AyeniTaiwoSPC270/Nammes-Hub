import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_MAX_LENGTH,
  FOLLOW_SCAN_SOURCES,
  campaignFromSearch,
  followLinkKey,
  followPageUrl,
  followQrTarget,
  followSharedTarget,
  normaliseCampaign,
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

  it('marks a shared link as a link, with the poster when one is named', () => {
    expect(followSharedTarget('https://nammes.example')).toBe('https://nammes.example/follow?src=link')
    expect(followSharedTarget('https://nammes.example/', 'october-flyer')).toBe(
      'https://nammes.example/follow?src=link&c=october-flyer',
    )
  })

  it('tags a poster when one is named', () => {
    expect(followQrTarget('https://nammes.example', 'october-flyer')).toBe(
      'https://nammes.example/follow?src=qr&c=october-flyer',
    )
  })

  it('folds a human poster name into the same slug the database checks', () => {
    expect(followQrTarget('https://nammes.example', 'Main Gate Poster!')).toBe(
      'https://nammes.example/follow?src=qr&c=main-gate-poster',
    )
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

describe('campaignFromSearch', () => {
  it('reads a campaign alongside the scan marker', () => {
    expect(campaignFromSearch('?src=qr&c=october-flyer')).toBe('october-flyer')
  })

  it('accepts a campaign that needs folding, so a hand-typed URL still counts', () => {
    expect(campaignFromSearch('?c=Main%20Gate')).toBe('main-gate')
  })

  it('is null when there is no campaign or it cannot form a slug', () => {
    expect(campaignFromSearch('?src=qr')).toBeNull()
    expect(campaignFromSearch('?c=!!!')).toBeNull()
    expect(campaignFromSearch('')).toBeNull()
  })
})

describe('normaliseCampaign', () => {
  it('lower-cases, folds punctuation and strips the edges', () => {
    expect(normaliseCampaign('  October / Flyer  ')).toBe('october-flyer')
    expect(normaliseCampaign('---')).toBe('')
  })

  it('caps the length without leaving a trailing dash', () => {
    const campaign = normaliseCampaign('a'.repeat(CAMPAIGN_MAX_LENGTH) + ' extra words')
    expect(campaign).toHaveLength(CAMPAIGN_MAX_LENGTH)
    expect(campaign.endsWith('-')).toBe(false)
  })

  it('refuses a value that is not a string', () => {
    expect(normaliseCampaign(null)).toBe('')
    expect(normaliseCampaign(42)).toBe('')
  })
})

describe('followLinkKey', () => {
  it('normalises a platform name or a hub path into the stored key', () => {
    expect(followLinkKey('whatsapp')).toBe('whatsapp')
    expect(followLinkKey('/calendar')).toBe('calendar')
    expect(followLinkKey('Instagram!')).toBe('instagram')
  })

  it('is null when nothing usable is left', () => {
    expect(followLinkKey('')).toBeNull()
    expect(followLinkKey('???')).toBeNull()
    expect(followLinkKey(undefined)).toBeNull()
  })
})
