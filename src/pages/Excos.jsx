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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
                <div className="aspect-[4/5] w-full animate-pulse bg-hairline" />
                <div className="flex flex-col gap-2 p-6">
                  <div className="h-5 w-3/4 animate-pulse rounded-sm bg-hairline" />
                  <div className="h-3 w-1/2 animate-pulse rounded-sm bg-hairline" />
                </div>
              </div>
            ))}
          </div>
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
                  {(x.email || x.phone) && (
                    <div className="mt-3 flex flex-col gap-1.5 border-t border-hairline pt-3">
                      {x.email && (
                        <a
                          href={`mailto:${x.email}`}
                          className="flex items-center gap-1.5 text-sm text-ink-muted no-underline hover:text-green-900 hover:underline"
                        >
                          <span className="material-symbols-outlined text-base">mail</span>
                          <span className="truncate">{x.email}</span>
                        </a>
                      )}
                      {x.phone && (
                        <a
                          href={`tel:${x.phone}`}
                          className="flex items-center gap-1.5 text-sm text-ink-muted no-underline hover:text-green-900 hover:underline"
                        >
                          <span className="material-symbols-outlined text-base">call</span>
                          <span className="truncate">{x.phone}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
