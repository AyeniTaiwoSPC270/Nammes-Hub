import { describe, expect, it, vi, afterEach } from 'vitest'
import { cardFilename, duelCardUrl, fetchCardBlob, personalCardUrl, boardCardUrl, practiceCardUrl } from './quizCard.js'

describe('the card urls', () => {
  it('points each variant at the query its endpoint branch reads', () => {
    expect(personalCardUrl({ sessionId: 's1', token: 'tok' })).toBe('/api/quiz-card?session=s1&token=tok')
    expect(boardCardUrl('s1')).toBe('/api/quiz-card?session=s1&view=board')
    expect(practiceCardUrl('ABCD2345')).toBe('/api/quiz-card?practice=ABCD2345')
    expect(duelCardUrl('AB12CD')).toBe('/api/quiz-card?battle=AB12CD')
  })

  it('encodes a token rather than pasting it in raw', () => {
    expect(personalCardUrl({ sessionId: 's1', token: 'a b&c=d' })).toContain('token=a%20b%26c%3Dd')
  })
})

describe('cardFilename', () => {
  it('names the file after the player, with nothing awkward in it', () => {
    expect(cardFilename('Ada Lovelace')).toBe('nammes-ada-lovelace.png')
    expect(cardFilename('  Ada  ')).toBe('nammes-ada.png')
  })

  it('falls back when a nickname is nothing a filename can use', () => {
    expect(cardFilename('!!!')).toBe('nammes-result.png')
    expect(cardFilename('', 'quiz-results')).toBe('nammes-quiz-results.png')
  })
})

describe('fetchCardBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the png on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['png']))))
    const blob = await fetchCardBlob('/api/quiz-card?session=s1&token=t')
    expect(await blob.text()).toBe('png')
  })

  it('shows the server its own message, so a gone run says so', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'This practice run is no longer stored.' }),
      { status: 410 },
    )))
    await expect(fetchCardBlob('/api/quiz-card?practice=X')).rejects.toThrow('This practice run is no longer stored.')
  })

  it('keeps the status on the error, so a caller can tell a 410 from a 403', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 })))
    await expect(fetchCardBlob('/api/quiz-card?session=s1&view=board')).rejects.toMatchObject({ status: 403 })
  })

  it('falls back to its own wording when the gateway answers with html', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    await expect(fetchCardBlob('/api/quiz-card?session=s1&token=t')).rejects.toThrow('Could not make your result card')
  })
})