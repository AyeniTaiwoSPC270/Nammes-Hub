export const GRADE_POINTS = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 }

export const CLASSIFICATION_BANDS = [
  { min: 4.5, label: 'First Class' },
  { min: 3.5, label: 'Second Class Upper' },
  { min: 2.4, label: 'Second Class Lower' },
  { min: 1.5, label: 'Third Class' },
  { min: 1.0, label: 'Pass' },
  { min: 0, label: 'Below Pass' },
]

export function pointsForGrade(grade) {
  const points = GRADE_POINTS[grade]
  if (points === undefined) {
    throw new Error(`Unknown grade: ${grade}`)
  }
  return points
}

export function semesterGPA(courses) {
  const totals = courses.reduce(
    (acc, course) => {
      acc.units += course.units
      acc.points += course.units * pointsForGrade(course.grade)
      return acc
    },
    { units: 0, points: 0 }
  )

  return {
    totalUnits: totals.units,
    totalPoints: totals.points,
    gpa: totals.units === 0 ? 0 : totals.points / totals.units,
  }
}

export function classify(cgpa) {
  const band = CLASSIFICATION_BANDS.find((b) => cgpa >= b.min)
  return band ? band.label : CLASSIFICATION_BANDS[CLASSIFICATION_BANDS.length - 1].label
}
