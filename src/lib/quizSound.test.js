import { describe, it, expect } from 'vitest'
import {
  tickSound,
  stateSound,
  revealSting,
  applauseSound,
  leaderboardChimes,
  quizSound,
  MUSIC_STYLES,
  EFFECT_GROUPS,
  hasMusicStyle,
  hasEffect,
  layersFor,
  styleFor,
  rootIndexAt,
  rollTimes,
  applauseSamples,
  DRUMROLL_HIT_MS,
  DRUMROLL_START_MS,
  revealHoldMs,
  effectOn,
  importedGain,
  buzz,
} from './quizSound'
import { THEME_MUSIC, MUSIC_NOTES, THEME_EFFECTS, DEFAULT_THEME, sanitizeTheme } from '../../api/_lib/quizTheme.js'

const DEFAULT_SOUND = DEFAULT_THEME.sound

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
  it('only cheers for a round most people got right', () => {
    expect(applauseSound(80)).toBe('applause')
    expect(applauseSound(50)).toBe('applause')
    expect(applauseSound(49)).toBeNull()
    expect(applauseSound(NaN)).toBeNull()
  })
  it('never asks for more chimes than the leaderboard has rows', () => {
    expect(leaderboardChimes(3)).toBe(3)
    expect(leaderboardChimes(50)).toBe(5)
    expect(leaderboardChimes(6, 8)).toBe(6)
    expect(leaderboardChimes(0)).toBe(0)
    expect(leaderboardChimes(NaN)).toBe(0)
  })
  it('publishes when the drum roll lands its hit, so the reveal can be timed to it', () => {
    // The sting used to sit at a hand-picked offset that drifted away from the roll whenever it was reshaped.
    expect(DRUMROLL_HIT_MS).toBeGreaterThan(400)
    expect(DRUMROLL_HIT_MS).toBeLessThan(1200)
  })
})

describe('switching sounds off', () => {
  const OFF_JOIN = { effects: true, off: ['join'] }
  it('plays everything unless the quiz has switched an effect off', () => {
    expect(effectOn(undefined, 'join')).toBe(true)
    expect(effectOn(DEFAULT_SOUND, 'join')).toBe(true)
    expect(effectOn(OFF_JOIN, 'join')).toBe(false)
    expect(effectOn(OFF_JOIN, 'tick')).toBe(true)
  })
  it('turns every effect off with the master switch', () => {
    expect(effectOn({ effects: false, off: [] }, 'tick')).toBe(false)
    expect(effectOn({ effects: false }, 'tick')).toBe(false)
  })
  it('ignores a junk off list rather than throwing on it', () => {
    for (const off of ['join', null, undefined, 7, { join: true }]) {
      expect(effectOn({ effects: true, off }, 'join'), String(off)).toBe(true)
    }
  })
})

describe('how long the reveal holds the answer back', () => {
  it('waits for the built-in roll to land its hit', () => {
    expect(revealHoldMs(DEFAULT_SOUND)).toBe(DRUMROLL_START_MS + DRUMROLL_HIT_MS)
    expect(revealHoldMs(DEFAULT_SOUND, 0)).toBe(DRUMROLL_START_MS + DRUMROLL_HIT_MS)
  })
  it('waits for an imported roll instead, because the built-in hit time means nothing for one', () => {
    expect(revealHoldMs(DEFAULT_SOUND, 2400)).toBe(DRUMROLL_START_MS + 2400)
    expect(revealHoldMs(DEFAULT_SOUND, 900.6)).toBe(DRUMROLL_START_MS + 901)
  })
  it('holds nothing at all when the roll is switched off, because there is no hit to wait for', () => {
    expect(revealHoldMs({ effects: true, off: ['drumroll'] })).toBe(0)
    expect(revealHoldMs({ effects: true, off: ['drumroll'] }, 2400)).toBe(0)
    expect(revealHoldMs({ effects: true, off: ['join', 'drumroll', 'applause'] })).toBe(0)
  })
  it('holds nothing at all when effects are off entirely', () => {
    expect(revealHoldMs({ effects: false, off: [] })).toBe(0)
    expect(revealHoldMs({ effects: false, off: [] }, 2400)).toBe(0)
  })
  it('does not wait for a clip that never decoded, and does not wait backwards', () => {
    for (const junk of [NaN, -1, Infinity, '1200', null, undefined]) {
      expect(revealHoldMs(DEFAULT_SOUND, junk), String(junk)).toBe(DRUMROLL_START_MS + DRUMROLL_HIT_MS)
    }
  })
  it('builds the hold out of a theme the server already cleaned', () => {
    const sound = sanitizeTheme({ sound: { music: 'chill', off: ['drumroll', 'not-a-sound'] } }).sound
    expect(revealHoldMs(sound)).toBe(0)
    expect(revealHoldMs(sanitizeTheme({}).sound)).toBe(DRUMROLL_START_MS + DRUMROLL_HIT_MS)
  })
})

describe('what a style resolves to', () => {
  // These are the two loops that shipped first. They describe lead and bass with flat keys, and every field the
  // scheduler reads has to come back out unchanged, or a "new styles only" change quietly rewrites them.
  const CHILL = { bpm: 84, wave: 'triangle', gain: 0.05, bass: 'sine', bassGain: 0.08, pattern: [0, 2, 4, 2, 3, 1, 4, 2] }
  const HYPE = { bpm: 126, wave: 'sawtooth', gain: 0.035, bass: 'square', bassGain: 0.05, pattern: [0, 3, 5, 3, 2, 4, 5, 4] }

  it('lifts the original styles\' flat bass into an object instead of reading fields off a string', () => {
    // A string is not nullish, so `style.bass ?? {...}` never fell through and every field read back undefined,
    // which tone() turned into its own defaults: chill's bass went from 0.08 to 0.2, hype's from a square to a sine.
    expect(layersFor(CHILL).bass).toEqual({ wave: 'sine', gain: 0.08 })
    expect(layersFor(HYPE).bass).toEqual({ wave: 'square', gain: 0.05 })
  })

  it('keeps the original styles on eighths, at the tempo they always had', () => {
    expect(layersFor(CHILL).stepDur).toBe(60 / 84 / 2)
    expect(layersFor(HYPE).stepDur).toBe(60 / 126 / 2)
    expect(layersFor(CHILL).steps).toBe(8)
    expect(layersFor(CHILL).every).toBe(4)
  })

  it('keeps the original styles\' lead, scale and bass roots exactly as they were', () => {
    expect(layersFor(CHILL).lead).toEqual({ wave: 'triangle', gain: 0.05, pattern: [0, 2, 4, 2, 3, 1, 4, 2] })
    expect(layersFor(HYPE).lead).toEqual({ wave: 'sawtooth', gain: 0.035, pattern: [0, 3, 5, 3, 2, 4, 5, 4] })
    expect(layersFor(CHILL).scale).toEqual([261.63, 293.66, 329.63, 392.0, 440.0, 523.25])
    expect(layersFor(CHILL).roots).toEqual([65.41, 65.41, 98.0, 87.31])
    expect(layersFor(HYPE).roots).toEqual([65.41, 65.41, 98.0, 87.31])
  })

  it('reads the bass interval off the bass layer, where the newer styles put it', () => {
    // It used to be read off the style, so every style silently fell back to 4 and the cinematic sub walked through
    // all four of its roots inside a single held chord.
    const onceABar = { bpm: 72, steps: 16, bass: { wave: 'sine', gain: 0.1, bassEvery: 16, roots: [55, 65, 73, 82] } }
    expect(layersFor(onceABar).every).toBe(16)
    expect(layersFor(onceABar).steps).toBe(16)
  })

  it('moves the original styles\' bass every four steps, as it always did', () => {
    for (const style of [CHILL, HYPE]) {
      const layers = layersFor(style)
      expect(layers.rootEvery).toBe(4)
      for (let i = 0; i < 32; i += 1) expect(rootIndexAt(layers, i)).toBe(Math.floor(i / 4) % 4)
    }
  })

  it('keeps the bass on the chord the pads are holding, step by step', () => {
    // The pads change chord once a bar. A bass that changed root faster than that visited all four chords inside a
    // single held one, so notes outside the chord landed on every downbeat.
    for (const name of ['disco', 'cinematic']) {
      const style = styleFor(name)
      const layers = layersFor(style)
      expect(style.bass.roots).toHaveLength(style.pads.roots.length)
      for (let i = 0; i < layers.steps * 8; i += 1) {
        expect(rootIndexAt(layers, i)).toBe(Math.floor(i / layers.steps) % style.pads.roots.length)
      }
    }
  })

  it('holds one root for a whole bar in the styles with a declared grid', () => {
    const afro = layersFor(styleFor('afro'))
    expect(afro.rootEvery).toBe(afro.steps)
    expect(rootIndexAt(afro, 0)).toBe(rootIndexAt(afro, afro.steps - 1))
    expect(rootIndexAt(afro, afro.steps)).not.toBe(rootIndexAt(afro, 0))
  })

  it('keeps every note at the length it was tuned to', () => {
    // durMul is a multiple of a step, and a step got twice as short when the grid became sixteenths. Afro and disco
    // kept the numbers written against the old eighth-note grid, which quietly halved them into 70ms blips. A floor
    // cannot catch that, because the wrong values are not absurd, they are half of what was intended, so the tuned
    // lengths are pinned here instead. Changing one is a deliberate retune and should fail this test.
    const TUNED = {
      chill: { lead: 0.571, bass: 1.214 },
      hype: { lead: 0.381, bass: 0.81 },
      afro: { lead: 0.245, bass: 0.404 },
      disco: { lead: 0.14, bass: 0.28 },
      cinematic: { lead: 0.542, bass: 2.917 },
    }
    for (const [name, want] of Object.entries(TUNED)) {
      const layers = layersFor(styleFor(name))
      expect(layers.stepDur * (layers.lead.durMul ?? 1.6), `${name} lead`).toBeCloseTo(want.lead, 2)
      expect(layers.stepDur * (layers.bass.durMul ?? 3.4), `${name} bass`).toBeCloseTo(want.bass, 2)
    }
  })

  it('plays a declared grid as sixteenths, so sixteen steps is one bar', () => {
    // The newer styles are written as sixteenths. On the old eighth-note grid they ran at half their stated tempo,
    // and a kick on 0, 4, 8, 12 landed on beats one and three instead of on every beat.
    const disco = { bpm: 118, steps: 16, lead: { wave: 'square', gain: 0.03, pattern: [] }, bass: { wave: 'sawtooth', gain: 0.06 } }
    expect(layersFor(disco).stepDur).toBe(60 / 118 / 4)
    // Sixteen sixteenths is four quarter beats, which is one bar of 4/4 at the tempo the style claims.
    expect(layersFor(disco).stepDur * 16).toBeCloseTo(4 * (60 / 118), 6)
  })

  it('has nothing to play for a style that is not there', () => {
    expect(layersFor(null)).toBeNull()
    expect(layersFor(undefined)).toBeNull()
    expect(layersFor('chill')).toBeNull()
  })

  it('resolves every style the studio offers', () => {
    for (const key of MUSIC_STYLES.filter((k) => k !== 'off')) {
      expect(layersFor(styleFor(key))).not.toBeNull()
    }
  })
})

// A fixed pseudo-random sequence, so a "random" crowd can be checked the same way every run.
function seeded(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rms = (samples, from, to) => {
  let sum = 0
  for (let i = from; i < to; i += 1) sum += samples[i] * samples[i]
  return Math.sqrt(sum / (to - from))
}

describe('the drum roll', () => {
  it('speeds up: every gap is shorter than the one before', () => {
    // The first version spaced its hits with (i / count) ** 1.7, which packs them together at the start and spreads
    // them out at the end, so the roll slowed down. Nothing could hear that, but this can.
    const times = rollTimes(28, 0.8)
    const gaps = times.slice(1).map((t, i) => t - times[i])
    for (let i = 1; i < gaps.length; i += 1) expect(gaps[i]).toBeLessThan(gaps[i - 1])
    expect(times[0]).toBe(0)
  })
  it('finishes before the boom it leads into, with the hits close together at the end', () => {
    const times = rollTimes(28, 0.8)
    expect(times.at(-1)).toBeLessThan(0.8)
    expect(times.at(-1) - times.at(-2)).toBeLessThan(0.012)
    expect(times[1] - times[0]).toBeGreaterThan(0.03)
  })
})

describe('the applause', () => {
  const RATE = 8000
  it('is a finite, in-range signal of the length asked for', () => {
    const crowd = applauseSamples(RATE, 2.6, seeded(1))
    expect(crowd.length).toBe(Math.floor(RATE * 2.6))
    for (const x of crowd) {
      expect(Number.isFinite(x)).toBe(true)
      expect(Math.abs(x)).toBeLessThanOrEqual(1)
    }
  })
  it('builds, holds and thins out, rather than sitting at one level like a hiss', () => {
    const crowd = applauseSamples(RATE, 2.6, seeded(2))
    const second = RATE
    const start = rms(crowd, 0, Math.floor(second * 0.1))
    const middle = rms(crowd, Math.floor(second * 0.9), Math.floor(second * 1.4))
    const end = rms(crowd, crowd.length - Math.floor(second * 0.1), crowd.length)
    expect(middle).toBeGreaterThan(start * 2)
    expect(middle).toBeGreaterThan(end * 2)
  })
  it('is different every time, so a long night of rounds never repeats the same cheer', () => {
    const a = applauseSamples(RATE, 1, seeded(3))
    const b = applauseSamples(RATE, 1, seeded(4))
    expect(a.some((x, i) => x !== b[i])).toBe(true)
  })
  it('is made of separate claps with gaps between them, not one steady level', () => {
    // A flat bed of noise has almost the same loudness in every 10 ms slice. A crowd of snaps does not.
    const crowd = applauseSamples(RATE, 2.6, seeded(5))
    const slice = Math.floor(RATE * 0.01)
    const levels = []
    for (let i = Math.floor(RATE * 0.9); i + slice < Math.floor(RATE * 1.6); i += slice) levels.push(rms(crowd, i, i + slice))
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length
    const spread = Math.sqrt(levels.reduce((a, b) => a + (b - mean) ** 2, 0) / levels.length) / mean
    expect(spread).toBeGreaterThan(0.1)
  })
})

describe('what the studio offers', () => {
  it('lists the music styles, silence first', () => {
    expect(MUSIC_STYLES).toEqual(['off', 'chill', 'hype', 'afro', 'disco', 'cinematic'])
  })
  it('can play every style the studio offers, so the two lists cannot drift apart', () => {
    // 'off' is silence and 'custom' is the admin's own clip, so neither has a generated loop behind it; both are
    // checked on their own below.
    for (const key of MUSIC_STYLES.filter((k) => k !== 'off' && k !== 'custom')) {
      expect(hasMusicStyle(key), key).toBe(true)
      expect(Object.hasOwn(THEME_MUSIC, key), key).toBe(true)
    }
    expect(hasMusicStyle('off')).toBe(false)
    expect(hasMusicStyle('nope')).toBe(false)
  })
  it('describes every loop it offers a note for', () => {
    for (const key of Object.keys(THEME_MUSIC).filter((k) => k !== 'off')) {
      expect(MUSIC_NOTES[key]).toBeTruthy()
    }
  })
  it('keeps the two original loops and takes the three newer ones', () => {
    expect(Object.keys(THEME_MUSIC)).toEqual(['off', 'chill', 'hype', 'afro', 'disco', 'cinematic', 'custom'])
  })
  it('offers the admin their own track as a style, but cannot generate one', () => {
    // 'custom' is the one style with no generated loop behind it: it is a clip from the library on one device, so
    // sanitizeTheme only keeps the choice when there is a clip id to go with it.
    expect(hasMusicStyle('custom')).toBe(false)
    expect(sanitizeTheme({ sound: { music: 'custom', custom: { music: 'abc12345' } } }).sound.music).toBe('custom')
    expect(sanitizeTheme({ sound: { music: 'custom' } }).sound.music).toBe('off')
  })
  it('accepts a saved theme using any of the styles, and falls back for anything else', () => {
    expect(sanitizeTheme({ sound: { music: 'afro' } }).sound).toMatchObject({ music: 'afro', effects: true })
    expect(sanitizeTheme({ sound: { music: 'cinematic', effects: false } }).sound).toMatchObject({ music: 'cinematic', effects: false })
    expect(sanitizeTheme({ sound: { music: 'dub' } }).sound).toMatchObject({ music: 'off', effects: true })
    expect(sanitizeTheme({}).sound).toMatchObject({ music: 'off', effects: true })
  })
  it('refuses a choice that only looks like one once used as an object key', () => {
    // ['chill'] becomes the string 'chill' as a key, so a plain hasOwn check let a hand-edited row through with an
    // array sitting in the theme, which then reached the projector.
    expect(sanitizeTheme({ sound: { music: ['chill'] } }).sound.music).toBe('off')
    expect(sanitizeTheme({ look: ['midnight'] }).look).toBe('classic')
    expect(sanitizeTheme({ pattern: ['stars'] }).pattern).toBe('math')
    expect(sanitizeTheme({ confetti: ['petals'] }).confetti).toBe('math')
    expect(sanitizeTheme({ look: { name: 'midnight' } }).look).toBe('classic')
    expect(sanitizeTheme({ look: 1 }).look).toBe('classic')
  })
  it('can play every effect the sound lab lists, so a new sound cannot be added unheard', () => {
    const listed = EFFECT_GROUPS.flatMap((g) => g.items.map(([name]) => name))
    expect(listed.length).toBeGreaterThan(0)
    for (const name of listed) expect(hasEffect(name)).toBe(true)
    expect(hasEffect('not-a-sound')).toBe(false)
  })
  it('lists each effect once, so the lab has no duplicate buttons', () => {
    const listed = EFFECT_GROUPS.flatMap((g) => g.items.map(([name]) => name))
    expect(new Set(listed).size).toBe(listed.length)
  })
  it('knows an effect for every name the lab lists, so nothing can be switched off by an unknown name', () => {
    // sanitizeTheme can only keep an effect in a quiz's off list if this list has it, so an effect added to the engine
    // without being added here could never be turned off.
    const listed = EFFECT_GROUPS.flatMap((g) => g.items.map(([name]) => name))
    for (const name of listed) expect(Object.hasOwn(THEME_EFFECTS, name), name).toBe(true)
    for (const name of Object.keys(THEME_EFFECTS)) expect(listed, name).toContain(name)
    expect(Object.keys(THEME_EFFECTS)).toHaveLength(listed.length)
  })
  it('describes every effect it knows, so the studio has a label for each switch', () => {
    for (const [name, label] of Object.entries(THEME_EFFECTS)) expect(label, name).toBeTruthy()
  })
  it('still offers the sounds the game has always played', () => {
    for (const name of ['tick', 'tickFast', 'timeUp', 'correct', 'wrong', 'lock', 'start', 'whoosh', 'fanfare']) {
      expect(hasEffect(name)).toBe(true)
    }
  })
})

describe('the level of an imported effect', () => {
  const clip = (peak) => ({ numberOfChannels: 1, getChannelData: () => Float32Array.of(0, peak * 0.4, -peak, peak * 0.1) })
  it('brings a quiet clip and a loud clip to the same peak', () => {
    expect(importedGain(clip(0.1)) * 0.1).toBeCloseTo(importedGain(clip(1)) * 1, 6)
  })
  it('turns a very quiet clip up, but only so far', () => {
    expect(importedGain(clip(0.1))).toBeGreaterThan(1)
    expect(importedGain(clip(0.001))).toBeLessThanOrEqual(4)
  })
  it('is no louder than the loudest built-in effect, so an import cannot bury the rest of the game', () => {
    expect(importedGain(clip(1)) * 1).toBeLessThanOrEqual(0.5)
  })
  it('leaves silence alone rather than dividing by nothing', () => {
    expect(importedGain({ numberOfChannels: 1, getChannelData: () => new Float32Array(8) })).toBe(1)
  })
})

describe('without audio support', () => {
  it('never throws and reports it is not supported', () => {
    expect(quizSound.isSupported()).toBe(false)
    expect(quizSound.unlock()).toBe(false)
    expect(() => {
      quizSound.play('correct')
      quizSound.play('drumroll')
      quizSound.play('not-a-sound')
      quizSound.startMusic('hype')
      quizSound.startMusic('disco')
      quizSound.previewMusic('afro')
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
