import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { LEVELS } from '../data/outlines'
import { LEVEL_ICONS } from '../lib/illustrations'

export default function Outlines() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        eyebrow="Course outlines"
        title="Choose your level"
        subtitle="Pick a level, then a semester, to see the course list and detailed outlines."
      />
      <div className="mx-auto max-w-[880px] px-5 pt-10 pb-12 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => navigate(`/outlines/${level}`)}
              className="flex flex-col items-center gap-1 rounded-lg bg-green-700 p-6 text-center transition-transform duration-150 ease-out hover:scale-[1.03] hover:bg-green-900"
            >
              {LEVEL_ICONS[level] && (
                <img src={LEVEL_ICONS[level]} alt="" aria-hidden="true" className="mb-1 h-12 w-12" />
              )}
              <span className="font-display text-3xl text-white">{level}</span>
              <span className="font-mono text-xs uppercase tracking-[.04em] text-orange-400">Level</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
