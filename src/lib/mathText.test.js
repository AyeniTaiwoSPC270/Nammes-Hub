import { describe, it, expect } from 'vitest'
import { splitMath, hasMath } from './mathText'

const B = '\\'

describe('splitMath', () => {
  it('returns plain text untouched', () => {
    expect(splitMath('What is pi?')).toEqual([{ type: 'text', value: 'What is pi?' }])
    expect(hasMath('What is pi?')).toBe(false)
  })
  it('finds inline maths between dollar signs', () => {
    expect(splitMath('Solve $x^2 = 4$ for x')).toEqual([
      { type: 'text', value: 'Solve ' },
      { type: 'math', value: 'x^2 = 4' },
      { type: 'text', value: ' for x' },
    ])
  })
  it('finds several pieces', () => {
    expect(splitMath('$a$ and $b$').filter((p) => p.type === 'math').map((p) => p.value)).toEqual(['a', 'b'])
  })
  it('keeps a backslash inside maths (like a fraction command)', () => {
    expect(splitMath(`$${B}frac{1}{2}$`)).toEqual([{ type: 'math', value: `${B}frac{1}{2}` }])
  })
  it('treats an escaped or lone dollar as a dollar', () => {
    expect(splitMath(`It costs ${B}$5 or ${B}$6`)).toEqual([{ type: 'text', value: 'It costs $5 or $6' }])
    expect(splitMath('Only one $ here')).toEqual([{ type: 'text', value: 'Only one $ here' }])
    expect(hasMath('$$')).toBe(false)
    expect(hasMath('$ $')).toBe(false)
  })
  it('does not run across lines', () => {
    expect(hasMath('a $b\nc$ d')).toBe(false)
  })
})
