import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { downsample, formatDay, percentLabel } from '../../../lib/analytics'

// Shared chart shell: a titled bordered surface, the same shape as a neutral Card but without Card's
// body clamping, because a chart is not prose.
export function ChartFrame({ title, description, action, children, className = '' }) {
  return (
    <section className={['rounded-lg border border-hairline bg-surface p-5 shadow-md', className].join(' ')}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

// Recharts draws SVG, so it reads the same custom properties the rest of the page uses. `brand` is the
// token meant for text/borders/icons on a surface and is the one that flips in dark mode; `green-900`
// does not, which is why the primary line is not green-900.
const AXIS_TICK = { fill: 'var(--color-ink-muted)', fontSize: 12 }
const AXIS_LINE = { stroke: 'var(--color-hairline)' }
const TOOLTIP_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 8,
  color: 'var(--color-ink)',
  fontSize: 12,
}
const CURSOR = { fill: 'var(--color-surface-low)' }

function ChartLegend({ items }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function TrafficChart({ rows }) {
  const data = downsample(rows, 90)
  return (
    <ChartFrame
      title="Traffic"
      description="Views and visitors, recorded since tracking started"
      action={<ChartLegend items={[
        { label: 'Views', color: 'var(--color-brand)' },
        { label: 'Visitors', color: 'var(--color-brand-orange)' },
      ]} />}
    >
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="analytics-traffic-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDay}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            minTickGap={28}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={38} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={formatDay}
            cursor={{ stroke: 'var(--color-hairline)' }}
          />
          <Area
            type="monotone"
            dataKey="views"
            name="Views"
            stroke="var(--color-brand)"
            strokeWidth={2}
            fill="url(#analytics-traffic-fill)"
          />
          <Line
            type="monotone"
            dataKey="visitors"
            name="Visitors"
            stroke="var(--color-brand-orange)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

export function SignupChart({ rows }) {
  return (
    <ChartFrame title="New members" description="Signups per day">
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={rows} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDay}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            minTickGap={28}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={38} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatDay} cursor={CURSOR} />
          <Bar dataKey="count" name="Signups" fill="var(--color-green-900)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

const ENGAGEMENT_SERIES = [
  { key: 'quiz', label: 'Live quiz', color: 'var(--color-brand)' },
  { key: 'practice', label: 'Practice', color: 'var(--color-brand-orange)' },
  { key: 'cbt', label: 'CBT', color: 'var(--color-success)' },
  { key: 'forms', label: 'Forms', color: 'var(--color-warning)' },
  { key: 'battles', label: 'Battles', color: 'var(--color-ink-muted)' },
]

export function EngagementChart({ rows }) {
  return (
    <ChartFrame
      title="Engagement"
      description="Things people did, per day"
      action={<ChartLegend items={ENGAGEMENT_SERIES} />}
    >
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={rows} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDay}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            minTickGap={28}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={38} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatDay} cursor={CURSOR} />
          {ENGAGEMENT_SERIES.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              stackId="engagement"
              fill={series.color}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

export function AwardChart({ rows }) {
  if (!rows.length) {
    return (
      <ChartFrame title="Award participation" description="Votes cast this period">
        <p className="py-10 text-center text-sm text-ink-muted">No votes cast in this period.</p>
      </ChartFrame>
    )
  }

  return (
    <ChartFrame title="Award participation" description="Votes cast per category this period">
      <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 34)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="category"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={116}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
          <Bar dataKey="votes" name="Votes" fill="var(--color-brand-orange)" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

export function EmailReachChart({ optedIn, optedOut }) {
  const total = optedIn + optedOut
  const data = [
    { name: 'Opted in', value: optedIn, color: 'var(--color-brand)' },
    { name: 'Opted out', value: optedOut, color: 'var(--color-hairline)' },
  ]

  return (
    <ChartFrame title="Email reach" description="Who can receive a broadcast">
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">No members yet.</p>
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={78}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-ink-900">{percentLabel(optedIn / total)}</span>
            <span className="text-xs text-ink-muted">opted in</span>
          </div>
          <p className="mt-1 text-center text-xs text-ink-muted">
            {optedIn.toLocaleString()} of {total.toLocaleString()} members
          </p>
        </div>
      )}
    </ChartFrame>
  )
}
