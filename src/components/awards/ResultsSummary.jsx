import { buildTally } from '../../data/awardVotes'

export default function ResultsSummary({ categories, nomineesByCategory, votes }) {
  return (
    <div className="flex flex-col gap-5">
      {categories.map((category) => {
        const nominees = nomineesByCategory[category.id] || []
        const categoryVotes = votes.filter((v) => v.category_id === category.id)
        const tally = buildTally(categoryVotes, nominees)
        const totalVotes = tally.reduce((sum, t) => sum + t.count, 0)
        const max = Math.max(...tally.map((t) => t.count), 1)
        const winner = tally.length > 0 && tally[0].count > 0 ? tally[0] : null

        return (
          <div key={category.id} className="rounded-lg border border-hairline bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-ink-900">{category.title}</h3>
              <span className="rounded-full bg-surface-low px-2.5 py-1 text-xs text-ink-muted">
                {totalVotes} vote{totalVotes === 1 ? '' : 's'}
              </span>
            </div>

            {winner && (
              <div className="mt-3 flex flex-col gap-3 rounded-lg bg-orange-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {winner.nominee.photo_url ? (
                    <img src={winner.nominee.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink-muted">
                      <span className="material-symbols-outlined text-2xl">person</span>
                    </span>
                  )}
                  <div className="flex flex-col">
                    <span className="w-fit rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.05em] text-white">
                      Winner
                    </span>
                    <span className="mt-0.5 font-bold text-ink-900">{winner.nominee.name}</span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="block font-bold text-orange-600">
                    {winner.count} vote{winner.count === 1 ? '' : 's'}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {totalVotes ? Math.round((winner.count / totalVotes) * 100) : 0}% share
                  </span>
                </div>
              </div>
            )}

            {tally.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">No nominees for this category.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                {tally.map(({ nominee, count }, i) => (
                  <div key={nominee.id} className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-xs font-bold text-ink-muted">{i + 1}</span>
                    {nominee.photo_url ? (
                      <img src={nominee.photo_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-low text-ink-muted">
                        <span className="material-symbols-outlined text-base">person</span>
                      </span>
                    )}
                    <span className="w-24 shrink-0 truncate text-sm text-ink" title={nominee.name}>{nominee.name}</span>
                    <div className="h-2.5 flex-1 rounded-full bg-hairline">
                      <div className="h-2.5 rounded-full bg-green-700" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-right font-mono text-xs text-ink-muted">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
