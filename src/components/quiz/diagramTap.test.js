import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { letterboxRect, toNormalized, cleanDiagramTargets, diagramHit, gradeAnswer } from '../../../api/_lib/quizGrading.js'

// A diagram question asks a student to tap a region, and the component that draws the picture had one caller that
// passed the tap itself and another that passed the list of regions. Only the second is a list, so `dots.map` threw
// "dots.map is not a function" the instant a student tapped -- the one interaction the question cannot be answered
// without -- and the ErrorBoundary showed them "The page ran into a problem".

describe('a tap is normalised against the picture, not the screen', () => {
  it('maps a point inside the picture to the same place inside the image', () => {
    const image = { width: 1600, height: 900 }
    const box = { width: 320, height: 320 } // letterboxed: the picture is 320x180, centred
    const rect = letterboxRect(box, image)
    expect(rect.width).toBeCloseTo(320)
    expect(rect.height).toBeCloseTo(180)
    // The middle of the drawn picture is the middle of the image.
    const centre = toNormalized({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, rect, image)
    expect(centre.x).toBeCloseTo(0.5)
    expect(centre.y).toBeCloseTo(0.5)
  })

  it('round-trips through a landscape and a portrait box', () => {
    for (const [image, box] of [
      [{ width: 1600, height: 900 }, { width: 320, height: 320 }],
      [{ width: 900, height: 1600 }, { width: 320, height: 320 }],
    ]) {
      const rect = letterboxRect(box, image)
      for (const [nx, ny] of [[0.25, 0.75], [0.5, 0.5], [0.8, 0.2]]) {
        const round = toNormalized({ x: rect.left + nx * rect.width, y: rect.top + ny * rect.height }, rect, image)
        expect(round.x).toBeCloseTo(nx)
        expect(round.y).toBeCloseTo(ny)
      }
    }
  })
})

describe('regions keep their shape on any display', () => {
  const targets = cleanDiagramTargets([{ x: 0.5, y: 0.5, r: 0.1, ar: 1.5 }])

  it('keeps the aspect ratio a region was authored with, and defaults a missing one', () => {
    expect(targets[0].ar).toBe(1.5)
    expect(cleanDiagramTargets([{ x: 0.5, y: 0.5, r: 0.1 }])[0].ar).toBe(1)
  })

  it('rejects a region it cannot draw rather than repairing it', () => {
    // A tap outside the picture, a zero radius and a NaN coordinate are all refused, so a bad row cannot widen a
    // region until every tap hits it.
    expect(cleanDiagramTargets([{ x: 1.4, y: 0.5, r: 0.1 }])).toHaveLength(0)
    expect(cleanDiagramTargets([{ x: 0.5, y: 0.5, r: 0 }])).toHaveLength(0)
    expect(cleanDiagramTargets([{ x: 'x', y: 0.5, r: 0.1 }])).toHaveLength(0)
    expect(cleanDiagramTargets(null)).toHaveLength(0)
  })

  it('measures each region against the picture it was authored on', () => {
    // A region is a circle of r times the picture's SHORTER side, so the tolerance along each axis depends on which
    // side that is. These are the boundaries diagramHit actually enforces, measured rather than guessed:
    //   ar 1.5 (landscape): dx up to 0.067, dy up to 0.100 -- the height is the shorter side
    //   ar 1   (square):    dx up to 0.100, dy up to 0.100
    //   ar 0.5 (portrait):  dx up to 0.100, dy up to 0.050 -- the width is the shorter side
    // A plain hypot() with no ar accepts 0.1 on BOTH axes everywhere, so on a landscape picture it takes in a band
    // half again as wide as the circle that was actually drawn. Every square test still passes and only the landscape
    // one misgrades -- which is the failure mode AGENTS.md records for this function.
    const wide = [{ x: 0.5, y: 0.5, r: 0.1, ar: 1.5 }]
    expect(diagramHit({ x: 0.56, y: 0.5 }, wide)).toBe(true)
    expect(diagramHit({ x: 0.5, y: 0.6 }, wide)).toBe(true)
    expect(diagramHit({ x: 0.6, y: 0.5 }, wide)).toBe(false)
    const square = [{ x: 0.5, y: 0.5, r: 0.1, ar: 1 }]
    expect(diagramHit({ x: 0.6, y: 0.5 }, square)).toBe(true)
    expect(diagramHit({ x: 0.5, y: 0.6 }, square)).toBe(true)
    const tall = [{ x: 0.5, y: 0.5, r: 0.1, ar: 0.5 }]
    expect(diagramHit({ x: 0.5, y: 0.54 }, tall)).toBe(true)
    expect(diagramHit({ x: 0.5, y: 0.6 }, tall)).toBe(false)
  })
})

describe('a diagram answer', () => {
  const question = { type: 'diagram', diagram_targets: [{ x: 0.5, y: 0.5, r: 0.1, ar: 1 }], points: 500 }

  it('grades a tap on the region right and a tap off it wrong', () => {
    expect(gradeAnswer(question, { tap: { x: 0.5, y: 0.5 } })).toMatchObject({ ok: true, correct: true })
    expect(gradeAnswer(question, { tap: { x: 0.9, y: 0.9 } })).toMatchObject({ ok: true, correct: false })
  })

  it('refuses a tap that is not a point on the picture', () => {
    // A bot that fell through to the typed branch sent answerText, and a client that sent nothing must not grade.
    expect(gradeAnswer(question, {}).ok).toBe(false)
    expect(gradeAnswer(question, { tap: null }).ok).toBe(false)
    expect(gradeAnswer(question, { tap: { x: 'a', y: 1 } }).ok).toBe(false)
  })
})

describe('the component that draws the picture', () => {
  const tap = readFileSync('src/components/quiz/DiagramTap.jsx', 'utf8')

  it('wraps a single tap into the list it maps over', () => {
    // The phone passes one point as `preview` and the projector passes the whole region list as `targets`. Treating
    // them as the same shape is what threw on the first tap.
    expect(tap).toMatch(/preview\s*\?\s*\[\s*preview\s*\]/)
  })

  it('never maps over a bare point', () => {
    expect(tap).not.toMatch(/dots\s*=\s*preview\s*[^?]*(\?\?|\|\|)/)
  })

  it('draws a tap at a fixed size, because a tap carries no radius', () => {
    expect(tap).toContain('PREVIEW_DOT_FRACTION')
  })
})