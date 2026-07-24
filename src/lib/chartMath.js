export function buildChartPoints(rows, { width, height, padding = 24 }) {
  if (rows.length === 0) {
    return []
  }

  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2
  const maxGpa = 5

  const step = rows.length === 1 ? 0 : innerWidth / (rows.length - 1)

  return rows.map((row, i) => ({
    label: row.label,
    x: padding + step * i,
    gpaY: padding + innerHeight * (1 - row.gpa / maxGpa),
    cgpaY: padding + innerHeight * (1 - row.cgpaSoFar / maxGpa),
    gpa: row.gpa,
    cgpaSoFar: row.cgpaSoFar,
  }))
}
