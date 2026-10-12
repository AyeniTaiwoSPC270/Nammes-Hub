import { describe, it, expect } from 'vitest'
import { h, toSvg } from './quizCharacterArt.js'

describe('h and toSvg', () => {
  it('writes a tag, its attributes and its closing tag', () => {
    expect(toSvg(h('rect', { x: 1, y: 2, width: 3, height: 4 }))).toBe('<rect x="1" y="2" width="3" height="4"></rect>')
  })

  it('kebab-cases camelCase attribute names, the way React does for SVG', () => {
    expect(toSvg(h('path', { d: 'M0 0', strokeWidth: 2.5, strokeLinecap: 'round' })))
      .toBe('<path d="M0 0" stroke-width="2.5" stroke-linecap="round"></path>')
  })

  it('keeps lowercase and dashed attribute names as they are', () => {
    expect(toSvg(h('g', { class: 'qz-body' }))).toBe('<g class="qz-body"></g>')
    expect(toSvg(h('path', { 'stroke-linejoin': 'round' }))).toBe('<path stroke-linejoin="round"></path>')
  })

  it('drops undefined, null and false attributes, and keeps zero', () => {
    expect(toSvg(h('g', { a: undefined, b: null, c: false, d: 0 }))).toBe('<g d="0"></g>')
  })

  it('flattens arrays of children and ignores nullish ones', () => {
    expect(toSvg(h('g', null, [h('circle', { r: 1 }), null, [h('circle', { r: 2 })]])))
      .toBe('<g><circle r="1"></circle><circle r="2"></circle></g>')
  })

  it('escapes the five characters that would break the attribute', () => {
    expect(toSvg(h('text', { 'font-family': "Georgia, 'Times New Roman', serif" })))
      .toBe('<text font-family="Georgia, &#x27;Times New Roman&#x27;, serif"></text>')
    expect(toSvg(h('text', { title: 'a & b < c > d " e' })))
      .toBe('<text title="a &amp; b &lt; c &gt; d &quot; e"></text>')
  })
})