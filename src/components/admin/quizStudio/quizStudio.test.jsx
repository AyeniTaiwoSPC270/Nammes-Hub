import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import StudioPreview, { PROJECTOR_SCREENS, PHONE_SCREENS } from './StudioPreview'
import SchemeColours from './SchemeColours'
import CharacterGallery from './CharacterGallery'
import Character from '../../quiz/Character'
import { CharacterCastContext } from '../../quiz/characterCastContext.js'
import { BackdropPropLayer } from './BackdropPropEditor'
import { BUILTIN_COUNT } from '../../../../api/_lib/quizCharacterArt.js'
import { THEME_LOOKS, THEME_PATTERNS, THEME_BACKDROP_MOTION, MOTION_PICTURE_ONLY, hasMarks, resolveMotion } from '../../../../api/_lib/quizTheme.js'

const theme = { look: 'royal', accent: '#123456', pattern: 'waves', confetti: 'stars', headline: 'Freshers Night', tagline: 'Phones out' }

const STUDIO = 'src/pages/admin/AdminQuizStudio.jsx'
const SCHEME_COLOURS = 'src/components/admin/quizStudio/SchemeColours.jsx'

// Source checks read the file with its line comments taken out. Several of the rules below are explained in the comment
// that sits beside the code they govern, and a grep that matched prose would fail on its own explanation.
const code = (path) => readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, '')

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

describe('the scheme colour rows', () => {
  // These render, unlike the rest of this file. The rows take a plain theme and a plain callback, so there is no router,
  // toast or query to mount around them, and rendering is the only way to prove which colour each input actually shows.
  const row = (theme) => renderToStaticMarkup(<SchemeColours theme={theme} onChange={() => {}} />)

  it('shows the colour in effect in every picker, because a colour input cannot show nothing', () => {
    const html = row({ look: 'ocean' })
    expect(html).toContain('value="#0891b2"') // ocean glow[0]
    expect(html).toContain('value="#2563eb"') // ocean glow[1]
    expect(html).toContain('value="#083344"') // ocean deep[0]
    expect(html).toContain('value="#164e63"') // ocean deep[1]
  })

  it('follows the accent on the glow until the admin says otherwise, which is what it has always done', () => {
    // ocean's accent (#0e7490) and its glow[0] (#0891b2) are different colours, so a row that showed the accent where
    // the scheme's tint belongs is visibly wrong here rather than only on a look where the two happen to match.
    const custom = row({ look: 'ocean', accent: '#00ff00' })
    expect(custom).toContain('value="#00ff00"')
    expect(custom).not.toContain('value="#0891b2"')
    expect(row({ look: 'ocean', accent: '#00ff00', glowA: '#ff0000' })).toContain('value="#ff0000"')
  })

  it('warns about a banner white text cannot be read on, and says nothing about the glow', () => {
    // text-white is hardcoded on every qz-deep panel, so a pale banner is legible enough to be allowed and not legible
    // enough to be safe. The glow is two radial gradients at 14% alpha behind text and cannot cause that.
    expect(row({ look: 'ocean', deepA: '#f6f3f2', deepB: '#ffffff' })).toContain('role="status"')
    expect(row({ look: 'ocean', glowA: '#f6f3f2', glowB: '#ffffff' })).not.toContain('role="status"')
    expect(row({ look: 'ocean' }), 'no built-in scheme may trip the warning').not.toContain('role="status"')
  })

  it('offers no clear button until there is something of the admin’s own to clear', () => {
    const customised = row({ look: 'ocean', deepB: '#083344' })
    expect(customised).toContain('Use the scheme’s banner')
    expect(customised).not.toContain('Use the scheme’s glow')
    expect(row({ look: 'ocean' })).not.toContain('Use the scheme’s banner')
  })

  it('marks a swatch chosen only when the admin chose it, not when the scheme happens to use it', () => {
    // Every scheme's own colours are in every strip, so keying the pressed state off the resolved colour would show one
    // as picked when the admin had only picked a scheme. This is the defect the Accent row already had.
    expect(row({ look: 'ocean' })).not.toContain('aria-pressed="true"')
    expect(row({ look: 'ocean', deepA: '#083344' })).toContain('aria-pressed="true"')
  })

  it('clears a pair in exactly one place, and takes both ends with it', () => {
    // Clearing one end of a gradient is not a state the studio offers, so the clear has to name both keys and there has
    // to be exactly one of it — the same rule the Accent and Page rows are held to.
    const source = code(SCHEME_COLOURS)
    const clears = source.split('onChange({ [aKey]: null, [bKey]: null })').length - 1
    expect(clears, 'clearing a pair should have exactly one home').toBe(1)
    expect(source).not.toMatch(/onChange\(\{ \[(aKey|bKey)\]: null \}\)/)
  })

  it('never puts the two ends of a gradient side by side, which is what broke the row', () => {
    // The studio's control column is 420px with p-5 on it, so 380px of content. One strip is a 16px tag, nine 32px items
    // and eight 6px gaps: 352px. Two side by side is 704px and does not fit, and `flex-1` does not solve that — it
    // squeezes instead of wrapping, so the swatches fell into vertical columns and the two colour inputs overlapped.
    //
    // jsdom applies no stylesheet, so nothing here can measure a pixel. This pins the shape that caused it rather than
    // the result: a row that grows instead of shrinking is what has to come back if this ever breaks again.
    const source = code(SCHEME_COLOURS)
    expect(source, 'a squeezed strip is the bug this guards').not.toMatch(/flex-1/)
    expect(source, 'the ends are stacked').toMatch(/flex flex-col gap-2/)
  })

  it('takes every colour it displays from themeCssVars rather than deriving it again', () => {
    // The precedence chain is easy to get wrong and is unit-tested exactly once, in quizTheme.js. A second copy in a
    // component would be a second place to get it wrong with nothing noticing. The swatch strips may read THEME_LOOKS —
    // they are the preset list by definition — but no input may, and nothing may index it by the current look.
    const source = readFileSync(SCHEME_COLOURS, 'utf8')
    expect(source).toContain('themeCssVars(theme)')
    expect(source, 'no input may read the preset directly').not.toMatch(/value=\{look\./)
    expect(source, 'nothing may look the current scheme up itself').not.toMatch(/THEME_LOOKS\[/)
  })
})

describe('the studio wiring', () => {
  it('writes the four scheme colours only through withSchemeColors', () => {
    const source = readFileSync(STUDIO, 'utf8')
    expect(source, 'the rows should hand their patch to the helper').toContain('withSchemeColors(theme,')
    // Reaching past the helper would be a second way to write a colour, which is how the accent regressed in the first place.
    expect(source).not.toMatch(/change\(\{[^}]*\b(glowA|glowB|deepA|deepB)\s*:/)
  })

  it('shows the card background input the banner the card would actually use', () => {
    const source = readFileSync(STUDIO, 'utf8')
    expect(source).toContain("value={card.backgroundColor ?? vars['--qz-deep-a']}")
    expect(source, 'the old fallback showed a colour the card was not using').not.toContain('value={card.backgroundColor ?? look.deep[0]}')
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
  it('draws saved prop positions and colours, and leaves hidden props out of the backdrop', () => {
    const html = renderToStaticMarkup(
      <StudioPreview
        theme={{
          pattern: 'math',
          backdropScale: 100,
          backdropLayout: {
            math: [
              { k: 'pi', x: 80, y: 60, s: 50, r: 45, c: '#123456' },
              { k: 'sum', x: 20, y: 30, s: 40, r: 0, h: true },
            ],
          },
        }}
        surface="projector"
        screen="question"
        title=""
      />,
    )
    expect(html).toContain('left:80%;top:60%;font-size:50px;color:#123456;transform:rotate(45deg)')
    expect(html).not.toContain('left:20%;top:30%;font-size:40px')
    expect(html).toContain('aria-hidden="true"')
  })
  it('places hit boxes over props in the same percentage coordinates and scaled size', () => {
    const overlay = renderToStaticMarkup(
      <BackdropPropLayer
        pattern="math"
        props={[{ k: 'pi', x: 25, y: 40, s: 40, r: 0 }]}
        scale={1.5}
        inset={10}
        selectedIndex={0}
        onSelect={() => {}}
        onChangeProps={() => {}}
        onDelete={() => {}}
        onToggleHidden={() => {}}
        onDeselect={() => {}}
      />,
    )
    expect(overlay).toContain('aria-label="π at 25, 40"')
    expect(overlay).toContain('inset:-10px')
    expect(overlay).toContain('left:25%;top:40%;width:72px;height:72px')
    expect(overlay).toContain('aria-pressed="true"')
  })
  describe('backdrop motion', () => {
    // Rendering without throwing proves nothing here: a mistyped class name, or a style that quietly resolved to Still,
    // is a perfectly valid still backdrop. So these assert the class actually reaches the markup, which is the
    // difference between "the projector moves" and "nothing failed".
    const draw = (theme, surface = 'projector') =>
      renderToStaticMarkup(<StudioPreview theme={theme} surface={surface} screen="question" title="" />)
    const q = '11111111-1111-4111-8111-111111111111'
    const pic = `${q}/33333333-3333-4333-8333-333333333333.webp`

    it('puts the chosen loop on the markup, on every pattern it claims to work on', () => {
      for (const motion of Object.keys(THEME_BACKDROP_MOTION)) {
        for (const pattern of Object.keys(THEME_PATTERNS)) {
          const drawn = resolveMotion(motion, pattern)
          // 'My image' needs the picture behind it or the sanitiser settles it to Plain before anything is drawn.
          const html = draw({ pattern, backdropMotion: motion, image: pattern === 'image' ? pic : null })
          if (drawn === 'off') {
            expect(html, `${motion} on ${pattern} should draw nothing`).not.toMatch(/qz-bd-/)
          } else {
            expect(html, `${motion} on ${pattern} draws as ${drawn} but no class reached the markup`).toContain(`qz-bd-${drawn}`)
            expect(html, `${motion} on ${pattern} has no duration`).toContain('animation-duration')
          }
        }
      }
    })
    it('keeps every mark its own rotation when the marks are moving', () => {
      // Float, Cascade and Twinkle animate the `translate` property precisely so they cannot clobber the inline
      // transform each mark already carries. An animation writing `transform` instead would leave the page perfectly
      // valid and every mark sitting upright.
      const html = draw({ pattern: 'hexagons', backdropMotion: 'float' })
      expect(html).toContain('qz-bd-float')
      expect(html).toMatch(/rotate\(-?\d/)
      expect(html, 'marks must start spread through the loop, not all at once').toMatch(/animation-delay:-[\d.]+s/)
    })
    it('leaves the phones still when the phone toggle is off, without touching the projector', () => {
      // The whole point of the toggle: the projector can move for the room while fifty handsets stay still.
      const moving = { pattern: 'math', backdropMotion: 'drift' }
      expect(draw(moving, 'phone'), 'phones move when the toggle is on').toContain('qz-bd-drift')
      expect(draw({ ...moving, backdropMotionOnPhones: false }, 'phone'), 'phones stay still').not.toContain('qz-bd-')
      expect(draw({ ...moving, backdropMotionOnPhones: false }, 'projector'), 'the projector is not a phone').toContain('qz-bd-drift')
    })
    it('does not animate an image pattern on phones where neither the picture nor a replacement pattern is drawn', () => {
      const html = draw({ pattern: 'image', image: pic, backdropMotion: 'drift' }, 'phone')
      expect(html).not.toContain('qz-bd-')
    })
    it('keeps the chosen static image zoom when Pan is disabled by reduced motion', () => {
      // The media query disables the Pan keyframes. The inline Size transform must remain as the still frame, otherwise
      // choosing Pan removes the existing Zoom control for anyone with reduced motion enabled.
      const html = draw({ pattern: 'image', image: pic, backdropMotion: 'pan' })
      const image = html.match(/<img[^>]*qz-bd-pan[^>]*>/)?.[0]
      expect(image).toBeTruthy()
      expect(image).toContain('transform:scale(1)')
    })
    it('keeps Pan zoomed in throughout its cycle so it cannot reveal the image edge', () => {
      const css = readFileSync('src/index.css', 'utf8')
      const keyframes = css.match(/@keyframes qz-bd-pan\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
      const scales = [...keyframes.matchAll(/scale\(calc\(var\(--qz-bd-zoom, 1\) ([*/]) ([\d.]+)\)\)/g)]
      expect(scales.length, 'both ends of the cycle keep a safety zoom').toBeGreaterThanOrEqual(2)
      expect(scales.every((match) => match[1] === '*' && Number(match[2]) >= 1)).toBe(true)
    })
    it('grows translating layers on all sides and keeps Bounce from shrinking below the viewport', () => {
      for (const motion of ['drift', 'orbit']) {
        const html = draw({ pattern: 'dots', backdropMotion: motion })
        expect(html, `${motion} needs top and bottom bleed too`).toContain('inset:calc(-0px - 15%)')
      }
      const css = readFileSync('src/index.css', 'utf8')
      const keyframes = css.match(/@keyframes qz-bd-bounce\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
      const scales = [...keyframes.matchAll(/scale\(([\d.]+)\)/g)].map((match) => Number(match[1]))
      expect(scales.length).toBeGreaterThan(0)
      expect(Math.min(...scales), 'Bounce should spring outward, never expose the backdrop edge').toBeGreaterThanOrEqual(1)
    })
    it('moves Cascade by the viewport height rather than one mark height', () => {
      const css = readFileSync('src/index.css', 'utf8')
      const keyframes = css.match(/@keyframes qz-bd-cascade\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
      expect(keyframes).toContain('118vh')
      expect(keyframes).not.toContain('118%')
    })
    it('uses a native disabled state for motion styles that are unavailable', () => {
      // Muted styling alone leaves Pan reachable and selectable by keyboard, even when saving cleans the choice back to
      // Still. Assert the control's semantic wiring, not just its colour.
      const studio = code(STUDIO)
      expect(studio).toMatch(/function Choice\(\{[^}]*disabled/)
      expect(studio).toContain('disabled={disabled}')
      expect(studio).toMatch(/<Choice[\s\S]*?disabled=\{!usable\}/)
    })
    it('draws a still backdrop exactly as it did before motion existed', () => {
      // 'off' has to leave no trace, or every existing quiz would change appearance the day this shipped.
      const plain = draw({ pattern: 'hexagons' })
      const still = draw({ pattern: 'hexagons', backdropMotion: 'off' })
      expect(still).toBe(plain)
      expect(still).not.toContain('qz-bd-')
    })
    it('never asks a pattern without marks to move marks it does not have', () => {
      for (const pattern of Object.keys(THEME_PATTERNS)) {
        for (const motion of ['float', 'cascade', 'twinkle']) {
          const drawn = resolveMotion(motion, pattern)
          if (hasMarks(pattern) && pattern !== 'none') expect(drawn, `${motion} on ${pattern}`).toBe(motion)
          else expect(MOTION_PICTURE_ONLY, `${motion} on ${pattern} fell back to a picture-only loop`).not.toContain(drawn)
        }
      }
    })
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
    for (let id = 0; id < BUILTIN_COUNT; id++) {
      for (const mood of ['idle', 'happy', 'dance', 'sad', 'wave']) {
        const html = renderToStaticMarkup(<Character id={id} mood={mood} />)
        expect(html).toContain(`qz-mood-${mood}`)
      }
    }
  }, 30_000)
  it('draws an authored spec when the parts lab supplies one', () => {
    const spec = {
      name: 'Moon test', body: 'moon', topper: 'none', eyes: 'round', mouth: 'smile', accessory: 'none', prop: 'none',
      color: { main: '#123456', dark: '#07111b', light: '#aabbcc' }, idle: 'bob', win: 'jump', sad: 'droop', hello: 'wave',
    }
    const html = renderToStaticMarkup(<Character spec={spec} title="Moon test" />)
    expect(html).toContain('d="M64 14a36 36 0 1 0 0 72 29 29 0 0 1 0-72z"')
    expect(html).toContain('fill="#123456"')
    expect(html).toContain('aria-label="Moon test"')
  })
  it('resolves an id through the active session cast context on the phone and projector', () => {
    const cast = { mode: 'all', characters: [{ slot: 0, name: 'Kola', spec: { body: 'pot', color: '#ff5a1f' }, moves: {}, color: { main: '#ff5a1f', dark: '#8e1c00', light: '#ffe9e0' } }] }
    const html = renderToStaticMarkup(<CharacterCastContext.Provider value={cast}><Character id={50} /></CharacterCastContext.Provider>)
    expect(html).toContain('d="M50 18c-13 0-20 10-22 26-2 18 4 38 22 38s24-20 22-38c-2-16-9-26-22-26z"')
    expect(html).toContain('fill="#ff5a1f"')
  })
  it('gives each character its own move classes', () => {
    const classes = new Set(
      Array.from({ length: BUILTIN_COUNT }, (_, id) => renderToStaticMarkup(<Character id={id} />).match(/class="([^"]+)"/)[1]),
    )
    expect(classes.size).toBe(BUILTIN_COUNT)
  })
  it('lists all 50 in the gallery', () => {
    const html = renderToStaticMarkup(<CharacterGallery />)
    expect(html.match(/aria-pressed/g).length).toBeGreaterThanOrEqual(BUILTIN_COUNT)
    expect(html).toContain('Pixel')
    expect(html).toContain('Glow')
  })
  it('keeps the built-in gallery and adds the quiz cast editor above it', () => {
    const source = readFileSync(STUDIO, 'utf8')
    expect(source).toContain('<CharacterEditor quizId={id} />')
    expect(source.indexOf('<CharacterEditor quizId={id} />')).toBeLessThan(source.indexOf('<CharacterGallery />'))
  })
})
