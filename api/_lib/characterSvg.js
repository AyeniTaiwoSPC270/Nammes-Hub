import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import Character from '../../src/components/quiz/Character.jsx'

// The quiz characters are inline SVG React components, not image files, so the only way to get one onto a
// server-rendered canvas card is to render the very same component to a string here. Rendering the component
// rather than redrawing it means the card can never drift from what the player saw in the lobby.
//
// This module breaks the api/_lib purity rule on purpose (it imports React and src/), the same way
// awardCardRender.js does: it is server-only, and nothing in src/ imports it. Character.jsx's CSS import moved to
// QuizParts.jsx for the same reason — Node cannot parse CSS.

// @napi-rs/canvas parses a standalone SVG, and xmlns is what makes the string standalone. The move classes
// (qz-i-*, qz-w-*, qz-h-*) mean nothing without characters.css attached, which is what a still card wants. One
// non-animation rule is lost with it, .qz-char { overflow: visible }, which matters only for shapes drawn just
// outside the viewBox and costs about a pixel here.
export function characterSvg(id, { mood = 'happy', size = 100 } = {}) {
  const markup = renderToStaticMarkup(createElement(Character, { id, mood }))
  const px = Number(size) > 0 ? Math.round(Number(size)) : 100
  return markup.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"`)
}