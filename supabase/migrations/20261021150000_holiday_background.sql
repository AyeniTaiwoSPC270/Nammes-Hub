-- The holiday page background: a theme may now paint the whole page behind the content — an uploaded
-- festive picture under a mode-adaptive wash, or a palette-gradient fallback — instead of the app's
-- plain bg-paper. Spec: docs/superpowers/specs/2026-10-21-holiday-page-background-design.md
--
-- `background` is jsonb { enabled, image }, judged entirely by sanitizeBackground() in
-- api/_lib/holidayTheme.js like every other jsonb half of a theme. The RPC returns `to_jsonb(t)`, so
-- the new key reaches the browser with no RPC change. The default is the feature OFF, so every
-- existing theme paints exactly what it painted before this migration ran.

alter table public.holiday_themes
  add column if not exists background jsonb not null default '{"enabled": false}'::jsonb;
