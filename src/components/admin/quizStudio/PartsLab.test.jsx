import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import PartsLab from './PartsLab'
import { filterPartNames } from './partsLabUtils.js'
import { BODIES, TOPPERS, EYES, MOUTHS, ACCESSORIES, PROPS } from '../../../../api/_lib/quizCharacterArt.js'

const STUDIO = 'src/pages/admin/AdminQuizStudio.jsx'

describe('parts lab', () => {
  it('shows a tab for each drawer category with its current count', () => {
    const html = renderToStaticMarkup(<PartsLab />)
    const categories = [
      ['Body', BODIES], ['Headpiece', TOPPERS], ['Eyes', EYES], ['Mouth', MOUTHS], ['Wears', ACCESSORIES], ['Prop', PROPS],
    ]
    for (const [label, parts] of categories) expect(html).toContain(`${label} (${parts.length})`)
  })

  it('renders each option in the selected category', () => {
    const html = renderToStaticMarkup(<PartsLab />)
    expect(html).toContain('pot')
    expect(html).toContain('moon')
    expect(html).toContain('aria-label="body pot"')
  })

  it('filters names case-insensitively after trimming whitespace', () => {
    expect(filterPartNames(['moon', 'mohawk', 'pot'], ' MO ')).toEqual(['moon', 'mohawk'])
  })

  it('returns an empty list when no part matches', () => {
    expect(filterPartNames(['moon', 'pot'], 'missing')).toEqual([])
  })

  it('is wired as a read-only studio tab with the actual part count', () => {
    const source = readFileSync(STUDIO, 'utf8')
    expect(source).toContain("tab === 'parts'")
    expect(source).toContain('<PartsLab />')
    expect(source).toContain('Parts lab (')
    expect(source).toContain('BODIES.length + TOPPERS.length + EYES.length + MOUTHS.length + ACCESSORIES.length + PROPS.length')
    expect(source).toMatch(/tab !== 'characters' && tab !== 'card' && tab !== 'parts'/)
  })
})
