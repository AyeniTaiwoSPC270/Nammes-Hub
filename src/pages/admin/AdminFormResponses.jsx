import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useFormQuery } from '../../data/forms'
import { useFormResponsesQuery, responsesToCsv } from '../../data/formResponses'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import ResponseSummaryTab from '../../components/admin/forms/ResponseSummaryTab'
import ResponseTableTab from '../../components/admin/forms/ResponseTableTab'
import ResponseIndividualTab from '../../components/admin/forms/ResponseIndividualTab'

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'table', label: 'Table' },
  { id: 'individual', label: 'Individual' },
]

export default function AdminFormResponses() {
  const { id } = useParams()
  const [tab, setTab] = useState('summary')
  const formQuery = useFormQuery(id)
  const responsesQuery = useFormResponsesQuery(id)

  const form = formQuery.data
  const responses = responsesQuery.data ?? []

  function handleExport() {
    const csv = responsesToCsv(form.questions, responses)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${form.title.replace(/\s+/g, '-').toLowerCase()}-responses.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if ((formQuery.isError && !form) || (responsesQuery.isError && !responsesQuery.data)) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState
          message="Couldn't load responses right now."
          onRetry={() => {
            formQuery.refetch()
            responsesQuery.refetch()
          }}
        />
      </div>
    )
  }

  if (formQuery.isLoading || responsesQuery.isLoading || !form) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <SkeletonTable columns={4} rows={5} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Forms', to: '/admin/forms' }, { label: form.title }]} />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-ink-900">{form.title} — Responses</h1>
        <Button variant="secondary" onClick={handleExport} disabled={responses.length === 0}>
          Export CSV
        </Button>
      </div>

      <div className="mt-6 flex gap-2 border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
              tab === t.id ? 'border-green-900 text-green-900' : 'border-transparent text-ink-muted',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {responses.length === 0 ? (
          <EmptyState icon="inbox" title="No responses yet" description="Responses will show up here once people start submitting." />
        ) : tab === 'summary' ? (
          <ResponseSummaryTab questions={form.questions} responses={responses} />
        ) : tab === 'table' ? (
          <ResponseTableTab questions={form.questions} responses={responses} />
        ) : (
          <ResponseIndividualTab questions={form.questions} responses={responses} />
        )}
      </div>
    </div>
  )
}
