import { useTheme } from '../../lib/ThemeContext'

// Light/dark switch for the quiz screens, which have no site header.
export default function QuizThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-hairline bg-surface text-ink-900 shadow-sm"
    >
      <span className="material-symbols-outlined" aria-hidden="true">{dark ? 'light_mode' : 'dark_mode'}</span>
    </button>
  )
}
