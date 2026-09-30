import { createContext, useContext, useMemo } from 'react'
import { DEFAULT_THEME, sanitizeTheme, themeCssVars } from '../../../api/_lib/quizTheme.js'

// Hands a quiz's look (designed in the Quiz Design Studio) to everything inside it. The accent colour and backdrop
// colours are CSS variables on a wrapper that adds no box of its own, so the same screens work in a game, in the studio
// preview and with no theme at all (the default look).

const ThemeContext = createContext(sanitizeTheme(DEFAULT_THEME))

export function useQuizTheme() {
  return useContext(ThemeContext)
}

export function QuizThemeScope({ theme, className = 'contents', children }) {
  const key = JSON.stringify(theme ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const clean = useMemo(() => sanitizeTheme(theme), [key])
  const vars = useMemo(() => themeCssVars(clean), [clean])
  return (
    <ThemeContext.Provider value={clean}>
      <div className={className} style={vars}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
