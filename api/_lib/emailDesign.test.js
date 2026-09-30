import { describe, it, expect } from 'vitest'
import {
  normalizeDesign,
  normalizeBlocks,
  presetDesign,
  systemDesign,
  EMAIL_PRESETS,
  renderEmail,
  renderBlocksHtml,
  legacyToBlocks,
  safeLink,
  resolveLink,
  newBlock,
  welcomeContent,
  newContentEmailContent,
} from './emailDesign.js'

const HOSTS = ['x.supabase.co']
const NOW = new Date('2026-09-30T12:00:00Z')
const render = (design, content) => renderEmail({ design, content, now: NOW })

describe('normalizeDesign', () => {
  it('fills defaults and clamps values', () => {
    const d = normalizeDesign({ colors: { link: 'red', text: '#ABCDEF' }, card: { width: 5000, padding: -1 }, fonts: { body: 'comic' } })
    expect(d.colors.link).toBe('#ae3200')
    expect(d.colors.text).toBe('#abcdef')
    expect(d.card.width).toBe(700)
    expect(d.card.padding).toBe(16)
    expect(d.fonts.body).toBe('system')
  })

  it('rejects unsafe urls in header, banner and button', () => {
    const d = normalizeDesign(
      { header: { logoUrl: 'javascript:alert(1)', banner: { url: 'http://evil.com/a.png' } }, button: { url: 'javascript:alert(1)' } },
      HOSTS,
    )
    expect(d.header.logoUrl).toBe('')
    expect(d.header.banner).toBeNull()
    expect(d.button.url).toBe('site:/')
  })

  it('restricts images to allowed hosts', () => {
    const d = normalizeDesign({ header: { banner: { url: 'https://other.com/a.png' } } }, HOSTS)
    expect(d.header.banner).toBeNull()
    const ok = normalizeDesign({ header: { banner: { url: 'https://x.supabase.co/a.png' } } }, HOSTS)
    expect(ok.header.banner.url).toBe('https://x.supabase.co/a.png')
  })
})

describe('links', () => {
  it('allows https, mailto and site paths only', () => {
    expect(safeLink('https://a.com/x')).toBe('https://a.com/x')
    expect(safeLink('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(safeLink('site:/events')).toBe('site:/events')
    expect(safeLink('http://a.com')).toBe('')
    expect(safeLink('javascript:alert(1)')).toBe('')
    expect(safeLink('https://a.com/"onmouseover="x')).toBe('')
  })
  it('resolves site links', () => {
    expect(resolveLink('site:/events', 'https://s.com')).toBe('https://s.com/events')
  })
})

describe('normalizeBlocks', () => {
  it('drops unknown types and images without a safe url', () => {
    const blocks = normalizeBlocks([{ type: 'script' }, { type: 'image', url: 'http://x.com/a.png' }, { type: 'text', text: 'hi' }], HOSTS)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
  })
  it('does not allow columns inside columns', () => {
    const inner = { type: 'columns', left: newBlock('text'), right: newBlock('text') }
    const [cols] = normalizeBlocks([{ type: 'columns', left: inner, right: newBlock('text') }])
    expect(cols.left.type).toBe('text')
  })
  it('caps the number of blocks', () => {
    const many = Array.from({ length: 100 }, () => newBlock('divider'))
    expect(normalizeBlocks(many)).toHaveLength(60)
  })
})

describe('renderEmail', () => {
  it('escapes the subject and block text', () => {
    const html = render({}, { subject: '<script>alert(1)</script>', blocks: [{ ...newBlock('text'), text: '<img src=x onerror=alert(1)>' }] })
    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })

  it('formats bold, italic and links', () => {
    const html = render({}, { subject: 's', blocks: [{ ...newBlock('text'), text: '**bold** and *it* and [site](https://a.com) and https://b.com' }] })
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>it</em>')
    expect(html).toContain('href="https://a.com"')
    expect(html).toContain('href="https://b.com"')
  })

  it('refuses javascript links in markdown', () => {
    const html = render({}, { subject: 's', blocks: [{ ...newBlock('text'), text: '[x](javascript:alert(1))' }] })
    expect(html).not.toContain('href="javascript')
  })

  it('applies colors, width and fonts from the design', () => {
    const html = render({ colors: { headerBg: '#123456' }, card: { width: 480 }, fonts: { body: 'georgia' } }, { subject: 's', blocks: [] })
    expect(html).toContain('#123456')
    expect(html).toContain('width="480"')
    expect(html).toContain('Georgia')
  })

  it('renders a button block only with a safe url', () => {
    const ok = render({}, { subject: 's', blocks: [{ ...newBlock('button'), text: 'Go', url: 'https://a.com' }] })
    expect(ok).toContain('href="https://a.com"')
    const bad = render({}, { subject: 's', blocks: [{ ...newBlock('button'), text: 'Go', url: 'javascript:alert(1)' }] })
    expect(bad).not.toContain('javascript:')
  })

  it('adds the design call-to-action when enabled', () => {
    const html = render({ button: { show: true, text: 'Open', url: 'site:/events' } }, { subject: 's', blocks: [] })
    expect(html).toContain('https://www.nammeshub.com.ng/events')
    expect(html).toContain('Open')
  })

  it('renders every preset without throwing', () => {
    for (const p of EMAIL_PRESETS) {
      const html = render(presetDesign(p.id), {
        subject: 'Hello',
        blocks: [
          { ...newBlock('heading'), text: 'H' },
          { ...newBlock('text'), text: 'Body' },
          { ...newBlock('quote'), text: 'Note' },
          { ...newBlock('list'), items: ['a', 'b'] },
          newBlock('divider'),
          newBlock('spacer'),
          newBlock('columns'),
        ],
      })
      expect(html).toContain('Hello')
      expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    }
  })

  it('replaces date tokens', () => {
    const html = render(presetDesign('bold'), { subject: 's', blocks: [] })
    expect(html).toContain('Sep 30, 2026')
    expect(html).not.toContain('{{date}}')
  })

  it('image blocks carry width, alt and link', () => {
    const b = { ...newBlock('image'), url: 'https://x.supabase.co/a.png', alt: 'A', widthPct: 50, link: 'https://a.com' }
    const html = render({}, { subject: 's', blocks: [b] })
    expect(html).toContain('width="260"')
    expect(html).toContain('alt="A"')
    expect(html).toContain('<a href="https://a.com">')
  })
})

describe('helpers', () => {
  it('legacyToBlocks builds text then image', () => {
    const blocks = legacyToBlocks({ body: 'hi', imageUrl: 'https://x.supabase.co/a.png' })
    expect(blocks.map((b) => b.type)).toEqual(['text', 'image'])
  })
  it('renderBlocksHtml returns only the body fragment', () => {
    const html = renderBlocksHtml([{ ...newBlock('text'), text: 'Hello' }], {})
    expect(html).toContain('Hello')
    expect(html).not.toContain('<html')
  })
  it('system emails render with their fixed content', () => {
    const welcome = render(systemDesign('welcome'), welcomeContent({ fullName: 'Ada' }))
    expect(welcome).toContain('Welcome to the hub, Ada.')
    const nc = render(systemDesign('new_content'), newContentEmailContent({ eyebrow: 'News', title: 'T', url: 'https://a.com/x' }))
    expect(nc).toContain('href="https://a.com/x"')
    expect(nc).toContain('News')
  })
})
