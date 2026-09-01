import { useNavigate } from 'react-router-dom'
import { LEVELS } from '../data/resources'
import PageBanner from '../components/PageBanner'

const YEAR_LABELS = {
  100: 'Freshman Year',
  200: 'Sophomore Year',
  300: 'Junior Year',
  400: 'Senior Year',
  500: 'Final Year',
}

export default function Resources() {
  const navigate = useNavigate()

  return (
    <div>
      <PageBanner
        title="Resources"
        subtitle="Access lecture notes, past questions, and study materials curated for engineering excellence."
      />
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <div className="mb-6 border-b border-hairline pb-2">
          <h2 className="text-2xl font-bold text-ink-900">Select Your Level</h2>
        </div>
        <p className="max-w-2xl text-ink-muted mb-8">
          Navigate to course materials specific to your current academic standing.
        </p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          {LEVELS.map((level, i) => (
            <button
              key={level}
              type="button"
              onClick={() => navigate(`/resources/${level}`)}
              className={[
                'group relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-hairline bg-surface p-6 text-center shadow-md transition-colors hover:bg-surface-low',
                i === LEVELS.length - 1 && LEVELS.length % 2 !== 0 ? 'col-span-2 md:col-span-1' : '',
              ].join(' ')}
            >
              <div className="absolute top-0 right-0 h-16 w-16 rounded-bl-full bg-surface-low transition-colors duration-300 group-hover:bg-orange-100" />
              <span className="relative text-3xl font-bold text-ink-900">{level}</span>
              <span className="relative text-xs font-semibold uppercase tracking-[.05em] text-orange-500">
                {YEAR_LABELS[level]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
