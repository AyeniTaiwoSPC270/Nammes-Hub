import Table from '../../ui/Table'
import { formatAnswerForDisplay } from '../../../data/formResponses'

export default function ResponseTableTab({ questions, responses }) {
  const columns = ['Submitted', ...questions.map((q) => q.label)]
  const rows = responses.map((r) => [
    new Date(r.submitted_at).toLocaleString(),
    ...questions.map((q) => formatAnswerForDisplay(q, r.answers?.[q.id])),
  ])
  return <Table columns={columns} rows={rows} />
}
