import { describe, it, expect } from 'vitest'
import { AWARD_PHASES, nextPhase, phaseAdvanceLabel } from './awardSeasons'

describe('AWARD_PHASES', () => {
  it('lists phases in order', () => {
    expect(AWARD_PHASES).toEqual(['nominating', 'curating', 'voting', 'closed', 'revealed'])
  })
})

describe('nextPhase', () => {
  it('advances through the sequence', () => {
    expect(nextPhase('nominating')).toBe('curating')
    expect(nextPhase('curating')).toBe('voting')
    expect(nextPhase('voting')).toBe('closed')
    expect(nextPhase('closed')).toBe('revealed')
  })
  it('returns null once revealed (no further phase)', () => {
    expect(nextPhase('revealed')).toBeNull()
  })
})

describe('phaseAdvanceLabel', () => {
  it('labels each forward action', () => {
    expect(phaseAdvanceLabel('nominating')).toBe('Close nominations & start curating')
    expect(phaseAdvanceLabel('curating')).toBe('Open voting')
    expect(phaseAdvanceLabel('voting')).toBe('Close voting')
    expect(phaseAdvanceLabel('closed')).toBe('Reveal results')
  })
  it('returns null for the terminal phase', () => {
    expect(phaseAdvanceLabel('revealed')).toBeNull()
  })
})
