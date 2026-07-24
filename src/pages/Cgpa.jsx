import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchSemesters } from '../lib/cgpaApi'
import { cumulativeStats } from '../lib/cgpa'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'

export default function Cgpa() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [semesters, setSemesters] = useState([])
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')

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

  const stats = cumulativeStats(semesters)

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
        {stats.rows.map((row) => {
          const semester = semesters.find((s) => s.id === row.semesterId)
          return (
            <div key={row.semesterId}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-xl">{row.label}</h2>
                <span className="font-mono text-sm text-ink-muted">GPA {row.gpa.toFixed(2)}</span>
              </div>
              <Table
                columns={['Code', 'Title', 'Units', 'Grade']}
                rows={semester.courses.map((c) => [c.code, c.title || '—', c.units, c.grade])}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
