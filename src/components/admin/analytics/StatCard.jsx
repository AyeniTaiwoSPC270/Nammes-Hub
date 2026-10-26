import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { formatDelta, percentDelta } from '../../../lib/analytics'
import { useCountUp } from '../../../lib/useCountUp'

// One headline number, its movement since the previous period, and a shape. The sparkline is optional
// because not every KPI has a daily series behind it -- email opt-in is a standing share, not a flow.
export default function StatCard({
  label,
  value = 0,
  previous = 0,
  icon,
  format = (n) => n.toLocaleString(),
  hint,
  spark,
  showDelta = true,
}) {
  const rawId = useId()
  const gradientId = `stat-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const safeValue = Number.isFinite(value) ? value : 0
  const shown = useCountUp(0, safeValue, { durationMs: 700 })
  const delta = percentDelta(safeValue, previous)
  const points = Array.isArray(spark) ? spark.map((v, i) => ({ i, v })) : []
  const rising = delta !== null && delta > 0
  const falling = delta !== null && delta < 0

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">{label}</span>
        {icon && (
          <span className="material-symbols-outlined text-hairline" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <span className="text-3xl font-bold leading-none text-ink-900">{format(shown)}</span>
        {showDelta && (
          <span
            className={[
              'inline-flex items-center gap-0.5 text-xs font-semibold',
              rising ? 'text-success' : falling ? 'text-danger' : 'text-ink-muted',
            ].join(' ')}
            title="Compared with the previous period of the same length"
          >
            {rising && <span className="material-symbols-outlined text-sm">arrow_upward</span>}
            {falling && <span className="material-symbols-outlined text-sm">arrow_downward</span>}
            {formatDelta(delta)}
          </span>
        )}
      </div>

      {points.length > 1 && (
        <div className="h-8" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--color-brand)"
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}
