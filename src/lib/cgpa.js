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

const LEVEL_ORDER = ['100', '200', '300', '400', '500']

function sortSemesters(semesters) {
  return [...semesters].sort((a, b) => {
    const levelDiff = LEVEL_ORDER.indexOf(String(a.level)) - LEVEL_ORDER.indexOf(String(b.level))
    if (levelDiff !== 0) return levelDiff
    return a.semester - b.semester
  })
}

export function cumulativeStats(semesters) {
  const sorted = sortSemesters(semesters)

  let cumulativeUnits = 0
  let cumulativePoints = 0

  const rows = sorted.map((sem) => {
    const semGpa = semesterGPA(sem.courses)

    const cgpaCourses = sem.courses.filter((c) => c.counts_toward_cgpa !== false)
    const cgpaUnits = cgpaCourses.reduce((sum, c) => sum + c.units, 0)
    const cgpaPoints = cgpaCourses.reduce((sum, c) => sum + c.units * pointsForGrade(c.grade), 0)

    cumulativeUnits += cgpaUnits
    cumulativePoints += cgpaPoints

    return {
      semesterId: sem.id,
      level: sem.level,
      semester: sem.semester,
      label: `${sem.level}L S${sem.semester}`,
      gpa: semGpa.gpa,
      cumulativeUnits,
      cumulativePoints,
      cgpaSoFar: cumulativeUnits === 0 ? 0 : cumulativePoints / cumulativeUnits,
    }
  })

  const overallCGPA = cumulativeUnits === 0 ? 0 : cumulativePoints / cumulativeUnits

  return {
    rows,
    overallUnits: cumulativeUnits,
    overallPoints: cumulativePoints,
    overallCGPA,
    classification: classify(overallCGPA),
  }
}

export function whatIfTarget({ currentUnits, currentPoints, targetCgpa, remainingUnits }) {
  if (remainingUnits <= 0) {
    return {
      requiredAveragePoint: null,
      achievable: false,
      alreadyMet: false,
      error: 'Enter at least 1 remaining unit.',
    }
  }

  const currentCgpa = currentUnits === 0 ? 0 : currentPoints / currentUnits

  if (currentCgpa >= targetCgpa) {
    return { requiredAveragePoint: 0, achievable: true, alreadyMet: true, error: null }
  }

  const requiredPoints = targetCgpa * (currentUnits + remainingUnits) - currentPoints
  const requiredAveragePoint = requiredPoints / remainingUnits

  return {
    requiredAveragePoint,
    achievable: requiredAveragePoint <= 5,
    alreadyMet: false,
    error: null,
  }
}

function normalizeCode(code) {
  return code.trim().toUpperCase().replace(/\s+/g, ' ')
}

function semesterRank(sem) {
  return LEVEL_ORDER.indexOf(String(sem.level)) * 2 + (sem.semester - 1)
}

export function findPriorAttempts(code, semesters, excludeSemesterId) {
  const target = normalizeCode(code)
  const current = semesters.find((s) => s.id === excludeSemesterId)
  const currentRank = current ? semesterRank(current) : Infinity
  const matches = []

  for (const sem of semesters) {
    if (sem.id === excludeSemesterId) continue
    if (semesterRank(sem) >= currentRank) continue
    for (const course of sem.courses) {
      if (normalizeCode(course.code) === target) {
        matches.push({ semesterId: sem.id, label: `${sem.level}L S${sem.semester}`, course })
      }
    }
  }

  return matches
}
