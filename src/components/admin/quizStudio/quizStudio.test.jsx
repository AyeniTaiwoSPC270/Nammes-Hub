import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import StudioPreview, { PROJECTOR_SCREENS, PHONE_SCREENS } from './StudioPreview'
import CharacterGallery from './CharacterGallery'
import Character from '../../quiz/Character'
import { AVATAR_COUNT } from '../../../data/quizCharacters'
import { THEME_LOOKS, THEME_PATTERNS } from '../../../../api/_lib/quizTheme.js'

const theme = { look: 'royal', accent: '#123456', pattern: 'waves', confetti: 'stars', headline: 'Freshers Night', tagline: 'Phones out' }

const STUDIO = 'src/pages/admin/AdminQuizStudio.jsx'

describe('the studio colour controls', () => {
  // A custom accent used to vanish the moment any colour scheme was clicked, which is what "custom colours do not work"
  // meant. The rule that prevents it lives in quizTheme.js and is unit-tested there, but a render test cannot fire a
  // click and the studio needs a router, a toast and a Supabase query to mount at all — so what is checked here is the
  // wiring itself, the way quizBackdrop.test.js checks the `isolate` ancestor jsdom would never complain about.
  const lines = () => readFileSync(STUDIO, 'utf8').split('\n')

  it('routes every colour-scheme button through withLook, which leaves the accent alone', () => {
    const row = lines()
    const map = row.findIndex((line) => line.includes('Object.entries(THEME_LOOKS).map'))
    expect(map, 'the colour scheme row should still be there').toBeGreaterThan(-1)
    const button = row.slice(map, map + 4).find((line) => line.includes('<Choice'))
    expect(button, 'a scheme button should still be there').toBeTruthy()
    expect(button).toContain('change(withLook(')
    // The old handler, spelled out, because a bare search for `accent: null` would also match the card's clear button.
    expect(readFileSync(STUDIO, 'utf8')).not.toMatch(/change\(\{\s*look:\s*key/)
  })

  it('clears a custom accent in exactly one place, and only when there is one to clear', () => {
    const source = readFileSync(STUDIO, 'utf8')
    const clears = source.split('withAccent(theme, null)').length - 1
    expect(clears, 'clearing the accent should have exactly one home').toBe(1)
    expect(source).toContain('theme.accent !== null &&')
  })

  it('gives the page colour the same treatment, so it can be set, cleared and shown as chosen', () => {
    const source = readFileSync(STUDIO, 'utf8')
    // Three writes: the swatch, the picker and the clear. Pinning only the clear would still pass if the swatch and the
    // picker went back to writing the field directly, which is the regression this whole row is about.
    expect(source.match(/change\(withPage\(/g), 'swatch, picker and clear should all go through withPage').toHaveLength(3)
    expect(source.split('withPage(theme, null)').length - 1, 'clearing the page should have exactly one home').toBe(1)
    expect(source).not.toMatch(/change\(\{[^}]*\bpage:/)
    expect(source).toContain('theme.page !== null &&')
    expect(source).toContain('aria-pressed={theme.page === hex}')
    // The colour input shows the page in effect, which is the site's own paper until one is chosen — it cannot show null.
    expect(source).toContain('const page = theme.page ?? PAGE_LIGHT.paper')
  })

  it('does not mark a swatch as chosen just because the scheme happens to use it', () => {
    // Every scheme's own accent is in ACCENT_SWATCHES, so keying the pressed state off the resolved colour showed one as
    // picked when the admin had only picked a scheme. The card tab already had this split right; the theme tab did not.
    // `aria-pressed` and the ring className are separate lines, so each is checked on its own.
    const source = readFileSync(STUDIO, 'utf8')
    expect(source).toContain('aria-pressed={theme.accent === hex}')
    expect(source).toContain('theme.accent === hex ?')
    expect(source).not.toMatch(/aria-pressed=\{accent === hex\}/)
  })
})

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

  it('re-skins the whole screen from a page colour, without any screen having to know about it', () => {
    // The whole mechanism: the preview frame already says bg-paper and text-ink-900, and the scope overrides those tokens.
    // If this fails, the page colour reaches nothing and every screen has to be edited by hand instead.
    const html = renderToStaticMarkup(<StudioPreview theme={{ page: '#0d1310' }} surface="projector" screen="lobby" title="" />)
    expect(html).toContain('--color-paper:#0d1310')
    expect(html).toContain('--color-ink-900:#f7f9f7')
    expect(html).toContain('bg-paper')
  })

  it('leaves the page alone when no page colour is set', () => {
    const html = renderToStaticMarkup(<StudioPreview theme={{ look: 'ocean' }} surface="projector" screen="lobby" title="" />)
    expect(html).not.toContain('--color-paper')
  })

  it('draws the lobby headline in white, not the default ink', () => {
    // index.css puts text-ink-900 on every h1/h2/h3. A rule that lands on the element beats one merely inherited from
    // the panel behind it, so the headline has to say white itself or it goes black on the dark panel. HostQuiz does.
    const html = renderToStaticMarkup(<StudioPreview theme={theme} surface="projector" screen="lobby" title="" />)
    const headline = html.slice(0, html.indexOf('Freshers Night')).match(/<h2[^>]*>$/)[0]
    expect(headline).toContain('text-white')
    expect(headline).not.toMatch(/text-ink-900|text-black/)
  })

  it('gives sponsor logos room to be read across a room', () => {
    const q = '11111111-1111-4111-8111-111111111111'
    const path = `${q}/33333333-3333-4333-8333-333333333333.webp`
    const html = renderToStaticMarkup(<StudioPreview theme={{ sponsors: [{ name: 'Acme', path }] }} surface="projector" screen="lobby" title="" />)
    const img = html.match(/<img[^>]*alt="Acme"[^>]*>/)[0]
    expect(img).toMatch(/max-h-20/) // 80px tall, about a sixth of the projector
  })
  it('shows sponsors on the lobby and the finish, and not when switched off', () => {
    const q = '11111111-1111-4111-8111-111111111111'
    const path = `${q}/33333333-3333-4333-8333-333333333333.webp`
    const branded = { sponsors: [{ name: 'Acme Ltd', path }], logo: path }
    const lobby = renderToStaticMarkup(<StudioPreview theme={branded} surface="projector" screen="lobby" title="" />)
    expect(lobby).toContain('Presented with')
    expect(lobby).toContain('alt="Acme Ltd"')
    expect(renderToStaticMarkup(<StudioPreview theme={branded} surface="projector" screen="podium" title="" />)).toContain('Acme Ltd')
    const off = renderToStaticMarkup(<StudioPreview theme={{ ...branded, showSponsors: { lobby: false, finish: false } }} surface="projector" screen="lobby" title="" />)
    expect(off).not.toContain('Presented with')
    expect(renderToStaticMarkup(<StudioPreview theme={branded} surface="phone" screen="lobby" title="" />)).not.toContain('Presented with')
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
  it('spreads a drawn pattern across the whole screen, not into one corner of it', () => {
    // Hexagons, rings and party used to be painted into an <svg> with no viewBox using percentage numbers as user units,
    // which put every mark inside roughly 350x350px at the top-left of the projector. Rendering it throws nothing, so the
    // only way to tell is to look at where the marks actually land.
    for (const pattern of ['hexagons', 'rings', 'party']) {
      const html = renderToStaticMarkup(<StudioPreview theme={{ pattern }} surface="projector" screen="question" title="" />)
      const marks = [...html.matchAll(/class="absolute"[^>]*style="left:([0-9.]+)%;top:([0-9.]+)%/g)].map((m) => [Number(m[1]), Number(m[2])])
      expect(marks.length, `${pattern} should draw more than one mark`).toBeGreaterThan(1)
      for (const [axis, limit] of [['left', 50], ['top', 45]]) {
        const reached = marks.some(([left, top]) => (axis === 'left' ? left : top) > limit)
        expect(reached, `${pattern} never gets past ${limit}% on the ${axis} axis — it is bunched in a corner`).toBe(true)
      }
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
  }, 30_000)
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
