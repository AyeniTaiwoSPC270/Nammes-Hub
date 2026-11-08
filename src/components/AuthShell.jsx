import { Link } from 'react-router-dom'
import Button from './ui/Button'
import { useTheme } from '../lib/ThemeContext'

// The one frame every auth screen sits in: a forest panel on a wide screen, a short brand band on a
// phone, and the form on paper in both. The panel's copy is deliberately constant — the story of what
// the Hub is does not change between signing in and resetting a password, and a panel that rewrote
// itself per screen was four chances for the four pages to disagree again.

const POINTS = [
  { icon: 'library_books', label: 'Outlines and course materials by level' },
  { icon: 'calendar_month', label: 'Timetable, academic calendar and events' },
  { icon: 'quiz', label: 'Past questions, practice and live quizzes' },
]

// The crest and wordmark are the only way back to the site: the usual navbar is hidden on these
// routes, and a visible "back" link was a second thing competing with the form.
function Lockup({ compact = false }) {
  return (
    <Link
      to="/"
      aria-label="NAMMES Hub home"
      className="flex items-center gap-3 rounded-sm text-white no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
    >
      <span className={compact ? 'flex h-11 w-11 items-center justify-center rounded-[10px] bg-white' : 'flex h-14 w-14 items-center justify-center rounded-xl bg-white'}>
        <img
          src="/logo.png"
          alt="NAMMES crest"
          className={compact ? 'h-9 w-9 object-contain' : 'h-11 w-11 object-contain'}
        />
      </span>
      <span className={compact ? 'font-display text-base font-bold leading-tight' : 'font-display text-xl font-bold leading-tight'}>
        NAMMES Hub
        <em className="mt-1 block not-italic font-medium uppercase tracking-[.16em] text-white/50 text-[9px]">University of Lagos</em>
      </span>
    </Link>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-low hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className="material-symbols-outlined text-xl" aria-hidden="true">
        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  )
}

// The eyebrow, title and lede are the same three pieces on all four screens, so they live here
// rather than being retyped with a slightly different scale on each page.
export function AuthHeading({ eyebrow, title, description }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[.16em] text-brand-orange">{eyebrow}</p>
      <h1 className="mt-2.5 text-3xl font-extrabold leading-tight tracking-tight text-ink-900">{title}</h1>
      {description && <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{description}</p>}
    </div>
  )
}

// Primary action. In dark mode the button inverts to light-on-dark: a forest button on a near-black
// page has no edge, and this is the one element the auth shell restyles rather than just recolours.
export function AuthSubmit({ children, className = '', ...props }) {
  return (
    <Button
      variant="primary"
      className={`w-full justify-center dark:bg-ink-900 dark:text-green-900 ${className}`}
      {...props}
    >
      {children}
    </Button>
  )
}

export function AuthSecureNote() {
  return (
    <p className="mt-5 flex items-center justify-center gap-1.5 border-t border-hairline pt-4 text-xs text-ink-muted">
      <span className="material-symbols-outlined text-sm" aria-hidden="true">
        shield
      </span>
      Secure institution login
    </p>
  )
}

export default function AuthShell({ children }) {
  return (
    <div className="grid min-h-svh bg-paper lg:grid-cols-[44%_1fr]">
      <aside className="hidden flex-col bg-green-900 px-11 py-11 text-white lg:flex lg:border-0 dark:lg:border-r dark:lg:border-hairline">
        <Lockup />
        <div className="my-7 h-[3px] w-[42px] bg-orange-500" />
        <h2 className="max-w-[15ch] text-[32px] font-extrabold leading-[1.14] tracking-tight text-white">
          Everything for the semester, in one place.
        </h2>
        <p className="mt-3.5 max-w-[40ch] text-sm leading-relaxed text-white/70">
          Course outlines, the class timetable, past questions, quizzes and results — for Metallurgical and Materials
          Engineering students.
        </p>
        <ul className="mt-8 flex flex-col gap-4">
          {POINTS.map((point) => (
            <li key={point.icon} className="flex items-center gap-3 text-sm text-white/90">
              <span className="material-symbols-outlined text-[21px] text-orange-500" aria-hidden="true">
                {point.icon}
              </span>
              {point.label}
            </li>
          ))}
        </ul>
        <p className="mt-auto pt-9 text-[10px] uppercase tracking-[.24em] text-white/40">
          Excellence &middot; Strength &middot; Build &middot; Order
        </p>
      </aside>

      <div className="flex flex-col">
        <div className="bg-green-900 px-5 py-4 lg:hidden">
          <Lockup compact />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:px-8">
          <div className="w-full max-w-[420px]">
            <div className="mb-1 flex justify-end">
              <ThemeToggle />
            </div>
            <div className="rounded-lg border border-hairline bg-surface p-5 shadow-md lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
