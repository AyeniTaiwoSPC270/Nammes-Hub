import { useNavigate } from 'react-router-dom'
import { LEVELS } from '../data/outlines'
import PageBanner from '../components/PageBanner'

export default function Outlines() {
  const navigate = useNavigate()

  return (
    <div>
      <PageBanner
        title="Course Outlines"
        subtitle="Access detailed curriculum structures and requirements."
      />
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <h2 className="text-xl font-bold text-green-900 mb-4">Select Level</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => navigate(`/outlines/${level}`)}
              className="rounded-md border border-hairline bg-surface px-4 py-3 text-center text-sm font-semibold text-ink-900 transition-colors hover:bg-surface-low"
            >
              {level} Level
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
