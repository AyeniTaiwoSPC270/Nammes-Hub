import { describe, it, expect } from 'vitest'
import { parseRichText, richTextPlain } from './richText'

const types = (text) => parseRichText(text).map((b) => b.type)

describe('parseRichText', () => {
  it('separates paragraphs on a blank line and keeps single line breaks inside one', () => {
    const blocks = parseRichText('First line\nsecond line\n\nSecond paragraph')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].segments).toEqual([{ text: 'First line\nsecond line' }])
    expect(blocks[1].segments).toEqual([{ text: 'Second paragraph' }])
  })

  it('ignores leading and repeated blank lines', () => {
    expect(parseRichText('\n\n  \nOnly paragraph\n\n\n')).toHaveLength(1)
  })

  it('reads headings at one to three hashes, and only with a space after them', () => {
    const blocks = parseRichText('# Title\n\n## Sub\n\n### Small\n\n#nothashtag')
    expect(blocks.map((b) => b.level)).toEqual([1, 2, 3, undefined])
    expect(blocks[3].type).toBe('paragraph')
  })

  it('merges consecutive quote lines into one quote', () => {
    const blocks = parseRichText('> one\n> two\n\nafter')
    expect(blocks[0].type).toBe('quote')
    expect(blocks[0].segments).toEqual([{ text: 'one\ntwo' }])
    expect(blocks[1].type).toBe('paragraph')
  })

  it('groups bulleted and numbered items into their own lists', () => {
    const [bullets, numbered] = parseRichText('- one\n- two\n\n1. first\n2. second')
    expect(bullets).toMatchObject({ type: 'list', ordered: false })
    expect(bullets.items).toHaveLength(2)
    expect(numbered).toMatchObject({ type: 'list', ordered: true })
    expect(numbered.items).toHaveLength(2)
  })

  it('marks bold, italic and safe links, and leaves an unsafe link as text', () => {
    const [block] = parseRichText('A **bold** and *soft* [link](https://x.test) then [bad](javascript:alert(1))')
    expect(block.segments.slice(0, 6)).toEqual([
      { text: 'A ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'soft', italic: true },
      { text: ' ' },
      { text: 'link', href: 'https://x.test' },
    ])
    // The rejected link may split across segments as long as the reader sees exactly what was typed
    // and no anchor is produced.
    expect(block.segments.some((s) => s.href)).toBe(true)
    expect(block.segments.filter((s) => s.href)).toHaveLength(1)
    expect(block.segments.slice(6).map((s) => s.text).join('')).toBe(' then [bad](javascript:alert(1))')
  })

  it('does not treat arithmetic asterisks as italics', () => {
    const [block] = parseRichText('2 * 3 * 4')
    expect(block.segments).toEqual([{ text: '2 * 3 * 4' }])
  })

  it('turns [image] on its own line into an image block', () => {
    expect(types('Intro\n\n[image]\n\nRest')).toEqual(['paragraph', 'image', 'paragraph'])
    expect(types('  [IMAGE]  ')).toEqual(['image'])
  })

  it('renders a legacy plain-text body that has no markup at all', () => {
    expect(types('Welcome to November.\n\nLet us begin.')).toEqual(['paragraph', 'paragraph'])
  })
})

describe('richTextPlain', () => {
  it('strips formatting for a card excerpt', () => {
    expect(richTextPlain('## Heading\n\nA **bold** and *soft* [link](https://x.test)\n\n- one\n- two')).toBe(
      'Heading A bold and soft link one two'
    )
  })

  it('drops the image placeholder', () => {
    expect(richTextPlain('Before\n\n[image]\n\nAfter')).toBe('Before After')
  })

  it('collapses whitespace and handles null', () => {
    expect(richTextPlain(' a   b\nc ')).toBe('a b c')
    expect(richTextPlain(null)).toBe('')
  })
})
