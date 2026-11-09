# Privacy-First Product Analytics and Experimentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A `funnel_events` spine (written only via a security-definer RPC) measuring the seven key funnel moments, a North Star card ("Weekly engaged students"), and A/B variant assignment via feature flags — no third-party SaaS, no IP, no PII.

**Architecture:** Mirror the `record_page_view()` one-writer pattern exactly: `record_funnel_event(p_event, p_props)` security definer, validated server-side, inserts only. Dashboard reads roll up via the `analytics_daily` table from the rollup plan or a new view. A/B variants hash `auth.uid()` deterministically client-side (read-only flag, no PII sent).

**Tech Stack:** SQL migrations, React Query, existing admin analytics page, `feature_flags`.

**Spec:** `docs/superpowers/specs/2026-11-09-privacy-first-analytics-design.md`

## Global Constraints

- One writer: `record_funnel_event()` only; PostgREST insert into `funnel_events` stays revoked.
- `props` jsonb keys are a closed set enforced in the function body (`enum`-style `case`) — never free-form.
- Events carry `user_id uuid` (nullable) only when the caller is authenticated; anon writes carry a session-scoped random `visitor` uuid like page_views. No IP, no UA, no email.
- No client-side measurement code may throw — all analytics calls are silent best-effort.

---

## Task 1: Migration

**Files:** Create `supabase/migrations/20261112090000_funnel_events.sql` + rollback

```sql
create table public.funnel_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  event text not null check (char_length(event) <= 60),
  props jsonb not null default '{}',
  user_id uuid references auth.users (id) on delete set null,  -- NULLABLE; never NOT NULL
  visitor text check (visitor is null or visitor ~ '^[0-9a-f-]{36}$')
);
create index funnel_events_at_idx on public.funnel_events (at);
create index funnel_events_event_at_idx on public.funnel_events (event, at);
alter table public.funnel_events enable row level security;
create policy funnel_events_select_admin on public.funnel_events
  for select to authenticated using ((select public.is_admin()));
revoke all on public.funnel_events from anon, authenticated;
grant select on public.funnel_events to authenticated;

create or replace function public.record_funnel_event(p_event text, p_props jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_visitor text; v_props jsonb := coalesce(p_props, '{}'::jsonb);
begin
  -- closed key set
  if not (v_props ? 'page' or v_props = '{}') then
    v_props := jsonb_build_object('page', left(coalesce(v_props->>'page',''), 120));
  end if;
  if p_event not in ('hub_view','outlines_open','cgpa_calculate','quiz_join','quiz_complete','cbt_submit','award_vote') then
    return;
  end if;
  insert into public.funnel_events (event, props, user_id, visitor)
  values (p_event, v_props, auth.uid(), nullif(current_setting('request.headers', true)::jsonb->>'x-visitor','')); -- pseudo: see Task 1b for client visitor transport
end $$;
```

- [ ] **Task 1b (resolve visitor transport):** match `page_views` — read `src/lib/pageViewTracker.js` for how `visitor` is generated client-side (sessionStorage random uuid) and passed as an RPC argument. Copy that: `record_funnel_event(p_event, p_props, p_visitor)` on both sides. Adjust the migration accordingly before applying.
- [ ] Apply to staging; rollback test: apply rollback, table drops cleanly.
- [ ] `npm test` (migrations.test.js ordering).

## Task 2: Client beacon

**Files:** Create `src/lib/funnelTracker.js`; modify `src/main.jsx` (or `App.jsx`)

- [ ] `const track = (event, props = {}) => { try { supabase.rpc('record_funnel_event', { p_event: event, p_props: props, p_visitor: getVisitorId() }); } catch {} }` — `getVisitorId()` shares the sessionStorage id with pageViewTracker (**Create** `src/lib/visitorId.js` — extract the sessionStorage id helper there and import it in both).
- [ ] Export `trackEvent` and call it at the 7 sites: Layout mount (`hub_view`), outlines detail open, CGPA `calculate` button, quiz join success, quiz complete screen mount, CBT submit success, award vote success.
- [ ] `hub_view` dedup: once per session (sessionStorage flag), like page_views' two-second guard but longer (per-session gate).

## Task 3: North Star + funnel card

- [ ] SQL: `funnel_summary(p_from date, p_to date)` RPC — returns jsonb: per-event counts, WAU distinct user_ids, "engaged" = distinct users with ≥3 events in the window, North Star = engaged / WAU.
- [ ] Admin analytics (`src/pages/admin/AdminAnalytics.jsx`): two cards — "Weekly engaged students: N (M% of actives)" and a 7-step funnel bar list (CSS bars, no new chart dep).
- [ ] Events feeding funnel bars link to nothing (no deep dives) — keeps it "directional, not forensic".

## Task 4: A/B variants (flags)

- [ ] Migration: `alter table public.feature_flags add column if not exists variant text;` (values e.g. `control`, `treatment`) — or keep variants as two boolean flags; prefer the column (single source). The flag-read helper (`useFeatureFlag`) is created by the incident-response plan at `src/data/featureFlags.js` — if it has not landed yet, this task creates nothing in that file and instead reads flags inline like `useReportsFlag` does (`src/data/reports.js`); revisit after that plan merges.
- [ ] **Create** `src/lib/abAssignment.js`: `assignVariant(userId, flagKey)` → sha256(`${flagKey}:${userId}`)[0] % 2 → `'control'|'treatment'` (pure, testable — write the test).
- [ ] Adopt in **one** flag first (new-outlines-layout) end-to-end; document the recipe in ADMIN.md for future flags.

## Task 5: Retention alignment (privacy spec)

- [ ] Extend `docs/privacy/inventory.md` (created by the data-governance plan) (from NDPR plan): add `funnel_events` row (class: behavioural-anonymous, lawful basis: legitimate interests, retention: 13 months — reuse the page_views sweep after extending it to funnel_events).
- [ ] Extend `retention-sweep.js` from the migration-hygiene plan to purge `funnel_events` in the same 13-month batch loop.

## Task 6: Verify

- [ ] Staging: exercise the 7 events; `select event, count(*) from funnel_events group by 1` shows them; admin dashboard renders the funnel; RLS blocks anon select (`anon` key → permission denied); North Star sane (0 is fine on empty).
- [ ] `npm test`/`lint`/`build`.

## Rollback

Rollback file drops table + function (destructive — data export first); client tracker is fire-and-forget and inert without the RPC.
