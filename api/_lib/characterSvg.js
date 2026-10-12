import { characterSvgMarkup, characterSpec } from './quizCharacterArt.js'

// The characters as SVG strings, for the result cards.
//
// @napi-rs/canvas parses a standalone SVG, and xmlns is what makes the string standalone. The animation classes
// (qz-i-*, qz-w-*, qz-h-*) are stripped here: they mean nothing without characters.css attached, which is exactly right
// for a still card.
//
// The drawing comes from api/_lib/quizCharacterArt.js, which src/components/quiz/Character.jsx draws from too, so the
// browser and the card cannot disagree about what a character looks like. `cast` is optional: without it an id is one
// of the 50 built-ins, which is every card drawn before a quiz had a cast of its own.
export function characterSvg(id, { mood = 'happy', size = 100, cast } = {}) {
  const px = Number(size) > 0 ? Math.round(Number(size)) : 100
  const spec = characterSpec(id, cast)
  const markup = characterSvgMarkup(spec, mood).replace(/\sclass="[^"]*"/g, '')
  return markup.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"`)
}