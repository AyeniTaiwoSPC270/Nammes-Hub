import { characterSvgBody, avatarInfo } from '../../../api/_lib/quizCharacterArt.js'

// One of the quiz characters, drawn from the shared art module (api/_lib/quizCharacterArt.js), which the result cards
// draw from too. Who it is comes from `id`; the module says which body, headpiece, face, outfit and moves it has, and
// `mood` changes the face and the movement: idle, happy, dance, sad or wave.
//
// Only the inside of the svg comes from the module, as a string, so that this file stays a component the browser can
// render while the same drawing can be parsed by a server that cannot load a .jsx file. Nothing admin-authored reaches
// that string: every part is a key in a fixed table and the colour is a validated hex.
//
// The attributes below are in this order on purpose — React writes them in the order they are written, and the parity
// test in api/_lib/characterArtParity.test.js compares this component's output against markup generated from the
// previous, hand-written version of this drawing.
//
// This file must not import characters.css: the card loads this drawing on a server, and Node cannot parse a stylesheet.

export default function Character({ id, mood = 'idle', className = 'h-full w-full', title }) {
  const info = avatarInfo(id)
  return (
    <svg
      viewBox="0 0 100 100"
      className={`qz-char qz-mood-${mood} qz-i-${info.idle} qz-w-${info.win} qz-s-${info.sad} qz-h-${info.hello} ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: characterSvgBody(info, mood) }}
    />
  )
}