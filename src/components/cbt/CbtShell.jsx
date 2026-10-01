import { Link } from 'react-router-dom'
import { BrandMark } from '../quiz/QuizParts'
import QuizThemeToggle from '../quiz/QuizThemeToggle'

// The plain frame for every CBT page: a slim header and a calm page. No game styling.
// `wide` is for the exam screen (question plus navigator side by side).
export default function CbtShell({ title, right, wide = false, children }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-paper text-ink-900">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-hairline bg-paper/95 px-4 py-3 backdrop-blur sm:px-8">
        <Link to="/cbt" className="flex min-w-0 items-center gap-3 no-underline">
          <BrandMark />
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-bold uppercase tracking-[0.12em] text-ink-900">NAMMES CBT practice</span>
            {title && <span className="block truncate text-xs text-ink-muted">{title}</span>}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {right}
          <QuizThemeToggle />
        </div>
      </header>
      <main className={`mx-auto flex w-full flex-1 flex-col gap-5 px-4 py-6 sm:px-6 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</main>
    </div>
  )
}
