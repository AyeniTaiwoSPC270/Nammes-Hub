import { describe, it, expect } from 'vitest'
import { tickSound, stateSound, revealSting, quizSound, MUSIC_STYLES, buzz } from './quizSound'

describe('sound rules', () => {
  it('ticks only in the last five seconds, faster in the last two', () => {
    expect([10, 6, 5, 4, 3, 2, 1, 0].map(tickSound)).toEqual([null, null, 'tick', 'tick', 'tick', 'tickFast', 'tickFast', null])
    expect(tickSound(NaN)).toBeNull()
    expect(tickSound(-1)).toBeNull()
  })
  it('has a sound for each step the game moves to, and none for a repeat or a first look', () => {
    expect(stateSound('lobby', 'question')).toBe('start')
    expect(stateSound('question', 'reveal')).toBe('timeUp')
    expect(stateSound('reveal', 'leaderboard')).toBe('whoosh')
    expect(stateSound('leaderboard', 'finished')).toBe('fanfare')
    expect(stateSound('question', 'question')).toBeNull()
    expect(stateSound(null, 'question')).toBeNull()
    expect(stateSound('lobby', 'lobby')).toBeNull()
  })
  it('chooses a happy or sad sting from how many got it right', () => {
    expect(revealSting(80)).toBe('correct')
    expect(revealSting(50)).toBe('correct')
    expect(revealSting(49)).toBe('wrong')
    expect(revealSting(0)).toBe('wrong')
  })
  it('lists the music styles the studio offers', () => {
    expect(MUSIC_STYLES).toEqual(['off', 'chill', 'hype'])
  })
})

describe('without audio support', () => {
  it('never throws and reports it is not supported', () => {
    expect(quizSound.isSupported()).toBe(false)
    expect(quizSound.unlock()).toBe(false)
    expect(() => {
      quizSound.play('correct')
      quizSound.play('not-a-sound')
      quizSound.startMusic('hype')
      quizSound.stopMusic()
      buzz([50])
    }).not.toThrow()
    expect(quizSound.isMusicPlaying()).toBe(false)
  })
  it('keeps volume and mute settings in range and tells listeners', () => {
    let calls = 0
    const off = quizSound.subscribe(() => { calls += 1 })
    quizSound.setVolume(5)
    expect(quizSound.getSnapshot().volume).toBe(1)
    quizSound.setVolume(-3)
    expect(quizSound.getSnapshot().volume).toBe(0)
    quizSound.setMuted(true)
    expect(quizSound.getSnapshot().muted).toBe(true)
    quizSound.setMuted(false)
    off()
    expect(calls).toBe(4)
  })
})
