import { useNavigate, useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useOutlinesQuery, getCourses } from '../../data/outlines'

export default function OutlineCourses() {
  const { level, semester } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useOutlinesQuery()

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/outlines" replace />

  const courses = getCourses(data ?? [], level, semester)
  const slug = (code) => code.replace(/\s+/g, '').toLowerCase()

  const tableRows = courses.map((c) => [
    c.code,
    c.title,
    String(c.units),
    <Button
      key={c.code}
      variant="ghost"
      size="sm"
      onClick={() => navigate(`/outlines/${level}/${semester}/${slug(c.code)}`)}
    >
      View outline
    </Button>,
  ])

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Outlines', to: '/outlines' },
          { label: `${level} Level`, to: `/outlines/${level}` },
          { label: SEMESTER_LABELS[semester] },
        ]}
      />
      <h1 className="text-[32px]">
        {level} Level &middot; {SEMESTER_LABELS[semester]}
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Select a course to view its detailed outline.</p>

      <div className="mt-6">
        {isError ? (
          <ErrorState message="Couldn't load courses right now." onRetry={refetch} />
        ) : isLoading ? (
          <SkeletonTable columns={4} rows={5} />
        ) : courses.length > 0 ? (
          <Table columns={['Code', 'Title', 'Units', '']} rows={tableRows} />
        ) : (
          <EmptyState title="Nothing here yet" body="No courses published for this semester yet." />
        )}
      </div>
    </div>
  )
}
