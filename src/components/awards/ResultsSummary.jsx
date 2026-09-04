import { buildTally } from '../../data/awardVotes'

export default function ResultsSummary({ categories, nomineesByCategory, votes }) {
  return (
    <div className="flex flex-col gap-5">
      {categories.map((category) => {
        const nominees = nomineesByCategory[category.id] || []
        const categoryVotes = votes.filter((v) => v.category_id === category.id)
        const tally = buildTally(categoryVotes, nominees)
        const max = Math.max(...tally.map((t) => t.count), 1)
        const winner = tally.length > 0 && tally[0].count > 0 ? tally[0].nominee : null

        return (
          <div key={category.id} className="rounded-lg border border-hairline bg-surface p-5 shadow-sm">
            <h3 className="text-base font-semibold text-ink-900">{category.title}</h3>
            {winner && <p className="mt-1 text-sm text-ink-muted">Winner: <span className="font-semibold text-ink-900">{winner.name}</span></p>}
            {tally.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">No nominees for this category.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                {tally.map(({ nominee, count }) => (
                  <div key={nominee.id} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm text-ink" title={nominee.name}>{nominee.name}</span>
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
