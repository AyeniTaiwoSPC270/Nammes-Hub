import { useLocation } from 'react-router-dom'
import { useHolidayTheme } from './HolidayThemeProvider'
import { isQuizPath } from './quizSurface'

/**
 * The live holiday theme when its page background should paint on this route, else null. The two
 * shells (Layout, AdminLayout) call this to decide whether to drop their own `bg-paper` — that is a
 * place in the page, and a shell that dropped it while the layer refused to render (a quiz route)
 * would leave a colourless page. Same rule as the decor overlay: public and admin, never the quiz
 * screens, and the toggle has to be actually on.
 */
export function useHolidayPageBackground() {
  const theme = useHolidayTheme()
  const { pathname } = useLocation()
  if (!theme?.background?.enabled) return null
  if (isQuizPath(pathname)) return null
  return theme
}
