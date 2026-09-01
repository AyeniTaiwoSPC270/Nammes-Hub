import { useEffect, useState } from 'react'
import PageBanner from '../components/PageBanner'
import EmptyState from '../components/ui/EmptyState'
import { fetchExcos } from '../data/excos'

export default function Excos() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExcos()
      .then((data) => {
        setRows(data)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <PageBanner
        title="The Aegis 26/27"
        subtitle="Meet the Executive Council leading NAMMES for the 2026/2027 session."
        size="lg"
      />

      <section className="mx-auto max-w-[1200px] px-5 sm:px-6 py-14">
        {error ? (
          <p className="text-ink-muted">Couldn&rsquo;t load the Excos list right now.</p>
        ) : loading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="group_off"
            title="No Excos added yet"
            description="Executive Council members will appear here once they're added."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
            {rows.map((x) => (
              <article
                key={x.id}
                className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-md transition-shadow hover:shadow-lg"
              >
                <div className="flex w-full aspect-[4/5] items-center justify-center bg-surface-low font-display text-3xl text-green-900">
                  {x.photo_url ? (
                    <img src={x.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (x.name || x.role || '?').charAt(0)
                  )}
                </div>
                <div className="flex flex-grow flex-col p-6">
                  <h3 className="mb-1 text-lg font-bold text-ink-900">{x.name || 'Name Surname'}</h3>
                  <p className="text-xs font-bold uppercase tracking-[.05em] text-orange-500">{x.role}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
