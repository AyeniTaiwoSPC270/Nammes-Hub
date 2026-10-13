import { describe, expect, it } from 'vitest'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { PATTERN_GLYPHS } from './quizTheme.js'
import { ensureFonts, CARD_FONT, NOTDEF } from './fonts.js'

// The result card draws its backdrop on a canvas using only the families in api/_lib/fonts. There is no emoji font among
// them, so a backdrop built from emoji would print a row of tofu boxes on every shared card — invisible in the studio,
// which uses the browser's own fonts, and shipped.
//
// A glyph is missing when it draws exactly what NOTDEF draws, because both fall back to the same notdef box. Ink is
// compared rather than advance width: every missing character shares the notdef width by definition, but so do several
// real ones (≈, ± and ✦ all measure the same here), so width cannot tell them apart and would both miss real gaps and
// fail on real glyphs.
//
// What this cannot prove, and it would be wrong to read it as proving: that the glyph is in *DejaVu* specifically. The
// canvas binding also sees the fonts installed on this machine, so a codepoint resolved from some unrelated family would
// pass here and still print tofu on Vercel, where the chain stops at the five files above. The emoji probes below do fall
// to notdef, so the check bites today; it is an environment property, not a guarantee.

function ink(text) {
  const canvas = createCanvas(96, 96)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 96, 96)
  ctx.fillStyle = '#000000'
  ctx.font = CARD_FONT
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 8, 48)
  return ctx.getImageData(0, 0, 96, 96).data
}

const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i])

// A character that drew nothing at all — a soft hyphen, a zero-width space, a BOM — is not the notdef box, so comparing
// against it would call such a character present. On a card that reads as a blank backdrop, which is worse than tofu
// because there is nothing to notice. Anything with no ink at all is therefore treated as missing.
const blank = (pixels) => {
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) return false
  }
  return true
}

describe('the fonts behind the card backdrop', () => {
  it('registers every face the card draws with', () => {
    ensureFonts()
    const names = GlobalFonts.families.map((f) => f.family)
    for (const family of ['Playfair Display', 'Public Sans', 'Public Sans Bold', 'DejaVu Sans', 'DejaVu Sans Bold']) {
      expect(names, family).toContain(family)
    }
  })

  it('can tell a missing glyph from a present one at all', () => {
    // Without this the assertions below could pass for the wrong reason: a renderer that drew nothing for anything would
    // report every glyph as fine.
    ensureFonts()
    const notdef = ink(NOTDEF)
    expect(same(ink('π'), notdef), 'π is in DejaVu').toBe(false)
    expect(same(ink('🎉'), notdef), '🎉 is not, and must read as missing').toBe(true)
    expect(same(ink('π'), ink('Σ')), 'two real glyphs must not be indistinguishable').toBe(false)
  })

  it('has every character every backdrop pattern is built from', () => {
    ensureFonts()
    const notdef = ink(NOTDEF)
    const missing = []
    for (const [pattern, glyphs] of Object.entries(PATTERN_GLYPHS)) {
      // The characters, not the keys: a key is what an admin picks, the character is what has to exist on a card.
      for (const glyph of Object.values(glyphs)) {
        const pixels = ink(glyph)
        if (same(pixels, notdef)) missing.push(`${pattern}: ${glyph} U+${glyph.codePointAt(0).toString(16).toUpperCase()} (no glyph)`)
        else if (blank(pixels)) missing.push(`${pattern}: ${glyph} U+${glyph.codePointAt(0).toString(16).toUpperCase()} (draws nothing)`)
      }
    }
    expect(missing, 'these would print as empty boxes or as nothing at all on a result card').toEqual([])
  })

  it('would catch an emoji in the table, which is the mistake this exists for', () => {
    // A self-check on the guard. If emoji ever stop reading as missing the assertion above has quietly stopped meaning
    // anything, and this fails instead.
    ensureFonts()
    expect(same(ink('🎉'), ink(NOTDEF))).toBe(true)
  })
})