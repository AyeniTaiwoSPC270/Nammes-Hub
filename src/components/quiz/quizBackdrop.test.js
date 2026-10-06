import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// QuizBackdrop paints at `-z-10`. A negative z-index only stays behind its parent when that parent has opened a stacking
// context (`isolate`); with none, the layer escapes to the root, paints under the screen's own `bg-paper` and is never
// seen. Every screen looked right in the studio preview and showed nothing in a real game for exactly this reason, and a
// render test cannot catch it because jsdom does no compositing, so the wiring is checked in the source instead.

const BACKDROP = 'src/components/quiz/QuizParts.jsx'
const PREVIEW = 'src/components/admin/quizStudio/StudioPreview.jsx'

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path) : path.endsWith('.jsx') ? [path] : []
  })
}

function linesOf(file) {
  return readFileSync(file, 'utf8').split('\n')
}

function opensAStackingContext(line) {
  return /className=[^>]*\bisolate\b/.test(line)
}

describe('the quiz backdrop', () => {
  it('paints behind its wrapper, which is the whole reason it needs one', () => {
    expect(readFileSync(BACKDROP, 'utf8')).toContain('-z-10')
  })

  it('is mounted on every screen inside a wrapper that opens a stacking context', () => {
    const unisolated = []
    for (const file of listFiles('src/pages')) {
      const lines = linesOf(file)
      lines.forEach((line, i) => {
        if (!line.includes('<QuizBackdrop')) return
        if (!opensAStackingContext(lines[i - 1] ?? '')) unisolated.push(`${file}:${i + 1}`)
      })
    }
    expect(unisolated).toEqual([])
  })

  it('is mounted in the studio preview inside the frame that opens one', () => {
    // The preview passes the backdrop into <Frame> as children, so its wrapper lives in the Frame component instead of
    // above the mount. That frame is scaled to fit, which is exactly why the preview kept showing a backdrop the live
    // screens were hiding: a transform creates a stacking context as a side effect.
    const frame = linesOf(PREVIEW).slice(linesOf(PREVIEW).findIndex((l) => l.includes('function Frame')))
    const wrapper = frame.find((l) => l.includes('overflow-hidden') && l.includes('className='))
    expect(wrapper, 'the preview frame should still be there').toBeTruthy()
    expect(opensAStackingContext(wrapper)).toBe(true)
  })
})