import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Table from '../../components/ui/Table'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, DAYS, useTimetablesQuery, getTimetable } from '../../data/timetables'
import { sortTimetableRows, formatTimeLabel, downloadTimetablePdf } from '../../lib/timetablePdf'

const CLASS_COLUMNS = ['Day', 'Time', 'Code', 'Course', 'Venue', 'Lecturer', 'Notes']
const EXAM_COLUMNS = ['Date', 'Time', 'Code', 'Course', 'Venue', 'Invigilator', 'Notes']

function toTableRows(rows) {
  return rows.map((r) => [
    r.day ?? r.date ?? '',
    `${formatTimeLabel(r.start_time)} - ${formatTimeLabel(r.end_time)}`,
    r.code,
    r.title,
    r.venue,
    r.lecturer ?? '',
    r.notes ?? '',
  ])
}

export default function TimetableLevel() {
  const { level } = useParams()
  const { data, isLoading, isError, refetch } = useTimetablesQuery()
  const [semester, setSemester] = useState('1')
  const [type, setType] = useState('class')
  const [day, setDay] = useState('All')

  if (!LEVELS.includes(level)) return <Navigate to="/timetable" replace />

  const allRows = getTimetable(data ?? [], level, semester, type)
  const sortedRows = sortTimetableRows(allRows, type)
  const visibleRows = type === 'class' && day !== 'All' ? sortedRows.filter((r) => r.day === day) : sortedRows

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Timetable', to: '/timetable' }, { label: `${level} Level` }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-ink-900">{level} Level Timetable</h1>
        {sortedRows.length > 0 && (
          <Button
            variant="accent"
            size="sm"
            onClick={() => downloadTimetablePdf({ level, semester, type, rows: sortedRows })}
          >
            <span className="material-symbols-outlined text-base">download</span>
            Download PDF
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-hairline bg-surface-low p-1">
            {Object.entries(SEMESTER_LABELS).map(([sem, label]) => (
              <button
                key={sem}
                type="button"
                onClick={() => setSemester(sem)}
                className={[
                  'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                  semester === sem ? 'bg-green-900 text-white' : 'text-ink-muted hover:text-ink-900',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-full border border-hairline bg-surface-low p-1">
            {[
              ['class', 'Class Timetable'],
              ['exam', 'Exam Timetable'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={[
                  'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                  type === value ? 'bg-green-100 text-green-900' : 'text-ink-muted hover:text-ink-900',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {type === 'class' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {['All', ...DAYS].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                className={[
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  day === d ? 'bg-green-900 text-white' : 'text-ink-muted hover:bg-surface-low hover:text-ink-900',
                ].join(' ')}
              >
                {d === 'All' ? 'All' : d.slice(0, 3)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        {isError && !data ? (
          <ErrorState message="Couldn't load the timetable right now." onRetry={refetch} />
        ) : isLoading ? (
          <SkeletonTable columns={CLASS_COLUMNS.length} rows={5} />
        ) : visibleRows.length > 0 ? (
          <Table columns={type === 'exam' ? EXAM_COLUMNS : CLASS_COLUMNS} rows={toTableRows(visibleRows)} />
        ) : sortedRows.length > 0 ? (
          <EmptyState
            icon="event_busy"
            title="No entries for this day"
            description={`Nothing scheduled on ${day} for ${level} Level, ${SEMESTER_LABELS[semester]}. Try a different day.`}
          />
        ) : (
          <EmptyState
            icon="event_busy"
            title="No timetable published yet"
            description={`The ${type === 'exam' ? 'exam' : 'class'} timetable for ${level} Level, ${SEMESTER_LABELS[semester]} hasn't been added yet. Check back soon.`}
          />
        )}
      </div>
    </div>
  )
}
