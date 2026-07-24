import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import {
  fetchSemesters,
  addSemester,
  deleteSemester,
  addCourse,
  updateCourse,
  deleteCourse,
} from '../lib/cgpaApi'
import { cumulativeStats, findPriorAttempts } from '../lib/cgpa'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'
import FormField from '../components/ui/FormField'

const LEVELS = ['100', '200', '300', '400', '500']
const SEMESTERS = [1, 2]
const GRADES = ['A', 'B', 'C', 'D', 'E', 'F']

export default function Cgpa() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [semesters, setSemesters] = useState([])
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')

  const [newLevel, setNewLevel] = useState(LEVELS[0])
  const [newSemesterNum, setNewSemesterNum] = useState(SEMESTERS[0])

  const [courseDrafts, setCourseDrafts] = useState({})

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let cancelled = false

    fetchSemesters(user.id).then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setFormError(error.message)
      } else {
        setSemesters(data)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  const stats = useMemo(() => cumulativeStats(semesters), [semesters])

  const existingKeys = useMemo(
    () => new Set(semesters.map((s) => `${s.level}-${s.semester}`)),
    [semesters]
  )

  function draftFor(semesterId) {
    return courseDrafts[semesterId] || { code: '', title: '', units: '3', grade: 'A' }
  }

  function setDraft(semesterId, patch) {
    setCourseDrafts((prev) => ({ ...prev, [semesterId]: { ...draftFor(semesterId), ...patch } }))
  }

  async function handleAddSemester(event) {
    event.preventDefault()
    setFormError('')

    if (existingKeys.has(`${newLevel}-${newSemesterNum}`)) {
      setFormError('That semester has already been added.')
      return
    }

    const { data, error } = await addSemester({ userId: user.id, level: newLevel, semester: newSemesterNum })

    if (error) {
      setFormError(error.message)
      return
    }

    setSemesters((prev) => [...prev, { ...data, courses: [] }])
  }

  async function handleDeleteSemester(semesterId) {
    setFormError('')
    const { error } = await deleteSemester(semesterId)

    if (error) {
      setFormError(error.message)
      return
    }

    setSemesters((prev) => prev.filter((s) => s.id !== semesterId))
  }

  async function handleAddCourse(semesterId, event) {
    event.preventDefault()
    setFormError('')

    const draft = draftFor(semesterId)
    const units = Number(draft.units)

    if (!draft.code.trim()) {
      setFormError('Enter a course code.')
      return
    }
    if (!Number.isInteger(units) || units < 1 || units > 6) {
      setFormError('Units must be a whole number between 1 and 6.')
      return
    }

    const { data, error } = await addCourse({
      semesterId,
      code: draft.code.trim(),
      title: draft.title.trim(),
      units,
      grade: draft.grade,
    })

    if (error) {
      setFormError(error.message)
      return
    }

    setSemesters((prev) =>
      prev.map((s) => (s.id === semesterId ? { ...s, courses: [...s.courses, data] } : s))
    )
    setCourseDrafts((prev) => ({ ...prev, [semesterId]: { code: '', title: '', units: '3', grade: 'A' } }))
  }

  async function handleExcludeFromCgpa(courseId) {
    setFormError('')
    const { error } = await updateCourse(courseId, { counts_toward_cgpa: false })

    if (error) {
      setFormError(error.message)
      return
    }

    setSemesters((prev) =>
      prev.map((s) => ({
        ...s,
        courses: s.courses.map((c) => (c.id === courseId ? { ...c, counts_toward_cgpa: false } : c)),
      }))
    )
  }

  async function handleDeleteCourse(semesterId, courseId) {
    setFormError('')
    const { error } = await deleteCourse(courseId)

    if (error) {
      setFormError(error.message)
      return
    }

    setSemesters((prev) =>
      prev.map((s) => (s.id === semesterId ? { ...s, courses: s.courses.filter((c) => c.id !== courseId) } : s))
    )
  }

  if (authLoading || loading) {
    return null
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
          CGPA calculator
        </div>
        <h1 className="mt-1.5 text-[32px]">Sign in to track your CGPA</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Your grades are saved to your account so they follow you across devices.
        </p>
        <Button variant="primary" className="mt-6" onClick={() => navigate('/login')}>
          Sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        CGPA calculator
      </div>
      <h1 className="mt-1.5 text-[32px]">Your academic record</h1>

      {formError && (
        <p className="mt-4 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">{formError}</p>
      )}

      <Card className="mt-6" tone="green" eyebrow="Cumulative GPA" title={stats.overallCGPA.toFixed(2)}>
        <Badge tone="new">{stats.classification}</Badge>
        <span className="ml-2 font-mono text-sm text-white/80">{stats.overallUnits} units completed</span>
      </Card>

      <div className="mt-8 flex flex-col gap-6">
        {stats.rows.length === 0 && (
          <p className="text-ink-muted">No semesters yet — add your first one below.</p>
        )}

        {stats.rows.map((row) => {
          const semester = semesters.find((s) => s.id === row.semesterId)
          const draft = draftFor(semester.id)
          const matches = draft.code.trim() ? findPriorAttempts(draft.code, semesters, semester.id) : []

          return (
            <div key={semester.id}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-xl">{row.label}</h2>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-ink-muted">GPA {row.gpa.toFixed(2)}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteSemester(semester.id)}>
                    Remove semester
                  </Button>
                </div>
              </div>

              {semester.courses.length === 0 ? (
                <p className="text-sm text-ink-muted">No courses yet — add one below.</p>
              ) : (
                <Table
                  columns={['Code', 'Title', 'Units', 'Grade', 'Counts toward CGPA', '']}
                  rows={semester.courses.map((c) => [
                    c.code,
                    c.title || '—',
                    c.units,
                    c.grade,
                    c.counts_toward_cgpa ? 'Yes' : 'No',
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCourse(semester.id, c.id)}>
                      Delete
                    </Button>,
                  ])}
                />
              )}

              {matches.length > 0 && (
                <div className="mt-3 rounded-sm bg-orange-100 p-3 text-sm text-ink">
                  <p>You&rsquo;ve taken this course before:</p>
                  {matches.map((m) => (
                    <div key={m.course.id} className="mt-1 flex items-center justify-between gap-3">
                      <span>
                        {m.label} &middot; grade {m.course.grade}
                        {m.course.counts_toward_cgpa === false ? ' (already excluded)' : ''}
                      </span>
                      {m.course.counts_toward_cgpa !== false && (
                        <Button variant="secondary" size="sm" onClick={() => handleExcludeFromCgpa(m.course.id)}>
                          Exclude that attempt from CGPA
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => handleAddCourse(semester.id, e)}
                className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end"
              >
                <FormField
                  label="Code"
                  value={draft.code}
                  onChange={(e) => setDraft(semester.id, { code: e.target.value })}
                  placeholder="MME 301"
                />
                <FormField
                  label="Title"
                  value={draft.title}
                  onChange={(e) => setDraft(semester.id, { title: e.target.value })}
                  placeholder="Optional"
                />
                <FormField
                  label="Units"
                  type="number"
                  value={draft.units}
                  onChange={(e) => setDraft(semester.id, { units: e.target.value })}
                />
                <FormField
                  label="Grade"
                  type="select"
                  options={GRADES}
                  value={draft.grade}
                  onChange={(e) => setDraft(semester.id, { grade: e.target.value })}
                />
                <Button variant="secondary" type="submit">
                  Add course
                </Button>
              </form>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleAddSemester} className="mt-8 flex flex-wrap items-end gap-3">
        <FormField
          label="Level"
          type="select"
          options={LEVELS}
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value)}
        />
        <FormField
          label="Semester"
          type="select"
          options={SEMESTERS.map(String)}
          value={String(newSemesterNum)}
          onChange={(e) => setNewSemesterNum(Number(e.target.value))}
        />
        <Button variant="primary" type="submit">
          Add semester
        </Button>
      </form>
    </div>
  )
}
