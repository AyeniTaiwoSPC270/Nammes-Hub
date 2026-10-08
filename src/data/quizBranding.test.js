import { describe, it, expect } from 'vitest'
import { brandingPaths, cardPreviewVersion, BRANDING_MAX_EDGE, BRANDING_MAX_BYTES, BACKDROP_MAX_EDGE, BACKDROP_MAX_BYTES } from './quizBranding'
import { sanitizeCard } from '../../api/_lib/quizCard.js'

// brandingPaths is the only thing that deletes a picture the look has stopped using (AdminQuizStudio's save). A picture
// missing from this list is an orphan left in the bucket for good, so the backdrop has to be counted with the rest.

const ID = '11111111-1111-4111-8111-111111111111'
const file = (n) => `${ID}/${n}aaaaaaaa-1111-4111-8111-111111111111.webp`

describe('quiz branding pictures', () => {
  it('counts the backdrop with the logo and the sponsors', () => {
    const logo = file('1')
    const image = file('2')
    const sponsor = file('3')
    expect(brandingPaths({ logo, image, sponsors: [{ name: 'Acme', path: sponsor }] })).toEqual([logo, image, sponsor])
  })

  it('counts the card background, which lives on its own column', () => {
    const logo = file('1')
    const background = file('4')
    // Leave it out and swapping the card picture orphans the old file in the bucket for good.
    expect(brandingPaths({ logo }, { background })).toEqual([logo, background])
    expect(brandingPaths({ logo }, {})).toEqual([logo])
  })

  it('has nothing to delete for a look with no pictures', () => {
    expect(brandingPaths(null)).toEqual([])
    expect(brandingPaths(undefined)).toEqual([])
    expect(brandingPaths({})).toEqual([])
    expect(brandingPaths({ logo: null, image: null, sponsors: [] })).toEqual([])
  })

  it('changes the preview token when the card design changes, and not otherwise', () => {
    // The studio puts this on the preview url, since the endpoint renders the saved card rather than the draft.
    const base = sanitizeCard({}, { quizId: ID })
    expect(cardPreviewVersion(base, ID)).toBe(cardPreviewVersion(sanitizeCard({}, { quizId: ID }), ID))
    expect(cardPreviewVersion(base, ID)).not.toBe(cardPreviewVersion({ ...base, showStreak: false }, ID))
    expect(cardPreviewVersion(base, ID)).not.toBe(cardPreviewVersion({ ...base, accent: '#abcdef' }, ID))
  })

  it('gives a backdrop far more room than a logo, both under what the bucket allows', () => {
    expect(BACKDROP_MAX_EDGE).toBeGreaterThan(BRANDING_MAX_EDGE)
    expect(BACKDROP_MAX_BYTES).toBeGreaterThan(BRANDING_MAX_BYTES)
    // The bucket's limit is raised to 1.5MB by 20261006120000_quiz_backdrop_picture.sql, so the studio can never accept
    // and shrink a picture that storage then refuses.
    expect(BACKDROP_MAX_BYTES).toBeLessThanOrEqual(1572864)
    expect(BRANDING_MAX_BYTES).toBeLessThanOrEqual(BACKDROP_MAX_BYTES)
  })
})