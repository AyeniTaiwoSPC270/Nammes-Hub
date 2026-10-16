import { describe, expect, it } from 'vitest'
import {
  gradeAnswer, computeAward, awardPoints, normaliseUnit, splitNumberAndUnit, unitMatches,
  letterboxRect, toNormalized, toRenderedPoint, cleanDiagramTargets, diagramHit,
} from './quizGrading'

describe('units', () => {
  // §2.2 is the whole reason units are per-question rather than a registry. This is the assertion that fails first if
  // anyone "improves" the matcher into a canonical registry.
  it('does not accept N for a question answered in kN', () => {
    const q = { type: 'numeric', numeric_answer: 2.5, numeric_unit: 'kN' }
    expect(gradeAnswer(q, { answerText: '2.5 kN' }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: '2.5 N' }).correct).toBe(false)
    expect(gradeAnswer(q, { answerText: '2500 N' }).correct).toBe(false)
  })

  it('does not accept kN for a question answered in N either', () => {
    const q = { type: 'numeric', numeric_answer: 2500, numeric_unit: 'N' }
    expect(gradeAnswer(q, { answerText: '2500 N' }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: '2500 kN' }).correct).toBe(false)
  })

  it('accepts the spellings of the declared unit and its aliases', () => {
    const q = { type: 'numeric', numeric_answer: 2.5, numeric_unit: 'kN', numeric_unit_aliases: ['kiloNewton', 'kilo-newton'] }
    for (const typed of ['2.5 kN', '2.5KN', '2.5 kn', '2.5 kiloNewton', '2.5 kilo-newton', '2.5 KILO_NEWTON']) {
      expect(gradeAnswer(q, { answerText: typed }).correct, typed).toBe(true)
    }
  })

  it('normalises micro and squared without collapsing prefixes', () => {
    expect(normaliseUnit('kN')).toBe('kn')
    expect(normaliseUnit('N')).toBe('n')
    expect(normaliseUnit('\u03bcm')).toBe('um')
    expect(normaliseUnit('m\u00b2')).toBe('m2')
    expect(normaliseUnit('N\u00b2')).toBe('n2')
  })

  it('ignores a typed unit when the question declares none', () => {
    const q = { type: 'numeric', numeric_answer: 4 }
    expect(gradeAnswer(q, { answerText: '4' }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: '4 N' }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: '4 elephants' }).correct).toBe(true)
  })

  it('refuses a bare number when the question requires a unit', () => {
    const q = { type: 'numeric', numeric_answer: 2.5, numeric_unit: 'kN' }
    expect(gradeAnswer(q, { answerText: '2.5' }).correct).toBe(false)
  })

  it('splits the number from the unit without touching the magnitude', () => {
    expect(splitNumberAndUnit('2500 N')).toEqual({ number: '2500', unit: 'N' })
    expect(splitNumberAndUnit('-3.5 kN')).toEqual({ number: '-3.5', unit: 'kN' })
    expect(splitNumberAndUnit('12')).toEqual({ number: '12', unit: '' })
  })

  it('keeps the tolerance working unchanged on a unit question', () => {
    const q = { type: 'numeric', numeric_answer: 100, numeric_tolerance: 1, numeric_unit: 'm' }
    expect(gradeAnswer(q, { answerText: '100.5 m' }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: '102 m' }).correct).toBe(false)
  })
})

describe('ordering', () => {
  const q = { type: 'order', options: ['mix', 'bake', 'serve'] }

  it('takes the authored order as the answer, with no separate column to drift', () => {
    expect(gradeAnswer(q, { answerText: '', order: [0, 1, 2] }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: '', order: [2, 0, 1] }).correct).toBe(false)
  })

  it('awards positional credit', () => {
    expect(gradeAnswer(q, { answerText: '', order: [0, 2, 1] }).credit).toBeCloseTo(1 / 3)
    expect(gradeAnswer(q, { answerText: '', order: [0, 1, 2] }).credit).toBe(1)
  })

  it('scores six steps with the last two swapped as four sixths, and is not correct', () => {
    const six = { type: 'order', options: ['a', 'b', 'c', 'd', 'e', 'f'] }
    const r = gradeAnswer(six, { answerText: '', order: [0, 1, 2, 3, 5, 4] })
    expect(r.correct).toBe(false)
    expect(r.credit).toBeCloseTo(4 / 6)
  })

  // The spec's worked example ("6 steps with 1 wrong scores 5/6") is not reachable: a permutation cannot have
  // exactly n-1 fixed points, since the one remaining element would have to fix itself. The nearest real value is
  // (n-2)/n, because a single transposition always displaces two positions.
  it('cannot score five sixths, because no permutation of six has five fixed points', () => {
    const six = { type: 'order', options: ['a', 'b', 'c', 'd', 'e', 'f'] }
    const permutations = [
      [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 5, 4], [1, 0, 2, 3, 4, 5], [0, 2, 1, 3, 4, 5],
      [5, 4, 3, 2, 1, 0], [2, 0, 1, 3, 4, 5], [0, 1, 2, 4, 3, 5], [3, 4, 5, 0, 1, 2],
    ]
    for (const order of permutations) {
      const r = gradeAnswer(six, { answerText: '', order })
      expect(r.credit, order.join(',')).not.toBeCloseTo(5 / 6)
    }
  })

  it('reaches five fifths nowhere either, and 2 of 5 is the reachable partial', () => {
    const five = { type: 'order', options: ['a', 'b', 'c', 'd', 'e'] }
    expect(gradeAnswer(five, { answerText: '', order: [0, 1, 4, 3, 2] }).credit).toBeCloseTo(3 / 5)
  })

  it('rejects a submission that is not a permutation of every step', () => {
    expect(gradeAnswer(q, { answerText: '', order: [0, 1] }).ok).toBe(false)
    expect(gradeAnswer(q, { answerText: '', order: [0, 1, 1] }).ok).toBe(false)
    expect(gradeAnswer(q, { answerText: '', order: [0, 1, 7] }).ok).toBe(false)
    expect(gradeAnswer(q, { answerText: '', order: undefined }).ok).toBe(false)
  })
})

describe('partial credit through computeAward', () => {
  it('scales by credit before the multipliers run', () => {
    const award = computeAward({ correct: false, base: 1000, credit: 5 / 6 })
    expect(award.points).toBe(833)
    expect(award.streakAfter).toBe(0)
    expect(award.bonus).toBe(0)
  })

  // The rounding is asserted rather than tolerated, because points_awarded is an integer and the alternative is a
  // leaderboard that disagrees with the reveal by a fraction.
  it('rounds an odd fraction at 2x explicitly', () => {
    expect(computeAward({ correct: false, base: 1000, credit: 1 / 3, multiplier: 2 }).points).toBe(667)
    expect(computeAward({ correct: false, base: 1000, credit: 2 / 3, multiplier: 2 }).points).toBe(1333)
  })

  it('gives no streak or comeback boost for a partial answer', () => {
    const award = computeAward({ correct: false, base: 1000, credit: 0.5, streakBefore: 3, options: { streaks: true }, comeback: true })
    expect(award.points).toBe(500)
    expect(award.streakAfter).toBe(0)
  })

  it('leaves a fully correct answer on the old path, unrounded', () => {
    const award = computeAward({ correct: true, base: 1000, streakBefore: 1, options: { streaks: true } })
    expect(award.points).toBe(1050)
    expect(award.streakAfter).toBe(2)
  })

  it('still scores a poll as nothing', () => {
    expect(computeAward({ correct: null, base: 1000, credit: 1, streakBefore: 2 }).points).toBe(0)
  })

  it('still scores a wrong non-partial answer as nothing', () => {
    expect(computeAward({ correct: false, base: 1000, streakBefore: 2 }).points).toBe(0)
  })
})

describe('diagram', () => {
  const q = { type: 'diagram', diagram_targets: [{ x: 0.5, y: 0.5, r: 0.1 }] }

  it('is correct inside the radius and wrong outside it', () => {
    expect(gradeAnswer(q, { answerText: '', tap: { x: 0.5, y: 0.5 } }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: '', tap: { x: 0.58, y: 0.5 } }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: '', tap: { x: 0.7, y: 0.5 } }).correct).toBe(false)
  })

  it('accepts any one of several targets', () => {
    const many = { type: 'diagram', diagram_targets: [{ x: 0.2, y: 0.2, r: 0.05 }, { x: 0.8, y: 0.8, r: 0.05 }] }
    expect(gradeAnswer(many, { answerText: '', tap: { x: 0.8, y: 0.8 } }).correct).toBe(true)
    expect(gradeAnswer(many, { answerText: '', tap: { x: 0.5, y: 0.5 } }).correct).toBe(false)
  })

  it('rejects a tap that is not a point', () => {
    expect(gradeAnswer(q, { answerText: '', tap: null }).ok).toBe(false)
    expect(gradeAnswer(q, { answerText: '', tap: { x: 'a', y: 1 } }).ok).toBe(false)
  })

  it('drops targets that are out of range or malformed, and caps the count', () => {
    expect(cleanDiagramTargets([{ x: 1.5, y: 0.5, r: 0.1 }, { x: 0.5, y: 0.5, r: 0 }, { x: 0.5, y: 0.5, r: 'x' }, { x: 0.5, y: 0.5, r: 0.1 }]))
      .toEqual([{ x: 0.5, y: 0.5, r: 0.1, ar: 1 }])
    const many = Array.from({ length: 40 }, (_, i) => ({ x: i / 40, y: 0.5, r: 0.01 }))
    expect(cleanDiagramTargets(many)).toHaveLength(12)
  })

  // A normalised circle only exists if the picture's own shape is known. Every diagram test above uses a square
  // (ar defaults to 1), where the naive distance is accidentally right, so these are the ones that would have caught
  // the original: on a 2:1 picture a region is twice as wide as it is tall if the aspect is ignored.
  it('keeps a region circular on a landscape picture, not twice as wide', () => {
    // 800x400 with r = 0.1 is a 40px circle. 0.04 across is 32px (inside), 0.07 across is 56px (outside).
    const wide = { type: 'diagram', diagram_targets: [{ x: 0.5, y: 0.5, r: 0.1, ar: 2 }] }
    expect(gradeAnswer(wide, { answerText: '', tap: { x: 0.54, y: 0.5 } }).correct).toBe(true)
    expect(gradeAnswer(wide, { answerText: '', tap: { x: 0.5, y: 0.58 } }).correct).toBe(true)
    // Both of these were accepted by the aspect-blind distance, and both are outside the circle.
    expect(gradeAnswer(wide, { answerText: '', tap: { x: 0.57, y: 0.5 } }).correct).toBe(false)
    expect(gradeAnswer(wide, { answerText: '', tap: { x: 0.5, y: 0.62 } }).correct).toBe(false)
  })

  it('keeps a region circular on a portrait picture, not twice as tall', () => {
    // 400x800 with r = 0.1 is again a 40px circle, so the vertical allowance in normalised terms is half as large.
    const tall = { type: 'diagram', diagram_targets: [{ x: 0.5, y: 0.5, r: 0.1, ar: 0.5 }] }
    expect(gradeAnswer(tall, { answerText: '', tap: { x: 0.5, y: 0.54 } }).correct).toBe(true)
    expect(gradeAnswer(tall, { answerText: '', tap: { x: 0.58, y: 0.5 } }).correct).toBe(true)
    expect(gradeAnswer(tall, { answerText: '', tap: { x: 0.5, y: 0.57 } }).correct).toBe(false)
    expect(gradeAnswer(tall, { answerText: '', tap: { x: 0.65, y: 0.5 } }).correct).toBe(false)
  })

  it('treats a missing or absurd aspect as square rather than failing the question', () => {
    expect(cleanDiagramTargets([{ x: 0.5, y: 0.5, r: 0.1, ar: 0 }])[0].ar).toBe(1)
    expect(cleanDiagramTargets([{ x: 0.5, y: 0.5, r: 0.1, ar: 1e6 }])[0].ar).toBe(50)
  })
})

// The three surfaces rolled their own award arithmetic and drifted: the hosted game credited a partially-right ordering
// while battle and practice multiplied the base by `correct`, so four steps in the right place scored nothing there and
// the same answer scored in a hosted game.
describe('awardPoints', () => {
  it('awards the full amount for a correct answer, multiplier already applied', () => {
    expect(awardPoints(2000, { correct: true, credit: 1 })).toBe(2000)
  })

  it('awards nothing for a wrong answer on a type that cannot be partial', () => {
    expect(awardPoints(2000, { correct: false, credit: 1 })).toBe(0)
  })

  it('awards the fraction of the question that landed for a partially-right ordering', () => {
    expect(awardPoints(2000, { correct: false, credit: 4 / 6 })).toBe(1333)
    expect(awardPoints(1000, { correct: false, credit: 2 / 6 })).toBe(333)
  })

  it('awards nothing for an entirely wrong ordering, or for no answer at all', () => {
    expect(awardPoints(2000, { correct: false, credit: 0 })).toBe(0)
    expect(awardPoints(2000, null)).toBe(0)
    expect(awardPoints(2000, { correct: false, credit: 1 })).toBe(0)
  })

  it('rounds the same way computeAward does, because both write an integer column', () => {
    // A third of a question at double points does not divide evenly, which is the whole reason credit is stored.
    expect(awardPoints(3000, { correct: false, credit: 1 / 3 })).toBe(1000)
    expect(awardPoints(1000, { correct: false, credit: 1 / 3 })).toBe(333)
  })
})

// The letterbox is the silent failure: get it wrong and every diagram grades wrong on every handset while looking
// right in the editor. Both boxes are exercised - the phone's portrait box and the authoring surface's wide one.
describe('the object-contain letterbox', () => {
  const image = { width: 800, height: 400 }

  it('centres a wide image in a tall box and bars it top and bottom', () => {
    const rect = letterboxRect({ width: 300, height: 600 }, image)
    expect(rect.width).toBeCloseTo(300)
    expect(rect.height).toBeCloseTo(150)
    expect(rect.left).toBeCloseTo(0)
    expect(rect.top).toBeCloseTo(225)
  })

  it('centres a wide image in a wider box and bars it left and right', () => {
    const rect = letterboxRect({ width: 900, height: 300 }, image)
    expect(rect.height).toBeCloseTo(300)
    expect(rect.width).toBeCloseTo(600)
    expect(rect.left).toBeCloseTo(150)
    expect(rect.top).toBeCloseTo(0)
  })

  it('round-trips a tap from the phone box back to the authoring box', () => {
    // Authoring box.
    const editorBox = { width: 900, height: 300 }
    const editorRect = letterboxRect(editorBox, image)
    const authored = toRenderedPoint({ x: 0.5, y: 0.25 }, editorRect, image)
    // The same marker, normalised, re-projected into a phone-shaped box.
    const phoneBox = { width: 300, height: 600 }
    const phoneRect = letterboxRect(phoneBox, image)
    const onPhone = toRenderedPoint({ x: 0.5, y: 0.25 }, phoneRect, image)
    // And a student tapping exactly that spot maps back to the authored normalised point.
    const back = toNormalized(onPhone, phoneRect, image)
    expect(back.x).toBeCloseTo(0.5, 6)
    expect(back.y).toBeCloseTo(0.25, 6)
    // The two rendered points are genuinely different pixels, which is the point of normalising.
    expect(onPhone.x).not.toBeCloseTo(authored.x)
    expect(onPhone.y).not.toBeCloseTo(authored.y)
  })

  it('round-trips through both boxes for several positions', () => {
    const boxes = [{ width: 320, height: 160 }, { width: 300, height: 600 }, { width: 900, height: 300 }, { width: 640, height: 480 }]
    for (const box of boxes) {
      for (const p of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 0.5 }, { x: 0.23, y: 0.81 }]) {
        const rect = letterboxRect(box, image)
        const rendered = toRenderedPoint(p, rect, image)
        const back = toNormalized(rendered, rect, image)
        expect(back.x, `${box.width}x${box.height} ${p.x}`).toBeCloseTo(p.x, 6)
        expect(back.y, `${box.width}x${box.height} ${p.y}`).toBeCloseTo(p.y, 6)
      }
    }
  })

  it('keeps a tap in the letterbox bar outside every target', () => {
    // A tap on the grey bar above the picture is not a miss on the diagram, it is a tap on nothing.
    const rect = letterboxRect({ width: 300, height: 600 }, image)
    const onBar = { x: 150, y: 50 }
    const n = toNormalized(onBar, rect, image)
    expect(diagramHit(n, [{ x: 0.5, y: 0.5, r: 0.3 }])).toBe(false)
  })

  it('survives a missing or zero-sized box instead of dividing by zero', () => {
    expect(() => letterboxRect({}, image)).not.toThrow()
    expect(() => toNormalized({ x: 1, y: 1 }, letterboxRect({ width: 0, height: 0 }, image), image)).not.toThrow()
  })
})