import { describe, it, expect, beforeAll } from 'vitest'

// The engine only touches the Web Audio API once a real AudioContext exists, and until it does every call quietly does
// nothing, so a test run in an environment with no audio support passes whether the music path works or not. This file
// stands up a fake context and drives the real start/stop path, which is what catches a loop that is offered on screen
// but never actually plays.

// The smallest AudioContext the scheduler will accept: anything that does not exist is built on demand, and a bus that
// remembers what was set on it is enough to see whether music was asked for and at what level.
function fakeContext() {
  const made = { oscillators: 0, buffers: 0, media: 0 }
  const param = (value = 0) => ({
    value,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
    linearRampToValueAtTime() {},
  })
  const node = () => ({
    gain: param(1),
    connect: (target) => target,
    disconnect() {},
    start() {},
    stop() {},
    frequency: param(440),
    detune: param(0),
    Q: param(1),
    type: 'sine',
    buffer: null,
    loop: false,
    onended: null,
  })
  return {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: node(),
    resume: () => Promise.resolve(),
    createGain: () => node(),
    createOscillator: () => { made.oscillators += 1; return node() },
    createBufferSource: () => { made.buffers += 1; return node() },
    createBiquadFilter: () => node(),
    createMediaElementSource: () => { made.media += 1; return node() },
    createBuffer: (channels, frames) => ({
      numberOfChannels: channels,
      duration: frames / 44100,
      getChannelData: () => new Float32Array(frames),
    }),
    decodeAudioData: () => Promise.reject(new Error('no clip in this test')),
    made,
  }
}

let ctx
let quizSound
let MUSIC_STYLES
let hasMusicStyle

beforeAll(async () => {
  ctx = fakeContext()
  globalThis.window = globalThis.window ?? {}
  globalThis.window.AudioContext = function FakeAudioContext() { return ctx }
  // The engine is imported after the fake is in place, because it captures the context the first time one is needed.
  const module = await import('./quizSound')
  quizSound = module.quizSound
  MUSIC_STYLES = module.MUSIC_STYLES
  hasMusicStyle = module.hasMusicStyle
})

const LOOPED = () => MUSIC_STYLES.filter((s) => hasMusicStyle(s))

describe('starting a loop for real', () => {
  it('reports itself supported once the browser offers an AudioContext', () => {
    expect(quizSound.isSupported()).toBe(true)
    expect(quizSound.unlock()).toBe(true)
  })
  it('actually starts every generated loop the studio offers', () => {
    // This is the regression this file exists for. The lab used to hand every style through a lookup that only an
    // imported track needs, so the promise it waited on never settled and no built-in loop ever made a sound.
    for (const style of LOOPED()) {
      quizSound.stopMusic()
      const before = ctx.made.oscillators
      quizSound.startMusic(style)
      expect(quizSound.isMusicPlaying(), `${style} should be playing`).toBe(true)
      expect(ctx.made.oscillators, `${style} should have scheduled notes`).toBeGreaterThan(before)
    }
  })
  it('auditions a loop the same way the sound lab does', () => {
    for (const style of LOOPED()) {
      quizSound.previewMusic(style)
      expect(quizSound.isMusicPlaying(), `${style} should be playing`).toBe(true)
    }
  })
  it('stays on the same run when asked again just to duck it', () => {
    quizSound.previewMusic('chill')
    const before = ctx.made.oscillators
    quizSound.startMusic('chill', { quiet: true })
    expect(quizSound.isMusicPlaying()).toBe(true)
    expect(ctx.made.oscillators).toBe(before)
  })
  it('stops, and says so', () => {
    quizSound.previewMusic('hype')
    expect(quizSound.isMusicPlaying()).toBe(true)
    quizSound.stopMusic()
    expect(quizSound.isMusicPlaying()).toBe(false)
  })
})

describe('playing a sound effect for real', () => {
  it('schedules the notes of an effect the quiz wants', () => {
    quizSound.setSoundConfig({ effects: true, off: [] })
    const before = ctx.made.oscillators
    quizSound.play('correct')
    expect(ctx.made.oscillators).toBeGreaterThan(before)
  })
  it('schedules nothing for an effect the quiz switched off', () => {
    quizSound.setSoundConfig({ effects: true, off: ['correct'] })
    const before = ctx.made.oscillators
    quizSound.play('correct')
    expect(ctx.made.oscillators).toBe(before)
    const afterWrong = ctx.made.oscillators
    quizSound.play('wrong')
    expect(ctx.made.oscillators).toBeGreaterThan(afterWrong)
    quizSound.setSoundConfig({ effects: true, off: [] })
  })
  it('auditions a switched-off effect anyway, which is the whole point of the lab button', () => {
    quizSound.setSoundConfig({ effects: true, off: ['tick'] })
    const before = ctx.made.oscillators
    quizSound.play('tick')
    expect(ctx.made.oscillators).toBe(before)
    quizSound.previewEffect('tick')
    expect(ctx.made.oscillators).toBeGreaterThan(before)
    quizSound.setSoundConfig({ effects: true, off: [] })
  })
  it('plays nothing for a name that is not an effect', () => {
    const before = ctx.made.oscillators
    quizSound.play('not-a-sound')
    expect(ctx.made.oscillators).toBe(before)
  })
})

describe('an imported track with no file behind it', () => {
  it('starts nothing rather than throwing at the host', () => {
    quizSound.stopMusic()
    expect(() => quizSound.startMusic('custom')).not.toThrow()
    expect(quizSound.isMusicPlaying()).toBe(false)
  })
})