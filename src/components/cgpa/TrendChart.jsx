import { buildChartPoints } from '../../lib/chartMath'

const WIDTH = 640
const HEIGHT = 220
const PADDING = 32

export default function TrendChart({ rows }) {
  const points = buildChartPoints(rows, { width: WIDTH, height: HEIGHT, padding: PADDING })

  if (points.length < 2) {
    return null
  }

  const baseline = HEIGHT - PADDING
  const barWidth = 18

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.cgpaY}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="GPA and CGPA trend across semesters"
    >
      {points.map((p) => (
        <rect
          key={`bar-${p.label}`}
          x={p.x - barWidth / 2}
          y={p.gpaY}
          width={barWidth}
          height={Math.max(0, baseline - p.gpaY)}
          className="fill-green-100"
        />
      ))}
      <path d={linePath} fill="none" className="stroke-orange-500" strokeWidth={2} />
      {points.map((p) => (
        <circle key={`dot-${p.label}`} cx={p.x} cy={p.cgpaY} r={3} className="fill-orange-500" />
      ))}
      {points.map((p) => (
        <text
          key={`label-${p.label}`}
          x={p.x}
          y={HEIGHT - 8}
          textAnchor="middle"
          className="fill-ink-muted font-mono text-[10px] uppercase"
        >
          {p.label}
        </text>
      ))}
    </svg>
  )
}
