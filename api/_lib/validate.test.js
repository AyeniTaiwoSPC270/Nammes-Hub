import { describe, it, expect } from 'vitest'
import { isUuid, isAllowedImageUrl } from './validate.js'

describe('isUuid', () => {
  it('accepts a v4 uuid and rejects junk', () => {
    expect(isUuid('5ad4560a-1b2c-4d3e-8f90-123456789abc')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid(undefined)).toBe(false)
    expect(isUuid("x' or 1=1")).toBe(false)
  })
})

describe('isAllowedImageUrl', () => {
  const hosts = ['proj.supabase.co']
  it('accepts https urls on an allowed host', () => {
    expect(isAllowedImageUrl('https://proj.supabase.co/storage/v1/object/public/a.png', hosts)).toBe(true)
  })
  it('rejects other hosts, http, internal addresses and non-urls', () => {
    expect(isAllowedImageUrl('https://evil.example/a.png', hosts)).toBe(false)
    expect(isAllowedImageUrl('http://proj.supabase.co/a.png', hosts)).toBe(false)
    expect(isAllowedImageUrl('https://169.254.169.254/latest', hosts)).toBe(false)
    expect(isAllowedImageUrl('https://proj.supabase.co.evil.example/a.png', hosts)).toBe(false)
    expect(isAllowedImageUrl('javascript:alert(1)', hosts)).toBe(false)
    expect(isAllowedImageUrl('', hosts)).toBe(false)
    expect(isAllowedImageUrl(null, hosts)).toBe(false)
  })
})
