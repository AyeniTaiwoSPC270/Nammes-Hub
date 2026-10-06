import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// A crash that took the host screen down in production, and no test caught it.
//
// `holdMsRef.current = holdMs` sat above `const holdMsRef = useRef(0)`. Both are in the component body, which runs top to
// bottom on every render, so the assignment touched a binding still in its temporal dead zone and the whole screen threw
// "Cannot access ... before initialization" before it could draw. Every test in the suite passed, because the tests never
// rendered this screen.
//
// There is no DOM in this project's tests and this screen needs a live Supabase session, so the guard reads the source and
// checks the one rule that was broken: inside a component body, a binding must be declared before anything reads or writes
// it. It cannot catch every possible mistake, but it catches this one exactly.

const source = readFileSync(new URL('./HostQuiz.jsx', import.meta.url), 'utf8')

// Only the component body matters: hooks declared inside a nested function are that function's own, and a useEffect body
// runs after the whole component has been rendered, so a read there is never in the dead zone.
function lines() {
  return source.split('\n').map((text, index) => ({ number: index + 1, text }))
}

describe('the host screen has no binding written to before it is declared', () => {
  it('writes to every ref only after that ref is declared', () => {
    const all = lines()
    // Only refs. A ref is written to during render, so a write above its declaration is a dead-zone crash on every
    // render. Other bindings are left alone: whether one is used is not this rule's business.
    const declarations = all
      .filter((l) => /^\s*const (\w+)\s*=\s*useRef\(/.test(l.text))
      .map((l) => ({ name: l.text.match(/const (\w+)\s*=/)[1], line: l.number }))
    expect(declarations.length).toBeGreaterThan(0)

    const problems = []
    for (const { name, line } of declarations) {
      // A write is the name followed by a dot and an assignment, and it must sit below the declaration.
      const written = all.find((l) => l.number > line && new RegExp(`\\b${name}\\s*\\.\\w+\\s*=(?!=)`).test(l.text))
      if (!written) continue
      const above = all.find((l) => l.number < line && new RegExp(`\\b${name}\\s*\\.\\w+\\s*=(?!=)`).test(l.text))
      if (above) problems.push(`${name}.current is written at line ${above.number} but the ref is declared at line ${line}`)
    }
    expect(problems).toEqual([])
  })

  it('holds the reveal up for as long as the sound it waits for actually lasts', () => {
    // The two halves of the same rule: the auto-advance wait has to include the hold, and the hold has to come from the
    // one function that decides it. A drift here is what let the answer be skipped entirely.
    expect(source).toMatch(/AUTO_ADVANCE_MS \+ \(state === 'reveal' \? holdMsRef\.current : 0\)/)
    expect(source).toMatch(/holdMsRef\.current = holdMs/)
    expect(source).toMatch(/revealHoldMs\(soundCfg, quizSound\.customEffectMs\('drumroll'\)\)/)
  })

  it('declares the ref it publishes before it publishes to it', () => {
    const declared = source.split('\n').findIndex((l) => /const holdMsRef = useRef\(/.test(l))
    const written = source.split('\n').findIndex((l) => /holdMsRef\.current = holdMs/.test(l))
    expect(declared).toBeGreaterThanOrEqual(0)
    expect(written).toBeGreaterThanOrEqual(0)
    expect(declared, 'the ref must be declared before it is written to').toBeLessThan(written)
  })
})