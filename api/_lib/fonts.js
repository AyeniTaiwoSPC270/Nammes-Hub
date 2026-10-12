import { GlobalFonts } from '@napi-rs/canvas'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Every font the two canvas renderers draw with, in one place. This is the second copy this replaced rather than the
// first: the quiz card registered these files, the award card registered three of them, and the test that checks the
// backdrop glyphs against them registered them all again — so deleting a font would have left the test quietly checking
// a set no card used any more.
//
// Server-only, like quizCardRender.js and awardCardRender.js beside it: it reads node:path and pulls in the canvas
// binding, so nothing in src/ may import it. The pure side of the theme — the glyph table these fonts have to cover —
// lives in quizTheme.js instead, which is why that file stays free of both.

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let fontsRegistered = false

export function ensureFonts() {
  if (fontsRegistered) return
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PlayfairDisplay-Bold.ttf'), 'Playfair Display')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PublicSans-Regular.ttf'), 'Public Sans')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PublicSans-Bold.ttf'), 'Public Sans Bold')
  // The maths backdrop needs glyphs the two Public Sans faces do not carry (pi, sigma, root, infinity).
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/DejaVuSans.ttf'), 'DejaVu Sans')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/DejaVuSans-Bold.ttf'), 'DejaVu Sans Bold')
  fontsRegistered = true
}

// The face the card draws its backdrop in. Kept here beside the registration so the test that checks the glyphs and the
// renderer that draws them cannot end up naming different fonts.
export const CARD_FONT = 'bold 64px "DejaVu Sans"'

// A private-use codepoint, which no font carries. Whatever a renderer draws for this, it drew by falling back.
export const NOTDEF = ''