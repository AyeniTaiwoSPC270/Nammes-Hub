# News video preview length and repeat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner set how long a news card's video preview runs (2–30s) and whether it repeats, as a site-wide default plus a per-post override.

**Architecture:** Two nullable columns on `news` (NULL = inherit) and two on `content_settings` (the site default). The pure resolver in `src/lib/newsVideo.js` is the one judge: post value → site default → 3s / off, clamped 2–30. The card renders what the resolver returns; the admin form and the Design tab write what it reads.

**Tech Stack:** Plain JS/JSX, Tailwind v4, Supabase (Postgres + RLS), react-query, Vitest (no typecheck step in this repo).

**Spec:** `docs/superpowers/specs/2026-10-29-news-video-preview-timing-design.md`
**Branch:** `feat/news-preview-timing` (already checked out, stacked on `fix/news-video-touch-preview`)

---

### Task 1: Migration + fix the migration guard test

**Files:**
- Modify: `src/lib/newsVideo.test.js` (the `apply_change_request` guard block)
- Create: `supabase/migrations/20261029160000_news_video_preview_tuning.sql`

- [ ] **Step 1: Rewrite the guard block in `newsVideo.test.js` first (it must fail)**

Replace the whole `describe('apply_change_request knows about every news video column', …)` block with:

```js
// The review queue is the trap this whole feature could fall into: `apply_change_request` rewrites
// every column it names and sets the rest to NULL, so a media column added to `news` without being
// added here is a video that vanishes the first time a non-owner's edit is approved.
//
// It reads the LATEST matching migration on purpose. Two files now define the function, and the
// original version of this test took the FIRST match -- which after the second migration meant every
// assertion below kept passing against the stale copy nobody ships.
describe('apply_change_request knows about every news video column', () => {
  const VIDEO_COLUMNS = [
    'video_kind', 'video_url', 'video_preview', 'video_position', 'video_duration',
    'video_preview_seconds', 'video_loop',
  ]

  const newsBranch = (() => {
    const dir = 'supabase/migrations'
    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .sort() // readdir order is filesystem-defined; chronological name order is what "latest" means here
    const matches = files
      .map((name) => readFileSync(`${dir}/${name}`, 'utf8'))
      .filter((sql) => sql.includes('video_kind') && sql.includes('apply_change_request'))
    const migration = matches.at(-1)
    if (!migration) return null
    const start = migration.indexOf("req.entity_type = 'news'")
    const end = migration.indexOf("req.entity_type = 'events'")
    return start > -1 && end > start ? migration.slice(start, end) : null
  })()

  it('exists at all (otherwise every assertion below is vacuously true)', () => {
    expect(newsBranch).toBeTruthy()
  })

  it('writes all seven columns on insert', () => {
    const insert = newsBranch.slice(newsBranch.indexOf('insert into public.news'), newsBranch.indexOf('else'))
    for (const column of VIDEO_COLUMNS) expect(insert, column).toContain(column)
  })

  it('writes all seven columns on update, each guarded on the payload carrying it', () => {
    const update = newsBranch.slice(newsBranch.indexOf('update public.news'))
    for (const column of VIDEO_COLUMNS) {
      expect(update, column).toContain(`${column} = case when req.payload ? '${column}'`)
    }
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/newsVideo.test.js`
Expected: FAIL — "writes all seven columns on insert" (`video_preview_seconds` not found).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261029160000_news_video_preview_tuning.sql`:

```sql
-- A card preview gets a length and a loop: per post, or inherited from the site default.
-- NULL on `news` means "inherit", so changing the site default moves every post that has no opinion
-- of its own, and a post can still say "the site says loop, I don't" with an explicit false.
alter table public.news
  add column video_preview_seconds integer,
  add column video_loop boolean;

alter table public.news
  add constraint news_video_preview_seconds_check
    check (video_preview_seconds is null or video_preview_seconds between 2 and 30);

-- The site default: not null with a floor, so a hand-written update cannot leave it unusable, and the
-- same 2-30 range the per-post column carries -- one range, two places, enforced the same way.
alter table public.content_settings
  add column news_video_preview_seconds integer not null default 3
    check (news_video_preview_seconds between 2 and 30),
  add column news_video_loop boolean not null default false;

-- `apply_change_request` rewrites every column it names from the payload and NULLs the rest, so the
-- two new columns must be here. Copy the function verbatim from
-- 20261026140000_news_video.sql and make exactly these three edits:
--
-- 1. In the news INSERT column list, after `video_duration`, add:
--      video_preview_seconds, video_loop
-- 2. In the news INSERT values, after the video_duration line, add:
--      nullif(req.payload->>'video_preview_seconds', '')::int,
--      (req.payload->>'video_loop')::boolean
--    (absent key reads as NULL = inherit, which is correct for a new row)
-- 3. In the news UPDATE, after the video_duration line, add:
--      video_preview_seconds = case when req.payload ? 'video_preview_seconds'
--        then nullif(req.payload->>'video_preview_seconds', '')::int else video_preview_seconds end,
--      video_loop = case when req.payload ? 'video_loop'
--        then (req.payload->>'video_loop')::boolean else video_loop end
create or replace function public.apply_change_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
-- ... verbatim body from 20261026140000_news_video.sql, with the three edits above ...
$$;
```

The function body is copied whole from `20261026140000_news_video.sql` (lines from `declare` to `end; $$`),
because Postgres has no `alter function` for adding payload handling — only `create or replace`.

- [ ] **Step 4: Run the guard again**

Run: `npx vitest run src/lib/newsVideo.test.js`
Expected: PASS (7 columns found in insert and guarded in update).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261029160000_news_video_preview_tuning.sql src/lib/newsVideo.test.js
git commit -m "feat(news): add preview length and loop columns, and point the queue guard at the latest migration"
```

---

### Task 2: The resolver decides

**Files:**
- Modify: `src/lib/newsVideo.js`
- Test: `src/lib/newsVideo.test.js`

- [ ] **Step 1: Write the failing tests** — add to `src/lib/newsVideo.test.js`:

```js
describe('preview timing', () => {
  const row = { video_kind: 'file', video_url: BUCKET_URL, video_preview: 'tap', video_position: 'top' }

  it('prefers the post, then the site default, then 3 seconds', () => {
    expect(resolveVideo({ ...row, video_preview_seconds: 9 }, opts()).previewSeconds).toBe(9)
    expect(resolveVideo(row, { ...opts(), defaults: { seconds: 7 } }).previewSeconds).toBe(7)
    expect(resolveVideo(row, opts()).previewSeconds).toBe(3)
  })

  it('settles a value the check constraint would have rejected', () => {
    // A hand-edited row must not reach a renderer: out of range and non-integers fall through.
    for (const bad of [1, 31, 0, -5, 'six', 4.5]) {
      const v = resolveVideo({ ...row, video_preview_seconds: bad }, { ...opts(), defaults: { seconds: 7 } })
      expect(v.previewSeconds, String(bad)).toBe(7)
    }
  })

  it('clamps the inherited default too, then floors at the constant', () => {
    expect(resolveVideo(row, { ...opts(), defaults: { seconds: 99 } }).previewSeconds).toBe(30)
    expect(resolveVideo(row, { ...opts(), defaults: { seconds: 1 } }).previewSeconds).toBe(2)
    expect(resolveVideo(row, opts()).previewSeconds).toBe(3)
  })

  it('reads the loop tri-state: post wins, else the default, else off', () => {
    expect(resolveVideo({ ...row, video_loop: false }, { ...opts(), defaults: { loop: true } }).loop).toBe(false)
    expect(resolveVideo({ ...row, video_loop: true }, opts()).loop).toBe(true)
    expect(resolveVideo(row, { ...opts(), defaults: { loop: true } }).loop).toBe(true)
    expect(resolveVideo(row, opts()).loop).toBe(false)
    // A JSON payload delivers booleans, not strings -- a truthy "false" must not read as loop on.
    expect(resolveVideo({ ...row, video_loop: 'false' }, { ...opts(), defaults: { loop: true } }).loop).toBe(true)
  })
})
```

Also update the existing `returns a cleaned video for a valid uploaded file` expectation to include
`previewSeconds: 3, loop: false` (the resolver's return shape grows).

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/lib/newsVideo.test.js`
Expected: FAIL — `previewSeconds` is undefined.

- [ ] **Step 3: Implement in `src/lib/newsVideo.js`**

Near `PREVIEW_SECONDS`, which keeps its name and value but changes meaning from "the" preview length to
the fallback:

```js
// The fallback when neither the post nor the site has an opinion -- not "the" preview length any more.
export const PREVIEW_SECONDS = 3
export const MIN_PREVIEW_SECONDS = 2
export const MAX_PREVIEW_SECONDS = 30
```

Add, above `resolveVideo`:

```js
/**
 * How long this post's preview runs, and whether it repeats: the post's own answer when it has one,
 * the site default when it doesn't, 3 seconds / never as the floor. Settled here rather than in the
 * card, because the admin form, the card and the studio preview must never disagree about it.
 */
function cleanPreviewTiming(item, defaults) {
  const inRange = (value) => {
    const n = Number(value)
    // Number(null) is 0 and Number('') is 0, so blank and JSON null both settle away correctly.
    return Number.isInteger(n) && n >= MIN_PREVIEW_SECONDS && n <= MAX_PREVIEW_SECONDS ? n : null
  }
  const seconds = inRange(item?.video_preview_seconds)
    ?? inRange(defaults?.seconds)
    ?? PREVIEW_SECONDS
  const loop = typeof item?.video_loop === 'boolean' ? item.video_loop : defaults?.loop === true
  return { seconds, loop }
}
```

And in `resolveVideo`, change the signature to
`export function resolveVideo(item, { enabled = true, storageBase, defaults } = {})`, then in both the
`file` and `youtube` return branches add:

```js
    ...cleanPreviewTiming(item, defaults),
```

(YouTube gets the values too — harmless, and one shape for every consumer rather than two.)

- [ ] **Step 4: Run and pass**

Run: `npx vitest run src/lib/newsVideo.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/newsVideo.js src/lib/newsVideo.test.js
git commit -m "feat(news): settle preview length and loop in the resolver, post then site default then 3s"
```

---

### Task 3: The card obeys the resolver

**Files:**
- Modify: `src/data/news.js`
- Modify: `src/components/content/ContentCards.jsx`
- Test: `src/lib/newsVideo.test.js` (source scan)

- [ ] **Step 1: Write the failing source scan** — add to `src/lib/newsVideo.test.js`:

```js
// The card is where a preview is actually shown, and both settings die quietly if it reads the
// constant or forgets the loop attribute -- nothing else in the suite renders it.
describe('the card honours the per-post timing', () => {
  const cards = readFileSync('src/components/content/ContentCards.jsx', 'utf8')

  it('loops when the post says so', () => {
    expect(cards).toContain('loop={video.loop}')
  })

  it('counts down the row\'s own seconds and never the constant', () => {
    expect(cards).toContain('previewSeconds')
    expect(cards).not.toContain('PREVIEW_SECONDS')
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/lib/newsVideo.test.js`
Expected: FAIL on `loop={video.loop}`.

- [ ] **Step 3: Thread the site defaults through `src/data/news.js`**

```js
export function resolveNewsVideo(item, enabled = true, settings) {
  return resolveVideo(item, {
    enabled,
    storageBase: STORAGE_BASE,
    // The settings row uses the column names; the resolver uses the neutral words, so no other
    // surface has to know which table the default came from.
    defaults: settings
      ? { seconds: settings.news_video_preview_seconds, loop: settings.news_video_loop }
      : undefined,
  })
}
```

- [ ] **Step 4: Make `VideoOverlay` in `src/components/content/ContentCards.jsx` obey it**

- Drop `PREVIEW_SECONDS` from the import (the source scan asserts this).
- Read the defaults once per card, beside the existing flag read, in both `NewsCard` and
  `NewsFeatureCard`:

```js
  const settings = useContentSettingsQuery().data
  const video = resolveNewsVideo(item, videoEnabled, settings)
```

(`useContentSettingsQuery` from `../../data/contentLooks` — anon-readable, cached by react-query, so a
grid of twenty cards is one request.)

- Replace `armStop` with a loop-aware version and use it as the video's `onPlaying`:

```jsx
  // Armed by the video's own `onPlaying`: the preview is N seconds of PLAYING, not of mounting. With
  // repeat on there is no timer at all -- the stop triggers below are the whole rule, which is what
  // the owner chose over a looping cap that visibly restarts mid-read.
  const armStop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (video.loop) return
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setPlaying(false)
    }, video.previewSeconds * 1000)
  }, [video.loop, video.previewSeconds])
```

- The `<video>` gains `loop={video.loop}` (keep `onPlaying={armStop}`).
- The `auto` observer keeps watching while looping, and stops on exit — otherwise a card scrolled past
  keeps streaming a 30MB file with nothing on screen:

```jsx
  useEffect(() => {
    if (video.kind !== 'file' || video.preview !== 'auto') return undefined
    const node = bandRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting)
        if (visible) {
          // Once only for a timed preview; a looping one is meant to come back on every re-entry.
          if (startedRef.current && !video.loop) return
          startedRef.current = true
          startPreview()
        } else if (video.loop) {
          stopPreview()
        }
      },
      { threshold: 0.6 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [video.kind, video.preview, video.loop, startPreview, stopPreview])
```

`startPreview` must clear any armed countdown before `setPlaying(true)` (it already does).

- [ ] **Step 5: Run the scan, then the whole suite**

Run: `npx vitest run src/lib/newsVideo.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/news.js src/components/content/ContentCards.jsx src/lib/newsVideo.test.js
git commit -m "feat(news): preview length and repeat drive the card, with the loop stopping on scroll-out"
```

---

### Task 4: Per-post controls in the video panel

**Files:**
- Modify: `src/pages/admin/config/newsAdminConfig.js`
- Modify: `src/lib/adminFields.js`
- Modify: `src/components/admin/AdminResourceForm.jsx`
- Modify: `src/components/admin/VideoUploadField.jsx`
- Test: `src/lib/adminFields.test.js`

- [ ] **Step 1: Failing tests** — add to `src/lib/adminFields.test.js`:

```js
describe('the video field owns its timing columns', () => {
  const fields = [{
    field: 'video_url', type: 'video',
    kindField: 'video_kind', previewField: 'video_preview',
    positionField: 'video_position', durationField: 'video_duration',
    secondsField: 'video_preview_seconds', loopField: 'video_loop',
  }]
  const withVideo = {
    video_url: 'https://x.supabase.co/storage/v1/object/public/news-videos/a.mp4',
    video_kind: 'file', video_preview: 'tap', video_position: 'top', video_duration: '0:12',
    video_preview_seconds: '6', video_loop: '1',
  }

  it('emits a number and a boolean, and inherit for anything blank', () => {
    expect(buildPayload(fields, withVideo)).toMatchObject({ video_preview_seconds: 6, video_loop: true })
    expect(buildPayload(fields, { ...withVideo, video_preview_seconds: '', video_loop: '' }))
      .toMatchObject({ video_preview_seconds: null, video_loop: null })
    // Out of range degrades to inherit rather than failing the save -- the duration field's rule.
    expect(buildPayload(fields, { ...withVideo, video_preview_seconds: '99' }).video_preview_seconds).toBeNull()
  })

  it('nulls the timing columns with the rest when the video is cleared', () => {
    const payload = buildPayload(fields, { ...withVideo, video_url: '' })
    expect(payload.video_preview_seconds).toBeNull()
    expect(payload.video_loop).toBeNull()
  })

  it('seeds inherit for a new post and the stored answers for an edit', () => {
    expect(buildFormState(fields, null)).toMatchObject({ video_preview_seconds: '', video_loop: '' })
    expect(buildFormState(fields, { video_preview_seconds: 7 }).video_preview_seconds).toBe(7)
    expect(buildFormState(fields, { video_loop: false }).video_loop).toBe('0')
    expect(buildFormState(fields, { video_loop: true }).video_loop).toBe('1')
    expect(buildFormState(fields, { video_loop: null }).video_loop).toBe('')
  })
})
```

- [ ] **Step 2: Run and fail**

Run: `npx vitest run src/lib/adminFields.test.js`
Expected: FAIL — `video_preview_seconds` not in payload.

- [ ] **Step 3: Implement**

`src/pages/admin/config/newsAdminConfig.js` — add to the video field:

```js
      secondsField: 'video_preview_seconds',
      loopField: 'video_loop',
```

`src/lib/adminFields.js` — import `MIN_PREVIEW_SECONDS, MAX_PREVIEW_SECONDS` alongside the existing
`newsVideo.js` imports.

In `buildFormState`'s `f.type === 'video'` branch, after the duration line:

```js
      state[f.secondsField] = record?.[f.secondsField] ?? ''
      // Selects are strings in form state, so the tri-state is '' / '1' / '0' -- inherit, loop, once.
      state[f.loopField] = record?.[f.loopField] === true ? '1' : record?.[f.loopField] === false ? '0' : ''
```

In `buildPayload`'s `f.type === 'video'` branch: null both columns in the `if (!url)` path, and in the
else path add:

```js
        const seconds = Number(values[f.secondsField])
        payload[f.secondsField] =
          values[f.secondsField] === '' || values[f.secondsField] == null ||
          !Number.isInteger(seconds) || seconds < MIN_PREVIEW_SECONDS || seconds > MAX_PREVIEW_SECONDS
            ? null
            : seconds
        payload[f.loopField] = values[f.loopField] === '1' ? true : values[f.loopField] === '0' ? false : null
```

`src/components/admin/AdminResourceForm.jsx` — enable the settings query only for forms that have a
video field, then pass the values down.

`useContentSettingsQuery()` today takes no arguments, so it has to learn to accept react-query options
first — in `src/data/contentLooks.js`:

```js
export function useContentSettingsQuery(options = {}) {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchContentSettings, ...options })
}
```

(`enabled` is the only option ever passed; the key stays shared so every reader shares one cache entry.)

Then in the form:

```js
  // Only screens with a video field pay for this -- it feeds the "site default" hints.
  const settingsQuery = useContentSettingsQuery({
    enabled: config.fields.some((f) => f.type === 'video'),
  })
```

(in the `f.type === 'video'` branch:)

```jsx
          seconds={values[f.secondsField]}
          loop={values[f.loopField]}
          defaultSeconds={settingsQuery.data?.news_video_preview_seconds ?? 3}
          defaultLoop={settingsQuery.data?.news_video_loop === true}
```

plus in `onChange`: `if ('seconds' in patch) setField(f.secondsField, patch.seconds)` and
`if ('loop' in patch) setField(f.loopField, patch.loop)`. Import `useContentSettingsQuery` from
`../../data/contentLooks`.

`src/components/admin/VideoUploadField.jsx` — new props `seconds, loop, defaultSeconds, defaultLoop`.
Inside the existing `grid … sm:grid-cols-2` block, and only when `kind === 'file'`:

```jsx
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">
            Preview length
          </span>
          <input
            type="number"
            min={MIN_PREVIEW_SECONDS}
            max={MAX_PREVIEW_SECONDS}
            value={seconds}
            onChange={(e) => onChange({ seconds: e.target.value })}
            placeholder={`Site default (${defaultSeconds})`}
            className={controlClass}
          />
          <span className="text-xs text-ink-muted">
            Seconds, {MIN_PREVIEW_SECONDS}–{MAX_PREVIEW_SECONDS}. Blank uses the site default.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">Repeat</span>
          <select value={loop} onChange={(e) => onChange({ loop: e.target.value })} className={controlClass}>
            <option value="">Use site default ({defaultLoop ? 'repeat' : 'play once'})</option>
            <option value="1">Repeat until they leave</option>
            <option value="0">Play once</option>
          </select>
          <span className="text-xs text-ink-muted">Repeat overrides the length above.</span>
        </label>
```

with an inline warning under Preview length when the typed value is outside the range:

```jsx
          {seconds !== '' && (Number(seconds) < MIN_PREVIEW_SECONDS || Number(seconds) > MAX_PREVIEW_SECONDS) && (
            <span className="text-xs text-danger">
              Between {MIN_PREVIEW_SECONDS} and {MAX_PREVIEW_SECONDS} — anything else saves as “use site default”.
            </span>
          )}
```

Import `MIN_PREVIEW_SECONDS, MAX_PREVIEW_SECONDS` from `../../lib/newsVideo`.

- [ ] **Step 4: Run and pass**

Run: `npx vitest run src/lib/adminFields.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/config/newsAdminConfig.js src/lib/adminFields.js src/components/admin/AdminResourceForm.jsx src/components/admin/VideoUploadField.jsx src/lib/adminFields.test.js
git commit -m "feat(news): per-post preview length and repeat controls in the video panel"
```

---

### Task 5: The site default on the Design tab

**Files:**
- Modify: `src/data/contentLooks.js`
- Modify: `src/pages/admin/ContentDesign.jsx`
- Test: `src/data/contentLooks.test.js`

- [ ] **Step 1: Failing test** — add to `src/data/contentLooks.test.js`:

```js
it('builds the news video preview default patch, cleaned and range-checked', () => {
  expect(newsVideoPatch({ seconds: 6, loop: true })).toEqual({
    news_video_preview_seconds: 6,
    news_video_loop: true,
  })
  expect(newsVideoPatch({ seconds: 6 })).toEqual({ news_video_preview_seconds: 6 })
  expect(newsVideoPatch({ loop: false })).toEqual({ news_video_loop: false })
  expect(newsVideoPatch({})).toEqual({})
  expect(() => newsVideoPatch({ seconds: 99 })).toThrow(/2/)
  expect(() => newsVideoPatch({ seconds: 'six' })).toThrow(/2/)
})
```

- [ ] **Step 2: Run and fail**

Run: `npx vitest run src/data/contentLooks.test.js`
Expected: FAIL — `newsVideoPatch is not a function`.

- [ ] **Step 3: Implement in `src/data/contentLooks.js`**

Add both columns to `SETTINGS_FIELDS`:

```js
const SETTINGS_FIELDS = [
  'events_look_id', 'news_look_id', 'events_on_home', 'news_on_home',
  'news_video_preview_seconds', 'news_video_loop',
]
```

Beside `lookOnHomePatch`:

```js
/**
 * The news video preview defaults: how long a card preview runs and whether it repeats, for every
 * post that has no answer of its own. Range-checked here rather than only by the column's check
 * constraint, because the admin should be told what is wrong instead of the database.
 */
export function newsVideoPatch({ seconds, loop } = {}) {
  const patch = {}
  if (seconds !== undefined) {
    const n = Number(seconds)
    if (!Number.isInteger(n) || n < MIN_PREVIEW_SECONDS || n > MAX_PREVIEW_SECONDS) {
      throw new Error(`Preview length must be a whole number of seconds between ${MIN_PREVIEW_SECONDS} and ${MAX_PREVIEW_SECONDS}.`)
    }
    patch.news_video_preview_seconds = n
  }
  if (loop !== undefined) patch.news_video_loop = loop === true
  return patch
}
```

Import `MIN_PREVIEW_SECONDS, MAX_PREVIEW_SECONDS` from `../lib/newsVideo`.

- [ ] **Step 4: Run and pass**

Run: `npx vitest run src/data/contentLooks.test.js`
Expected: PASS.

- [ ] **Step 5: The controls in `src/pages/admin/ContentDesign.jsx`**

- Import `useNewsVideoFlag` from `../../data/news` and `newsVideoPatch` from `../../data/contentLooks`.
- Read `const videoEnabled = useNewsVideoFlag()` beside the other queries.
- Seed a local draft (the settings row arrives asynchronously, so the input owns its text until blur):

```js
  const [secondsDraft, setSecondsDraft] = useState(null) // null = not edited yet, so show the stored value
  const storedSeconds = settings?.news_video_preview_seconds ?? 3
  const loopDefault = settings?.news_video_loop === true

  function saveSeconds() {
    if (settingsMutation.isPending || secondsDraft === null) return
    if (Number(secondsDraft) === storedSeconds) { setSecondsDraft(null); return }
    settingsMutation.mutate(newsVideoPatch({ seconds: Number(secondsDraft) }), {
      onSuccess: () => { setSecondsDraft(null); toast.success('Preview length default saved.') },
      onError: (error) => toast.error(error.message),
    })
  }

  function toggleLoopDefault(next) {
    if (settingsMutation.isPending) return
    settingsMutation.mutate(newsVideoPatch({ loop: next }), {
      onSuccess: () => toast.success(next ? 'Previews now repeat by default.' : 'Previews now play once by default.'),
      onError: (error) => toast.error(error.message),
    })
  }
```

- Render directly after the `onHome` `Toggle` block, inside the same rounded container, and only for
  news with the flag on (events has no video):

```jsx
              {page === 'news' && videoEnabled && (
                <div className="flex flex-col gap-3 border-t border-hairline pt-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Video preview defaults</p>
                    <p className="text-xs text-ink-muted">
                      Applies to every news video that has no override of its own.
                    </p>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">
                      Preview length
                    </span>
                    <input
                      type="number"
                      min={MIN_PREVIEW_SECONDS}
                      max={MAX_PREVIEW_SECONDS}
                      value={secondsDraft ?? String(storedSeconds)}
                      onChange={(e) => setSecondsDraft(e.target.value)}
                      onBlur={saveSeconds}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveSeconds() } }}
                      className="min-h-10 rounded-md border border-hairline bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
                    />
                    <span className="text-xs text-ink-muted">
                      Seconds, {MIN_PREVIEW_SECONDS}–{MAX_PREVIEW_SECONDS}. Saved when you leave the box.
                    </span>
                  </label>
                  <Toggle
                    checked={loopDefault}
                    onChange={toggleLoopDefault}
                    label="Repeat the preview"
                    description="Repeats until the reader leaves the card."
                  />
                </div>
              )}
```

Import `MIN_PREVIEW_SECONDS, MAX_PREVIEW_SECONDS` from `../../lib/newsVideo`.

- [ ] **Step 6: Commit**

```bash
git add src/data/contentLooks.js src/data/contentLooks.test.js src/pages/admin/ContentDesign.jsx
git commit -m "feat(news): site-wide preview length and repeat defaults on the news Design tab"
```

---

### Task 6: Full verification

- [ ] **Step 1: The whole suite**

Run: `npm test 2>&1 | grep -E "Test Files|Tests |FAIL"`
Expected: all files pass, no FAIL lines.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: exit 0, 0 errors; warnings must not exceed the pre-existing 82.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit anything outstanding, then code review the diff**

```bash
git status --short
git diff origin/fix/news-video-touch-preview...HEAD --stat
```

Review the full diff against the spec, fix findings, re-run Steps 1–3, then push and open the PR
stacked on `fix/news-video-touch-preview`.
