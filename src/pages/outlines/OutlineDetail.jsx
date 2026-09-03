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

  if (isError && !data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this outline right now." onRetry={refetch} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <div className="h-4 w-48 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-4 h-3 w-32 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-2 h-8 w-2/3 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-3 h-4 w-56 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-6">
          <SkeletonText lines={3} />
        </div>
        <div className="mt-6 rounded-lg border border-hairline bg-surface p-6 shadow-md">
          <div className="h-3 w-32 animate-pulse rounded-sm bg-hairline" />
          <div className="mt-4">
            <SkeletonText lines={4} />
          </div>
        </div>
      </div>
    )
  }

  const course = getCourse(data ?? [], level, semester, code)
  if (!course) return <Navigate to={`/outlines/${level}/${semester}`} replace />

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Outlines', to: '/outlines' },
          { label: `${level} Level`, to: `/outlines/${level}` },
          { label: SEMESTER_LABELS[semester], to: `/outlines/${level}/${semester}` },
          { label: course.code },
        ]}
      />

      <div className="text-xs font-semibold uppercase tracking-[.05em] text-orange-500">
        {course.code} &middot; {course.units} unit{course.units === 1 ? '' : 's'}
      </div>
      <h1 className="mt-1.5 text-3xl font-bold text-ink-900">{course.title}</h1>
      <div className="mt-2 text-sm text-ink-muted">
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

      {(course.past_questions_link || course.lecturer_notes_link) && (
        <Card className="mt-6" eyebrow="Downloads" padded>
          <div className="flex flex-wrap gap-4">
            {course.past_questions_link && (
              <a
                href={course.past_questions_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:underline"
              >
                Past exam questions <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </a>
            )}
            {course.lecturer_notes_link && (
              <a
                href={course.lecturer_notes_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:underline"
              >
                Lecturer notes <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </a>
            )}
          </div>
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
