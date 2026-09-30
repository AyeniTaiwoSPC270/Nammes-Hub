import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import StudioPreview, { PROJECTOR_SCREENS, PHONE_SCREENS } from './StudioPreview'
import CharacterGallery from './CharacterGallery'
import Character from '../../quiz/Character'
import { AVATAR_COUNT } from '../../../data/quizCharacters'
import { THEME_LOOKS, THEME_PATTERNS } from '../../../../api/_lib/quizTheme.js'

const theme = { look: 'royal', accent: '#123456', pattern: 'waves', confetti: 'stars', headline: 'Freshers Night', tagline: 'Phones out' }

describe('studio preview', () => {
  it('draws every projector and phone screen without crashing', () => {
    for (const screen of Object.keys(PROJECTOR_SCREENS)) {
      expect(renderToStaticMarkup(<StudioPreview theme={theme} surface="projector" screen={screen} title="Maths Quiz" />)).toContain('NAMMES Live Quiz')
    }
    for (const screen of Object.keys(PHONE_SCREENS)) {
      expect(renderToStaticMarkup(<StudioPreview theme={theme} surface="phone" screen={screen} title="Maths Quiz" />)).toContain('NAMMES Live Quiz')
    }
  })
  it('puts the headline and tagline on the lobby and the accent colour on the page', () => {
    const html = renderToStaticMarkup(<StudioPreview theme={theme} surface="projector" screen="lobby" title="Maths Quiz" />)
    expect(html).toContain('Freshers Night')
    expect(html).toContain('Phones out')
    expect(html).toContain('--color-orange-500:#123456')
  })
  it('escapes a hostile headline and ignores a hostile colour', () => {
    const html = renderToStaticMarkup(
      <StudioPreview theme={{ headline: '<img src=x onerror=alert(1)>', accent: 'red;background:url(x)' }} surface="phone" screen="lobby" title="" />,
    )
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('background:url(x)')
  })
  it('works for every look and backdrop', () => {
    for (const look of Object.keys(THEME_LOOKS)) for (const pattern of Object.keys(THEME_PATTERNS)) {
      expect(() => renderToStaticMarkup(<StudioPreview theme={{ look, pattern }} surface="projector" screen="question" title="" />)).not.toThrow()
    }
  })
})

describe('characters', () => {
  it('draws all 50 in every mood', () => {
    for (let id = 0; id < AVATAR_COUNT; id++) {
      for (const mood of ['idle', 'happy', 'dance', 'sad', 'wave']) {
        const html = renderToStaticMarkup(<Character id={id} mood={mood} />)
        expect(html).toContain(`qz-mood-${mood}`)
      }
    }
  })
  it('gives each character its own move classes', () => {
    const classes = new Set(
      Array.from({ length: AVATAR_COUNT }, (_, id) => renderToStaticMarkup(<Character id={id} />).match(/class="([^"]+)"/)[1]),
    )
    expect(classes.size).toBe(AVATAR_COUNT)
  })
  it('lists all 50 in the gallery', () => {
    const html = renderToStaticMarkup(<CharacterGallery />)
    expect(html.match(/aria-pressed/g).length).toBeGreaterThanOrEqual(AVATAR_COUNT)
    expect(html).toContain('Pixel')
    expect(html).toContain('Glow')
  })
})
