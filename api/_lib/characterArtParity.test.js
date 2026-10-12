import { describe, it, expect } from 'vitest'
import { CHARACTER_MARKUP } from './quizCharacterMarkup.js'
import * as art from './quizCharacterArt.js'

const { characterSvgBody, characterSvgMarkup, avatarInfo, BUILTIN_COUNT } = art

// The oracle. api/_lib/quizCharacterMarkup.js is generated from Character.jsx by scripts/quizCharacterMarkup.test.js and is
// committed, so it records exactly what the 50 characters look like today, with the animation classes already stripped.
//
// This phase replaces the JSX with a string builder. Until that is byte-identical to this file, the drawing has not moved
// safely — and this test is the only thing standing between a refactor and 50 quietly different characters.

const stored = (id, mood) => CHARACTER_MARKUP[`${id}:${mood}`]

// The builder keeps the animation classes, because the browser needs them. The stored markup had them removed when it
// was generated, so both sides are stripped before they are compared.
const strip = (svg) => svg.replace(/\sclass="[^"]*"/g, '')

// What is inside the root. The root itself is the component's job (Task 5): its classes and its aria-hidden belong to
// whatever renders it, so the builder is held to the drawing alone.
const inside = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')

describe('the string builder against the committed markup', () => {
  it('reproduces the inside of every stored character, in every mood', () => {
    const drifted = Object.keys(CHARACTER_MARKUP)
      .filter((key) => {
        const [id, mood] = key.split(':')
        return strip(characterSvgBody(avatarInfo(Number(id)), mood)) !== inside(stored(Number(id), mood))
      })
      .sort()
    expect(drifted, `${drifted.length} character(s) no longer match. First: ${drifted[0]}`).toEqual([])
  })

  it('covers all 50 characters and 5 moods', () => {
    expect(Object.keys(CHARACTER_MARKUP)).toHaveLength(BUILTIN_COUNT * 5)
  })
})

describe('characterSvgBody', () => {
  it('draws the shadow, the prop and the body group, in that order', () => {
    const out = characterSvgBody(avatarInfo(0), 'idle')
    expect(out.startsWith('<ellipse cx="50" cy="90"')).toBe(true)
    expect(out).toContain('<g class="qz-body">')
  })

  it('takes its mood from the argument, not from the spec', () => {
    // Character 0 is a box, so its eye row is 48 and the sad eyes sit one below it.
    expect(characterSvgBody(avatarInfo(0), 'sad')).toContain('<circle cx="38" cy="49" r="7" fill="#fff"></circle>')
    expect(characterSvgBody(avatarInfo(0), 'idle')).not.toContain('<circle cx="38" cy="49" r="7" fill="#fff"></circle>')
  })
})

describe('characterSvgMarkup', () => {
  it('wraps the body in an svg root carrying the animation classes', () => {
    const svg = characterSvgMarkup(avatarInfo(0), 'idle')
    expect(svg.startsWith('<svg class="qz-char qz-mood-idle qz-i-bob qz-w-jump qz-s-droop qz-h-wave" viewBox="0 0 100 100">')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('leaves labelling to whoever renders it, so it cannot contradict the root', () => {
    expect(characterSvgMarkup(avatarInfo(13), 'happy')).not.toContain('aria-')
    expect(characterSvgMarkup(avatarInfo(13), 'happy')).not.toContain('role=')
  })
})