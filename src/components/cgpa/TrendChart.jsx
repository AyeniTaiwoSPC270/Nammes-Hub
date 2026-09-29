import { useEffect, useRef, useState } from 'react'
import { buildChartPoints } from '../../lib/chartMath'

const WIDTH = 640
const HEIGHT = 220
const PADDING = 32

export default function TrendChart({ rows }) {
  const points = buildChartPoints(rows, { width: WIDTH, height: HEIGHT, padding: PADDING })
  const [activeIndex, setActiveIndex] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (activeIndex === null) return

    function handleOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) {
        setActiveIndex(null)
      }
    }

    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [activeIndex])

  if (points.length < 2) {
    return null
  }

  const baseline = HEIGHT - PADDING
  const barWidth = 18
  const step = points.length === 1 ? WIDTH : (WIDTH - PADDING * 2) / (points.length - 1)
  const sliceWidth = Math.min(step, WIDTH / points.length)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.cgpaY}`).join(' ')
  const active = activeIndex === null ? null : points[activeIndex]

  return (
    <div ref={containerRef} className="relative" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-full"
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
            className="fill-surface-low"
          />
        ))}
        <path d={linePath} fill="none" className="stroke-orange-500" strokeWidth={2} />
        {points.map((p, i) => (
          <circle
            key={`dot-${p.label}`}
            cx={p.x}
            cy={p.cgpaY}
            r={i === activeIndex ? 5 : 3}
            className="fill-orange-500 transition-[r]"
          />
        ))}
        {points.map((p) => (
          <text
            key={`label-${p.label}`}
            x={p.x}
            y={HEIGHT - 8}
            textAnchor="middle"
            className="fill-ink-muted font-mono text-[16px] uppercase"
          >
            {p.label}
          </text>
        ))}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.label}`}
            x={p.x - sliceWidth / 2}
            y={0}
            width={sliceWidth}
            height={baseline}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex((current) => (current === i ? null : current))}
            onClick={(e) => {
              e.stopPropagation()
              setActiveIndex((current) => (current === i ? null : i))
            }}
          />
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-hairline bg-surface px-3 py-2 text-sm shadow-md"
          style={{
            left: `${(active.x / WIDTH) * 100}%`,
            top: `${(active.cgpaY / HEIGHT) * 100}%`,
            transform: `translate(${
              activeIndex === 0 ? '0%' : activeIndex === points.length - 1 ? '-100%' : '-50%'
            }, calc(-100% - 10px))`,
          }}
        >
          <div className="font-mono text-xs uppercase text-ink-muted">{active.label}</div>
          <div className="mt-0.5 font-semibold text-ink-900">
            GPA {active.gpa.toFixed(2)} &middot; CGPA {active.cgpaSoFar.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  )
}
