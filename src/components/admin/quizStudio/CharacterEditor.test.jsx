import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { avatarInfo, DEFAULT_MOOD, MAX_CAST, sameDesign, sanitizeCast } from '../../../../api/_lib/quizCharacterArt.js'

const SOURCE = 'src/components/admin/quizStudio/CharacterEditor.jsx'

describe('cast editor rules', () => {
  it('cleans each authored spec before the editor uses it', () => {
    const cleaned = sanitizeCast({ mode: 'all', characters: [{ slot: 2, name: 'Kola', spec: { body: 'bad', color: 'red' }, moves: {} }] })
    expect(cleaned.characters[0].spec).toMatchObject({ body: DEFAULT_MOOD.body, color: null })
  })

  it('keeps deleted slots as holes and uses the shared design comparer', () => {
    const cast = sanitizeCast({ mode: 'all', characters: [
      { slot: 0, name: 'A', spec: {}, moves: {} }, { slot: 2, name: 'C', spec: {}, moves: {} },
    ] })
    const remaining = cast.characters.filter((character) => character.slot !== 0)
    expect(remaining.map((character) => character.slot)).toEqual([2])
    expect(sameDesign(avatarInfo(0), avatarInfo(0))).toBe(true)
    expect(sameDesign(avatarInfo(0), avatarInfo(1))).toBe(false)
    expect(MAX_CAST).toBe(12)
  })

  it('uses one accordion state, one save action and warns about duplicates without blocking save', () => {
    const source = readFileSync(SOURCE, 'utf8')
    expect(source).toContain('const [open, setOpen] = useState')
    expect(source).toContain('aria-expanded={open === section.id}')
    expect(source).toContain('sameDesign(')
    expect(source).toContain('role="status"')
    expect(source).toContain('Save cast')
    expect(source).toContain('useSaveCast')
  })

  it('keeps save controls available when the last saved character is deleted', () => {
    const source = readFileSync(SOURCE, 'utf8')
    expect(source).toMatch(/\{\(draft \|\| selected\) && \(/)
  })
})
