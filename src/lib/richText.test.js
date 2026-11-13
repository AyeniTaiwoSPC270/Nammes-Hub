import { describe, it, expect } from 'vitest'
import {
  bodyFontOf,
  editorOf,
  imageRatioOf,
  parseRichText,
  readingMinutes,
  richTextPlain,
  summaryOf,
} from './richText'

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

  it('combines a heading with bold and a colour inside it', () => {
    const [block] = parseRichText('## A [color=orange]**bold** word[/color]')
    expect(block.type).toBe('heading')
    expect(block.segments).toEqual([
      { text: 'A ' },
      { text: 'bold', bold: true, color: 'orange' },
      { text: ' word', color: 'orange' },
    ])
  })

  it('stacks a size, a font and underline on one run', () => {
    const [block] = parseRichText('## [size=lg][font=serif]**[u]Big[/u]**[/font][/size]')
    expect(block.segments).toEqual([{ text: 'Big', bold: true, underline: true, size: 'lg', font: 'serif' }])
  })

  it('only accepts the allow-listed values, and an unclosed wrapper stays literal', () => {
    expect(parseRichText('[color=purple]x[/color]')[0].segments).toEqual([{ text: '[color=purple]x[/color]' }])
    expect(parseRichText('[color=red]oops')[0].segments).toEqual([{ text: '[color=red]oops' }])
  })

  it('drops the body-font directive instead of rendering it as a paragraph', () => {
    expect(types('[body=serif]\n\nWelcome')).toEqual(['paragraph'])
    expect(bodyFontOf('[body=serif]\n\nWelcome')).toBe('serif')
    expect(bodyFontOf('Welcome')).toBe('sans')
  })

  it('turns [image] on its own line into an image block', () => {
    expect(types('Intro\n\n[image]\n\nRest')).toEqual(['paragraph', 'image', 'paragraph'])
    expect(types('  [IMAGE]  ')).toEqual(['image'])
  })

  it('hides the standfirst and editor directives from the prose', () => {
    const body = '[summary]A short line **with style**[/summary]\n\n[editor]Olamide Lawal[/editor]\n\nBody'
    expect(types(body)).toEqual(['paragraph'])
    expect(summaryOf(body)).toBe('A short line with style')
    expect(editorOf(body)).toBe('Olamide Lawal')
    expect(summaryOf('Body only')).toBe('')
    expect(editorOf('Body only')).toBe('')
  })

  it('reads a cover shape off the marker and ignores a shape it does not know', () => {
    const [block] = parseRichText('[image=16:9]')
    expect(block).toEqual({ type: 'image', ratio: '16:9' })
    expect(imageRatioOf('[image=3:4]\n\ntext')).toBe('3:4')
    expect(imageRatioOf('plain text')).toBe('natural')
    // A typo stays visible as text rather than quietly cropping the photo to something else.
    expect(types('[image=7:5]')).toEqual(['paragraph'])
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

  it('strips the size, colour, font and underline wrappers', () => {
    expect(richTextPlain('A [color=orange][size=lg]big[/size][/color] [u]word[/u]')).toBe('A big word')
  })

  it('does not put the body-font directive in a description', () => {
    expect(richTextPlain('[body=serif]\n\nHello there')).toBe('Hello there')
  })

  it('drops the image placeholder', () => {
    expect(richTextPlain('Before\n\n[image]\n\nAfter')).toBe('Before After')
    expect(richTextPlain('Before\n\n[image=16:9]\n\nAfter')).toBe('Before After')
    // The standfirst is a headline element, not prose: a card excerpt starts at the body.
    expect(richTextPlain('[summary]Lead line[/summary]\n\nBody')).toBe('Body')
  })

  it('collapses whitespace and handles null', () => {
    expect(richTextPlain(' a   b\nc ')).toBe('a b c')
    expect(richTextPlain(null)).toBe('')
  })
})

describe('readingMinutes', () => {
  it('counts the prose, ignoring markup and the photo placeholder', () => {
    const words = Array.from({ length: 440 }, () => 'word').join(' ')
    expect(readingMinutes(`[body=serif]\n\n[image]\n\n## Title\n\n${words}`)).toBe(2)
  })

  it('never reports less than a minute', () => {
    expect(readingMinutes('')).toBe(1)
    expect(readingMinutes('Three words only')).toBe(1)
  })
})
