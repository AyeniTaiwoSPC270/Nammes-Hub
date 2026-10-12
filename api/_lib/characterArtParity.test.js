import { describe, it, expect } from 'vitest'
import { CHARACTER_MARKUP } from './quizCharacterMarkup.js'
import { characterSvgMarkup, avatarInfo, BUILTIN_COUNT } from './quizCharacterArt.js'

// The oracle. api/_lib/quizCharacterMarkup.js is generated from Character.jsx by scripts/quizCharacterMarkup.test.js and is
// committed, so it records exactly what the 50 characters look like today, with the animation classes already stripped.
//
// This phase replaces the JSX with a string builder. Until that is byte-identical to this file, the drawing has not moved
// safely — and this test is the only thing standing between a refactor and 50 quietly different characters.

const stored = (id, mood) => CHARACTER_MARKUP[`${id}:${mood}`]

// The builder keeps the animation classes, because the browser needs them. The stored markup had them removed when it
// was generated, so both sides are stripped before they are compared.
const strip = (svg) => svg.replace(/\sclass="[^"]*"/g, '')

describe('the string builder against the committed markup', () => {
  it('reproduces every stored character, in every mood', () => {
    const drifted = Object.keys(CHARACTER_MARKUP)
      .filter((key) => {
        const [id, mood] = key.split(':')
        return strip(characterSvgMarkup(avatarInfo(Number(id)), mood)) !== stored(Number(id), mood)
      })
      .sort()
    expect(drifted, `${drifted.length} character(s) no longer match. First: ${drifted[0]}`).toEqual([])
  })

  it('covers all 50 characters and 5 moods', () => {
    expect(Object.keys(CHARACTER_MARKUP)).toHaveLength(BUILTIN_COUNT * 5)
  })
})