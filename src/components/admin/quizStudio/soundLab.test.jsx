import { describe, it, expect } from 'vitest'
import { needsAnImportedFile } from './SoundLab'
import { THEME_MUSIC } from '../../../../api/_lib/quizTheme.js'

// The lab's Play button for a generated loop has to reach the engine on the click. An earlier version routed every style
// through the library lookup that only an imported track needs, so a built-in loop returned before it was ever asked for
// and the button did nothing at all. That rule is what this file pins down.
//
// The lab itself cannot be rendered here: it reads the engine through useSyncExternalStore, which needs a server
// snapshot to render on the server, and the app never renders on the server. The engine's own start path is driven with
// a fake AudioContext in quizSoundLive.test.js instead.

// Only the admin's own track has to be found in the library before it can play. Every other style is a loop the engine
// generates itself, so it starts from the click with nothing to wait for.
describe('which styles have to be found in the library before they can play', () => {
  it('only the admin’s own track does', () => {
    expect(needsAnImportedFile('custom')).toBe(true)
  })
  it('no generated loop does, which is the regression this test exists for', () => {
    for (const style of Object.keys(THEME_MUSIC).filter((s) => s !== 'custom')) {
      expect(needsAnImportedFile(style), `${style} should start straight away`).toBe(false)
    }
  })
  it('answers for every style the studio offers, so a new loop is never left waiting on a file', () => {
    for (const style of Object.keys(THEME_MUSIC)) expect(typeof needsAnImportedFile(style), style).toBe('boolean')
  })
})