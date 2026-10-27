import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// The news video feature needs three hosts the browser is allowed to reach, and `vercel.json` is the
// ONLY place that policy lives -- a meta tag would be a second copy, and there isn't one. Each entry
// below is a symptom that shipped to production before this file existed:
//   media-src without storage  -> an uploaded MP4 silently refuses to play (2026-10-26)
//   frame-src without nocookie -> the article's YouTube player builds an iframe the browser throws away
//   img-src without i.ytimg    -> the facade's thumbnail is a black box, so the video "isn't rendering"
const policy = (() => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
  // Found by the header itself rather than by its source pattern: the pattern is `/(.*)`, and
  // matching on that would silently start reading a different block if the rules are ever reordered.
  const headers = vercel.headers.flatMap((h) => h.headers ?? [])
  return headers.find((h) => h.key === 'Content-Security-Policy').value
})()

/** One directive's sources, e.g. `media-src` -> ["'self'", 'blob:', 'https://…']. */
function sourcesOf(directive) {
  const block = policy.split('; ').find((part) => part.startsWith(`${directive} `))
  return block ? block.slice(directive.length + 1).split(' ') : []
}

describe('the production CSP lets a news video play', () => {
  it('finds the policy at all (otherwise every assertion below is vacuous)', () => {
    expect(policy).toContain('default-src')
  })

  it('allows media from this project\'s own storage host', () => {
    // Taken from connect-src rather than hardcoded, so a project move updates this test and the
    // policy together instead of leaving an old host asserted here.
    const storageHost = sourcesOf('connect-src').find((src) => src.startsWith('https://') && src.endsWith('.supabase.co'))
    expect(storageHost, 'connect-src should name the Supabase project').toBeTruthy()
    expect(sourcesOf('media-src')).toContain(storageHost)
  })

  it('allows the click-to-load YouTube player', () => {
    expect(sourcesOf('frame-src')).toContain('https://www.youtube-nocookie.com')
  })

  it('allows the YouTube thumbnail the facade shows before the click', () => {
    expect(sourcesOf('img-src')).toContain('https://i.ytimg.com')
  })
})
