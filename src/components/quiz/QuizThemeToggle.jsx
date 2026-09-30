import { useTheme } from '../../lib/ThemeContext'

// The quiz screens have no site header, so they carry their own light/dark switch.
export default function QuizThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed right-3 top-3 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-hairline bg-surface text-ink-900 shadow-md"
    >
      <span className="material-symbols-outlined" aria-hidden="true">{dark ? 'light_mode' : 'dark_mode'}</span>
    </button>
  )
}
