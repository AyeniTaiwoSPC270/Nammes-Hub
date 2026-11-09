# Admin Handbook and Executive Handover

ADMIN.md is 3.3 KB and `/admin` runs an org — but executives rotate every session, and no systematic
handover means every August the new team learns production by accident.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Expanded ADMIN.md | Roles → least-privilege table (owner/admin per AAL2), top 25 tasks with click-paths + screenshots, emergency contacts |
| Handover checklist | `docs/admin/handover.md` — accounts, secrets transfer, pending broadcasts/forms/awards state, first-week walkthrough with outgoing exec |
| In-app help | `/admin` home gains "First time? 6-step orientation" linking to ADMIN.md + video (existing Remotion explainer) |
| Change-request flow | Document the propose→review→publish pipeline for non-technical execs |
| Glossary | Table of every admin term (SLO, AAL2, outbox, RLS…) in plain English |

### Out

- **Per-feature docs.** Those live in specs; the handbook indexes them.
- **Video re-production.** The explainer exists; link it.

---

## 2. The problem

The `/admin` surface covers calendar, banners, broadcasts, CBT, awards, outlines review, analytics — operated by undergraduates, often mid-exam-week, with no QA. A wrong broadcast or revealed award early is unrecoverable socially. Knowledge currently lives in one person's head.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Format | Handbook in-repo (ADMIN.md + `docs/admin/`) + printable single-page cheat sheet (PDF) | Survives device loss; laminated at handover |
| Screenshots | 25 task shots, refreshed each session handover (add to a checklist item) | Text-only rots |
| Orientation | Self-serve 6-step tour; completion tracked in `hub_feedback`-adjacent log? No — in a `app_config.admin_orientation_done` flag for simplicity | Cheap, effective |
| Handover cadence | August + January windows; calendar invite auto-created from the checklist | Process, not memory |

## 4. The change

Rewrite ADMIN.md (target 15–20 KB); add `docs/admin/handover.md` + `docs/admin/cheat-sheet.md`; `/admin` home card linking to it; PDF render via the existing handbook build pipeline; checklist owner = one named exec.

## 5. Verification

1. A never-used-it person (e.g., new 300-level volunteer) completes: publish a banner, open a quiz, read inbox — guided by handbook alone, ≤ 30 min.
2. Printed cheat sheet exists and is illegible-free at 100% zoom.
3. Handover checklist signed by both outgoing and incoming treasurers/presidents.

## 6. Risk

Docs rot faster than code — the handover checklist's first item is "verify the handbook matches reality today". Screenshots regenerate in the same pass.
