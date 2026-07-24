# CGPA Calculator — Design

## Overview

A `/cgpa` page for NAMMES Hub letting a signed-in student build up their full academic record
(100L–500L, both semesters) and get: per-semester GPA, running CGPA, a degree classification
badge, a GPA/CGPA trend chart, retake/carryover handling, and a "what grade average do I need
to hit a target CGPA" simulator. Data is entered manually (not auto-filled from
`src/data/outlines.js`) and persisted to Supabase, tied to the signed-in account, so it survives
across devices and browser clears.

This is the first NAMMES Hub feature to use Supabase for anything beyond auth — no data tables
exist in the project yet.

## Grading rules

Constants live in one file (`src/lib/cgpa.js`) so they're easy to retune later:

- **Grade points (5.0 scale):** A=5, B=4, C=3, D=2, E=1, F=0
- **Classification bands:** First Class 4.50–5.00 · Second Class Upper 3.50–4.49 ·
  Second Class Lower 2.40–3.49 · Third Class 1.50–2.39 · Pass 1.00–1.49

## Data model (Supabase)

First tables in the project — RLS-scoped to the owning user throughout.

**`cgpa_semesters`**
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | → `auth.users`, cascade delete |
| `level` | text | `100`–`500` |
| `semester` | smallint | `1` or `2` |
| `created_at` | timestamptz | default `now()` |

Unique on `(user_id, level, semester)` — one record per semester of the program.

**`cgpa_courses`**
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `semester_id` | uuid | → `cgpa_semesters`, cascade delete |
| `code` | text | |
| `title` | text | optional |
| `units` | smallint | check `1–6` |
| `grade` | text | check in `A,B,C,D,E,F` |
| `counts_toward_cgpa` | boolean | default `true` |
| `created_at` | timestamptz | default `now()` |

RLS policies on both tables restrict select/insert/update/delete to rows whose semester belongs
to `auth.uid()`.

### Retake / carryover handling

A semester's own GPA always includes every course entered for that term, unmodified — it's a
historical record. CGPA sums only courses where `counts_toward_cgpa = true`.

When a student adds a course whose code matches one already entered in an earlier semester, the
UI surfaces that earlier attempt with a one-click "exclude from CGPA" toggle. This is explicit
and student-controlled rather than an auto-detected/silent exclusion rule, since course-code
matching on manually typed data is inherently fuzzy (typos, re-numbered courses, etc.).

## Architecture

- **`src/lib/cgpa.js`** — pure calculation functions, no React/Supabase dependency:
  grade→point map, classification lookup, `semesterGPA()`, cumulative-CGPA-so-far per semester
  (feeds the trend chart), and the what-if target calculation. Covered by Vitest unit tests.
- **`src/lib/cgpaApi.js`** — thin Supabase read/write layer: fetch all semesters+courses for the
  signed-in user; add/update/delete a semester; add/update/delete a course; toggle
  `counts_toward_cgpa`.
- **`src/pages/Cgpa.jsx`** — the page. Auth-gates via `useAuth()` (prompts sign-in if logged
  out). Loads all data once on mount into local state. Derives GPA/CGPA/classification/chart
  data with `useMemo` over `cgpa.js`. Calls `cgpaApi.js` for mutations and updates local state
  from the result.
- **`src/components/cgpa/TrendChart.jsx`** — small hand-rolled SVG chart (bars = semester GPA,
  line = running CGPA). No new charting dependency.

No global state or data-fetching library is introduced — local component state matches how the
rest of this app is built (no redux/react-query present anywhere today).

Routing: add `/cgpa` in `App.jsx`; add "CGPA" to the `links` array in `Navbar.jsx`.

## UI

Page shell matches existing simple pages (`Outlines`/`Events`): `mx-auto max-w-[880px]`,
eyebrow + `h1` header pattern.

- **Summary strip:** current CGPA (large), classification `Badge`, total units completed.
- **Trend chart:** shown once ≥2 semesters exist (a single point isn't a trend).
- **Per-semester sections**, ordered 100L→500L, S1→S2: a `Table` of courses (code, title,
  units, grade, retake toggle, delete) with an inline add-course row, and that semester's own
  GPA in the section header. An "Add semester" control (level + semester picker) is disabled/
  hidden for combinations already added.
- **What-if panel:** target CGPA + remaining units → required average grade point, with a clear
  "not mathematically achievable" message if it exceeds 5.0, or a congratulatory message if the
  target is already met.

## Error handling & edge cases

- Supabase failures surface via the same form-level error slot pattern used in
  Signup/ResetPassword (commit `c83ea81`), not a new error UI.
- Validation: units restricted to 1–6, grade restricted to the six letters, duplicate semester
  creation blocked by the DB unique constraint with a friendly message.
- Empty states for "no semesters yet" and "semester with no courses yet."
- What-if calc guards divide-by-zero when remaining units is 0.

## Testing

Vitest is added as the project's test framework (none exists today) — natural fit since the app
is already on Vite. `src/lib/cgpa.js` (grade points, semester GPA, cumulative CGPA,
classification lookup, what-if math) gets real unit tests since it's pure, side-effect-free
logic. `package.json` gains a `test` script and `vitest` as a dev dependency. UI flows
(add/edit/delete course, retake toggle, auth gating) are verified manually against the running
dev server rather than adding component-level test infra, to keep this addition scoped to the
calculation logic that actually benefits from it.
