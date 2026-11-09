# Incident Response, Runbooks, and Exam-Week Protocol

There is no written runbook for "the site is down during CBT" — the highest-stakes scenario this product
will ever face — and no postmortem habit to convert incidents into hardened code.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Runbooks | `docs/runbooks/`: site-down, quiz-cannot-start, CBT-degraded, email-worker-stalled, db-locked |
| Exam-week protocol | War-room checklist for CBT windows: freeze deploys, staffed hours, rollback plan |
| Kill switches | `feature_flags` wiring: disable battles/CBT/practice instantly from `/admin` |
| Postmortem | Blameless template `docs/postmortems/TEMPLATE.md`; one written per SEV-1/2 |
| Comms | Pre-written student-facing banner copy for partial degradation |

### Out

- **On-call rotation tooling.** A two-admin phone tree is honest at this size.
- **Chaos engineering.** Premature; the exam protocol and drills cover the real risk.

---

## 2. The problem

The app renders thousands of student-hours per semester through time-critical flows (CBT attempts,
live quizzes at departmental events). `feature_flags` exists but is not documented as a kill-switch
system; the Maintenance page exists but there is no decision tree for when to use it.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Severity ladder | SEV-1 (site/CBT down), SEV-2 (degraded core), SEV-3 (minor) | Aligns response effort to impact |
| Rollback | `vercel rollback` to previous deployment; Supabase migration rollback = forward-fix migration. For data loss: restore the newest nightly dump into a scratch **free** project and copy back affected rows (see `2026-11-09-backup-and-restore-drill-design.md` — Supabase PITR is paid-only and is NOT assumed) | Vercel gives instant atomic rollback; DB never auto-rolls; free-tier recovery is real but slower — rehearse it |
| Kill switches | Flags checked at route-render (`App.jsx`) and API handler entry | One boolean stops a feature everywhere |
| Drills | One tabletop per exam window (30 min, two admins, scenario walk-through) | Rehearsed response beats documented response |
| Comms | Static `/maintenance` copy + Twitter/WhatsApp broadcast template | Students hear it from the department first |

## 4. The change

Write 5 runbooks (symptom → diagnose → mitigate → escalate → comms). Add `killSwitch(flag)` helper in
`src/lib/flags.js` (reads `feature_flags` via React Query, 30 s staleTime) checked in App routes and
in `cbt`/`quiz` handlers. Template postmortem committed. ADMIN.md gains the exam-week section.

## 5. Verification

1. Tabletop: inject "CBT submit 500s" — responders locate the runbook and name the rollback command in ≤ 5 min.
2. Flip `feature_flags.cbt_enabled=false` in staging → CBT routes show the maintenance banner within one staleTime.
3. Restore drill result linked from the runbook (see backup spec — it is free-tier and the only restore path that exists here).

## 6. Risk

Unused runbooks rot — tie one review per semester to the exam calendar. Kill switches must fail-open to
"available" during reads only if the flag table is unreachable, never fail-open on write paths.
