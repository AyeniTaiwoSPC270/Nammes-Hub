# CGPA Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/cgpa` page for NAMMES Hub where a signed-in student manually enters courses/grades per semester and gets a running GPA/CGPA, a degree classification, a trend chart, retake/carryover handling, and a target-CGPA "what-if" simulator, with all data persisted to Supabase.

**Architecture:** Pure calculation logic lives in `src/lib/cgpa.js` (grade points, semester GPA, cumulative CGPA, classification, retake matching, what-if math) and `src/lib/chartMath.js` (SVG coordinate scaling), both unit-tested with Vitest. `src/lib/cgpaApi.js` is a thin Supabase CRUD wrapper. `src/pages/Cgpa.jsx` is the page component holding local React state, fed by `cgpaApi.js` and derived via `cgpa.js`. `src/components/cgpa/TrendChart.jsx` renders the trend chart from `chartMath.js` output. No new state-management or charting library is introduced.

**Tech Stack:** React 19, react-router-dom 7, Supabase JS v2, Tailwind CSS v4, Vite, Vitest (new dev dependency).

## Global Constraints

- Grading scale (5.0): A=5, B=4, C=3, D=2, E=1, F=0.
- Classification bands: First Class 4.50–5.00 · Second Class Upper 3.50–4.49 · Second Class Lower 2.40–3.49 · Third Class 1.50–2.39 · Pass 1.00–1.49.
- Course entry is fully manual — do not auto-fill from `src/data/outlines.js`.
- Units per course: whole number 1–6.
- Data is persisted to Supabase, scoped to the signed-in user (RLS), not localStorage.
- No new state-management library (redux/react-query) and no new charting library — local component state and a hand-rolled SVG chart.
- Reuse existing design system components (`Button`, `Card`, `Badge`, `Table`, `FormField`) and page shell convention (`mx-auto max-w-[880px] px-5 py-12 sm:px-6`, eyebrow + `h1` header). Do not invent new UI primitives.
- Supabase failures surface through the existing form-level error slot pattern (`<p className="rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">`), matching Signup/ResetPassword.
- Active Supabase project id: `ascdypvchlbpfupsssuy` (from `VITE_SUPABASE_URL` in `.env`).
- `src/lib/cgpa.js` and `src/lib/chartMath.js` get real Vitest unit tests (pure, no side effects). UI wiring (`Cgpa.jsx`, `TrendChart.jsx`, `cgpaApi.js`) is verified manually against the running dev server — this repo has no component/integration test infra today and none is being added, matching how Login/Signup/ResetPassword are verified elsewhere in the app.

---

### Task 1: Vitest setup + core grading math (`cgpa.js`)

**Files:**
- Create: `src/lib/cgpa.js`
- Create: `src/lib/cgpa.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `GRADE_POINTS` (object), `CLASSIFICATION_BANDS` (array of `{min, label}`), `pointsForGrade(grade: string): number`, `semesterGPA(courses: {units:number, grade:string}[]): {totalUnits, totalPoints, gpa}`, `classify(cgpa: number): string`.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write the failing tests**

Create `src/lib/cgpa.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { pointsForGrade, semesterGPA, classify } from './cgpa'

describe('pointsForGrade', () => {
  it('maps each letter grade to its point value', () => {
    expect(pointsForGrade('A')).toBe(5)
    expect(pointsForGrade('B')).toBe(4)
    expect(pointsForGrade('C')).toBe(3)
    expect(pointsForGrade('D')).toBe(2)
    expect(pointsForGrade('E')).toBe(1)
    expect(pointsForGrade('F')).toBe(0)
  })

  it('throws on an unknown grade', () => {
    expect(() => pointsForGrade('Z')).toThrow('Unknown grade: Z')
  })
})

describe('semesterGPA', () => {
  it('computes weighted GPA across courses', () => {
    const result = semesterGPA([
      { units: 3, grade: 'A' },
      { units: 2, grade: 'C' },
    ])
    expect(result.totalUnits).toBe(5)
    expect(result.totalPoints).toBe(3 * 5 + 2 * 3)
    expect(result.gpa).toBeCloseTo((3 * 5 + 2 * 3) / 5)
  })

  it('returns a 0 GPA for an empty course list instead of dividing by zero', () => {
    const result = semesterGPA([])
    expect(result.totalUnits).toBe(0)
    expect(result.totalPoints).toBe(0)
    expect(result.gpa).toBe(0)
  })
})

describe('classify', () => {
  it('maps CGPA values to the correct classification band', () => {
    expect(classify(5.0)).toBe('First Class')
    expect(classify(4.5)).toBe('First Class')
    expect(classify(4.49)).toBe('Second Class Upper')
    expect(classify(3.5)).toBe('Second Class Upper')
    expect(classify(2.4)).toBe('Second Class Lower')
    expect(classify(1.5)).toBe('Third Class')
    expect(classify(1.0)).toBe('Pass')
    expect(classify(0.5)).toBe('Below Pass')
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/lib/cgpa.test.js`
Expected: FAIL — `src/lib/cgpa.js` does not exist yet.

- [ ] **Step 5: Implement the minimal code to make the tests pass**

Create `src/lib/cgpa.js`:

```js
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/cgpa.test.js`
Expected: PASS (8 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/cgpa.js src/lib/cgpa.test.js
git commit -m "feat: add CGPA grading math with Vitest coverage"
```

---

### Task 2: Cumulative CGPA, retake matching, and what-if math

**Files:**
- Modify: `src/lib/cgpa.js`
- Modify: `src/lib/cgpa.test.js`

**Interfaces:**
- Consumes: `pointsForGrade(grade)`, `semesterGPA(courses)`, `classify(cgpa)` from Task 1 (same file).
- Produces: `cumulativeStats(semesters: {id, level, semester, courses}[]): {rows, overallUnits, overallPoints, overallCGPA, classification}` where each `rows[i]` is `{semesterId, level, semester, label, gpa, cumulativeUnits, cumulativePoints, cgpaSoFar}`; `whatIfTarget({currentUnits, currentPoints, targetCgpa, remainingUnits}): {requiredAveragePoint, achievable, alreadyMet, error}`; `findPriorAttempts(code: string, semesters, excludeSemesterId): {semesterId, label, course}[]`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/cgpa.test.js`:

```js
import { cumulativeStats, whatIfTarget, findPriorAttempts } from './cgpa'

describe('cumulativeStats', () => {
  it('sorts semesters chronologically and tracks a running CGPA', () => {
    const semesters = [
      { id: 's2', level: '100', semester: 2, courses: [{ units: 3, grade: 'B', counts_toward_cgpa: true }] },
      { id: 's1', level: '100', semester: 1, courses: [{ units: 2, grade: 'A', counts_toward_cgpa: true }] },
    ]

    const result = cumulativeStats(semesters)

    expect(result.rows.map((r) => r.semesterId)).toEqual(['s1', 's2'])
    expect(result.rows[0].gpa).toBeCloseTo(5)
    expect(result.rows[1].cumulativeUnits).toBe(5)
    expect(result.overallCGPA).toBeCloseTo((2 * 5 + 3 * 4) / 5)
    expect(result.classification).toBe('Second Class Upper')
  })

  it('excludes courses flagged as not counting toward CGPA from cumulative totals but keeps them in that semester GPA', () => {
    const semesters = [
      {
        id: 's1',
        level: '300',
        semester: 1,
        courses: [
          { units: 3, grade: 'F', counts_toward_cgpa: false },
          { units: 2, grade: 'B', counts_toward_cgpa: true },
        ],
      },
    ]

    const result = cumulativeStats(semesters)

    expect(result.rows[0].gpa).toBeCloseTo((3 * 0 + 2 * 4) / 5)
    expect(result.overallUnits).toBe(2)
    expect(result.overallCGPA).toBeCloseTo(4)
  })
})

describe('whatIfTarget', () => {
  it('computes the average grade point needed on remaining units to hit a target CGPA', () => {
    const result = whatIfTarget({ currentUnits: 60, currentPoints: 216, targetCgpa: 3.8, remainingUnits: 20 })
    expect(result.requiredAveragePoint).toBeCloseTo(4.4)
    expect(result.achievable).toBe(true)
    expect(result.alreadyMet).toBe(false)
  })

  it('flags an unreachable target', () => {
    const result = whatIfTarget({ currentUnits: 60, currentPoints: 60, targetCgpa: 4.8, remainingUnits: 4 })
    expect(result.achievable).toBe(false)
  })

  it('flags when the target is already met', () => {
    const result = whatIfTarget({ currentUnits: 60, currentPoints: 60 * 4.5, targetCgpa: 4.0, remainingUnits: 20 })
    expect(result.alreadyMet).toBe(true)
    expect(result.requiredAveragePoint).toBe(0)
  })

  it('returns an error instead of dividing by zero when remaining units is 0', () => {
    const result = whatIfTarget({ currentUnits: 60, currentPoints: 180, targetCgpa: 4.0, remainingUnits: 0 })
    expect(result.error).toBeTruthy()
    expect(result.requiredAveragePoint).toBeNull()
  })
})

describe('findPriorAttempts', () => {
  it('finds earlier attempts of the same course code in other semesters, case/whitespace-insensitive', () => {
    const semesters = [
      { id: 's1', level: '300', semester: 1, courses: [{ id: 'c1', code: 'mme 301', units: 3, grade: 'F' }] },
      { id: 's2', level: '300', semester: 2, courses: [{ id: 'c2', code: 'MME  301', units: 3, grade: 'B' }] },
    ]

    const matches = findPriorAttempts('MME 301', semesters, 's2')

    expect(matches).toHaveLength(1)
    expect(matches[0].semesterId).toBe('s1')
    expect(matches[0].label).toBe('300L S1')
  })

  it('returns an empty array when there is no prior attempt', () => {
    const semesters = [{ id: 's1', level: '300', semester: 1, courses: [{ id: 'c1', code: 'MME 301', units: 3, grade: 'A' }] }]
    expect(findPriorAttempts('MME 303', semesters, 's1')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/cgpa.test.js`
Expected: FAIL — `cumulativeStats`, `whatIfTarget`, `findPriorAttempts` are not exported yet.

- [ ] **Step 3: Implement the minimal code to make the tests pass**

Append to `src/lib/cgpa.js`:

```js
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

export function findPriorAttempts(code, semesters, excludeSemesterId) {
  const target = normalizeCode(code)
  const matches = []

  for (const sem of semesters) {
    if (sem.id === excludeSemesterId) continue
    for (const course of sem.courses) {
      if (normalizeCode(course.code) === target) {
        matches.push({ semesterId: sem.id, label: `${sem.level}L S${sem.semester}`, course })
      }
    }
  }

  return matches
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/cgpa.test.js`
Expected: PASS (14 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cgpa.js src/lib/cgpa.test.js
git commit -m "feat: add cumulative CGPA, retake matching, and what-if math"
```

---

### Task 3: Supabase schema for semesters and courses

**Files:**
- None locally — this project has no `supabase/migrations` directory convention yet; apply directly via the Supabase MCP migration tool.

**Interfaces:**
- Produces: tables `public.cgpa_semesters` and `public.cgpa_courses` with RLS enabled, consumed by Task 4.

- [ ] **Step 1: Apply the migration**

Call `mcp__plugin_supabase_supabase__apply_migration` with `project_id: "ascdypvchlbpfupsssuy"`, `name: "create_cgpa_tables"`, and this `query`:

```sql
create table public.cgpa_semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('100','200','300','400','500')),
  semester smallint not null check (semester in (1,2)),
  created_at timestamptz not null default now(),
  unique (user_id, level, semester)
);

create table public.cgpa_courses (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.cgpa_semesters(id) on delete cascade,
  code text not null,
  title text,
  units smallint not null check (units between 1 and 6),
  grade text not null check (grade in ('A','B','C','D','E','F')),
  counts_toward_cgpa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cgpa_semesters enable row level security;
alter table public.cgpa_courses enable row level security;

create policy "Users manage their own semesters"
  on public.cgpa_semesters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage courses in their own semesters"
  on public.cgpa_courses
  for all
  using (
    exists (
      select 1 from public.cgpa_semesters s
      where s.id = cgpa_courses.semester_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cgpa_semesters s
      where s.id = cgpa_courses.semester_id and s.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Verify the tables and RLS**

Call `mcp__plugin_supabase_supabase__list_tables` with `project_id: "ascdypvchlbpfupsssuy"`, `schemas: ["public"]`, `verbose: true`.
Expected: both `cgpa_semesters` and `cgpa_courses` listed with the columns above.

Call `mcp__plugin_supabase_supabase__execute_sql` with `project_id: "ascdypvchlbpfupsssuy"` and query:

```sql
select relname, relrowsecurity from pg_class where relname in ('cgpa_semesters', 'cgpa_courses');
```

Expected: both rows show `relrowsecurity = true`.

- [ ] **Step 3: Commit**

No local files changed by this task — nothing to commit. Note the migration name (`create_cgpa_tables`) in the Task 4 commit message for traceability.

---

### Task 4: Supabase CRUD wrapper (`cgpaApi.js`)

**Files:**
- Create: `src/lib/cgpaApi.js`

**Interfaces:**
- Consumes: `supabase` client from `src/lib/supabaseClient.js`; schema from Task 3.
- Produces: `fetchSemesters(userId): Promise<{data: {id, level, semester, courses}[], error}>`, `addSemester({userId, level, semester}): Promise<{data, error}>`, `deleteSemester(semesterId): Promise<{error}>`, `addCourse({semesterId, code, title, units, grade}): Promise<{data, error}>`, `updateCourse(courseId, patch): Promise<{data, error}>`, `deleteCourse(courseId): Promise<{error}>`.

- [ ] **Step 1: Write the wrapper**

Create `src/lib/cgpaApi.js`:

```js
import { supabase } from './supabaseClient'

export async function fetchSemesters(userId) {
  const { data, error } = await supabase
    .from('cgpa_semesters')
    .select('id, level, semester, cgpa_courses(id, code, title, units, grade, counts_toward_cgpa)')
    .eq('user_id', userId)

  if (error) return { data: null, error }

  const semesters = data.map((row) => ({
    id: row.id,
    level: row.level,
    semester: row.semester,
    courses: row.cgpa_courses,
  }))

  return { data: semesters, error: null }
}

export async function addSemester({ userId, level, semester }) {
  return supabase
    .from('cgpa_semesters')
    .insert({ user_id: userId, level, semester })
    .select()
    .single()
}

export async function deleteSemester(semesterId) {
  return supabase.from('cgpa_semesters').delete().eq('id', semesterId)
}

export async function addCourse({ semesterId, code, title, units, grade }) {
  return supabase
    .from('cgpa_courses')
    .insert({ semester_id: semesterId, code, title: title || null, units, grade })
    .select()
    .single()
}

export async function updateCourse(courseId, patch) {
  return supabase.from('cgpa_courses').update(patch).eq('id', courseId).select().single()
}

export async function deleteCourse(courseId) {
  return supabase.from('cgpa_courses').delete().eq('id', courseId)
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors from `src/lib/cgpaApi.js`.

- [ ] **Step 3: Commit**

This wrapper requires an authenticated browser session to exercise meaningfully — it's verified manually once wired into the page in Task 8, the same way Login/Signup/ResetPassword have no automated coverage in this repo.

```bash
git add src/lib/cgpaApi.js
git commit -m "feat: add Supabase CRUD wrapper for CGPA semesters and courses"
```

---

### Task 5: Chart coordinate math (`chartMath.js`)

**Files:**
- Create: `src/lib/chartMath.js`
- Create: `src/lib/chartMath.test.js`

**Interfaces:**
- Produces: `buildChartPoints(rows: {label, gpa, cgpaSoFar}[], {width, height, padding}): {label, x, gpaY, cgpaY, gpa, cgpaSoFar}[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chartMath.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildChartPoints } from './chartMath'

describe('buildChartPoints', () => {
  it('returns an empty array for no data', () => {
    expect(buildChartPoints([], { width: 400, height: 200 })).toEqual([])
  })

  it('places a single point at the left padding edge', () => {
    const [point] = buildChartPoints([{ label: '100L S1', gpa: 5, cgpaSoFar: 5 }], {
      width: 400,
      height: 200,
      padding: 20,
    })
    expect(point.x).toBe(20)
    expect(point.gpaY).toBe(20)
  })

  it('spreads multiple points evenly across the inner width and maps GPA 0 to the bottom', () => {
    const points = buildChartPoints(
      [
        { label: '100L S1', gpa: 0, cgpaSoFar: 0 },
        { label: '100L S2', gpa: 5, cgpaSoFar: 5 },
      ],
      { width: 220, height: 120, padding: 10 }
    )

    expect(points[0].x).toBe(10)
    expect(points[1].x).toBe(210)
    expect(points[0].gpaY).toBe(110)
    expect(points[1].gpaY).toBe(10)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/chartMath.test.js`
Expected: FAIL — `src/lib/chartMath.js` does not exist yet.

- [ ] **Step 3: Implement the minimal code to make the tests pass**

Create `src/lib/chartMath.js`:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/chartMath.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/chartMath.js src/lib/chartMath.test.js
git commit -m "feat: add pure coordinate math for the CGPA trend chart"
```

---

### Task 6: Trend chart component

**Files:**
- Create: `src/components/cgpa/TrendChart.jsx`

**Interfaces:**
- Consumes: `buildChartPoints` from `src/lib/chartMath.js` (Task 5).
- Produces: default-exported `TrendChart({ rows })` component, where `rows` matches `cumulativeStats().rows` shape (`{label, gpa, cgpaSoFar}`). Renders `null` when fewer than 2 rows are given.

- [ ] **Step 1: Write the component**

Create `src/components/cgpa/TrendChart.jsx`:

```jsx
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
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors from `src/components/cgpa/TrendChart.jsx`.

- [ ] **Step 3: Commit**

Visual verification happens once this is wired into the page in Task 9 (a component with no page can't be viewed in the browser yet).

```bash
git add src/components/cgpa/TrendChart.jsx
git commit -m "feat: add CGPA trend chart component"
```

---

### Task 7: CGPA page skeleton — auth gate, read-only data, routing

**Files:**
- Create: `src/pages/Cgpa.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Navbar.jsx`

**Interfaces:**
- Consumes: `useAuth()` from `src/lib/AuthContext.jsx`; `fetchSemesters` from `src/lib/cgpaApi.js` (Task 4); `cumulativeStats` from `src/lib/cgpa.js` (Task 2); `Button`, `Card`, `Badge`, `Table` from `src/components/ui/*`.
- Produces: `/cgpa` route rendering a read-only summary of the signed-in user's semesters; "CGPA" nav link.

- [ ] **Step 1: Write the page skeleton**

Create `src/pages/Cgpa.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchSemesters } from '../lib/cgpaApi'
import { cumulativeStats } from '../lib/cgpa'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'

export default function Cgpa() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [semesters, setSemesters] = useState([])
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let cancelled = false

    fetchSemesters(user.id).then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setFormError(error.message)
      } else {
        setSemesters(data)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  if (authLoading || loading) {
    return null
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
          CGPA calculator
        </div>
        <h1 className="mt-1.5 text-[32px]">Sign in to track your CGPA</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Your grades are saved to your account so they follow you across devices.
        </p>
        <Button variant="primary" className="mt-6" onClick={() => navigate('/login')}>
          Sign in
        </Button>
      </div>
    )
  }

  const stats = cumulativeStats(semesters)

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        CGPA calculator
      </div>
      <h1 className="mt-1.5 text-[32px]">Your academic record</h1>

      {formError && (
        <p className="mt-4 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">{formError}</p>
      )}

      <Card className="mt-6" tone="green" eyebrow="Cumulative GPA" title={stats.overallCGPA.toFixed(2)}>
        <Badge tone="new">{stats.classification}</Badge>
        <span className="ml-2 font-mono text-sm text-white/80">{stats.overallUnits} units completed</span>
      </Card>

      <div className="mt-8 flex flex-col gap-6">
        {stats.rows.map((row) => {
          const semester = semesters.find((s) => s.id === row.semesterId)
          return (
            <div key={row.semesterId}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-xl">{row.label}</h2>
                <span className="font-mono text-sm text-ink-muted">GPA {row.gpa.toFixed(2)}</span>
              </div>
              <Table
                columns={['Code', 'Title', 'Units', 'Grade']}
                rows={semester.courses.map((c) => [c.code, c.title || '—', c.units, c.grade])}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the route**

In `src/App.jsx`, add the import alongside the other page imports:

```js
import Cgpa from './pages/Cgpa'
```

Add the route inside `<Route element={<Layout />}>`, next to the `outlines` route:

```jsx
<Route path="cgpa" element={<Cgpa />} />
```

- [ ] **Step 3: Add the nav link**

In `src/components/Navbar.jsx`, add to the `links` array, right after the Outlines entry:

```js
{ to: '/cgpa', label: 'CGPA' },
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`

- Signed out: visit `/cgpa` → expect the "Sign in to track your CGPA" prompt with a working "Sign in" button that navigates to `/login`.
- Sign in with an existing account, visit `/cgpa` → expect the page to load with "0.00" CGPA, a "Below Pass" badge, "0 units completed", and no semester sections (this is expected — adding semesters/courses arrives in Task 8).

- [ ] **Step 6: Commit**

```bash
git add src/pages/Cgpa.jsx src/App.jsx src/components/Navbar.jsx
git commit -m "feat: add read-only CGPA page skeleton with routing"
```

---

### Task 8: Add/edit/delete semesters and courses, with retake handling

**Files:**
- Modify: `src/pages/Cgpa.jsx`

**Interfaces:**
- Consumes: `addSemester`, `deleteSemester`, `addCourse`, `updateCourse`, `deleteCourse` from `src/lib/cgpaApi.js` (Task 4); `findPriorAttempts` from `src/lib/cgpa.js` (Task 2); `FormField` from `src/components/ui/FormField.jsx`.
- Produces: fully interactive CRUD on `/cgpa` — this is the page other students would actually use to build their record.

- [ ] **Step 1: Replace `src/pages/Cgpa.jsx` with the interactive version**

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import {
  fetchSemesters,
  addSemester,
  deleteSemester,
  addCourse,
  updateCourse,
  deleteCourse,
} from '../lib/cgpaApi'
import { cumulativeStats, findPriorAttempts } from '../lib/cgpa'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'
import FormField from '../components/ui/FormField'

const LEVELS = ['100', '200', '300', '400', '500']
const SEMESTERS = [1, 2]
const GRADES = ['A', 'B', 'C', 'D', 'E', 'F']

export default function Cgpa() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [semesters, setSemesters] = useState([])
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')

  const [newLevel, setNewLevel] = useState(LEVELS[0])
  const [newSemesterNum, setNewSemesterNum] = useState(SEMESTERS[0])

  const [courseDrafts, setCourseDrafts] = useState({})

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let cancelled = false

    fetchSemesters(user.id).then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setFormError(error.message)
      } else {
        setSemesters(data)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  const stats = useMemo(() => cumulativeStats(semesters), [semesters])

  const existingKeys = useMemo(
    () => new Set(semesters.map((s) => `${s.level}-${s.semester}`)),
    [semesters]
  )

  function draftFor(semesterId) {
    return courseDrafts[semesterId] || { code: '', title: '', units: '3', grade: 'A' }
  }

  function setDraft(semesterId, patch) {
    setCourseDrafts((prev) => ({ ...prev, [semesterId]: { ...draftFor(semesterId), ...patch } }))
  }

  async function handleAddSemester(event) {
    event.preventDefault()
    setFormError('')

    if (existingKeys.has(`${newLevel}-${newSemesterNum}`)) {
      setFormError('That semester has already been added.')
      return
    }

    const { data, error } = await addSemester({ userId: user.id, level: newLevel, semester: newSemesterNum })

    if (error) {
      setFormError(error.message)
      return
    }

    setSemesters((prev) => [...prev, { ...data, courses: [] }])
  }

  async function handleDeleteSemester(semesterId) {
    setFormError('')
    const { error } = await deleteSemester(semesterId)

    if (error) {
      setFormError(error.message)
      return
    }

    setSemesters((prev) => prev.filter((s) => s.id !== semesterId))
  }

  async function handleAddCourse(semesterId, event) {
    event.preventDefault()
    setFormError('')

    const draft = draftFor(semesterId)
    const units = Number(draft.units)

    if (!draft.code.trim()) {
      setFormError('Enter a course code.')
      return
    }
    if (!Number.isInteger(units) || units < 1 || units > 6) {
      setFormError('Units must be a whole number between 1 and 6.')
      return
    }

    const { data, error } = await addCourse({
      semesterId,
      code: draft.code.trim(),
      title: draft.title.trim(),
      units,
      grade: draft.grade,
    })

    if (error) {
      setFormError(error.message)
      return
    }

    setSemesters((prev) =>
      prev.map((s) => (s.id === semesterId ? { ...s, courses: [...s.courses, data] } : s))
    )
    setCourseDrafts((prev) => ({ ...prev, [semesterId]: { code: '', title: '', units: '3', grade: 'A' } }))
  }

  async function handleExcludeFromCgpa(courseId) {
    setFormError('')
    const { error } = await updateCourse(courseId, { counts_toward_cgpa: false })

    if (error) {
      setFormError(error.message)
      return
    }

    setSemesters((prev) =>
      prev.map((s) => ({
        ...s,
        courses: s.courses.map((c) => (c.id === courseId ? { ...c, counts_toward_cgpa: false } : c)),
      }))
    )
  }

  async function handleDeleteCourse(semesterId, courseId) {
    setFormError('')
    const { error } = await deleteCourse(courseId)

    if (error) {
      setFormError(error.message)
      return
    }

    setSemesters((prev) =>
      prev.map((s) => (s.id === semesterId ? { ...s, courses: s.courses.filter((c) => c.id !== courseId) } : s))
    )
  }

  if (authLoading || loading) {
    return null
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
          CGPA calculator
        </div>
        <h1 className="mt-1.5 text-[32px]">Sign in to track your CGPA</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Your grades are saved to your account so they follow you across devices.
        </p>
        <Button variant="primary" className="mt-6" onClick={() => navigate('/login')}>
          Sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        CGPA calculator
      </div>
      <h1 className="mt-1.5 text-[32px]">Your academic record</h1>

      {formError && (
        <p className="mt-4 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">{formError}</p>
      )}

      <Card className="mt-6" tone="green" eyebrow="Cumulative GPA" title={stats.overallCGPA.toFixed(2)}>
        <Badge tone="new">{stats.classification}</Badge>
        <span className="ml-2 font-mono text-sm text-white/80">{stats.overallUnits} units completed</span>
      </Card>

      <div className="mt-8 flex flex-col gap-6">
        {stats.rows.length === 0 && (
          <p className="text-ink-muted">No semesters yet — add your first one below.</p>
        )}

        {stats.rows.map((row) => {
          const semester = semesters.find((s) => s.id === row.semesterId)
          const draft = draftFor(semester.id)
          const matches = draft.code.trim() ? findPriorAttempts(draft.code, semesters, semester.id) : []

          return (
            <div key={semester.id}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-xl">{row.label}</h2>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-ink-muted">GPA {row.gpa.toFixed(2)}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteSemester(semester.id)}>
                    Remove semester
                  </Button>
                </div>
              </div>

              {semester.courses.length === 0 ? (
                <p className="text-sm text-ink-muted">No courses yet — add one below.</p>
              ) : (
                <Table
                  columns={['Code', 'Title', 'Units', 'Grade', 'Counts toward CGPA', '']}
                  rows={semester.courses.map((c) => [
                    c.code,
                    c.title || '—',
                    c.units,
                    c.grade,
                    c.counts_toward_cgpa ? 'Yes' : 'No',
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCourse(semester.id, c.id)}>
                      Delete
                    </Button>,
                  ])}
                />
              )}

              {matches.length > 0 && (
                <div className="mt-3 rounded-sm bg-orange-100 p-3 text-sm text-ink">
                  <p>You&rsquo;ve taken this course before:</p>
                  {matches.map((m) => (
                    <div key={m.course.id} className="mt-1 flex items-center justify-between gap-3">
                      <span>
                        {m.label} &middot; grade {m.course.grade}
                        {m.course.counts_toward_cgpa === false ? ' (already excluded)' : ''}
                      </span>
                      {m.course.counts_toward_cgpa !== false && (
                        <Button variant="secondary" size="sm" onClick={() => handleExcludeFromCgpa(m.course.id)}>
                          Exclude that attempt from CGPA
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => handleAddCourse(semester.id, e)}
                className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end"
              >
                <FormField
                  label="Code"
                  value={draft.code}
                  onChange={(e) => setDraft(semester.id, { code: e.target.value })}
                  placeholder="MME 301"
                />
                <FormField
                  label="Title"
                  value={draft.title}
                  onChange={(e) => setDraft(semester.id, { title: e.target.value })}
                  placeholder="Optional"
                />
                <FormField
                  label="Units"
                  type="number"
                  value={draft.units}
                  onChange={(e) => setDraft(semester.id, { units: e.target.value })}
                />
                <FormField
                  label="Grade"
                  type="select"
                  options={GRADES}
                  value={draft.grade}
                  onChange={(e) => setDraft(semester.id, { grade: e.target.value })}
                />
                <Button variant="secondary" type="submit">
                  Add course
                </Button>
              </form>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleAddSemester} className="mt-8 flex flex-wrap items-end gap-3">
        <FormField
          label="Level"
          type="select"
          options={LEVELS}
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value)}
        />
        <FormField
          label="Semester"
          type="select"
          options={SEMESTERS.map(String)}
          value={String(newSemesterNum)}
          onChange={(e) => setNewSemesterNum(Number(e.target.value))}
        />
        <Button variant="primary" type="submit">
          Add semester
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, sign in, go to `/cgpa`:

- Add "100" / semester 1 → expect a new "100L S1" section with an empty-courses message and an add-course form.
- Add a course `MME 101`, units `2`, grade `A` → expect it to appear in the table, semester GPA to read `5.00`, and the top CGPA card to read `5.00` / "First Class" / "2 units completed".
- Add a second semester "100" / semester 2, add a course with grade `C`, units `3` → expect the CGPA card to recompute across both semesters.
- In the 100L S2 add-course form, type code `MME 101` (matching the 100L S1 course) → expect the "You've taken this course before" banner to appear with an "Exclude that attempt from CGPA" button; click it → expect the 100L S1 row's "Counts toward CGPA" column to flip to "No" and the CGPA card to recompute without those units/points.
- Click "Delete" on a course row → expect it to disappear and the GPA/CGPA to recompute.
- Click "Remove semester" → expect the whole section to disappear.
- Refresh the page → expect all remaining data to reload from Supabase exactly as left.
- Try adding "100" / semester 1 again after having removed it and re-added — and try adding a level/semester combination that already exists → expect the friendly "That semester has already been added." error.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Cgpa.jsx
git commit -m "feat: add semester/course CRUD and retake handling to the CGPA page"
```

---

### Task 9: What-if simulator and trend chart

**Files:**
- Modify: `src/pages/Cgpa.jsx`

**Interfaces:**
- Consumes: `whatIfTarget` from `src/lib/cgpa.js` (Task 2); `TrendChart` from `src/components/cgpa/TrendChart.jsx` (Task 6).
- Produces: the complete CGPA calculator feature.

- [ ] **Step 1: Add the chart and what-if panel to `src/pages/Cgpa.jsx`**

Add to the imports at the top:

```js
import { cumulativeStats, findPriorAttempts, whatIfTarget } from '../lib/cgpa'
import TrendChart from '../components/cgpa/TrendChart'
```

(This replaces the existing `import { cumulativeStats, findPriorAttempts } from '../lib/cgpa'` line — add `whatIfTarget` to it instead of duplicating the import.)

Add new state, alongside the existing `courseDrafts` state:

```js
const [targetCgpa, setTargetCgpa] = useState('')
const [remainingUnits, setRemainingUnits] = useState('')
```

Add the derived what-if result, alongside the existing `stats`/`existingKeys` `useMemo` calls:

```js
const whatIf = useMemo(() => {
  const target = Number(targetCgpa)
  const remaining = Number(remainingUnits)

  if (!targetCgpa || !remainingUnits || Number.isNaN(target) || Number.isNaN(remaining)) {
    return null
  }

  return whatIfTarget({
    currentUnits: stats.overallUnits,
    currentPoints: stats.overallPoints,
    targetCgpa: target,
    remainingUnits: remaining,
  })
}, [targetCgpa, remainingUnits, stats.overallUnits, stats.overallPoints])
```

Insert the trend chart right after the CGPA summary `Card` and before the `<div className="mt-8 flex flex-col gap-6">` semesters list:

```jsx
{stats.rows.length >= 2 && (
  <div className="mt-6">
    <TrendChart rows={stats.rows} />
  </div>
)}
```

Insert the what-if panel after the "Add semester" `<form>`, before the closing `</div>` of the page:

```jsx
<div className="mt-10 rounded-lg bg-orange-100 p-6">
  <h2 className="text-xl">What grade do I need?</h2>
  <p className="mt-1 text-sm text-ink-muted">
    Enter a target CGPA and how many units you have left to find your required average grade point.
  </p>
  <div className="mt-4 flex flex-wrap items-end gap-3">
    <FormField
      label="Target CGPA"
      type="number"
      value={targetCgpa}
      onChange={(e) => setTargetCgpa(e.target.value)}
      placeholder="4.50"
    />
    <FormField
      label="Remaining units"
      type="number"
      value={remainingUnits}
      onChange={(e) => setRemainingUnits(e.target.value)}
      placeholder="60"
    />
  </div>

  {whatIf && (
    <p className="mt-4 text-sm">
      {whatIf.error && <span className="text-danger">{whatIf.error}</span>}
      {!whatIf.error && whatIf.alreadyMet && (
        <span className="text-success">You&rsquo;ve already met that target.</span>
      )}
      {!whatIf.error && !whatIf.alreadyMet && !whatIf.achievable && (
        <span className="text-danger">
          Not achievable — even straight A&rsquo;s on your remaining units won&rsquo;t reach that target.
        </span>
      )}
      {!whatIf.error && !whatIf.alreadyMet && whatIf.achievable && (
        <span>
          You need an average grade point of <strong>{whatIf.requiredAveragePoint.toFixed(2)}</strong> on
          your remaining units.
        </span>
      )}
    </p>
  )}
</div>
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual end-to-end verification**

Run: `npm run dev`, sign in, go to `/cgpa`:

- With only one semester added, confirm the trend chart is not shown.
- Add a second semester with different grades, confirm the trend chart appears with a bar per semester (green) and an orange line/dots tracking running CGPA, labeled by semester (e.g. "100L S1", "100L S2").
- In the what-if panel, enter a target CGPA lower than your current CGPA → expect "You've already met that target."
- Enter a target CGPA slightly above current, with a reasonable remaining-units number → expect a specific required average grade point (double check by hand: `target * (currentUnits + remaining) - currentPoints) / remaining`).
- Enter a target CGPA of `5.0` with very few remaining units when current CGPA is low → expect "Not achievable...".
- Enter `0` remaining units → expect no crash and a friendly "Enter at least 1 remaining unit." error message (the `useMemo` still runs since the string `'0'` is truthy; `whatIfTarget`'s own `remainingUnits <= 0` guard is what produces the message).
- Sign out and back in (or open a private window and sign in) → confirm the full record (semesters, courses, retake exclusions) reloads from Supabase correctly.
- Run `npx vitest run` → expect all `cgpa.js` and `chartMath.js` tests still passing after this integration.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Cgpa.jsx
git commit -m "feat: add what-if target simulator and trend chart to CGPA page"
```
