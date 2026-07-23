import { useNavigate } from 'react-router-dom'
import { LEVELS } from '../data/outlines'

export default function Outlines() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        Course outlines
      </div>
      <h1 className="mt-1.5 text-[32px]">Choose your level</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Pick a level, then a semester, to see the course list and detailed outlines.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => navigate(`/outlines/${level}`)}
            className="flex flex-col items-center gap-1 rounded-lg bg-green-700 p-6 text-center transition-transform duration-150 ease-out hover:scale-[1.03] hover:bg-green-900"
          >
            <span className="font-display text-3xl text-white">{level}</span>
            <span className="font-mono text-xs uppercase tracking-[.04em] text-orange-400">Level</span>
          </button>
        ))}
      </div>
    </div>
  )
}
