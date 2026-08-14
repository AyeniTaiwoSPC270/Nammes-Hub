import { useParams, Navigate, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useOutlinesQuery, getCourse } from '../../data/outlines'

export default function OutlineDetail() {
  const { level, semester, code } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useOutlinesQuery()

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/outlines" replace />

  if (isError) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this outline right now." onRetry={refetch} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <SkeletonText lines={1} className="w-40" />
        <div className="mt-4">
          <SkeletonText lines={5} />
        </div>
      </div>
    )
  }

  const course = getCourse(data ?? [], level, semester, code)
  if (!course) return <Navigate to={`/outlines/${level}/${semester}`} replace />

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Outlines', to: '/outlines' },
          { label: `${level} Level`, to: `/outlines/${level}` },
          { label: SEMESTER_LABELS[semester], to: `/outlines/${level}/${semester}` },
          { label: course.code },
        ]}
      />

      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        {course.code} &middot; {course.units} unit{course.units === 1 ? '' : 's'}
      </div>
      <h1 className="mt-1.5 text-[32px]">{course.title}</h1>
      <div className="mt-2 font-mono text-sm text-ink-muted">
        Lecturer: {course.lecturer} &middot; Updated {course.updated}
      </div>

      <p className="mt-6 max-w-2xl leading-relaxed text-ink">{course.description}</p>

      <Card className="mt-6" eyebrow="Topics covered" padded>
        <ul className="list-disc space-y-1.5 pl-5">
          {course.topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      </Card>

      {course.texts?.length > 0 && (
        <Card className="mt-6" eyebrow="Recommended texts" padded>
          <ul className="list-disc space-y-1.5 pl-5">
            {course.texts.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-8">
        <Button variant="ghost" onClick={() => navigate(`/outlines/${level}/${semester}`)}>
          Back to course list
        </Button>
      </div>
    </div>
  )
}
