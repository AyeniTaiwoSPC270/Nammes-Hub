import { characterMarkup } from './quizCharacterMarkup.js'

// The characters as SVG strings, for the result cards.
//
// @napi-rs/canvas parses a standalone SVG, and xmlns is what makes the string standalone. The animation classes
// (qz-i-*, qz-w-*, qz-h-*) are stripped when the markup is generated: they mean nothing without characters.css
// attached, which is exactly right for a still card.
//
// This reads the generated markup rather than rendering Character.jsx, because a Node function cannot load a .jsx
// file: doing so failed the whole route with FUNCTION_INVOCATION_FAILED on Vercel, before any of this ran.
// api/_lib/quizCharacterMarkup.js is produced from that component and kept in step by
// scripts/quizCharacterMarkup.test.js.
export function characterSvg(id, { mood = 'happy', size = 100 } = {}) {
  const px = Number(size) > 0 ? Math.round(Number(size)) : 100
  const markup = characterMarkup(id, mood)
  return markup.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"`)
}