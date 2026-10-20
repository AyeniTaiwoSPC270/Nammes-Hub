import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useTheme } from './ThemeContext'
import { useActiveHolidayThemeQuery } from '../data/holidays'
import { sanitizeHolidayTheme, holidayThemeVars } from '../../api/_lib/holidayTheme.js'
import HolidayDecor from '../components/site/HolidayDecor'

// The live holiday theme, for the whole app. Mounts INSIDE ThemeProvider because it re-reads the
// light/dark mode: the palette has a map for each, and an inline custom property on <html> beats both
// @theme and the `.dark` block, so the overlay has to be re-written whenever the reader toggles.
//
// Nothing here can break the site. The query answers null on failure or when the holidays flag is
// down, an empty var set means the site's own tokens paint, and removal restores exactly what was
// there before — a holiday is decoration and never a dependency.
const HolidayThemeContext = createContext(null)

export function HolidayThemeProvider({ children }) {
  const { theme } = useTheme()
  const { data } = useActiveHolidayThemeQuery()
  // Memoised: the effect below depends on identity, and sanitising per render would re-write every
  // custom property on each of them.
  const active = useMemo(() => (data ? sanitizeHolidayTheme(data) : null), [data])
  const applied = useRef([])

  useEffect(() => {
    const root = document.documentElement
    const vars = holidayThemeVars(active, theme)
    // Strip last time's keys first: a theme whose palette omits `brand` must leave the site's own
    // brand standing, not yesterday's festive red.
    for (const key of applied.current) root.style.removeProperty(key)
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)
    applied.current = Object.keys(vars)
    return () => {
      for (const key of applied.current) root.style.removeProperty(key)
      applied.current = []
    }
  }, [active, theme])

  return (
    <HolidayThemeContext.Provider value={active}>
      {children}
      <HolidayDecor />
    </HolidayThemeContext.Provider>
  )
}

/** The live holiday theme row (sanitised), or null when nothing is on. */
export function useHolidayTheme() {
  return useContext(HolidayThemeContext)
}
