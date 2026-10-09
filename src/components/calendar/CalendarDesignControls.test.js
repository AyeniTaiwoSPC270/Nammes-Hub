import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { KIND_ORDER, DEFAULT_THEME } from '../../../api/_lib/calendarTheme.js'

// `sanitizeTheme` will accept any lowercase word as a kind's icon, and a Material Symbols name the font was never
// asked to load renders as that word in text on the calendar — on the legend, on every spanning bar and on the day
// sheet. src/lib/iconFont.test.js cannot catch it here: it reads icon names out of the JSX, and this file offers its
// names through an array and a variable rather than as literals inside a span.
//
// So the same list index.html is checked against is read again, and the picker is held to it.

const source = readFileSync(new URL('./CalendarDesignControls.jsx', import.meta.url), 'utf8')

// The array as written, rather than an import: importing the module would need the JSX pipeline in the test, and the
// value under test is the literal in the file a human edits.
function iconChoices() {
  const block = source.match(/const KIND_ICON_CHOICES = \[([\s\S]*?)\]/)?.[1]
  expect(block, 'KIND_ICON_CHOICES must still be a plain array literal in this file').toBeTypeOf('string')
  return [...block.matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
}

function loadedIcons() {
  const html = readFileSync('index.html', 'utf8')
  return new Set((html.match(/icon_names=([a-z_,]+)&/)?.[1] ?? '').split(','))
}

describe('the calendar icon picker', () => {
  it('offers icons', () => {
    expect(iconChoices().length).toBeGreaterThan(0)
  })

  it('only offers icons the font has loaded', () => {
    const loaded = loadedIcons()
    expect(iconChoices().filter((name) => !loaded.has(name))).toEqual([])
  })

  it('offers no icon twice', () => {
    const choices = iconChoices()
    expect(choices).toEqual([...new Set(choices)])
  })

  // A seeded default that the picker cannot show would still paint -- ToggleIcon renders whatever it is handed --
  // but the admin could never pick it back, so it would be a one-way door.
  it('offers every icon a fresh theme is seeded with', () => {
    const choices = new Set(iconChoices())
    const seeded = KIND_ORDER.map((kind) => DEFAULT_THEME.accents[kind].icon)
    expect(seeded.filter((icon) => !choices.has(icon))).toEqual([])
  })
})