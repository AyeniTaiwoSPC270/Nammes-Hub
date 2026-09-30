import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// The icon font is loaded as a fixed list of icon names (index.html), to keep it small. An icon used in a page
// but missing from that list shows up as plain text (for example the word "BOLT"), so this test catches it.

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path) : path.endsWith('.jsx') ? [path] : []
  })
}

function loadedIcons() {
  const html = readFileSync('index.html', 'utf8')
  const list = html.match(/icon_names=([a-z_,]+)&/)?.[1] ?? ''
  return new Set(list.split(','))
}

function usedIcons() {
  const used = new Map()
  for (const file of listFiles('src')) {
    const source = readFileSync(file, 'utf8')
    const names = []
    for (const span of source.matchAll(/material-symbols-outlined[^>]*>([^<]*(?:<(?!\/span)[^<]*)*)<\/span>/g)) {
      const inner = span[1].trim()
      if (/^[a-z_]+$/.test(inner)) names.push(inner)
      // quoted names in a ternary such as theme === 'dark' ? 'light_mode' : 'dark_mode' (comparisons are skipped)
      for (const quoted of inner.matchAll(/(?<![=!]==?\s*)'([a-z_]+)'/g)) names.push(quoted[1])
    }
    for (const prop of source.matchAll(/\bicon[=:]\s*["']([a-z_]+)["']/g)) names.push(prop[1])
    for (const name of names) used.set(name, [...(used.get(name) ?? []), file])
  }
  return used
}

describe('icon font', () => {
  it('loads every icon the pages use', () => {
    const loaded = loadedIcons()
    const missing = [...usedIcons()].filter(([name]) => !loaded.has(name)).map(([name, files]) => `${name} (${[...new Set(files)].join(', ')})`)
    expect(missing).toEqual([])
  })
  it('keeps the list in alphabetical order, which the font URL requires', () => {
    const list = [...loadedIcons()]
    expect(list).toEqual([...list].sort())
  })
})
