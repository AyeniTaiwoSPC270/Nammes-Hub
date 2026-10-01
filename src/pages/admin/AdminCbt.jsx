import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../lib/ToastContext'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ErrorState from '../../components/ui/ErrorState'
import ExamEditor from '../../components/admin/cbt/ExamEditor'
import { fetchCourses, fetchExams, addCourse, deleteCourse, createExam } from '../../data/cbtAdmin'
import { LEVEL_LABEL } from '../../data/cbt'

// CBT exams for admins: add a course, add an exam to it, fill the question bank from a spreadsheet, publish it.
// Students find published exams at /cbt. Spec: docs/superpowers/specs/2026-10-01-cbt-exam-mode.md

const input = 'min-h-11 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink-900 focus:border-brand focus:outline-none'

function CourseCard({ course, exams, openId, onOpen }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [asking, setAsking] = useState(false)
  const add = useMutation({
    mutationFn: () => createExam(course.id, title),
    onSuccess: (exam) => {
      setTitle('')
      queryClient.invalidateQueries({ queryKey: ['cbt_exams'] })
      onOpen(exam.id)
      toast.success('Exam created. Add its questions, then publish it.')
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => deleteCourse(course.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cbt_courses'] })
      queryClient.invalidateQueries({ queryKey: ['cbt_exams'] })
      toast.success('Course deleted.')
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <li className="rounded-xl border border-hairline bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-ink-900">{course.code} <span className="text-base font-normal text-ink-muted">· {LEVEL_LABEL[course.level]}</span></h2>
          <p className="text-ink-muted">{course.title}</p>
        </div>
        {asking ? (
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Delete this course and all its exams?
            <Button variant="destructive" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>Yes, delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>Keep it</Button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setAsking(true)}>Delete course</Button>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {exams.map((exam) => {
          const open = openId === exam.id
          return (
            <li key={exam.id} className="rounded-lg border border-hairline">
              <button type="button" onClick={() => onOpen(open ? null : exam.id)} aria-expanded={open} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left">
                <span className="min-w-0">
                  <span className="block font-bold text-ink-900">{exam.title}</span>
                  <span className="block text-xs text-ink-muted">{exam.duration_minutes} min · pass {exam.pass_mark_percent}% · code {exam.code}</span>
                </span>
                <span className="flex items-center gap-2">
                  {exam.published ? <Badge tone="updated">Published</Badge> : <Badge tone="neutral">Draft</Badge>}
                  <span className="material-symbols-outlined" aria-hidden="true">{open ? 'expand_less' : 'expand_more'}</span>
                </span>
              </button>
              {open && (
                <div className="px-4 pb-4">
                  <ExamEditor exam={exam} onDeleted={() => onOpen(null)} />
                </div>
              )}
            </li>
          )
        })}
        {exams.length === 0 && <li className="text-sm text-ink-muted">No exams yet.</li>}
      </ul>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add.mutate()
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="New exam title, e.g. 2024/25 first semester CBT" aria-label="New exam title" className={`${input} min-w-0 flex-1`} />
        <Button type="submit" variant="secondary" loading={add.isPending} disabled={!title.trim()}>Add exam</Button>
      </form>
    </li>
  )
}

export default function AdminCbt() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const courses = useQuery({ queryKey: ['cbt_courses'], queryFn: fetchCourses })
  const exams = useQuery({ queryKey: ['cbt_exams'], queryFn: fetchExams })
  const [openId, setOpenId] = useState(null)
  const [level, setLevel] = useState('100')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const add = useMutation({
    mutationFn: () => addCourse({ level, code, title }),
    onSuccess: () => {
      setCode('')
      setTitle('')
      queryClient.invalidateQueries({ queryKey: ['cbt_courses'] })
      toast.success('Course added.')
    },
    onError: (e) => toast.error(e.message.includes('duplicate') ? 'That course code already exists.' : e.message),
  })

  const failed = courses.isError || exams.isError
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'CBT Exams' }]} />
      <h1 className="text-3xl font-bold text-ink-900">CBT Exams</h1>
      <p className="max-w-2xl text-ink-muted">
        Timed, exam-style practice for students at <code>/cbt</code>. Add a course, add an exam to it, paste the questions from a spreadsheet, then publish. Each attempt draws a fresh random paper from the question bank.
      </p>

      <section aria-label="Add a course" className="mt-8 rounded-xl border border-hairline bg-surface-low p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-bold text-ink-900">Add a course</h2>
        <form
          className="grid gap-3 sm:grid-cols-[160px_160px_minmax(0,1fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            add.mutate()
          }}
        >
          <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)} className={input}>
            {Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input aria-label="Course code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} placeholder="MTH 101" className={input} />
          <input aria-label="Course title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Elementary Mathematics I" className={input} />
          <Button type="submit" variant="accent" loading={add.isPending}>Add course</Button>
        </form>
      </section>

      <section className="mt-8" aria-label="Courses">
        {failed ? (
          <ErrorState message="Couldn't load the CBT exams." onRetry={() => { courses.refetch(); exams.refetch() }} />
        ) : courses.isLoading || exams.isLoading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : courses.data.length === 0 ? (
          <p className="rounded-xl border border-hairline bg-surface p-5 text-ink-muted">No courses yet. Add your first one above.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {courses.data.map((c) => (
              <CourseCard key={c.id} course={c} exams={exams.data.filter((e) => e.course_id === c.id)} openId={openId} onOpen={setOpenId} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
