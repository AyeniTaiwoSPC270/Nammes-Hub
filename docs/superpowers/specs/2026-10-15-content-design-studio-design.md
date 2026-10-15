# Events & News Design Studio

A design studio that lets an admin restyle the `/events` and `/news` pages — accent, card treatment and layout — with named, reusable looks, exactly as the calendar, quiz, form and email studios already do. This is the fifth studio, and `calendar_looks` is the model.

**Status:** approved. **Date:** 2026-10-15. **Plan:** `docs/superpowers/plans/2026-10-15-content-design-studio.md`

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| `content_looks` | Named, reusable designs, one per page, saved and reapplied |
| `content_settings` | Singleton pointer row: which look is live per page, and whether Home adopts it |
| `contentTheme.js` | The pure sanitiser + `themeVars`, shared by studio, public pages and tests |
| `src/components/content/*` | The one renderer for event and news cards, used by the public pages, Home and the studio preview |
| Design tab on `/admin/events` and `/admin/news` | One shared studio body, two routes |
| `/events`, `/news`, their detail pages | Read the live look and render through the shared cards |
| `Home.jsx` news + events blocks | Adopt the look **only** when that page's `on_home` flag is true |

### Out

- **`page_banners`.** The hero at the top of both pages stays exactly where it is, edited at `/admin/banners`. The studio styles below the fold. Conflating them would drag in the known-broken `updatePageBanner` row (`AGENTS.md` § Known open bugs) for no gain.
- **The calendar.** `/calendar` keeps its own studio and its own owner-gated `calendar_looks`. A department event appearing on `/calendar` is merged there as *content*; it is never styled by this studio.
- **A new admin tile.** The studio is a tab on the two admin pages that already exist.
- **Per-item themes.** No `theme` column is added to `events` or `news`. See §2.
- **A Vercel function, a `feature_flags` key, an `apply_change_request` edit.** Nothing here needs one.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Unit of design | **Page-level look, named by a pointer row** | The look never lives on `events`/`news`, so nothing here touches `apply_change_request`, which enumerates those tables' columns explicitly (`20261009100000_calendar_review_queue.sql:37-67`). A new column would be silently dropped from every queued non-owner edit |
| Events vs news | **Two independent looks** | A timetable and a magazine are different objects. One shared look guarantees they match and forfeits that |
| Home | **Opt-in per page** | `Home.jsx` also renders awards, opportunities and announcements. It adopts a look only on its own news/events block, only when the flag is set, so the accent never leaks onto the rest of the page |
| Storage | **Two tables** — `content_looks` + `content_settings` | A look table alone cannot say which one is live. The calendar needed the same split (`20261009090000_calendar.sql:52-74`) |
| Write policy on `content_looks` | **Public read, admin write** | Public read is forced: `/news` is an anonymous page and reads through the anon key. Admin write because both admin screens are `reviewGated` and only owners can even write `events`/`news` rows today, so an owner-only look table would be one most admins cannot touch |
| Which tables to copy | **`form_looks`** for the look table, **`calendar_settings`** for the pointer row | The former carries the name-length check and the size cap; the latter carries the column-scoped update that keeps `id` from being repointed |
| Admin placement | **A Design tab on each existing admin page** | Chosen over one tabbed route. Events and News are already two separate tiles for a reason, so an admin finds the design where they find the content. Costs a tab list parameterised by page instead of a single `CALENDAR_TABS` |
| Studio body | **One shared component**, lazy in both routes, `page` as a prop | The shell, the controls and the preview are identical. Only the tab list and the previewed page differ |
| Colour | **Swatch id + Advanced hex**, copied from `calendarTheme.js` | Storing a token name rather than a hex is what makes the look dark-mode-safe for free |
| `SWATCHES` | **Copied, not imported, from `calendarTheme.js` | Importing couples two studios `AGENTS.md` says stay independent. Eight rows is not a real duplication |
| Preset vs live | **Fill the draft, never commit** | Holds across all four existing studios. Only email differs, because a style is chosen at send time |
| Icons | **No new Material Symbols names** | `calendar_today`, `arrow_forward`, `article`, `event_busy` are already in `index.html`'s `icon_names=`. Adding none keeps `src/lib/iconFont.test.js` green without touching `index.html` |

---

## 3. Data model

One migration, `supabase/migrations/20261015100000_content_looks.sql`, and its rollback `supabase/rollbacks/20261015100000_content_looks.rollback.sql` (drop both tables, per the convention every migration follows).

### 3.1 `content_looks`

```sql
create table public.content_looks (
  id text primary key,                    -- client-minted via generateId(), like calendar_looks
  page text not null check (page in ('events', 'news')),
  name text not null check (char_length(name) between 1 and 40),
  design jsonb not null default '{}'::jsonb
    check (jsonb_typeof(design) = 'object' and pg_column_size(design) < 4000),
  created_at timestamptz not null default now()
);
alter table public.content_looks enable row level security;

create policy content_looks_public_select on public.content_looks
  for select using (true);                       -- /news and /events read this anonymously
create policy content_looks_admin_insert on public.content_looks
  for insert with check ((select public.is_admin()));
create policy content_looks_admin_update on public.content_looks
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy content_looks_admin_delete on public.content_looks
  for delete using ((select public.is_admin()));
```

The `page` column is load-bearing, not bookkeeping: it stops an events look being made live on the news page, where `layout.featured` and `card.imageHeight` would either do nothing or do the wrong thing.

### 3.2 `content_settings`

```sql
create table public.content_settings (
  id smallint primary key default 1,
  events_look_id text references public.content_looks(id) on delete set null,
  news_look_id   text references public.content_looks(id) on delete set null,
  events_on_home boolean not null default false,
  news_on_home   boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint content_settings_singleton check (id = 1)
);
alter table public.content_settings enable row level security;
create policy content_settings_public_select on public.content_settings for select using (true);
create policy content_settings_admin_update on public.content_settings
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
```

`on delete set null` is what the calendar does by hand — `AdminCalendarDesign.jsx:152-173` clears `active_look_id` when the active look is deleted. A foreign key makes it impossible to delete a live look and leave the settings row pointing at nothing, so the page falls back to `DEFAULT_THEME` instead of rendering an empty shell.

Grants, copied from the two precedents and both traps called out in their comments: `revoke all` from `anon` and `authenticated` first, because `20260929071000_least_privilege_grants.sql:23` made a new table private to anon by default; then grant by name. `content_settings` gets a **column-scoped** update grant that omits `id`, so the singleton key cannot be repointed (`20261009090000_calendar.sql:159-161`).

MFA: `content_looks` is in the `admin_mfa_ok()` restrictive loop, as `form_looks` is (`20261013111000_form_looks.sql:33-41`). `content_settings` is not — it is two pointers and two booleans, and `calendar_settings` is treated the same way by omission rather than by a policy.

---

## 4. The theme

`api/_lib/contentTheme.js` — pure, no `window`, no Supabase, no `node:` built-ins, so the studio, the public pages and the tests all clean a value through the same function. `AGENTS.md`'s rule about which `api/_lib` files are allowed to break that rule does not apply here.

```js
export const DEFAULT_THEME = Object.freeze({
  accent: Object.freeze({ color: 'brand', hex: '' }),
  card:   Object.freeze({ radius: 'md', shadow: 'md', image: 'cover', density: 'comfortable' }),
  type:   Object.freeze({ titleSize: 'md', clamp: 3 }),
  layout: Object.freeze({
    page: 'news',                       -- echoed from the row, not trusted from the design
    columns: 3,
    featured: 'image-left',
    imageAspect: 'md',
    stagger: true,
  }),
})
```

### 4.1 Why every key is CSS-variable-driven, not Tailwind

Tailwind classes are static strings, so `grid-cols-3` cannot read a setting. The scale maps therefore hold **CSS values**, exactly as `calendarTheme.js:37-39` holds `RADIUS_PX`/`CELL_MIN`/`ROW_PAD`:

```js
const RADIUS_PX    = { sm: '4px', md: '8px', lg: '12px', full: '9999px' }
const SHADOW_PX    = {
  none: 'none',
  sm:   '0 1px 2px rgb(0 0 0 / 0.06)',
  md:   '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
  lg:   '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
}
const PAD_PX       = { compact: '16px', comfortable: '24px', spacious: '32px' }
const TITLE_PX     = { sm: '18px', md: '20px', lg: '24px', xl: '28px' }
const ASPECT_RATIO = { short: '1 / 1', md: '4 / 3', tall: '3 / 4', portrait: '9 / 16' }
```

The allow-lists, in full, so there is no guessing at implementation time:

| Key | Allowed | Clamp |
|---|---|---|
| `accent.color` | `SWATCHES` ids, plus a `#rrggbb` in `accent.hex` | — |
| `card.radius` | `sm md lg full` | — |
| `card.shadow` | `none sm md lg` | — |
| `card.image` | `cover plain none` — `cover` is `BlurredBackdropImage`, `plain` is a lazy `<img>`, `none` ignores `image_url` | — |
| `card.density` | `compact comfortable spacious` | — |
| `type.titleSize` | `sm md lg xl` | — |
| `type.clamp` | integer | 2–6 |
| `layout.page` | `events news` | — |
| `layout.columns` | integer | 1–4 |
| `layout.featured` | `none image-left image-top` (news only) | — |
| `layout.imageAspect` | `short md tall portrait` | — |
| `layout.stagger` | boolean | — |

`themeVars(theme)` returns:

```
--content-accent      colorVar(color, hex)      var(--content-radius)      var(--content-shadow)
--content-pad         var(--content-title)      var(--content-clamp)       var(--content-aspect)
--content-cols        var(--content-featured)
```

and repoints `--color-brand` and `--color-green-900` at `--content-accent`, so the existing `text-brand-orange` in `Card.jsx:5-6` and `News.jsx:53` follow the look without being touched. The calendar's guard is copied verbatim in spirit: a mapping is emitted only when it does something, because naming a token as its own value is a custom-property cycle and CSS drops the whole chain to its initial value (`calendarTheme.js:200-206`).

`colorVar` returns `hex || var(--swatch-token)`. A hex does **not** survive dark mode, which is why the swatch id is the primary field and the hex is the escape hatch — the same trade the calendar already made.

### 4.2 The small CSS block

A dozen lines in `src/index.css`, because a custom property cannot set `grid-template-columns` or `aspect-ratio` on its own:

```css
.content-grid  { display: grid; gap: 1.25rem; grid-template-columns: repeat(var(--content-cols, 3), minmax(0, 1fr)); }
.content-image { aspect-ratio: var(--content-aspect, 4 / 3); }
```

plus two media queries that pin `.content-grid` to 1 column under `sm` and 2 under `lg`, so the desktop column setting never makes a phone scroll sideways.

### 4.3 `sanitizeTheme(input, page)`

`sanitizeTheme` takes the page as its second argument, on the model of `sanitizeTheme(look.design, { quizId })`. Anything goes in; a complete, renderable, **page-appropriate** theme comes out.

- `oneOf` over each allow-list, `int(value, min, max, fallback)` for `clamp` (2–6) and `columns` (1–4) — only real finite numbers, because a numeric string from a query param is not a setting.
- `bool` for `stagger`, because `Boolean('false')` is true.
- `cleanAccent` copied from `calendarTheme.js:101-109` including the long comment: the hex is kept **alongside** the swatch id, or re-sanitising the draft on every render would strip it and the admin's Advanced colour would vanish on the next click.
- `page: 'events'` cleans `layout.featured` back to `'none'` and forces `card.image` away from `'none'`. An events page with no images is a list of text; an events page with a featured card has nothing to feature, since events are grouped by date, not by importance.
- The return is a literal, so **unknown keys are dropped** — a hand-edited row cannot smuggle a class name into a theme.

---

## 5. One renderer, three consumers

This is the part that makes the rest trustworthy, and it is the `quizCharacterArt.js` lesson applied to markup: **the studio preview must render the same components the public page renders**, or the preview is a drawing of a page that does not exist.

Today there are three card renderers and none of them agree:

| Where | What it uses |
|---|---|
| `/events` | `EventCard`, hand-written inside `Events.jsx:14-36` |
| `/news` | hand-written `Link` markup, twice, inside `News.jsx:82-101` and `:105-130` |
| `Home.jsx` news | the generic `ui/Card` with `tone={item.tone}` |
| `Home.jsx` events | a fourth copy of the event markup, inline at `Home.jsx:204-217` |

So `src/components/content/` gains three components, and the four call sites collapse onto them:

- **`EventCard.jsx`** — one `event` prop, reads the look from CSS vars on its wrapper. Takes `tone` from `event.tone`.
- **`NewsCard.jsx`** — one `item` prop, reads the look from CSS vars.
- **`NewsFeatureCard.jsx`** — `layout: 'image-left' | 'image-top' | 'none'`, driven by `theme.layout.featured`.

**This is a behaviour change on Home and it is intentional.** `Home.jsx`'s news cards currently render through `ui/Card`, which takes a per-item `tone`; `NewsCard` keeps `tone` so that is preserved. The change is that Home's cards now follow the look when the flag is on, which is the only way "apply to Home" can mean anything.

It also **resolves a half-finished thing rather than adding one.** `news.tone` is stored and admin-editable at `/admin/news` but only read on `Home.jsx:125` — an admin who sets it sees no change on the page they set it on. Once `/news` and Home share `NewsCard`, `news.tone` reads the same in both places. `events.tone` is read nowhere at all today; `EventCard` gives it its first consumer, which costs one prop and fixes an admin-facing dead end.

`EventDetail.jsx`, `NewsDetail.jsx` and the two list pages take the look unconditionally. A reader who clicks through from a restyled card and lands on an unstyled page has been told the restyle is broken.

Be precise about how little a detail page has to honour, though: a `NewsDetail` has no card, no grid and no featured slot, so the only two things the look can reach there are the **accent** on the category eyebrow (`NewsDetail.jsx:46`) and the **radius** on the hero image. `themeVars` goes on the article wrapper, which is inside the page's own container — not on the page root — so the breadcrumb, the back button and the nav keep their own colours. An admin is told nothing about the detail pages in the studio's copy, because there is nothing there to promise.

---

## 6. The studio

`src/pages/admin/ContentDesign.jsx`, exporting `ContentDesignBody` as a **named export** because both routes load it through `React.lazy`.

```
/admin/events?tab=list|design
/admin/news?tab=list|design
```

`src/lib/adminContentTabs.js` exports `CONTENT_TABS`, `DEFAULT_CONTENT_TAB = 'list'` and `normalizeContentTab(value)` — exact-match, falling back to `'list'` on anything else — mirroring `src/lib/adminCalendarTabs.js`. It stays react-router-free so the tests can read it without a router.

`AdminEvents.jsx` and `AdminNews.jsx` become the same shape `AdminCalendar.jsx` is: read `tab` from `useSearchParams`, keep the existing `AdminResourceManager` eager, `React.lazy` the design body, one `role="tabpanel"`, and `setSearchParams({ tab }, { replace: true })` so Back leaves the page.

The body copies `AdminCalendarDesign.jsx`'s three-column shape — `lg:grid-cols-[240px_360px_minmax(0,1fr)]` — with three control tabs, **accent / card / layout**, built from the shared primitives in `src/components/admin/forms/DesignControls.jsx` (`ColorField`, `ControlSection`, `Segmented`, `Slider`, `ToggleIcon`).

Specifics carried over from the calendar studio:

- **The draft is raw; `theme = sanitizeTheme(draft, page)` is derived for display only** (`AdminCalendarDesign.jsx:91-94`). Cleaning in place would drop an Advanced hex the moment another control was touched.
- `dirty` is `JSON.stringify(theme) !== JSON.stringify(base)`.
- **Seeding** opens on the page's live look id, falling back to the first saved look, so the studio starts from what visitors actually see.
- **Day-sheet equivalent:** none here, but the preview must not be scroll-locked or clickable in a way that steals the controls.
- **The dark toggle** only appears while the site theme is light, because `.dark` is the only dark definition in the codebase (`src/index.css:51`); on a dark site it says "Showing the dark palette".
- **No owner gating.** Every button here is admin-write, matching `form_looks` and `quiz_looks`. The calendar studio's `useOwnAdminRowQuery` banner does not apply and must not be copied.

Three actions, unchanged in meaning from all four existing studios:

| Action | Writes | Toast |
|---|---|---|
| **Save design** | `content_looks.design` on the selected row, sanitised in and out | — |
| **Save as new design** | a new `{ id: generateId(name), page, name, design }` | "It is not live until you make it the active design." |
| **Make live** | `content_settings.<page>_look_id` | — |
| **Apply to Home** | `content_settings.<page>_on_home` | states plainly which block of Home is affected |

Rename sends the design with the name, because the row is written whole and this avoids a read-back round trip (`AdminCalendarDesign.jsx:138-150`).

### 6.1 Wiring

`src/data/contentLooks.js` — its **own** module, not folded into `events.js` or `news.js`. `AGENTS.md` records that four studios with four tables and four sanitisers is deliberate; a fifth shares the rule, not the file.

```js
useContentLooksQuery(page)     useContentSettingsQuery()
saveContentLook({id, page, name, design})   deleteContentLook(id)
saveContentSettings({ events_look_id, events_on_home, news_look_id, news_on_home })
usePageLook(page)              -> { theme, onHome, ready }
```

`saveContentLook` upserts with `onConflict: 'id'` and sanitises **on the way in and on the way out**, so what comes back is a clean theme (`src/data/calendar.js:171-180`). `page` is sticky: it comes from the row, never from the payload.

Every mutation asserts on zero rows returned and throws `'No changes were saved — your account may not have admin access to change …'`, copying `assertSaved` (`src/data/calendar.js:132-137`). A refused write under RLS returns an **empty result, not an error**, so without this the toast would say success and nothing would change.

Both mutations invalidate `['content_looks', page]` **and** `['content_settings']` — the active look is a join of the two, so invalidating one leaves a stale pointer on screen.

`usePageLook(page)` is what the four public surfaces read. It never throws and never blocks: a failed query falls back to `sanitizeTheme(null, page)`, which is the current look exactly. A page that cannot load its theme must still render.

---

## 7. Tests

### 7.1 `api/_lib/contentTheme.test.js`

Copied from `calendarTheme.test.js`, which is the most thorough test in the repo and the reason the rule is mechanical rather than a thing to remember.

- `leafPaths(DEFAULT_THEME)` walks the **real** default shape, so the test cannot drift when a field is added.
- `describe('every DEFAULT_THEME field is covered')` generates, per leaf, a wrong-type test (must yield the default) and an out-of-range test (must yield a renderable theme). **Adding a key with no fallback fails this suite.**
- `sanitizeTheme` non-mutating (on a frozen input), idempotent, drops unknown keys.
- Hex tests: kept alongside the swatch id; idempotent for swatch-only, hex-only and both; rejects `'red'`, `'rgb(0,0,0)'`, `'#fff'`, `'#1234567'`, `'#000000;}'`, `'var(--color-ink)'`.
- Page-specific: `page: 'events'` forces `featured` to `'none'` and `card.image` away from `'none'`; `page: 'news'` leaves them alone.
- `themeVars`: every key starts `--`, every value a non-empty string with no `undefined`/`NaN`, never a token pointing at itself, references tokens rather than hexes so dark mode keeps working, survives a junk theme.

### 7.2 `src/data/contentLooks.test.js`

Modelled on `formLooks.test.js`. Writes go to `content_looks`, not `content_settings`; "Make live" writes `content_settings` and nothing else; `page` survives a payload that disagrees with it; the name is trimmed; a junk design is cleaned on write; a refused delete throws `/admin access/`; `usePageLook` falls back to the default on a failed query.

### 7.3 `src/lib/adminContentTabs.test.js`

Ids unique, the default is a real tab, every tab has a label, real ids pass through, and everything falls back — `undefined`, `null`, `''`, `'nope'`, `'LIST'`, `'list '`, `' list'`, `0`, `false`, `{}`, `['list']`. No mutation of the input.

### 7.4 `src/lib/iconFont.test.js`

Unchanged and still green, because §2 commits to adding no new symbol names.

---

## 8. Rollout

1. Migration + rollback.
2. `contentTheme.js` + its test. Pure; nothing depends on it yet.
3. `contentLooks.js` + its test.
4. `src/components/content/*` and the four call-site collapses. **At this point the site is visually identical** — the components render what the hand-written markup rendered.
5. `/news`, `/events`, both detail pages and Home read `usePageLook` with `on_home` false everywhere. Still identical.
6. The Design tab on both admin pages.
7. Turn a flag on, live it, look at it.

Steps 4 and 5 are separately reviewable on purpose: if the studio ever looks wrong in the preview, the components are already the ones the public page uses, so the preview is evidence rather than an illustration.

### Verification

`npm test`, `npm run lint` (exit 0, no new warnings), `npm run build`.

**Then, and this cannot be faked:** open the studio on a real admin account and look at the light preview, the dark preview, the phone-width preview, an events page with no images, a news page with no featured-worthy post, and a Home page with both flags off. Confirmation needs a Supabase login.

---

## 9. Known limits

- `events.tone` and `news.tone` are per-*item* accents. A page-level look cannot express them; they ride alongside it, unchanged. An admin wanting a different-coloured card on one event still gets exactly what they get today, and no more.
- A look is not versioned. Editing the live look edits it for everyone at once. The mitigation is "Save as new design", which is the same answer the other four studios give.
- `content_looks.design` is capped at 4000 bytes. The current shape is well under; if a sixth tab of controls ever does not fit, that cap is the thing to raise first.
- `/admin/banners` and this studio are two places to look for the top of the page. Deliberate (§1), and reversible later without a migration.