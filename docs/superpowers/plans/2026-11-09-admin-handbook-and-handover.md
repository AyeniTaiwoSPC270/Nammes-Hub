# Admin Handbook and Executive Handover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 3.3 KB ADMIN.md with a handbook a new executive can run solo for a week, plus a repeatable handover checklist and in-app orientation — so August never again means "learn production by accident".

**Architecture:** ADMIN.md expands in place (structure below); supporting docs land in `docs/admin/`; the admin home gets a "First time?" orientation card linking out; no code rewrites.

**Tech Stack:** Markdown, the existing admin home page, the existing Remotion video explainer (link only).

**Spec:** `docs/superpowers/specs/2026-11-09-admin-handbook-and-handover-design.md`

## Global Constraints

- Every instruction must be followable by a non-engineer: click-paths, not file paths, in the "Tasks" sections; file paths only in the "Engineering appendix".
- No screenshots of real student data — use the staging fixture user (`fixture-student@nammeshub.test` semantics) when capturing admin screens.
- Single source of truth: link to ADMIN.md rather than duplicating content into the handover doc.

---

## Task 1: Expand ADMIN.md

Structure (target 500–700 lines):

1. **What the Hub is** (2 lines + link to README)
2. **Roles & least privilege** — owner vs admin (AAL2/TOTP); what each role can do (table: feature × role) from the actual guards in code.
3. **Everyday tasks** (top 25, click-paths): post news, publish event, upload resource, edit outline, feature a story, send broadcast (with quota note), schedule calendar reminder, review forms submissions, pin a form, award cards (reveal), manage applications, empty invite queue, export data (GDPR/NDPR), run restore drill reference, check backup status, interpret `/api/health`, reading UptimeRobot/Sentry alerts, flipping feature flags (broadcasts/CBT/battles), publishing a new handbook edition, rotating a secret, silencing an incident, rate-limit false positives.
4. **Emergency** — runbooks index (link), owner contacts, rollback command, "when in doubt: put the site in maintenance via flag, then call the owner".
5. **Monthly chores** — backup restore-drill check, cost note append, dependency merge, flag review, dead-code report.
6. **Glossary** — plain-English table (SLO, AAL2, RLS, outbox, CAS, RPC, pooler, burn rate, P75…).
7. **Index** — specs/plans cross-links.
8. **Engineering appendix** — env vars, deploy flow, migration policy, pooler URL, staging.

- [ ] Write it; verify every click-path on staging with the fixture admin account; record "last verified 2026-11" line at the top.

## Task 2: Handover checklist

**Files:** Create `docs/admin/handover.md`

Sections: **Incoming exec** (1) read ADMIN.md end-to-end (60–90 min), (2) shadow the outgoing exec for one real task of each category (content, people, emergencies), (3) accounts transferred: GitHub, Vercel, Supabase, Resend, Sentry, Upstash, UptimeRobot, Search Console — 2FA reset done **in person**, (4) secrets not emailed — the password manager is the transfer path, (5) walkthrough: post a test news item, send a test broadcast to self, verify CBT can open, (6) sign the checklist. **Outgoing exec**: clean the queue (pending broadcasts/forms/awards/applications), drop stale drafts, final cost + backup notes.

- [ ] Include a dated blank checklist at the bottom to print/sign.

## Task 3: In-app orientation

**Files:** Modify `src/pages/admin/AdminHomeContent.jsx` (the `/admin` landing route — verified in `src/App.jsx:299`)

- [ ] "First time here?" card (dismissible, localStorage `admin_onboarded_v1`): 6 steps — tour (2 min), read your role, send test broadcast to yourself, open staging, know the emergency path, add owner to contacts — each one line with a link (ADMIN.md section anchors / staging URL / video URL).
- [ ] Copy approved by owner before merge (one-line human check).

## Task 4: Video link

- [ ] Link the existing Remotion explainer (`video/` in repo or the GitHub Release `video-assets-v1` from the repo-hygiene plan; pick the Release URL once that plan runs — leave a `TODO(repo-hygiene)` if it hasn't landed) as "Watch the 4-minute tour" on the card and in ADMIN.md §1.

## Task 5: Verify + review

- [ ] Owner read-through session recorded in ADMIN.md header ("reviewed by X, 2026-11-..").
- [ ] Checklists print correctly (browser print → PDF sanity check).

## Rollback

Docs revert with git; the card is a localStorage-gated additive component — delete the import.
