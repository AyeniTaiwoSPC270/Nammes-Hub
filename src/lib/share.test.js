import { afterEach, describe, expect, it, vi } from 'vitest'
import { absoluteUrl, whatsappUrl, shareArticle, copyLink } from './share.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubWindow(origin = 'https://nammeshub.com.ng') {
  vi.stubGlobal('window', { location: { origin } })
}

describe('absoluteUrl', () => {
  it('uses the page origin when there is one', () => {
    stubWindow()
    expect(absoluteUrl('/news/some-post')).toBe('https://nammeshub.com.ng/news/some-post')
  })

  it('degrades to the path when there is no window at all', () => {
    expect(absoluteUrl('/news/some-post')).toBe('/news/some-post')
  })
})

describe('whatsappUrl', () => {
  it('encodes the title and the absolute link as one text payload', () => {
    stubWindow()
    const url = whatsappUrl('Exam timetable moved', '/news/timetable-moved')
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(
      'Exam timetable moved https://nammeshub.com.ng/news/timetable-moved',
    )
  })
})

describe('shareArticle', () => {
  it('reports "unsupported" rather than throwing when the sheet does not exist', async () => {
    vi.stubGlobal('navigator', {})
    expect(await shareArticle({ title: 'T', path: '/news/t' })).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('passes the title and the absolute url to the sheet', async () => {
    stubWindow()
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    const result = await shareArticle({ title: 'Exam timetable moved', path: '/news/timetable-moved' })
    expect(result).toEqual({ ok: true, reason: 'shared' })
    expect(share).toHaveBeenCalledWith({
      title: 'Exam timetable moved',
      url: 'https://nammeshub.com.ng/news/timetable-moved',
    })
  })

  it('treats a closed sheet as dismissed, not as an error', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) })
    expect(await shareArticle({ title: 'T', path: '/news/t' })).toEqual({ ok: false, reason: 'dismissed' })
  })

  it('reports a genuine failure separately', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('not allowed')) })
    expect(await shareArticle({ title: 'T', path: '/news/t' })).toEqual({ ok: false, reason: 'error' })
  })
})

describe('copyLink', () => {
  it('uses the async clipboard when it is available', async () => {
    stubWindow()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await copyLink('/news/some-post')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://nammeshub.com.ng/news/some-post')
  })

  it('falls back to the legacy copy on an insecure origin', async () => {
    stubWindow()
    vi.stubGlobal('navigator', {})
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const select = vi.fn()
    vi.stubGlobal('document', {
      createElement: () => ({ style: {}, setAttribute: () => {}, select, value: '' }),
      body: { appendChild, removeChild },
      execCommand: () => true,
    })
    expect(await copyLink('/news/some-post')).toBe(true)
    expect(appendChild).toHaveBeenCalled()
    expect(removeChild).toHaveBeenCalled()
  })

  it('reports false when neither path works, rather than throwing', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', undefined)
    expect(await copyLink('/news/some-post')).toBe(false)
  })
})
